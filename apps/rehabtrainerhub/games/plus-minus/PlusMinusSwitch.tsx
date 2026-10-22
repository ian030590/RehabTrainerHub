import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceFeedbackMs, rangeSettings, ValidateSettings, type PlusMinusSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { PlusMinusTutorial } from './rules/PlusMinusTutorial';
import { conditions, CreatePlusMinusItems, CreateRandom, ExpectedAnswer, maxDigits, type PlusMinusItem } from './logic/plusMinus';
import type { PlusMinusRow } from './logic/plusMinusScore';
import { NumberPad, RuleLabel } from './NumberPad';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'ready' | 'intro' | 'item' | 'feedback';
interface Controls { begin(): void; digit(value: string): void; back(): void; submit(): void; enter(): void }

function IntroText(condition: number, en: boolean) {
  return en ? ['Copy each number exactly as it appears, to get used to the keys.', 'In this list, add 3 to every number.', 'In this list, subtract 3 from every number.',
    'In this list, add 3 and subtract 3 in turn, starting with add. For 27, 13, 40 the answers are 30, 10, 43.'][condition + 1]
    : ['先照抄數字：看到什麼就輸入什麼，熟悉按鍵。', '這一段：每個數字加 3。', '這一段：每個數字減 3。', '這一段：加 3、減 3 輪流，第一個先加。例如 27、13、40，要答 30、10、43。'][condition + 1];
}

export function PlusMinusSwitch() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<PlusMinusSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<PlusMinusRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [item, setItem] = useState<PlusMinusItem | null>(null);
  const [step, setStep] = useState<Step>('ready');
  const [entry, setEntry] = useState('');
  const [lastResult, setLastResult] = useState<{ correct: boolean; expected: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const numberRef = useRef<HTMLParagraphElement>(null);
  const beginRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopRunRef.current?.();
    stopRunRef.current = null;
    controlsRef.current = null;
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      const controls = controlsRef.current;
      if (!controls || event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); controls.digit(event.key); }
      else if (event.key === 'Backspace') { event.preventDefault(); controls.back(); }
      // Buttons answer Enter themselves; elsewhere Enter starts a list or submits.
      else if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON' && !event.repeat) { event.preventDefault(); controls.enter(); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  // Start has focus on each rule screen; once numbers come, focus leaves the keys free for typing.
  useEffect(() => {
    if (phase !== 'running') return;
    if (step === 'intro') beginRef.current?.focus();
    if (step === 'item' && document.activeElement === beginRef.current) (document.activeElement as HTMLElement).blur();
  }, [phase, step, item]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const items = CreatePlusMinusItems(settings, CreateRandom(Date.now()));
    const allRows: PlusMinusRow[] = [];
    const timers = new Set<number>();
    let stopped = false, index = 0, current: Step = 'ready', typed = '', onset = 0;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
    };
    const stop = () => { stopped = true; for (const timer of timers) window.clearTimeout(timer); timers.clear(); };
    stopRunRef.current = stop;
    const go = (next: Step) => { current = next; setStep(next); };
    const update = (next: string) => { typed = next; setEntry(next); };
    // The number changes outside React so the answer time starts on the frame it appears.
    const show = (value: number | null) => {
      if (numberRef.current) numberRef.current.textContent = value === null ? '' : String(value);
      if (value !== null) onset = performance.now();
    };
    const finish = () => {
      stop();
      controlsRef.current = null;
      const score = BuildGameScore(allRows, settings);
      jsPsychLifecycleRef.current?.finish({ trials: score.summary.trials, accuracy: score.summary.accuracy });
      PlayGameEndSound('Victory');
      setRows([...allRows]);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    const present = (next: number) => {
      index = next;
      const nextItem = items[next];
      update('');
      setLastResult(null);
      setItem(nextItem);
      if (nextItem.question === 1) { show(null); go('intro'); return; }
      go('item');
      show(nextItem.number);
    };
    const advance = () => index + 1 < items.length ? present(index + 1) : finish();
    const controls: Controls = {
      begin: () => { if (current !== 'intro') return; go('item'); show(items[index].number); },
      digit: value => { if (current === 'item' && typed.length < maxDigits) update(typed + value); },
      back: () => { if (current === 'item') update(typed.slice(0, -1)); },
      submit: () => {
        if (current !== 'item' || !typed) return;
        const shown = items[index];
        const expected = ExpectedAnswer(shown);
        const response = Number(typed);
        allRows.push({ trial: allRows.length + 1, question: shown.question, practice: shown.condition === -1, condition: shown.condition, number: shown.number,
          response, correct: response === expected, rtMs: Math.round(performance.now() - onset) });
        if (shown.condition !== -1) { advance(); return; }
        setLastResult({ correct: response === expected, expected });
        go('feedback');
        later(advance, practiceFeedbackMs);
      },
      enter: () => { if (current === 'intro') controls.begin(); else if (current === 'item') controls.submit(); },
    };
    controlsRef.current = controls;
    setItem(null);
    setStep('ready');
    setEntry('');
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:plus-minus', onStart: () => later(() => present(0), leadInMs) });
    return () => {
      stop();
      controlsRef.current = null;
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    SendGameEvent('active');
    setPhase('running');
  };

  const duration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const parts = en ? [minutes && `${minutes} min`, rest && `${rest} s`] : [minutes && `${minutes} 分`, rest && `${rest} 秒`];
    return `${en ? 'about' : '約'} ${parts.filter(Boolean).join(' ')}`;
  };
  const unit = (field: typeof rangeSettings[number]) => en ? (field.unitEn ? ` ${field.unitEn}` : '') : ` ${field.unitZh}`;
  const hints: Record<string, string> = en ? {
    itemsPerList: 'Numbers in each of the three lists: add 3, subtract 3, then the two in turn.',
    practice: 'Copy 15 numbers first to get used to the keys. They are saved but left out of the results.',
  } : {
    itemsPerList: '三段（加 3、減 3、輪流）各有幾個數字。',
    practice: '正式開始前先照抄 15 個數字熟悉按鍵。練習會保存，但不列入成果統計。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? 'Yes, copy 15 numbers' : '是，照抄 15 個') : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const listLength = item?.condition === -1 ? 15 : settings.itemsPerList;
  const listNumber = item ? item.condition + 1 : 0;
  const progressLabel = !item || step === 'ready' ? (en ? 'Get ready' : '準備開始') : item.condition === -1
    ? (en ? `Practice ${item.question} of ${listLength}` : `練習 ${item.question}／${listLength}`)
    : en ? `List ${listNumber} · ${item.question} of ${listLength}` : `第 ${listNumber} 段 ${item.question}／${listLength}`;
  const progress = !item || step === 'ready' || step === 'intro' ? 0 : item.question / listLength * 100;
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const seconds = (value: number | null) => value === null ? missing : `${(value / 1000).toFixed(2)} ${en ? 's' : '秒'}`;
  const signedSeconds = (value: number | null) => value === null ? missing : `${value > 0 ? '+' : ''}${(value / 1000).toFixed(2)} ${en ? 's' : '秒'}`;
  const perList = conditions.map(condition => {
    const list = rows.filter(row => row.condition === condition);
    return { condition, correct: list.filter(row => row.correct).length, count: list.length };
  });
  return <div ref={rootRef} className="plus-minus-game-root">
    <div ref={jsPsychHostRef} className="pm-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <PlusMinusTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog plus-minus-phase-menu" aria-labelledby="pm-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="pm-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="pm-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="pm-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="pm-stage pm-running" data-state={step} aria-label={title}>
      <header className="pm-hud">
        <p className="pm-progress-label">{progressLabel}</p>
        <p className="pm-rule">{item ? RuleLabel(item.condition, en) : ''}</p>
        <div className="pm-progress-track"><div className="pm-progress-fill" style={{ width: `${progress}%` }} /></div>
        <button type="button" className="btn btn-ghost pm-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="pm-display">
        <p ref={numberRef} className="pm-number" aria-live="off" />
        {step === 'intro' && item && <div className="pm-message-group">
          <p className="pm-message">{IntroText(item.condition, en)}</p>
          {item.condition >= 0 && <p className="pm-message-note">{en ? 'Go as quickly and accurately as you can.' : '盡量又快又正確。'}</p>}
          <button ref={beginRef} type="button" className="btn btn-primary pm-begin" onClick={() => controlsRef.current?.begin()}>{en ? 'Start' : '開始'}</button>
        </div>}
        {step === 'feedback' && lastResult && <p className="pm-feedback" role="status" data-result={lastResult.correct ? 'correct' : 'wrong'}>
          {lastResult.correct ? '✓' : en ? `It was ${lastResult.expected}` : `應為 ${lastResult.expected}`}</p>}
      </div>
      <div className="pm-answer-area">
        <p className="pm-entry" data-filled={entry ? true : undefined} aria-label={en ? 'Your answer' : '你的答案'}>{entry}</p>
        <NumberPad en={en} active={step === 'item'} full={entry.length >= maxDigits} empty={!entry}
          onDigit={value => controlsRef.current?.digit(value)} onBack={() => controlsRef.current?.back()} onSubmit={() => controlsRef.current?.submit()} />
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Correct answers' : '正確率'}</p><strong>{summary.accuracy === null ? missing : `${summary.accuracy}%`}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Extra time when alternating' : '輪流時每個多花'}</p><strong>{signedSeconds(summary.switchCostMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean time per number' : '每個數字平均時間'}</p><strong>{seconds(summary.meanResponseMs)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(entryItem => <div className="score-context-item" key={entryItem.label}><dt>{entryItem.label}</dt><dd>{entryItem.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Correct' : '答對'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        {perList.map(list => <div className="score-context-item" key={list.condition}><dt>{RuleLabel(list.condition, en)}</dt>
          <dd>{seconds([summary.addMs, summary.subtractMs, summary.alternateMs][list.condition])}{en ? ' each' : '／個'} · {list.correct} / {list.count}</dd></div>)}
      </dl>
        <p className="score-note">{en ? 'Times run from when a number appears to Submit and include wrong answers. Extra time when alternating is the alternating list minus the average of the add and subtract lists. Practice is listed below but not counted here.'
          : '時間從數字出現算到按下送出，包含答錯的題目。輪流時每個多花的時間＝輪流段平均時間減去加 3、減 3 兩段的平均。練習列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, practiceFeedbackMs, rangeSettings, ValidateSettings, type LetterMemorySettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { LetterMemoryTutorial } from './rules/LetterMemoryTutorial';
import { CreateLetterMemoryBlocks, CreateLetterSchedule, CreateRandom, ExpectedLetters, lengths, recallCount, ScoreLetters, type LetterMemoryBlock } from './logic/letterMemory';
import type { LetterMemoryRow } from './logic/letterMemoryScore';
import { LetterEntry, LetterPad } from './LetterPad';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'ready' | 'prompt' | 'stream' | 'answer' | 'feedback';
interface Controls { ready(): void; type(letter: string): void; back(): void; clear(): void; submit(): void; enter(): void }

export function LetterMemoryRecall() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<LetterMemorySettings>({ ...defaultSettings });
  const [rows, setRows] = useState<LetterMemoryRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [blocks, setBlocks] = useState<LetterMemoryBlock[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [step, setStep] = useState<Step>('ready');
  const [entry, setEntry] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ correct: boolean; expected: string[] } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const letterRef = useRef<HTMLParagraphElement>(null);
  const readyRef = useRef<HTMLButtonElement>(null);
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
      if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); controls.type(event.key.toUpperCase()); }
      else if (event.key === 'Backspace') { event.preventDefault(); controls.back(); }
      // Buttons answer Enter themselves; elsewhere Enter starts the letters or submits.
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
  // Start has focus so Enter or Space begins the letters; while answering, focus leaves the keypad free for typing.
  useEffect(() => {
    if (phase !== 'running') return;
    if (step === 'prompt') readyRef.current?.focus();
    if (step === 'answer') (document.activeElement as HTMLElement | null)?.blur();
  }, [phase, step, blockIndex]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const plan = CreateLetterMemoryBlocks(settings, CreateRandom(Date.now()));
    const allRows: LetterMemoryRow[] = [];
    const timers = new Set<number>();
    let stopped = false, index = 0, current: Step = 'ready', typed: string[] = [], onset = 0;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
    };
    const stop = () => { stopped = true; for (const timer of timers) window.clearTimeout(timer); timers.clear(); };
    stopRunRef.current = stop;
    const go = (next: Step) => { current = next; setStep(next); };
    // Letters change outside React so each one appears on the frame it is due.
    const show = (letterIndex: number | null) => {
      const element = letterRef.current;
      if (!element) return;
      element.textContent = letterIndex === null ? '' : plan[index].letters[letterIndex];
      if (letterIndex === null) delete element.dataset.index; else element.dataset.index = String(letterIndex);
    };
    const update = (next: string[]) => { typed = next; setEntry(next); };
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
    const openBlock = (next: number) => {
      index = next;
      update([]);
      setBlockIndex(next);
      setLastResult(null);
      show(null);
      go('prompt');
    };
    const advance = () => index + 1 < plan.length ? openBlock(index + 1) : finish();
    const controls: Controls = {
      ready: () => {
        if (current !== 'prompt') return;
        go('stream');
        const schedule = CreateLetterSchedule(plan[index].letters.length, settings.itemExposureMs);
        for (const event of schedule.events) later(() => show(event.index), event.at);
        later(() => { show(null); onset = performance.now(); go('answer'); }, schedule.answerAt);
      },
      type: letter => { if (current === 'answer' && typed.length < recallCount) update([...typed, letter]); },
      back: () => { if (current === 'answer') update(typed.slice(0, -1)); },
      clear: () => { if (current === 'answer') update([]); },
      submit: () => {
        if (current !== 'answer' || typed.length !== recallCount) return;
        const block = plan[index];
        const result = ScoreLetters(block.letters, typed);
        allRows.push({ trial: allRows.length + 1, practice: block.practice, length: block.letters.length, correctItems: result.correctItems,
          requiredItems: result.requiredItems, rtMs: Math.round(performance.now() - onset) });
        if (!block.practice) { advance(); return; }
        setLastResult({ correct: result.correct, expected: ExpectedLetters(block.letters) });
        go('feedback');
        later(advance, practiceFeedbackMs);
      },
      enter: () => { if (current === 'prompt') controls.ready(); else if (current === 'answer') controls.submit(); },
    };
    controlsRef.current = controls;
    setBlocks(plan);
    setBlockIndex(0);
    setStep('ready');
    setEntry([]);
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:letter-memory', onStart: () => later(() => openBlock(0), leadInMs) });
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
    itemExposureMs: 'How long each letter stays on screen. Shorter is harder.',
    rounds: 'Sequences that count toward the results. Lengths of 5, 7, 9 and 11 letters come in mixed order.',
    practice: 'Two practice sequences of 5 and 7 letters come first and show the right answer. They are saved but left out of the results.',
  } : {
    itemExposureMs: '每個字母停留在畫面上的時間，越短越難。',
    rounds: '計入成果的題數。每題 5、7、9 或 11 個字母，順序打亂。',
    practice: '正式開始前先做 5 個與 7 個字母的練習各 1 題，會顯示正確答案。練習會保存，但不列入成果統計。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? 'Yes, 2 sequences' : '是，2 題') : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const block = blocks[blockIndex];
  const practiceCount = blocks.filter(item => item.practice).length;
  const countedTotal = blocks.length - practiceCount;
  const number = block?.practice ? blockIndex + 1 : blockIndex - practiceCount + 1;
  const total = block?.practice ? practiceCount : countedTotal;
  const progressLabel = !block || step === 'ready' ? (en ? 'Get ready' : '準備開始') : block.practice ? (en ? `Practice ${number} of ${total}` : `練習 ${number}／${total}`)
    : en ? `Item ${number} of ${total}` : `第 ${number} 題，共 ${total} 題`;
  const progress = !block || step === 'ready' ? 0 : number / total * 100;
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const byLength = lengths.map(length => {
    const counted = rows.filter(row => !row.practice && row.length === length);
    return { length, counted, correct: counted.filter(row => row.correctItems === row.requiredItems).length };
  }).filter(item => item.counted.length);
  return <div ref={rootRef} className="letter-memory-game-root">
    <div ref={jsPsychHostRef} className="lm-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <LetterMemoryTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog letter-memory-phase-menu" aria-labelledby="lm-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="lm-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="lm-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="lm-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="lm-stage lm-running" data-state={step} aria-label={title}>
      <header className="lm-hud">
        <p className="lm-progress-label">{progressLabel}</p>
        <div className="lm-progress-track"><div className="lm-progress-fill" style={{ width: `${progress}%` }} /></div>
        <button type="button" className="btn btn-ghost lm-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="lm-display">
        <p ref={letterRef} className="lm-letter" aria-hidden="true" />
        {step === 'prompt' && <div className="lm-message-group">
          <p className="lm-message">{en ? 'Keep the latest four letters in mind.' : '請一直記住最新的 4 個字母。'}</p>
          <button ref={readyRef} type="button" className="btn btn-primary lm-ready" onClick={() => controlsRef.current?.ready()}>{en ? 'Start' : '開始'}</button>
        </div>}
        {step === 'answer' && <p className="lm-message" role="status">{en ? 'Enter the last four letters in order.' : '照順序輸入最後 4 個字母。'}</p>}
        {step === 'feedback' && lastResult && <p className="lm-feedback" role="status" data-result={lastResult.correct ? 'correct' : 'wrong'}>
          {lastResult.correct ? (en ? 'Correct' : '答對了') : en ? `Not quite. The last four were ${lastResult.expected.join(' ')}.` : `不對，最後 4 個是 ${lastResult.expected.join(' ')}。`}</p>}
      </div>
      <div className="lm-answer-area">
        <LetterEntry entry={entry} en={en} />
        <LetterPad en={en} active={step === 'answer'} full={entry.length >= recallCount}
          onLetter={letter => controlsRef.current?.type(letter)} onBack={() => controlsRef.current?.back()} onClear={() => controlsRef.current?.clear()} />
        <footer className="lm-actions">
          <button type="button" className="btn btn-primary lm-submit" disabled={step !== 'answer' || entry.length !== recallCount} onClick={() => controlsRef.current?.submit()}>{en ? 'Submit' : '送出答案'}</button>
        </footer>
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'All four right' : '4 個全對'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Letters right' : '字母答對'}</p><strong>{percent(summary.itemAccuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean answer time' : '平均作答時間'}</p><strong>{summary.meanResponseMs === null ? missing : `${(summary.meanResponseMs / 1000).toFixed(1)} ${en ? 's' : '秒'}`}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Answers all right' : '全對題數'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Letters right' : '答對字母'}</dt><dd>{summary.correctItems} / {summary.requiredItems}</dd></div>
        {byLength.map(item => <div className="score-context-item" key={item.length}><dt>{en ? `All right, ${item.length} letters` : `${item.length} 個字母時全對`}</dt>
          <dd>{item.correct} / {item.counted.length}</dd></div>)}
      </dl>
        <p className="score-note">{en ? 'A letter counts when it is in its right place. Answer time runs from the last letter to Submit. Practice is listed below but not counted here.'
          : '字母在正確位置才算答對。作答時間從最後一個字母結束算到按下送出。練習題列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, EstimatedSeconds, leadInMs, rangeSettings, ValidateSettings, type KeepTrackSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { KeepTrackTutorial } from './rules/KeepTrackTutorial';
import { CreateKeepTrackBlocks, CreateRandom, CreateWordSchedule, LastWords, loads, ScoreAnswer, wordLabels, type Category, type KeepTrackBlock } from './logic/keepTrack';
import type { KeepTrackRow } from './logic/keepTrackScore';
import { AnswerRows } from './AnswerRows';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayGameEndSound, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'ready' | 'prompt' | 'stream' | 'answer' | 'feedback';
interface Controls { ready(): void; choose(category: Category, word: string): void; submit(): void; next(): void; enter(): void }

export function KeepTrackRecall() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<KeepTrackSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<KeepTrackRow[]>([]);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [blocks, setBlocks] = useState<KeepTrackBlock[]>([]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [step, setStep] = useState<Step>('ready');
  const [choices, setChoices] = useState<Partial<Record<Category, string>>>({});
  const [lastResult, setLastResult] = useState<{ correctItems: number; requiredItems: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const controlsRef = useRef<Controls | null>(null);
  const stopRunRef = useRef<(() => void) | null>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

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
      // Buttons answer Enter themselves; elsewhere Enter moves on: start the words, submit, or continue after practice.
      if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON' && !event.repeat) {
        event.preventDefault();
        controlsRef.current?.enter();
      }
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
  // Keyboard players land on the control the step needs: start, the first word, or continue.
  useEffect(() => {
    if (phase !== 'running') return;
    if (step === 'prompt' || step === 'feedback') actionRef.current?.focus();
    if (step === 'answer') stageRef.current?.querySelector<HTMLButtonElement>('.kt-option')?.focus();
  }, [phase, step, blockIndex]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const plan = CreateKeepTrackBlocks(settings, CreateRandom(Date.now()));
    const allRows: KeepTrackRow[] = [];
    const timers = new Set<number>();
    let stopped = false, index = 0, current: Step = 'ready', picked: Partial<Record<Category, string>> = {}, onset = 0;
    const later = (callback: () => void, ms: number) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) callback(); }, ms);
      timers.add(timer);
    };
    const stop = () => { stopped = true; for (const timer of timers) window.clearTimeout(timer); timers.clear(); };
    stopRunRef.current = stop;
    const go = (next: Step) => { current = next; setStep(next); };
    // Words change outside React so each one appears on the frame it is due.
    const show = (wordIndex: number | null) => {
      const element = wordRef.current;
      if (!element) return;
      const word = wordIndex === null ? null : plan[index].words[wordIndex].word;
      element.textContent = word ? wordLabels[word][enRef.current ? 'en' : 'zh'] : '';
      if (wordIndex === null) delete element.dataset.index; else element.dataset.index = String(wordIndex);
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
    const openBlock = (next: number) => {
      index = next;
      picked = {};
      setBlockIndex(next);
      setChoices({});
      setLastResult(null);
      show(null);
      go('prompt');
    };
    const advance = () => index + 1 < plan.length ? openBlock(index + 1) : finish();
    controlsRef.current = {
      ready: () => {
        if (current !== 'prompt') return;
        go('stream');
        const schedule = CreateWordSchedule(plan[index].words.length, settings.itemExposureMs);
        for (const event of schedule.events) later(() => show(event.index), event.at);
        later(() => { show(null); onset = performance.now(); go('answer'); }, schedule.answerAt);
      },
      choose: (category, word) => {
        if (current !== 'answer') return;
        picked = { ...picked, [category]: word };
        setChoices(picked);
      },
      submit: () => {
        const block = plan[index];
        if (current !== 'answer' || !block.targets.every(target => picked[target])) return;
        const result = ScoreAnswer(block, picked);
        allRows.push({ trial: allRows.length + 1, practice: block.practice, load: block.load, correctItems: result.correctItems,
          requiredItems: result.requiredItems, rtMs: Math.round(performance.now() - onset) });
        if (block.practice) { setLastResult(result); go('feedback'); return; }
        advance();
      },
      next: () => { if (current === 'feedback') advance(); },
      enter: () => {
        const controls = controlsRef.current;
        if (current === 'prompt') controls?.ready();
        else if (current === 'answer') controls?.submit();
        else if (current === 'feedback') controls?.next();
      },
    };
    setBlocks(plan);
    setBlockIndex(0);
    setStep('ready');
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:keep-track', onStart: () => later(() => openBlock(0), leadInMs) });
    return () => {
      stop();
      if (controlsRef.current) controlsRef.current = null;
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
    itemExposureMs: 'How long each word stays on screen. Shorter is harder.',
    rounds: 'Blocks that count toward the results. Blocks with 3, 4 and 5 target categories come equally often.',
    practice: 'One practice block with 3 targets comes first and shows the right answers. It is saved but left out of the results.',
  } : {
    itemExposureMs: '每個詞停留在畫面上的時間，越短越難。',
    rounds: '計入成果的組數。要記 3、4、5 個類別的組數各占三分之一。',
    practice: '正式開始前先做 1 組 3 個類別的練習，送出後會顯示正確答案。練習會保存，但不列入成果統計。',
  };
  const summaryItems = [
    ...rangeSettings.map(field => ({ label: en ? field.en : field.zh, value: `${settings[field.key]}${unit(field)}` })),
    { label: en ? 'Practice first' : '先練習', value: settings.practice ? (en ? 'Yes, 1 block' : '是，1 組') : (en ? 'No' : '否') },
    { label: en ? 'Estimated time' : '預估時間', value: duration(EstimatedSeconds(settings)) },
  ];
  const block = blocks[blockIndex];
  const practiceCount = blocks.filter(item => item.practice).length;
  const countedTotal = blocks.length - practiceCount;
  const countedNumber = blockIndex - practiceCount + 1;
  const progressLabel = !block || step === 'ready' ? (en ? 'Get ready' : '準備開始') : block.practice ? (en ? 'Practice block' : '練習組')
    : en ? `Block ${countedNumber} of ${countedTotal}` : `第 ${countedNumber} 組，共 ${countedTotal} 組`;
  const progress = !block || step === 'ready' ? 0 : block.practice ? 100 : countedNumber / countedTotal * 100;
  const pickedCount = block ? block.targets.filter(target => choices[target]).length : 0;
  const complete = Boolean(block) && pickedCount === block.targets.length;
  const score = BuildGameScore(rows, settings);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const byLoad = loads.map(load => {
    const counted = rows.filter(row => !row.practice && row.load === load);
    return { load, counted, correct: counted.reduce((sum, row) => sum + row.correctItems, 0), required: counted.reduce((sum, row) => sum + row.requiredItems, 0) };
  }).filter(item => item.counted.length);
  return <div ref={rootRef} className="keep-track-game-root">
    <div ref={jsPsychHostRef} className="kt-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <KeepTrackTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog keep-track-phase-menu" aria-labelledby="kt-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="kt-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            {rangeSettings.map(field => <label key={field.key}>{en ? field.en : field.zh}：<output>{settings[field.key]}{unit(field)}</output>
              <input name={field.key} type="range" min={field.min} max={field.max} step={field.step} value={settings[field.key]}
                onChange={event => setSettings({ ...settings, [field.key]: Number(event.target.value) })} />
              <small className="training-setting-description">{hints[field.key]}</small></label>)}
            <label className="kt-checkbox"><input name="practice" type="checkbox" checked={settings.practice}
              onChange={event => setSettings({ ...settings, practice: event.target.checked })} />{en ? 'Practice first' : '先練習'}
              <small className="training-setting-description">{hints.practice}</small></label>
            <p className="kt-estimate">{en ? 'Estimated time' : '預估時間'}：{duration(EstimatedSeconds(settings))}</p>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main ref={stageRef} className="kt-stage kt-running" data-state={step} aria-label={title}>
      <header className="kt-hud">
        <p className="kt-progress-label">{progressLabel}</p>
        <div className="kt-progress-track"><div className="kt-progress-fill" style={{ width: `${progress}%` }} /></div>
        <button type="button" className="btn btn-ghost kt-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="kt-display">
        <p ref={wordRef} className="kt-word" aria-hidden="true" />
        {step === 'prompt' && <div className="kt-message-group">
          <p className="kt-message">{en ? 'Remember the latest word from each category below.' : '記住下面每個類別最新出現的詞。'}</p>
          <button ref={actionRef} type="button" className="btn btn-primary kt-ready" onClick={() => controlsRef.current?.ready()}>{en ? 'Got them, start' : '記住了，開始'}</button>
        </div>}
        {step === 'answer' && <p className="kt-message" role="status">{en ? `Pick the last word in each category (${pickedCount} of ${block?.targets.length ?? 0} picked).`
          : `每個類別選出最後出現的詞（已選 ${pickedCount}／${block?.targets.length ?? 0}）。`}</p>}
        {step === 'feedback' && lastResult && <div className="kt-message-group">
          <p className="kt-feedback" role="status" data-result={lastResult.correctItems === lastResult.requiredItems ? 'correct' : 'wrong'}>
            {en ? `${lastResult.correctItems} of ${lastResult.requiredItems} right. The right words are marked ✓.` : `答對 ${lastResult.correctItems}／${lastResult.requiredItems}。打 ✓ 的是正確答案。`}</p>
          <button ref={actionRef} type="button" className="btn btn-primary kt-continue" onClick={() => controlsRef.current?.next()}>{en ? 'Start the counted blocks' : '開始正式題'}</button>
        </div>}
      </div>
      <div className="kt-answer-area">
        {block && step !== 'ready' && <AnswerRows targets={block.targets} en={en} choices={choices} active={step === 'answer'}
          reveal={step === 'feedback' ? LastWords(block) : undefined} onChoose={(category, word) => controlsRef.current?.choose(category, word)} />}
        <footer className="kt-actions">
          <button type="button" className="btn btn-primary kt-submit" disabled={step !== 'answer' || !complete} onClick={() => controlsRef.current?.submit()}>{en ? 'Submit' : '送出答案'}</button>
        </footer>
      </div>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Blocks all right' : '整組全對'}</p><strong>{percent(summary.accuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Words right' : '詞答對'}</p><strong>{percent(summary.itemAccuracy)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Mean answer time' : '平均作答時間'}</p><strong>{summary.meanResponseMs === null ? missing : `${(summary.meanResponseMs / 1000).toFixed(1)} ${en ? 's' : '秒'}`}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.slice(0, -1).map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Blocks all right' : '全對組數'}</dt><dd>{summary.correct} / {summary.trials}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Words right' : '答對詞數'}</dt><dd>{summary.correctItems} / {summary.requiredItems}</dd></div>
        {byLoad.map(item => <div className="score-context-item" key={item.load}><dt>{en ? `Words right, ${item.load} categories` : `記 ${item.load} 類時答對`}</dt>
          <dd>{item.correct} / {item.required}</dd></div>)}
      </dl>
        <p className="score-note">{en ? 'A block is all right only when every category is right. Answer time runs from the last word to Submit. The practice block is listed below but not counted here.'
          : '每個類別都答對，該組才算全對。作答時間從最後一個詞結束算到按下送出。練習組列在下方明細，但不計入這些統計。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

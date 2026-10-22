import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, modes, ValidateSettings, type TimingMode, type TimingSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { TimingTutorial } from './rules/TimingTutorial';
import { taskCopy } from './taskCopy';
import { CreateRandom, CreateTimingPlan, estimateTargets, PresentDuration, ScoreCompare, ScoreEstimate, ScoreReproduce, Staircase,
  type TimingClock, type TimingRow, type TimingTrial } from './logic/timing';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

const browserClock: TimingClock = {
  now: () => performance.now(),
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: timer => window.clearTimeout(timer),
};

type Phase = 'menu' | 'rules' | 'running' | 'results';
type Step = 'intro' | 'ready' | 'watch' | 'gap' | 'hold' | 'holding' | 'choose' | 'feedback';

const readyMs = 900, gapMs = 700, feedbackMs = 1200;

export function TimePerceptionGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<TimingSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<TimingRow[]>([]);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [step, setStep] = useState<Step>('intro');
  const [trialIndex, setTrialIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  // The plan lives in a ref for the timers; this counter re-renders once a new plan is in place.
  const [, setPlanVersion] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const planRef = useRef<TimingTrial[]>([]);
  const rowsRef = useRef<TimingRow[]>([]);
  const staircaseRef = useRef(new Staircase({ startMs: 400, stepMs: 40, minMs: 40, maxMs: 600 }));
  const comparisonRef = useRef(0);
  const holdStartRef = useRef<number | null>(null);
  const stopPresentRef = useRef<() => void>(() => undefined);
  const timerRef = useRef(0);
  const stepRef = useRef(step);
  stepRef.current = step;
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopTimers = useCallback(() => {
    stopPresentRef.current();
    window.clearTimeout(timerRef.current);
  }, []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopTimers();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, [stopTimers]);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);
  const lamp = (on: boolean) => { if (lampRef.current) lampRef.current.dataset.on = String(on); };
  const later = (callback: () => void, ms: number) => {
    const generation = generationRef.current;
    timerRef.current = window.setTimeout(() => { if (generation === generationRef.current) callback(); }, ms);
  };
  const present = (ms: number, onDone: () => void) => {
    const generation = generationRef.current;
    stopPresentRef.current = PresentDuration(ms, { show: () => lamp(true), hide: () => lamp(false) }, browserClock,
      () => { if (generation === generationRef.current) onDone(); });
  };
  const finish = useCallback((completed: TimingRow[]) => {
    const thresholdMs = staircaseRef.current.thresholdMs();
    const score = BuildGameScore(completed, thresholdMs);
    jsPsychLifecycleRef.current?.finish({ trials: completed.length, reproduce_error_percent: score.summary.reproduceErrorPercent, compare_threshold_ms: score.summary.compareThresholdMs });
    PlayGameEndSound('Victory');
    setRows(completed);
    setThreshold(thresholdMs);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  }, [settings]);
  const beginTrialRef = useRef<(index: number) => void>(() => undefined);
  beginTrialRef.current = (index: number) => {
    const trial = planRef.current[index];
    setTrialIndex(index);
    setFeedback('');
    lamp(false);
    const previous = planRef.current[index - 1];
    if (!previous || previous.task !== trial.task) { setStep('intro'); return; }
    runTrialRef.current(index);
  };
  const runTrialRef = useRef<(index: number) => void>(() => undefined);
  runTrialRef.current = (index: number) => {
    const trial = planRef.current[index];
    setStep('ready');
    later(() => {
      setStep('watch');
      if (trial.task !== 'compare') { present(trial.targetMs, () => setStep(trial.task === 'reproduce' ? 'hold' : 'choose')); return; }
      const difference = staircaseRef.current.differenceMs;
      comparisonRef.current = trial.targetMs + (trial.longer ? difference : -difference);
      const [first, second] = trial.standardFirst ? [trial.targetMs, comparisonRef.current] : [comparisonRef.current, trial.targetMs];
      present(first, () => {
        setStep('gap');
        later(() => { setStep('watch'); present(second, () => setStep('choose')); }, gapMs);
      });
    }, readyMs);
  };
  const recordRef = useRef<(row: TimingRow, message: string) => void>(() => undefined);
  recordRef.current = (row: TimingRow, message: string) => {
    rowsRef.current = [...rowsRef.current, row];
    if (row.correct) PlaySuccessSound(); else PlayFailureSound();
    setFeedback(message);
    setStep('feedback');
    later(() => {
      if (rowsRef.current.length >= planRef.current.length) finish(rowsRef.current);
      else beginTrialRef.current(trialIndex + 1);
    }, feedbackMs);
  };
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} ${enRef.current ? 's' : '秒'}`;
  const chooseRef = useRef<(choice: number) => void>(() => undefined);
  chooseRef.current = (choice: number) => {
    const trial = planRef.current[trialIndex];
    if (phaseRef.current !== 'running' || stepRef.current !== 'choose' || !trial) return;
    const english = enRef.current;
    if (trial.task === 'compare') {
      if (choice > 2) return;
      const comparisonFirst = !trial.standardFirst;
      const judgedLonger = (choice === 1) === comparisonFirst ? 'longer' : 'shorter';
      const row = ScoreCompare(trialIndex + 1, trial.targetMs, comparisonRef.current, judgedLonger);
      staircaseRef.current.record(row.correct);
      const longerTime = (trial.standardFirst === trial.longer) ? 2 : 1;
      recordRef.current(row, row.correct ? (english ? '✓ Right' : '✓ 對') : (english ? `✗ Time ${longerTime} was longer` : `✗ 第${longerTime === 1 ? '一' : '二'}次比較長`));
      return;
    }
    if (trial.task === 'estimate' && choice >= 1 && choice <= 5) {
      const row = ScoreEstimate(trialIndex + 1, trial.targetMs, estimateTargets[choice - 1]);
      recordRef.current(row, row.correct ? (english ? `✓ Right, about ${trial.targetMs / 1000} s` : `✓ 對，約 ${trial.targetMs / 1000} 秒`)
        : (english ? `✗ It was about ${trial.targetMs / 1000} s` : `✗ 實際約 ${trial.targetMs / 1000} 秒`));
    }
  };
  const holdRef = useRef<(down: boolean) => void>(() => undefined);
  holdRef.current = (down: boolean) => {
    const trial = planRef.current[trialIndex];
    if (phaseRef.current !== 'running' || !trial || trial.task !== 'reproduce') return;
    if (down && stepRef.current === 'hold') {
      holdStartRef.current = performance.now();
      lamp(true);
      setStep('holding');
      return;
    }
    if (down || stepRef.current !== 'holding' || holdStartRef.current === null) return;
    const produced = performance.now() - holdStartRef.current;
    holdStartRef.current = null;
    lamp(false);
    const row = ScoreReproduce(trialIndex + 1, trial.targetMs, produced);
    const english = enRef.current;
    recordRef.current(row, english ? `You held ${seconds(produced)}; the dot was on ${seconds(trial.targetMs)}.` : `你按了 ${seconds(produced)}，圓點亮了 ${seconds(trial.targetMs)}。`);
  };
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (stepRef.current === 'intro') return;
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (event.type === 'keydown' && !event.repeat) holdRef.current(true);
        if (event.type === 'keyup') holdRef.current(false);
        return;
      }
      const choice = Number(event.key);
      if (event.type === 'keydown' && choice >= 1 && choice <= 5) { event.preventDefault(); if (!event.repeat) chooseRef.current(choice); }
    };
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('keyup', keys, true);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('keyup', keys, true);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [exit, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'running' || !host) return;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:time-perception', onStart: () => {
      planRef.current = CreateTimingPlan(settings, CreateRandom(Date.now()));
      setPlanVersion(version => version + 1);
      rowsRef.current = [];
      staircaseRef.current = new Staircase({ startMs: 400, stepMs: 40, minMs: 40, maxMs: 600 });
      beginTrialRef.current(0);
    } });
    return () => {
      stopTimers();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, settings, stopTimers]);

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
    setStep('intro');
    setTrialIndex(0);
    setPhase('running');
  };

  const copy = taskCopy[en ? 'en' : 'zh'];
  const modeLabel = (mode: TimingMode) => mode === 'mixed' ? (en ? 'All three, in blocks' : '三種輪流（分段）') : copy[mode].title;
  const summaryItems = [
    { label: en ? 'Tasks' : '作答方式', value: modeLabel(settings.mode) },
    { label: en ? 'Trials' : '題數', value: en ? String(settings.trials) : `${settings.trials} 題` },
  ];
  const trial = planRef.current[trialIndex];
  const task = trial?.task ?? (settings.mode === 'mixed' ? 'reproduce' : settings.mode);
  const prompts: Record<Step, string> = en
    ? { intro: '', ready: 'Get ready.', watch: 'Watch the dot.', gap: 'Again…', hold: 'Hold the button for the same time.', holding: 'Let go when the time feels the same.',
      choose: task === 'compare' ? 'Which time was longer?' : 'About how many seconds was it on?', feedback }
    : { intro: '', ready: '準備。', watch: '注意圓點亮多久。', gap: '再一次……', hold: '按住按鈕同樣久。', holding: '覺得一樣久了就放開。',
      choose: task === 'compare' ? '哪一次亮得比較久？' : '大約亮了幾秒？', feedback };
  const holdEvent = (down: boolean) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (down) event.currentTarget.setPointerCapture?.(event.pointerId);
    holdRef.current(down);
  };
  const score = BuildGameScore(rows, threshold);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const ms = (value: number | null) => value === null ? missing : `${value} ms`;
  return <div ref={rootRef} className="time-perception-game-root">
    <div ref={jsPsychHostRef} className="time-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <TimingTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog time-perception-phase-menu" aria-labelledby="time-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="time-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Tasks' : '作答方式'}<select name="mode" value={settings.mode} onChange={event => setSettings({ ...settings, mode: event.target.value as TimingMode })}>
              {modes.map(mode => <option key={mode} value={mode}>{modeLabel(mode)}</option>)}
            </select>
              <small className="training-setting-description">{settings.mode === 'mixed'
                ? (en ? 'Reproduce, compare and estimate, a third of the trials each.' : '重現、比較、估計各占三分之一。') : copy[settings.mode].text}</small></label>
            <label>{en ? 'Trials' : '題數'}：<output>{settings.trials}</output>
              <input name="trials" type="range" min={12} max={48} step={6} value={settings.trials}
                onChange={event => setSettings({ ...settings, trials: Number(event.target.value) })} />
              <small className="training-setting-description">{en ? 'Each trial takes about 5 to 8 seconds.' : '每題約 5 到 8 秒。'}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="time-stage time-running" aria-label={title} data-task={task}>
      <header className="time-hud">
        <p className="time-progress-label">{en ? `Trial ${trialIndex + 1} of ${settings.trials}` : `第 ${trialIndex + 1} 題，共 ${settings.trials} 題`}</p>
        <div className="time-progress-track"><div className="time-progress-fill" style={{ width: `${(trialIndex + 1) / settings.trials * 100}%` }} /></div>
        <button type="button" className="btn btn-ghost time-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div className="time-lamp-area"><span ref={lampRef} className="time-lamp" data-on="false" aria-hidden="true" /></div>
      <div className="time-controls">
        <p className="time-prompt" role="status" data-step={step}>{prompts[step]}</p>
        {task === 'reproduce' && <button type="button" className="time-hold" disabled={step !== 'hold' && step !== 'holding'} data-holding={step === 'holding' ? 'true' : undefined}
          onPointerDown={holdEvent(true)} onPointerUp={holdEvent(false)} onPointerCancel={holdEvent(false)} onContextMenu={event => event.preventDefault()}>
          {en ? 'Hold for the same time' : '按住同樣久'}<small>{en ? 'or hold the Space bar' : '或按住空白鍵'}</small></button>}
        {task === 'compare' && <div className="time-choices" data-count="2">
          {[1, 2].map(choice => <button key={choice} type="button" className="time-choice" disabled={step !== 'choose'} onClick={() => chooseRef.current(choice)}>
            {choice === 1 ? (en ? 'First was longer' : '第一次較長') : (en ? 'Second was longer' : '第二次較長')}<small>{choice}</small></button>)}</div>}
        {task === 'estimate' && <div className="time-choices" data-count="5">
          {[1, 2, 3, 4, 5].map(choice => <button key={choice} type="button" className="time-choice" disabled={step !== 'choose'} onClick={() => chooseRef.current(choice)}>
            {en ? `${choice} s` : `${choice} 秒`}</button>)}</div>}
      </div>
      {step === 'intro' && trial && <section className="time-intro" aria-labelledby="time-intro-title">
        <div className="time-intro-panel">
          <h2 id="time-intro-title">{copy[trial.task].title}</h2>
          <p>{copy[trial.task].text}</p>
          <button type="button" className="btn btn-primary time-intro-start" autoFocus onClick={() => runTrialRef.current(trialIndex)}>{en ? 'Start' : '開始'}</button>
        </div>
      </section>}
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Reproduce: mean miss' : '重現：平均誤差'}</p><strong>{percent(summary.reproduceErrorPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Compare: smallest gap told apart' : '比較：能分辨的時間差'}</p><strong>{ms(summary.compareThresholdMs)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Estimate: right' : '估計：答對率'}</p><strong>{percent(summary.estimateAccuracyPercent)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Reproduce: held time ÷ shown time' : '重現：按住時間 ÷ 亮的時間'}</dt><dd>{summary.reproduceRatio ?? missing}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Compare: right' : '比較：答對率'}</dt><dd>{percent(summary.compareAccuracyPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Estimate: mean difference' : '估計：平均差距'}</dt><dd>{ms(summary.estimateMeanErrorMs)}</dd></div>
      </dl>
        <p className="score-note">{en ? 'A ratio above 1 means you held longer than the dot was on; below 1, shorter. A positive estimate difference means you guessed longer than it was.'
          : '比值大於 1 表示按得比亮的時間久，小於 1 表示較短。估計差距為正數，表示猜得比實際長。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

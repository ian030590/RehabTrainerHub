import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, mathLevels, speeds, ValidateSettings, type DividedSettings, type MathLevel, type Speed } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { DividedTutorial } from './rules/DividedTutorial';
import { CreatePath, CreateProblem, CreateRandom, ScoreProblem, TrackingLog, type DividedRow, type Point, type Problem, type TrackingPercentages } from './logic/divided';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'running' | 'results';
interface RunState {
  path: ReturnType<typeof CreatePath>; random: () => number; log: TrackingLog; rows: DividedRow[];
  start: number; end: number; lastFrame: number; nextAt: number; secondsLeft: number; frame: number;
  problem: { value: Problem; index: number; shownAt: number; window: ReturnType<TrackingLog['window']> } | null;
}

const firstProblemMs = 3000, quietEndMs = 3000;
const responseMs: Record<MathLevel, number> = { easy: 5000, harder: 7000 };
const arrowKeys: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
const operationSigns = ['+', '−', '×'];

export function DividedAttentionGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const title = t('game.title');
  const [phase, setPhase] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<DividedSettings>({ ...defaultSettings });
  const [rows, setRows] = useState<DividedRow[]>([]);
  const [tracking, setTracking] = useState<TrackingPercentages>({ overall: null, alone: null, duringMath: null });
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [feedback, setFeedback] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(defaultSettings.durationSec);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const runRef = useRef<RunState | null>(null);
  // Field-relative pixels. Mouse and touch set the pointer; arrow keys drive a separate crosshair.
  const pointerRef = useRef<Point | null>(null);
  const keyPointRef = useRef<Point | null>(null);
  const inputRef = useRef<'pointer' | 'keys'>('pointer');
  const touchIdRef = useRef<number | null>(null);
  const heldKeysRef = useRef(new Set<string>());
  const generationRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const enRef = useRef(en);
  enRef.current = en;

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const stopLoop = useCallback(() => {
    if (runRef.current) cancelAnimationFrame(runRef.current.frame);
    runRef.current = null;
    heldKeysRef.current.clear();
  }, []);
  const stopRuntime = useCallback(() => {
    generationRef.current++;
    stopLoop();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit-training' });
  }, [stopLoop]);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const backToSettings = useCallback(() => setPhase('menu'), []);

  const finishRef = useRef<() => void>(() => undefined);
  finishRef.current = () => {
    const run = runRef.current;
    if (!run) return;
    const percentages = run.log.percentages();
    const completed = run.rows;
    stopLoop();
    const score = BuildGameScore(completed, percentages, settings.durationSec);
    jsPsychLifecycleRef.current?.finish({ problems: completed.length, tracking_percent: percentages.overall, accuracy_percent: score.summary.accuracyPercent });
    PlayGameEndSound('Victory');
    setRows(completed);
    setTracking(percentages);
    setProblem(null);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settings }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setPhase('results');
  };
  const gapMs = (run: RunState) => 2000 + Math.floor(run.random() * 2000);
  const resolveRef = useRef<(choice: number | null) => void>(() => undefined);
  resolveRef.current = (choice: number | null) => {
    const run = runRef.current;
    const shown = run?.problem;
    if (!run || !shown || phaseRef.current !== 'running') return;
    const now = performance.now();
    const chosen = choice === null ? null : shown.value.options[choice] ?? null;
    if (choice !== null && chosen === null) return;
    const row = ScoreProblem(shown.index, shown.value, chosen, chosen === null ? null : now - shown.shownAt, run.log.percentSince(shown.window));
    run.rows.push(row);
    run.problem = null;
    run.nextAt = now + gapMs(run);
    if (row.correct) PlaySuccessSound(); else PlayFailureSound();
    const english = enRef.current;
    setFeedback(row.correct ? (english ? '✓ Right' : '✓ 答對')
      : chosen === null ? (english ? `Time is up. It was ${row.answer}.` : `時間到，答案是 ${row.answer}。`)
        : (english ? `✗ It was ${row.answer}.` : `✗ 答案是 ${row.answer}。`));
    setProblem(null);
  };
  const frameRef = useRef<(now: number) => void>(() => undefined);
  frameRef.current = (now: number) => {
    const run = runRef.current;
    const field = fieldRef.current, target = targetRef.current;
    if (!run || phaseRef.current !== 'running') return;
    run.frame = requestAnimationFrame(time => frameRef.current(time));
    if (!field || !target) return;
    const width = field.clientWidth, height = field.clientHeight, zone = target.offsetWidth / 2;
    const point = run.path.at((now - run.start) / 1000);
    const cx = zone + (point.x - .08) / .84 * Math.max(0, width - 2 * zone);
    const cy = zone + (point.y - .08) / .84 * Math.max(0, height - 2 * zone);
    target.style.transform = `translate(${cx - zone}px, ${cy - zone}px)`;
    const seconds = Math.min(.05, Math.max(0, (now - run.lastFrame) / 1000));
    run.lastFrame = now;
    const marker = markerRef.current;
    if (inputRef.current === 'keys') {
      const key = keyPointRef.current ?? { x: width / 2, y: height / 2 };
      for (const name of heldKeysRef.current) {
        key.x += arrowKeys[name].x * .7 * width * seconds;
        key.y += arrowKeys[name].y * .7 * height * seconds;
      }
      key.x = Math.min(width, Math.max(0, key.x));
      key.y = Math.min(height, Math.max(0, key.y));
      keyPointRef.current = key;
      if (marker) { marker.hidden = false; marker.style.transform = `translate(${key.x}px, ${key.y}px)`; }
    } else if (marker && !marker.hidden) marker.hidden = true;
    const position = inputRef.current === 'keys' ? keyPointRef.current : pointerRef.current;
    const onTarget = position !== null && Math.hypot(position.x - cx, position.y - cy) <= zone;
    if (target.dataset.on !== String(onTarget)) target.dataset.on = String(onTarget);
    run.log.add(onTarget, run.problem !== null);
    const left = Math.max(0, Math.ceil((run.end - now) / 1000));
    if (left !== run.secondsLeft) { run.secondsLeft = left; setSecondsLeft(left); }
    if (now >= run.end) { finishRef.current(); return; }
    if (run.problem && now - run.problem.shownAt >= responseMs[settings.mathLevel]) resolveRef.current(null);
    else if (!run.problem && now >= run.nextAt && run.end - now > quietEndMs) {
      const value = CreateProblem(settings.mathLevel, run.random);
      run.problem = { value, index: run.rows.length + 1, shownAt: now, window: run.log.window() };
      setFeedback('');
      setProblem(value);
    }
  };
  const startRunRef = useRef<() => void>(() => undefined);
  startRunRef.current = () => {
    const seed = Date.now();
    const now = performance.now();
    const end = now + settings.durationSec * 1000;
    pointerRef.current = null;
    keyPointRef.current = null;
    inputRef.current = 'pointer';
    runRef.current = { path: CreatePath(seed, settings.speed), random: CreateRandom(seed + 1), log: new TrackingLog(), rows: [],
      start: now, end, lastFrame: now, nextAt: now + firstProblemMs, secondsLeft: settings.durationSec, frame: 0, problem: null };
    runRef.current.frame = requestAnimationFrame(time => frameRef.current(time));
  };
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setRows([]); setPhase('menu'); };
    const keys = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'running') return;
      if (event.key === 'Escape') { event.preventDefault(); exit(); return; }
      if (event.key in arrowKeys) {
        event.preventDefault();
        if (event.type === 'keyup') { heldKeysRef.current.delete(event.key); return; }
        if (inputRef.current !== 'keys') { keyPointRef.current = pointerRef.current ? { ...pointerRef.current } : null; inputRef.current = 'keys'; }
        heldKeysRef.current.add(event.key);
        return;
      }
      const choice = Number(event.key);
      if (event.type === 'keydown' && choice >= 1 && choice <= 3) { event.preventDefault(); if (!event.repeat) resolveRef.current(choice - 1); }
    };
    const blur = () => heldKeysRef.current.clear();
    const pagehide = () => { stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', keys, true);
    window.addEventListener('keyup', keys, true);
    window.addEventListener('blur', blur);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('keyup', keys, true);
      window.removeEventListener('blur', blur);
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
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:divided-attention', onStart: () => startRunRef.current() });
    return () => {
      stopLoop();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [phase, stopLoop]);

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
    setProblem(null);
    setFeedback('');
    setSecondsLeft(settings.durationSec);
    setPhase('running');
  };

  const fieldPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    inputRef.current = 'pointer';
  };
  // Only the first finger on the field steers, so a second finger can answer on a phone.
  const fieldDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') { fieldPoint(event); return; }
    if (touchIdRef.current !== null && touchIdRef.current !== event.pointerId) return;
    event.preventDefault();
    touchIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    fieldPoint(event);
  };
  const fieldMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || event.pointerId === touchIdRef.current) fieldPoint(event);
  };
  const fieldUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || event.pointerId !== touchIdRef.current) return;
    touchIdRef.current = null;
    pointerRef.current = null;
  };
  const fieldLeave = (event: ReactPointerEvent<HTMLDivElement>) => { if (event.pointerType === 'mouse') pointerRef.current = null; };

  const speedLabels: Record<Speed, string> = en ? { slow: 'Slow', medium: 'Medium', fast: 'Fast' } : { slow: '慢', medium: '中', fast: '快' };
  const levelLabels: Record<MathLevel, string> = en ? { easy: 'Single-digit add and subtract', harder: 'Two-digit add and subtract, times tables' }
    : { easy: '個位數加減', harder: '兩位數加減與九九乘法' };
  const duration = (seconds: number) => en ? `${seconds / 60} min` : `${seconds / 60} 分鐘`;
  const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const summaryItems = [
    { label: en ? 'Length' : '時間長度', value: duration(settings.durationSec) },
    { label: en ? 'Dot speed' : '圓點速度', value: speedLabels[settings.speed] },
    { label: en ? 'Sums' : '算式難度', value: levelLabels[settings.mathLevel] },
  ];
  const score = BuildGameScore(rows, tracking, settings.durationSec);
  const summary = score.summary;
  const missing = en ? 'N/A' : '無';
  const percent = (value: number | null) => value === null ? missing : `${value}%`;
  const points = (value: number | null) => value === null ? missing : value <= 0 ? (en ? 'No drop' : '沒有減少') : en ? `${value} points` : `${value} 個百分點`;
  const equation = problem ? `${problem.a} ${operationSigns[['+', '-', '×'].indexOf(problem.operation)]} ${problem.b} = ?` : feedback || (en ? 'Stay on the dot.' : '跟住圓點。');
  return <div ref={rootRef} className="divided-attention-game-root">
    <div ref={jsPsychHostRef} className="divided-jspsych-host" aria-hidden="true" />
    {(phase === 'menu' || phase === 'rules') && <DividedTutorial active={phase === 'rules'} ready title={title}
      settings={settings} summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog divided-attention-phase-menu" aria-labelledby="divided-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="divided-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Activity settings' : '活動設定'}</h3>
            <label>{en ? 'Length' : '時間長度'}：<output>{duration(settings.durationSec)}</output>
              <input name="durationSec" type="range" min={60} max={240} step={30} value={settings.durationSec}
                onChange={event => setSettings({ ...settings, durationSec: Number(event.target.value) })} />
              <small className="training-setting-description">{en ? 'The dot keeps moving for the whole time; a sum appears every few seconds.' : '圓點全程移動，每隔幾秒出現一道算式。'}</small></label>
            <label>{en ? 'Dot speed' : '圓點速度'}<select name="speed" value={settings.speed} onChange={event => setSettings({ ...settings, speed: event.target.value as Speed })}>
              {speeds.map(speed => <option key={speed} value={speed}>{speedLabels[speed]}</option>)}
            </select></label>
            <label>{en ? 'Sums' : '算式難度'}<select name="mathLevel" value={settings.mathLevel} onChange={event => setSettings({ ...settings, mathLevel: event.target.value as MathLevel })}>
              {mathLevels.map(level => <option key={level} value={level}>{levelLabels[level]}</option>)}
            </select>
              <small className="training-setting-description">{settings.mathLevel === 'easy'
                ? (en ? 'Each sum stays up to 5 seconds.' : '每道算式最多顯示 5 秒。') : (en ? 'Each sum stays up to 7 seconds.' : '每道算式最多顯示 7 秒。')}</small></label>
          </section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <main className="divided-stage divided-running" aria-label={title}>
      <header className="divided-hud">
        <p className="divided-progress-label">{en ? `${clock(secondsLeft)} left` : `剩 ${clock(secondsLeft)}`}</p>
        <div className="divided-progress-track"><div className="divided-progress-fill" style={{ width: `${(1 - secondsLeft / settings.durationSec) * 100}%` }} /></div>
        <button type="button" className="btn btn-ghost divided-stop" onClick={exit}>{en ? 'Stop' : '停止'}</button>
      </header>
      <div ref={fieldRef} className="divided-field" aria-label={en ? 'Moving dot area' : '圓點移動區'} role="img"
        onPointerDown={fieldDown} onPointerMove={fieldMove} onPointerUp={fieldUp} onPointerCancel={fieldUp} onPointerLeave={fieldLeave}
        onContextMenu={event => event.preventDefault()}>
        <div ref={targetRef} className="divided-target" data-on="false"><span className="divided-zone" /><span className="divided-dot" /></div>
        <span ref={markerRef} className="divided-marker" hidden />
      </div>
      <section className="divided-math" aria-label={en ? 'Sums' : '算式'} data-state={problem ? 'problem' : 'waiting'}>
        <p className="divided-equation" role="status">{equation}</p>
        <div className="divided-options">
          {[0, 1, 2].map(index => <button key={index} type="button" className="divided-option" disabled={!problem}
            onPointerDown={event => { event.preventDefault(); resolveRef.current(index); }}
            onClick={event => { if (event.detail === 0) resolveRef.current(index); }}>
            {problem?.options[index] ?? ''}<small>{index + 1}</small></button>)}
        </div>
      </section>
    </main>}
    {phase === 'results' && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{en ? 'Training results' : '訓練成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{en ? 'Key results' : '主要成果'}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{en ? 'Time on the dot' : '跟住圓點的時間'}</p><strong>{percent(summary.trackingPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Sums right' : '算式答對率'}</p><strong>{percent(summary.accuracyPercent)}</strong></div>
        <div className="score-key-metric"><p>{en ? 'Less time on the dot during sums' : '算式出現時少跟住'}</p><strong>{points(summary.trackingCostPercent)}</strong></div>
      </div></section>
      <section className="score-context"><h2>{en ? 'Session settings' : '當次設定'}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'On the dot with no sum showing' : '沒有算式時跟住'}</dt><dd>{percent(summary.trackingAlonePercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'On the dot while a sum showed' : '算式出現時跟住'}</dt><dd>{percent(summary.trackingDuringMathPercent)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Sums shown' : '出現的算式'}</dt><dd>{summary.problems}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Sums left unanswered' : '沒回答的算式'}</dt><dd>{summary.missed}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Mean answer time' : '平均作答時間'}</dt><dd>{summary.meanRtMs === null ? missing : `${summary.meanRtMs} ms`}</dd></div>
      </dl>
        <p className="score-note">{en ? 'Less time on the dot during sums is the gap between the two rows above. A larger number means the sums pulled more attention away from the dot.'
          : '「算式出現時少跟住」是上面兩列的差距；數字越大，表示算算式時越少顧到圓點。'}</p></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Local play. Results are not saved to the Hub.' : '獨立練習，成果未保存至 Hub。')
        : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

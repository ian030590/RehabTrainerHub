import { initJsPsych } from 'jspsych';
import { Application } from 'pixi.js';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from './i18n/useT';
import { copy, type Labels } from './labels';
import { defaultSettings, LevelFromDifficulty, listSettings, rangeSettings, ValidateSettings, type EveryBallSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { EveryBallTutorial } from './rules/EveryBallTutorial';
import { CreateEveryBallPlans, levelPassAccuracy, SummarizeEveryBallTrials, type ResponseAction, type ResponseSource, type SessionSummary, type TrialRecord } from './logic/everyBallResponse';
import { RunEveryBall, type EveryBallVisual } from './logic/everyBallRun';
import { CreateResponseWindow } from './logic/responseWindow';
import { CreateCameraGestureDetector, CreateMicrophoneTapDetector, microphoneDetection, ToMeterLevel, type MicrophoneFrame, type PoseFrame } from './logic/responseDetection';
import { DrawEveryBallScene, DrawLandmarks, ReadScenePalette, type ScenePalette } from './scene';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayMidiMusic, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import {
  ExitContainerFullscreen, ExitGame, IsHubGame, OnSavedSettings, RequestContainerFullscreen, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult,
  SetInputPreview, StartSensorInput, StopSensorInput, ToPreviewRect,
} from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'initializing' | 'playing' | 'results';
type Hole = { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number };
type ListKey = typeof listSettings[number]['key'];
type RangeKey = typeof rangeSettings[number]['key'];

function InputErrorMessage(error: unknown, inputMode: 'camera' | 'microphone', labels: Labels) {
  const messages = labels.errors[inputMode];
  const reason = error instanceof Error ? error.message : '';
  return reason in messages ? messages[reason as keyof typeof messages] : messages.initialization;
}

// The field layer covers everything except the camera window, whose corners match the frame's inner radius.
function HoleClipPath(hole: Hole | null) {
  if (!hole) return undefined;
  const { x, y, width: w, height: h, viewportWidth, viewportHeight } = hole;
  const r = Math.min(6, w / 2, h / 2);
  return `path(evenodd, "M0 0H${viewportWidth}V${viewportHeight}H0Z M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}`
    + `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z")`;
}

export function EveryBallGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const labels = copy[lang];
  const title = t('game.title');
  const [phase, setPhaseState] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'playing' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<EveryBallSettings>({ ...defaultSettings });
  const [error, setError] = useState('');
  const [sensorReady, setSensorReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [visual, setVisual] = useState<EveryBallVisual>({ phase: 'idle' });
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [hole, setHole] = useState<Hole | null>(null);
  const [responses] = useState(() => CreateResponseWindow({
    now: () => performance.now(), setTimeout: (callback, milliseconds) => window.setTimeout(callback, milliseconds), clearTimeout: timer => window.clearTimeout(timer),
  }));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const cameraViewRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const meterRef = useRef<HTMLSpanElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const appRef = useRef<Application | null>(null);
  const paletteRef = useRef<ScenePalette | null>(null);
  const visualRef = useRef<EveryBallVisual>({ phase: 'idle' });
  const cameraDetectorRef = useRef(CreateCameraGestureDetector());
  const microphoneDetectorRef = useRef(CreateMicrophoneTapDetector(defaultSettings.soundSensitivity));
  const pointerHandledRef = useRef(false);
  const previewKeyRef = useRef('');
  const trackingRef = useRef(false);
  const generationRef = useRef(0);
  const sensorReadyRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const level = LevelFromDifficulty(settings.difficulty);

  const setPhase = useCallback((next: Phase) => { phaseRef.current = next; setPhaseState(next); }, []);
  const palette = useCallback(() => paletteRef.current ??= ReadScenePalette(document.documentElement), []);
  const drawVisual = useCallback((next: EveryBallVisual) => {
    visualRef.current = next;
    setVisual(next);
    if (appRef.current) DrawEveryBallScene(appRef.current, next, palette(), labelsRef.current.ballNames);
  }, [palette]);
  // Only changes are sent, so the container is not asked to move the window on every resize event.
  const sendPreview = useCallback((rect: ReturnType<typeof ToPreviewRect> | null) => {
    const key = JSON.stringify(rect);
    if (key === previewKeyRef.current) return;
    previewKeyRef.current = key;
    SetInputPreview(rect);
  }, []);
  const setTrackingState = useCallback((value: boolean) => {
    if (trackingRef.current === value) return;
    trackingRef.current = value;
    setTracking(value);
  }, []);
  const stopSensor = useCallback(() => {
    sendPreview(null);
    StopSensorInput();
    sensorReadyRef.current = false;
    setSensorReady(false);
    setTrackingState(false);
    if (paletteRef.current) DrawLandmarks(overlayRef.current, null, paletteRef.current);
    if (meterRef.current) meterRef.current.style.transform = 'scaleX(0)';
  }, [sendPreview, setTrackingState]);
  const stopRun = useCallback(() => {
    generationRef.current++;
    responses.Cancel();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'stop' });
  }, [responses]);
  // Stop, Escape, a lost sensor and the container's configure request all return to the settings form.
  const showConfiguration = useCallback(() => {
    stopRun();
    stopSensor();
    void ExitContainerFullscreen();
    setSummary(null);
    drawVisual({ phase: 'idle' });
    setPhase('menu');
  }, [drawVisual, setPhase, stopRun, stopSensor]);
  const exit = useCallback(() => { stopRun(); stopSensor(); void ExitGame(); }, [stopRun, stopSensor]);

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    // A dialog opened inside an unfocused frame does not move focus by itself.
    formRef.current?.querySelector('select')?.focus();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { setError(''); showConfiguration(); };
    const pagehide = () => { stopRun(); StopSensorInput(); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [showConfiguration, stopRun]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    const redraw = () => DrawEveryBallScene(app, visualRef.current, palette(), labelsRef.current.ballNames);
    void app.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: host }).then(() => {
      initialized = true;
      if (cancelled) { app.destroy(true, { children: true, texture: true }); return; }
      app.canvas.className = 'every-ball-canvas';
      host.appendChild(app.canvas);
      appRef.current = app;
      app.renderer.on('resize', redraw);
      redraw();
    }).catch(failure => console.warn('The Every Ball stage could not start.', failure));
    return () => {
      cancelled = true;
      if (appRef.current === app) appRef.current = null;
      if (initialized) { app.renderer.off('resize', redraw); app.destroy(true, { children: true, texture: true }); }
    };
  }, [palette]);
  useEffect(() => { if (appRef.current) DrawEveryBallScene(appRef.current, visualRef.current, palette(), labels.ballNames); }, [labels, palette]);

  // Pose and sound numbers from the container: drawn while checking the setup, counted only during play.
  useEffect(() => {
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (!sensorReadyRef.current || !['rules', 'playing'].includes(phaseRef.current)) return;
      if (message.type === 'error') {
        setError(InputErrorMessage(new Error(message.payload.reason), settingsRef.current.inputMode, labelsRef.current));
        showConfiguration();
        return;
      }
      if (message.type !== 'frame') return;
      const playing = phaseRef.current === 'playing';
      if ('rms' in message.payload) {
        const frame = message.payload as MicrophoneFrame;
        if (meterRef.current) meterRef.current.style.transform = `scaleX(${ToMeterLevel(frame.rms)})`;
        const result = playing ? microphoneDetectorRef.current.Update(frame) : null;
        if (result && 'onset' in result) responses.Hold(microphoneDetection.decisionMs);
        else if (result) responses.Emit(result.action, 'microphone', result.delayMs);
        return;
      }
      const frame = message.payload as PoseFrame;
      DrawLandmarks(overlayRef.current, frame, palette());
      if (!playing) { setTrackingState(frame.hands.length > 0); return; }
      const result = cameraDetectorRef.current.Update(frame);
      setTrackingState(result.tracking);
      if (result.action) responses.Emit(result.action, 'camera');
    };
    window.addEventListener('game:input', receive);
    return () => window.removeEventListener('game:input', receive);
  }, [palette, responses, setTrackingState, showConfiguration]);

  const respond = useCallback((action: ResponseAction, source: ResponseSource) => {
    if (phaseRef.current === 'playing') responses.Emit(action, source);
  }, [responses]);
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'initializing') return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); showConfiguration(); return; }
      if (phase !== 'playing' || event.repeat) return;
      if (event.code === 'Space') { event.preventDefault(); respond('clap', 'keyboard'); }
      if (event.key === 'ArrowDown') { event.preventDefault(); respond('thigh', 'keyboard'); }
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [phase, respond, showConfiguration]);

  // The container shows the camera image behind the transparent game, inside the camera frame.
  const previewing = settings.inputMode === 'camera' && sensorReady && (phase === 'rules' || phase === 'playing');
  useEffect(() => {
    const view = cameraViewRef.current;
    if (!previewing || !view) { sendPreview(null); setHole(null); return; }
    const update = () => {
      const rect = view.getBoundingClientRect();
      setHole({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
      sendPreview(ToPreviewRect(rect, window.innerWidth, window.innerHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(view);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [previewing, sendPreview]);

  const finish = useCallback((trials: TrialRecord[], levelId: 1 | 2 | 3) => {
    const completed = SummarizeEveryBallTrials(trials, levelId);
    const score = BuildGameScore(completed);
    // Preview and sensor stop first: once the result is sent the container accepts no more sensor requests.
    stopSensor();
    jsPsychLifecycleRef.current?.finish({ trials: completed.total, correct: completed.correct, accuracy: completed.accuracy });
    setSummary(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settingsRef.current }, score.summary, score.rounds);
    void ExitContainerFullscreen();
    drawVisual({ phase: 'idle' });
    setPhase('results');
  }, [drawVisual, setPhase, stopSensor]);
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (phase !== 'playing' || !host) return;
    const generation = generationRef.current;
    const jsPsych = initJsPsych({ display_element: host });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychLifecycleRef.current = lifecycle;
    const levelId = LevelFromDifficulty(settings.difficulty);
    const cancelled = () => generation !== generationRef.current || phaseRef.current !== 'playing';
    cameraDetectorRef.current = CreateCameraGestureDetector();
    microphoneDetectorRef.current = CreateMicrophoneTapDetector(settings.soundSensitivity);
    void jsPsychLifecycleRef.current?.start({ moduleId: 'brain:every-ball-response', onStart: () => {
      void RunEveryBall(CreateEveryBallPlans(levelId, settings.rounds), {
        fixationStyle: settings.fixationStyle,
        wait: milliseconds => new Promise<void>(resolve => { jsPsych.pluginAPI.setTimeout(resolve, milliseconds); }),
        waitForResponse: milliseconds => responses.WaitForResponse(milliseconds),
        notify: drawVisual,
        cancelled,
      }).then(result => { if (!result.aborted && !cancelled()) finish(result.trials, levelId); })
        .catch(failure => console.error('Every Ball stopped unexpectedly.', failure));
    } });
    return () => {
      responses.Cancel();
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [drawVisual, finish, phase, responses, settings]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setError('');
    setPhase('rules');
  };
  const beginRun = useCallback(() => {
    SendGameEvent('active');
    drawVisual({ phase: 'idle' });
    setPhase('playing');
  }, [drawVisual, setPhase]);
  // The first click turns the sensor on while the game is still windowed, so the permission prompt is not hidden.
  // The second click is a fresh user action, which the container needs to enter fullscreen.
  const startTraining = useCallback(async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    if (!sensorReadyRef.current) {
      setError('');
      setPhase('initializing');
      try {
        await StartSensorInput(settings.inputMode === 'camera' ? 'pose' : 'microphone');
      } catch (failure) {
        if (generation !== generationRef.current) return;
        setError(InputErrorMessage(failure, settings.inputMode, labels));
        showConfiguration();
        return;
      }
      if (generation !== generationRef.current) return;
      sensorReadyRef.current = true;
      setSensorReady(true);
      setPhase('rules');
      return;
    }
    PrepareAudioFeedback();
    await RequestContainerFullscreen();
    if (generation !== generationRef.current || phaseRef.current !== 'rules') { await ExitContainerFullscreen(); return; }
    beginRun();
  }, [beginRun, labels, setPhase, settings, showConfiguration]);

  const rangeField = (key: RangeKey) => rangeSettings.find(field => field.key === key)!;
  const measure = (key: RangeKey) => key === 'rounds' ? `${settings.rounds} ${labels.roundsUnit}` : `${settings.soundSensitivity}%`;
  const optionName = (key: ListKey, value: string) => {
    const names: Record<string, string> = key === 'difficulty' ? labels.difficultyNames : key === 'inputMode' ? labels.inputNames : labels.fixationNames;
    return names[value];
  };
  const optionHint = (key: ListKey) => key === 'difficulty' ? labels.levelHints[level] : key === 'inputMode' ? labels.inputHints[settings.inputMode] : labels.fixationHints[settings.fixationStyle];
  const listInput = (key: ListKey, label: string) => <label key={key}>{label}
    <select name={key} value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value })}>
      {listSettings.find(field => field.key === key)!.options.map(option => <option key={option} value={option}>{optionName(key, option)}</option>)}
    </select>
    <small className="training-setting-description">{optionHint(key)}</small></label>;
  const rangeInput = (key: RangeKey, label: string, hint: string) => {
    const field = rangeField(key);
    return <label key={key}>{label}：<output>{measure(key)}</output>
      <input name={key} type="range" min={field.min} max={field.max} step={field.step} value={settings[key]}
        onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
      <small className="training-setting-description">{hint}</small></label>;
  };
  const microphone = settings.inputMode === 'microphone';
  const summaryItems = [
    { label: labels.difficulty, value: labels.difficultyNames[settings.difficulty] },
    { label: labels.rounds, value: measure('rounds') },
    { label: labels.inputMode, value: labels.inputNames[settings.inputMode] },
    ...(microphone ? [{ label: labels.sensitivity, value: measure('soundSensitivity') }] : []),
    { label: labels.fixation, value: labels.fixationNames[settings.fixationStyle] },
  ];
  const status = phase === 'initializing' ? labels.opening[settings.inputMode]
    : sensorReady ? `${labels.ready[settings.inputMode]}${en ? ' ' : ''}${labels.fullscreenNote}` : '';
  const hudStatus = !sensorReady ? labels.inputNames[settings.inputMode] : microphone ? labels.listening : tracking ? labels.tracking : labels.finding;
  const score = summary ? BuildGameScore(summary) : null;
  const backLabel = IsHubGame() ? labels.backLobby : labels.backEntry;
  const showActions = phase !== 'results';
  return <div className={`every-ball-root every-ball-response-phase-${phase}`} style={{ '--every-ball-hole': HoleClipPath(hole) } as CSSProperties}>
    <div className="every-ball-field" aria-hidden="true" />
    <div ref={jsPsychHostRef} className="every-ball-jspsych-host" aria-hidden="true" />
    <main className={`every-ball-stage${microphone ? '' : ' is-camera'}`} aria-label={title} data-trial-phase={visual.phase}>
      <div ref={canvasHostRef} className="every-ball-canvas-host" aria-hidden="true" />
      <header className={`every-ball-hud${microphone ? ' has-meter' : ''}`}>
        <p className="every-ball-hud-item"><span>{labels.levelShort[level]}</span><strong>{title}</strong></p>
        <p className="every-ball-hud-item"><span>{labels.progress}</span><strong>{labels.trial(Math.max(1, visual.trialNumber ?? 1), settings.rounds)}</strong></p>
        <p className="every-ball-hud-item every-ball-hud-status" aria-live="polite"><span>{labels.inputMode}</span><strong>{hudStatus}</strong></p>
        {microphone && <div className="every-ball-meter" role="img" aria-label={labels.meter}><span ref={meterRef} className="every-ball-meter-level" /></div>}
        <button type="button" className="btn btn-ghost every-ball-stop" onClick={showConfiguration}>{labels.stop}</button>
      </header>
      {!microphone && <div className={`every-ball-camera${previewing ? ' is-live' : ''}`}>
        <div ref={cameraViewRef} className="every-ball-camera-view">
          <canvas ref={overlayRef} className="every-ball-camera-overlay" aria-hidden="true" />
          {!previewing && <p className="every-ball-camera-waiting">{phase === 'initializing' ? labels.opening.camera : labels.cameraWaiting}</p>}
        </div>
      </div>}
      {showActions && <div className="every-ball-actions" role="group" aria-label={labels.actions}>
        {(['clap', 'thigh'] as const).map(action => <button key={action} type="button" className="every-ball-action"
          onPointerDown={event => { event.preventDefault(); pointerHandledRef.current = true; respond(action, 'touch'); }}
          onClick={() => { if (pointerHandledRef.current) { pointerHandledRef.current = false; return; } respond(action, 'touch'); }}
          onContextMenu={event => event.preventDefault()}>{labels.actionNames[action]}</button>)}
      </div>}
      {(phase === 'menu' || phase === 'rules' || phase === 'initializing') && <EveryBallTutorial active={phase !== 'menu'} ready={phase === 'rules'} title={title}
        settings={settings} summaryItems={summaryItems} onStart={() => void startTraining()} onBack={showConfiguration} inputReady={sensorReady} status={status} />}
    </main>
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog" aria-labelledby="every-ball-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="every-ball-settings-title">{title}</h2></header>
        <div className="training-config-body">
          {error && <p className="every-ball-input-error" role="alert">{error}</p>}
          <section className="training-setting"><h3>{labels.settingsTitle}</h3>
            <p className="training-setting-description">{labels.settingsNote}</p>
            {listInput('difficulty', labels.difficulty)}
            {rangeInput('rounds', labels.rounds, labels.roundsHint)}
          </section>
          <section className="training-setting"><h3>{labels.inputTitle}</h3>
            {listInput('inputMode', labels.inputMode)}
            {microphone && rangeInput('soundSensitivity', labels.sensitivity, labels.sensitivityHint)}
            {listInput('fixationStyle', labels.fixation)}
          </section>
          <section className="training-setting"><h3>{labels.privacyTitle}</h3><p className="training-setting-description">{labels.privacy}</p></section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{labels.confirm}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{backLabel}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'results' && summary && score && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{labels.resultsTitle}</h1><p>{title} · {labels.difficultyNames[settings.difficulty]}</p></header>
      <section className="score-priority"><h2>{labels.keyResults}</h2><div className="score-key-grid">
        <div className="score-key-metric"><p>{labels.correct}</p><strong>{summary.correct} / {summary.total}</strong></div>
        <div className="score-key-metric"><p>{labels.accuracy}</p><strong>{summary.accuracy}%</strong></div>
        <div className="score-key-metric"><p>{labels.averageRt}</p><strong>{summary.averageRtMs === null ? labels.none : `${summary.averageRtMs} ms`}</strong></div>
      </div>
        <p className="score-note">{summary.passed ? labels.passed : labels.notPassed}{en ? '. ' : '。'}{labels.passRule(levelPassAccuracy[LevelFromDifficulty(settings.difficulty)])}</p>
        <p className="score-note">{labels.rtNote}</p>
      </section>
      <section className="score-context score-errors"><h2>{labels.errorCounts}</h2><dl className="score-context-list">
        <div className="score-context-item"><dt>{labels.misses}</dt><dd>{summary.misses}</dd></div>
        <div className="score-context-item"><dt>{labels.falseAlarms}</dt><dd>{summary.falseAlarms}</dd></div>
        <div className="score-context-item"><dt>{labels.wrongActions}</dt><dd>{summary.wrongActions}</dd></div>
      </dl></section>
      <section className="score-context"><h2>{labels.sessionSettings}</h2><dl className="score-context-list">
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? labels.localSave : saveState === 'saved' ? labels.saved : saveState === 'error' ? labels.saveError : labels.saving}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{labels.retry}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{backLabel}</button>
    </section></div>}
  </div>;
}

import { initJsPsych } from 'jspsych';
import { Application, Texture, type Ticker } from 'pixi.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { copy, type Labels } from './labels';
import { defaultSettings, rangeSettings, ToPlayConfig, ValidateSettings, type RangeKey, type TongueSettings } from './settings';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { TongueCue } from './TongueCue';
import { TongueTutorial } from './rules/TongueTutorial';
import { calibrationSteps, CreateCalibration } from './logic/calibration';
import {
  CreateTongueSession, MapVideoPointToStage, RecognitionFromFrame, ResumeTongueSession, StepTongueSession, SummarizeTongueSession,
  type Recognition, type SessionSummary, type TongueFrame, type TongueSession,
} from './logic/tongueCatch';
import { CreateTongueScene, DestroyTongueScene, DrawTongueScene, ReadScenePalette, type TongueScene } from './scene';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import {
  ExitContainerFullscreen, ExitGame, IsHubGame, OnSavedSettings, RequestContainerFullscreen, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult,
  SetInputCapture, SetInputPreview, StartSensorInput, StopSensorInput, ToPreviewRect,
} from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { CreateTongueFeedback, EmitTongueFeedback, ReadTongueProtectedRects } from './fx/feedback';

type Phase = 'menu' | 'rules' | 'initializing' | 'calibration' | 'playing' | 'results';
type Hud = { timeLeft: number; caught: number; missed: number };

const appleTextureUrl = new URL('./textures/apple.svg', import.meta.url).href;
// Apples draw at up to 120 px on screens up to 2x density.
const appleTextureSize = 256;

// Pixi's SVG loader fetches the file, and the runner blocks fetch for game packages, so the apple loads as an image.
async function LoadAppleTexture() {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = appleTextureUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = appleTextureSize;
  canvas.height = appleTextureSize;
  canvas.getContext('2d')?.drawImage(image, 0, 0, appleTextureSize, appleTextureSize);
  return Texture.from(canvas);
}
const restingRecognition: Recognition = { label: 'Rest', confidence: 0, faceVisible: false };
const fullFrame = { x: 0, y: 0, width: 1, height: 1 };

function InputErrorMessage(error: unknown, labels: Labels) {
  const reason = error instanceof Error ? error.message : '';
  return reason in labels.errors ? labels.errors[reason as keyof Labels['errors']] : labels.errors.initialization;
}

export function TongueCatchGame() {
  const { lang, t } = useT();
  const en = lang === 'en';
  const labels = copy[lang];
  const title = t('game.title');
  const [phase, setPhaseState] = useState<Phase>('menu');
  const [paused, setPaused] = useState(false);
  const [cameraLost, setCameraLost] = useState(false);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef(0);
  const cameraLostRef = useRef(false);
  const reconnectingRef = useRef(false);
  const resumeAfterCalibrationRef = useRef(false);
  const stopRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const restoreStopRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === 'playing' && !paused && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase, paused]);
  useEffect(() => { if (paused) continueRef.current?.focus(); else if (restoreStopRef.current) { restoreStopRef.current = false; stopRef.current?.focus(); } }, [paused]);
  useEffect(() => { if (phase === 'results') resultHeadingRef.current?.focus(); }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<TongueSettings>({ ...defaultSettings });
  const [error, setError] = useState('');
  const [sensorReady, setSensorReady] = useState(false);
  const [faceVisible, setFaceVisible] = useState(false);
  const [calibration, setCalibration] = useState(() => CreateCalibration().State());
  const [hud, setHud] = useState<Hud>({ timeLeft: defaultSettings.durationSec, caught: 0, missed: 0 });
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const feedbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const feedbackRef = useRef<ReturnType<typeof CreateTongueFeedback> | null>(null);
  const cameraSpaceRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<TongueScene | null>(null);
  const sessionRef = useRef<TongueSession | null>(null);
  const calibrationRef = useRef(CreateCalibration());
  const recognitionRef = useRef<Recognition>(restingRecognition);
  const mouthRef = useRef<{ x: number; y: number } | null>(null);
  const hudRef = useRef<Hud>(hud);
  const faceVisibleRef = useRef(false);
  const previewKeyRef = useRef('');
  const generationRef = useRef(0);
  const sensorReadyRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const finishRef = useRef<() => void>(() => undefined);

  const setPhase = useCallback((next: Phase) => { phaseRef.current = next; setPhaseState(next); }, []);
  // Only changes are sent, so the container is not asked to move the camera image on every resize event.
  const sendPreview = useCallback((rect: ReturnType<typeof ToPreviewRect> | null) => {
    const key = JSON.stringify(rect);
    if (key === previewKeyRef.current) return;
    previewKeyRef.current = key;
    SetInputPreview(rect);
  }, []);
  const setFaceState = useCallback((value: boolean) => {
    if (faceVisibleRef.current === value) return;
    faceVisibleRef.current = value;
    setFaceVisible(value);
  }, []);
  const clearPlay = useCallback(() => {
    feedbackRef.current?.Clear();
    sessionRef.current = null;
    recognitionRef.current = restingRecognition;
    mouthRef.current = null;
    if (sceneRef.current) DrawTongueScene(sceneRef.current, null);
  }, []);
  const stopSensor = useCallback(() => {
    sendPreview(null);
    StopSensorInput();
    sensorReadyRef.current = false;
    setSensorReady(false);
    setFaceState(false);
  }, [sendPreview, setFaceState]);
  const stopRun = useCallback(() => {
    generationRef.current++;
    pausedRef.current = false; cameraLostRef.current = false; resumeAfterCalibrationRef.current = false; setPaused(false); setCameraLost(false);
    clearPlay();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'stop' });
  }, [clearPlay]);
  // Stop, Cancel, Escape, a lost camera and the container's configure request all return to the settings form.
  const showConfiguration = useCallback(() => {
    stopRun();
    stopSensor();
    void ExitContainerFullscreen();
    setSummary(null);
    setPhase('menu');
  }, [setPhase, stopRun, stopSensor]);
  const exit = useCallback(() => { stopRun(); stopSensor(); void ExitGame(); }, [stopRun, stopSensor]);
  const pause = useCallback((lost = false) => {
    if (!['playing', 'calibration'].includes(phaseRef.current)) return;
    if (lost) { cameraLostRef.current = true; setCameraLost(true); }
    if (pausedRef.current) return;
    pausedRef.current = true;
    if (!resumeAfterCalibrationRef.current) pausedAtRef.current = performance.now();
    if (phaseRef.current === 'calibration') {
      const state = calibrationRef.current.State();
      if (state.capturing) SetInputCapture(state.label, false);
    }
    recognitionRef.current = restingRecognition; mouthRef.current = null;
    feedbackRef.current?.Clear(); DisposeAudioFeedback(); setPaused(true);
  }, []);
  const pauseManually = useCallback(() => pause(), [pause]);
  const resume = useCallback(async () => {
    if (!pausedRef.current || reconnectingRef.current) return;
    PrepareAudioFeedback();
    const generation = generationRef.current;
    if (cameraLostRef.current) {
      reconnectingRef.current = true;
      try { await StartSensorInput(); } catch { return; } finally { reconnectingRef.current = false; }
      if (generation !== generationRef.current || !pausedRef.current) return;
      cameraLostRef.current = false; setCameraLost(false); sensorReadyRef.current = true; setSensorReady(true);
      resumeAfterCalibrationRef.current = resumeAfterCalibrationRef.current || phaseRef.current === 'playing';
      calibrationRef.current = CreateCalibration(); setCalibration(calibrationRef.current.State());
      pausedRef.current = false; restoreStopRef.current = true; setPaused(false); setPhase('calibration'); return;
    }
    if (phaseRef.current === 'calibration') {
      const label = calibrationRef.current.Restart(performance.now());
      if (label) SetInputCapture(label, true);
      setCalibration(calibrationRef.current.State());
    } else if (sessionRef.current) ResumeTongueSession(sessionRef.current, performance.now() - pausedAtRef.current);
    pausedRef.current = false; restoreStopRef.current = true; setPaused(false);
  }, [setPhase]);

  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    // A dialog opened inside an unfocused frame does not move focus by itself.
    formRef.current?.querySelector('input')?.focus();
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
    const canvas = feedbackCanvasRef.current;
    if (!canvas) return;
    const readView = () => {
      const app = appRef.current;
      return app ? { width: app.screen.width, height: app.screen.height, rect: app.canvas.getBoundingClientRect() } : null;
    };
    const feedback = CreateTongueFeedback(canvas, readView, () => {
      const rects = ReadTongueProtectedRects(document, phaseRef.current === 'results');
      const view = readView();
      const session = sessionRef.current;
      if (view && session) {
        const protect = (x: number, y: number, width: number, height: number) => rects.push({
          left: view.rect.left + x * view.rect.width / view.width, top: view.rect.top + y * view.rect.height / view.height,
          width: width * view.rect.width / view.width, height: height * view.rect.height / view.height,
        });
        protect(session.mouthX - 60, session.mouthY - 60, 120, 120);
        for (const apple of session.apples) protect(apple.x - apple.size / 2, apple.y - apple.size / 2, apple.size, apple.size);
      }
      return rects;
    });
    feedbackRef.current = feedback;
    return () => { feedback.Dispose(); feedbackRef.current = null; };
  }, []);

  // The Pixi ticker runs the legacy update loop; React only shows the HUD numbers when they change.
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    let cancelled = false;
    let initialized = false;
    const app = new Application();
    const tick = (ticker: Ticker) => {
      const session = sessionRef.current;
      const scene = sceneRef.current;
      if (phaseRef.current !== 'playing' || pausedRef.current || !session || !scene) return;
      const config = ToPlayConfig(settingsRef.current);
      const apples = session.apples.slice();
      const previousHold = session.holdDirection;
      const events = StepTongueSession(session, {
        dtMs: ticker.deltaMS, now: performance.now(), width: app.screen.width, height: app.screen.height,
        mouth: mouthRef.current, recognition: recognitionRef.current, random: Math.random,
      }, config);
      EmitTongueFeedback(feedbackRef.current, apples, previousHold, session, events);
      if (events.caught.length) PlaySuccessSound();
      if (events.missed.length) PlayFailureSound();
      DrawTongueScene(scene, session);
      const next = { timeLeft: Math.max(0, Math.ceil(config.durationSec - session.elapsed)), caught: session.score, missed: session.missed };
      if (next.timeLeft !== hudRef.current.timeLeft || next.caught !== hudRef.current.caught || next.missed !== hudRef.current.missed) {
        hudRef.current = next;
        setHud(next);
      }
      if (session.elapsed >= config.durationSec) finishRef.current();
    };
    void app.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: host })
      .then(async () => {
        initialized = true;
        const appleTexture = await LoadAppleTexture();
        if (cancelled) { app.destroy(true, { children: true, texture: true }); return; }
        app.canvas.className = 'tongue-canvas';
        host.appendChild(app.canvas);
        appRef.current = app;
        sceneRef.current = CreateTongueScene(app, appleTexture, ReadScenePalette(document.documentElement));
        app.ticker.add(tick);
      }).catch(failure => console.warn('The Tongue Catch stage could not start.', failure));
    return () => {
      cancelled = true;
      if (appRef.current === app) appRef.current = null;
      if (sceneRef.current) DestroyTongueScene(sceneRef.current);
      sceneRef.current = null;
      if (initialized) { app.ticker.remove(tick); app.destroy(true, { children: true, texture: true }); }
    };
  }, []);

  const beginPlay = useCallback(() => {
    feedbackRef.current?.Clear();
    if (resumeAfterCalibrationRef.current && sessionRef.current) {
      resumeAfterCalibrationRef.current = false;
      ResumeTongueSession(sessionRef.current, performance.now() - pausedAtRef.current);
      recognitionRef.current = restingRecognition; mouthRef.current = null;
      setPhase('playing'); return;
    }
    const app = appRef.current;
    sessionRef.current = CreateTongueSession(app?.screen.width ?? window.innerWidth, app?.screen.height ?? window.innerHeight);
    recognitionRef.current = restingRecognition;
    mouthRef.current = null;
    const reset = { timeLeft: settingsRef.current.durationSec, caught: 0, missed: 0 };
    hudRef.current = reset;
    setHud(reset);
    setPhase('playing');
  }, [setPhase]);

  // Mouth frames from the container: they count calibration samples, then steer the tongue during play.
  useEffect(() => {
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (!sensorReadyRef.current || !['rules', 'calibration', 'playing'].includes(phaseRef.current)) return;
      if (message.type === 'error') {
        if (['calibration', 'playing'].includes(phaseRef.current)) { pause(true); return; }
        setError(InputErrorMessage(new Error(message.payload.reason), labelsRef.current));
        showConfiguration();
        return;
      }
      if (pausedRef.current) return;
      if (message.type !== 'frame') return;
      const frame = message.payload as TongueFrame;
      setFaceState(frame.face);
      if (phaseRef.current === 'calibration') {
        const update = calibrationRef.current.Update(frame.samples, performance.now());
        if (!update) return;
        if (update.finished) SetInputCapture(update.finished, false);
        const state = calibrationRef.current.State();
        setCalibration(state);
        if (state.complete) beginPlay();
        return;
      }
      if (phaseRef.current !== 'playing') return;
      const app = appRef.current;
      recognitionRef.current = RecognitionFromFrame(frame, ToPlayConfig(settingsRef.current).sensitivity);
      mouthRef.current = frame.mouth && app
        ? MapVideoPointToStage(frame.mouth.x, frame.mouth.y, frame.videoWidth, frame.videoHeight, app.screen.width, app.screen.height) : null;
    };
    window.addEventListener('game:input', receive);
    return () => window.removeEventListener('game:input', receive);
  }, [beginPlay, pause, setFaceState, showConfiguration]);

  useEffect(() => {
    if (phase !== 'initializing' && phase !== 'calibration' && phase !== 'playing') return;
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.repeat) { if (phaseRef.current === 'initializing') showConfiguration(); else if (pausedRef.current) void resume(); else pause(); }
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [phase, pause, resume, showConfiguration]);

  // The container shows the camera behind the whole game, or only in the calibration area while calibrating.
  useEffect(() => {
    if (!sensorReady || !['rules', 'calibration', 'playing'].includes(phase)) { sendPreview(null); return; }
    if (phase !== 'calibration') { sendPreview(fullFrame); return; }
    const view = cameraSpaceRef.current;
    if (!view) return;
    const update = () => sendPreview(ToPreviewRect(view.getBoundingClientRect(), window.innerWidth, window.innerHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(view);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [phase, sendPreview, sensorReady]);

  // One jsPsych run covers calibration and play, as in the original game.
  const running = phase === 'calibration' || phase === 'playing';
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (!running || !host) return;
    const lifecycle = new JsPsychExternalLifecycle(initJsPsych({ display_element: host }));
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'mouth:tongue-catch', onStart: () => undefined });
    return () => {
      lifecycle.dispose();
      if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null;
    };
  }, [running]);

  const finish = useCallback(() => {
    const session = sessionRef.current;
    if (phaseRef.current !== 'playing' || !session) return;
    const completed = SummarizeTongueSession(session, performance.now());
    const score = BuildGameScore(completed, ToPlayConfig(settingsRef.current));
    // Preview and camera stop first: once the result is sent the container accepts no more sensor requests.
    stopSensor();
    jsPsychLifecycleRef.current?.finish({ ...score.summary });
    clearPlay();
    PlayGameEndSound('Victory');
    setSummary(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settingsRef.current }, score.summary, score.rounds);
    void ExitContainerFullscreen();
    setPhase('results');
  }, [clearPlay, setPhase, stopSensor]);
  finishRef.current = finish;

  useEffect(() => {
    if (phase === 'results') feedbackRef.current?.Play('complete');
    return () => feedbackRef.current?.Clear();
  }, [phase]);

  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings)) return;
    SaveGameSettings(settings);
    setError('');
    setPhase('rules');
  };
  const beginCalibration = useCallback(() => {
    calibrationRef.current = CreateCalibration();
    setCalibration(calibrationRef.current.State());
    SendGameEvent('active');
    setPhase('calibration');
  }, [setPhase]);
  const captureMovement = () => {
    const label = calibrationRef.current.Start(performance.now());
    if (!label) return;
    SetInputCapture(label, true);
    setCalibration(calibrationRef.current.State());
  };
  // The first click turns the camera on while the game is still windowed, so the permission prompt is not hidden.
  // The second click is a fresh user action, which the container needs to enter fullscreen.
  const startTraining = useCallback(async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    if (!sensorReadyRef.current) {
      setError('');
      setPhase('initializing');
      try {
        await StartSensorInput();
      } catch (failure) {
        if (generation !== generationRef.current) return;
        setError(InputErrorMessage(failure, labels));
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
    beginCalibration();
  }, [beginCalibration, labels, setPhase, settings, showConfiguration]);

  const measure = (key: RangeKey) => key === 'durationSec' || key === 'spawnIntervalSec' ? labels.seconds(settings[key])
    : key === 'growthRate' || key === 'appleSpeed' ? labels.pixelsPerSecond(settings[key]) : `${settings[key]}%`;
  const rangeInput = (key: RangeKey, label: string, hint: string) => {
    const field = rangeSettings.find(item => item.key === key)!;
    return <label key={key}>{label}：<output>{measure(key)}</output>
      <input name={key} type="range" min={field.min} max={field.max} step={field.step} value={settings[key]}
        onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
      <small className="training-setting-description">{hint}</small></label>;
  };
  const summaryItems = [
    { label: labels.sensitivity, value: measure('sensitivityPercent') },
    { label: labels.duration, value: measure('durationSec') },
    { label: labels.edgeChance, value: measure('edgeChancePercent') },
    { label: labels.growthRate, value: measure('growthRate') },
    { label: labels.appleSpeed, value: measure('appleSpeed') },
    { label: labels.spawnInterval, value: measure('spawnIntervalSec') },
  ];
  const status = phase === 'initializing' ? labels.opening : sensorReady ? `${labels.ready}${en ? ' ' : ''}${labels.fullscreenNote}` : '';
  const faceStatus = !sensorReady ? labels.cameraOff : faceVisible ? labels.tracking : labels.noFace;
  const score = summary ? BuildGameScore(summary, ToPlayConfig(settings)) : null;
  const backLabel = IsHubGame() ? labels.backLobby : labels.backEntry;
  const step = calibrationSteps[Math.min(calibration.index, calibrationSteps.length - 1)];
  const stepCopy = labels.calibration[step];
  return <div className={`tongue-root tongue-catch-phase-${phase}${sensorReady ? ' is-camera' : ''}`}>
    <canvas ref={feedbackCanvasRef} className="tongue-feedback" aria-hidden="true" />
    <div className="tongue-field" aria-hidden="true" />
    <div ref={jsPsychHostRef} className="tongue-jspsych-host" aria-hidden="true" />
    <main className="tongue-stage" aria-label={title} inert={paused}>
      <div ref={canvasHostRef} className="tongue-canvas-host" aria-hidden="true" />
      {/* Calibration has its own card and cancel button; the original showed no play numbers there. */}
      {phase !== 'calibration' && <header className="tongue-hud">
        <p className="tongue-hud-item"><span>{labels.timeLeft}</span><strong>{labels.seconds(phase === 'playing' ? hud.timeLeft : settings.durationSec)}</strong></p>
        <p className="tongue-hud-item"><span>{labels.caught}</span><strong>{phase === 'playing' ? hud.caught : 0}</strong></p>
        <p className="tongue-hud-item"><span>{labels.missed}</span><strong>{phase === 'playing' ? hud.missed : 0}</strong></p>
        <p className="tongue-hud-item tongue-hud-status" aria-live="polite"><span>{labels.face}</span><strong>{faceStatus}</strong></p>
        <button ref={stopRef} type="button" className="btn btn-ghost tongue-stop" onClick={pauseManually}>{en ? 'Stop' : '停止'}</button>
      </header>}
      {phase === 'playing' && sensorReady && !faceVisible && <p className="tongue-face-warning" role="status">{labels.findFace}</p>}
      {(phase === 'menu' || phase === 'rules' || phase === 'initializing') && <TongueTutorial active={phase !== 'menu'} ready={phase === 'rules'} title={title}
        summaryItems={summaryItems} onStart={() => void startTraining()} onBack={showConfiguration} inputReady={sensorReady} status={status} />}
    </main>
    {phase === 'calibration' && <div className="tongue-calibration-overlay" inert={paused}>
      <div ref={cameraSpaceRef} className="tongue-calibration-camera-space" aria-hidden="true"><div className="tongue-camera-guide" /></div>
      <section className="tongue-calibration-card" aria-labelledby="tongue-calibration-title">
        <span className="tongue-step-count">{labels.calibrationStep(Math.min(calibration.index + 1, calibrationSteps.length), calibrationSteps.length)}</span>
        <span className="tongue-direction-cue"><TongueCue label={step} /></span>
        <h1 id="tongue-calibration-title">{stepCopy.title}</h1>
        <p>{stepCopy.instruction}</p>
        <div className="tongue-calibration-progress" role="progressbar" aria-label={labels.calibrationProgress} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(calibration.progress * 100)}><span style={{ transform: `scaleX(${calibration.progress})` }} /></div>
        <strong role="status">{calibration.capturing ? labels.capturing : !faceVisible ? labels.findFace : labels.capturePrompt}</strong>
        <div className="tongue-calibration-actions">
          <button className="btn btn-primary" type="button" onClick={captureMovement} disabled={calibration.capturing}>{calibration.capturing ? labels.capturing : labels.capture}</button>
          <button className="btn btn-ghost" type="button" onClick={showConfiguration}>{labels.cancel}</button>
          <button ref={stopRef} className="btn btn-ghost tongue-stop" type="button" onClick={pauseManually}>{en ? 'Stop' : '停止'}</button>
        </div>
      </section>
    </div>}
    {paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="tongue-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="tongue-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{cameraLost ? (en ? 'Camera input stopped. Continuing requires calibration; ending will not save this session.' : '相機輸入已中斷；繼續前需重新校正，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束活動後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={() => void resume()}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={showConfiguration}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog" aria-labelledby="tongue-settings-title"
      onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="tongue-settings-title">{title}</h2></header>
        <div className="training-config-body">
          {error && <p className="tongue-input-error" role="alert">{error}</p>}
          <section className="training-setting"><h3>{labels.settingsTitle}</h3>
            <p className="training-setting-description">{labels.settingsNote}</p>
            {rangeInput('sensitivityPercent', labels.sensitivity, labels.sensitivityHint)}
            {rangeInput('durationSec', labels.duration, labels.durationHint)}
            {rangeInput('edgeChancePercent', labels.edgeChance, labels.edgeChanceHint)}
          </section>
          <section className="training-setting"><h3>{labels.playTitle}</h3>
            {rangeInput('growthRate', labels.growthRate, labels.growthRateHint)}
            {rangeInput('appleSpeed', labels.appleSpeed, labels.appleSpeedHint)}
            {rangeInput('spawnIntervalSec', labels.spawnInterval, labels.spawnIntervalHint)}
          </section>
          <section className="training-setting"><h3>{labels.privacyTitle}</h3><p className="training-setting-description">{labels.privacy}</p></section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{backLabel}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings}>{labels.confirm}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'results' && summary && score && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><div className="score-key-grid">
        <div className="score-key-metric"><p>{labels.caughtApples}</p><strong>{summary.score}</strong></div>
        <div className="score-key-metric"><p>{labels.missedApples}</p><strong>{summary.missed}</strong></div>
        <div className="score-key-metric"><p>{labels.averageHold}</p><strong>{labels.seconds(summary.averageHoldSeconds)}</strong></div>
      </div>
        <p className="score-note">{labels.catchRate(score.summary.catchRate)}</p>
        <p className="score-note">{labels.holdNote}</p>
      </section>
      <p className="score-save-status" role="status">{saveState === 'local' ? labels.localSave : saveState === 'saved' ? labels.saved : saveState === 'error' ? labels.saveError : labels.saving}</p>
      <div className="score-actions">
        {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{labels.retry}</button>}
        <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{backLabel}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{labels.sessionSettings}</h2><dl className="score-context-list">
        <div className="score-context-item"><dt>{labels.actualDuration}</dt><dd>{labels.seconds(summary.durationSeconds)}</dd></div>
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      </details>
    </section></div>}
  </div>;
}

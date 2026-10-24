import { initJsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { copy, type Labels } from './labels';
import { defaultSettings, rangeSettings, ToPlayConfig, ValidateSettings, type RangeKey, type SeagullSettings } from './settings';
import { CreateFlightSession, StepFlight, SummarizeFlight, type FlightSession, type FlightSummary } from './logic/flight';
import { CreateFlapDetector, CreateHeadSmoother, CreateNeutralCalibration, HeadTargetX } from './logic/headInput';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { SeagullTutorial } from './rules/SeagullTutorial';
import { CreateSeagullScene, type SeagullScene } from './scene';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { DisposeAudioFeedback, PlayFailureSound, PlayGameEndSound, PlayMidiMusic, PlaySuccessSound, PrepareAudioFeedback, StopMidiMusic } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { ExitContainerFullscreen, ExitGame, IsHubGame, OnSavedSettings, RequestContainerFullscreen, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult,
  SetInputPreview, StartSensorInput, StopSensorInput, ToPreviewRect } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';

type Phase = 'menu' | 'rules' | 'initializing' | 'calibration' | 'playing' | 'results';
type HeadFrame = { timestamp: number; face: boolean; yaw: number | null; pitch: number | null };
type Hud = { timeLeft: number; passed: number; missed: number; altitude: number; countdown: number; frozen: boolean; crashed: boolean };

function InputErrorMessage(error: unknown, labels: Labels) {
  const reason = error instanceof Error ? error.message : '';
  return reason in labels.errors ? labels.errors[reason as keyof Labels['errors']] : labels.errors.initialization;
}

export function SeagullFlightGame() {
  const { lang } = useT();
  const labels = copy[lang];
  const title = labels.title;
  const [phase, setPhaseState] = useState<Phase>('menu');
  useEffect(() => {
    if (phase === 'playing' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<SeagullSettings>({ ...defaultSettings });
  const [error, setError] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  const [sensorReady, setSensorReady] = useState(false);
  const [faceVisible, setFaceVisible] = useState(false);
  const [calibration, setCalibration] = useState(() => CreateNeutralCalibration(0).State());
  const [hud, setHud] = useState<Hud>({ timeLeft: defaultSettings.durationSec, passed: 0, missed: 0, altitude: 80, countdown: 3, frozen: false, crashed: false });
  const [summary, setSummary] = useState<FlightSummary | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const phaseRef = useRef<Phase>('menu');
  const generationRef = useRef(0);
  const sensorReadyRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const labelsRef = useRef(labels);
  labelsRef.current = labels;
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const cameraSpaceRef = useRef<HTMLDivElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const sceneRef = useRef<SeagullScene | null>(null);
  const sessionRef = useRef<FlightSession | null>(null);
  const calibrationRef = useRef(CreateNeutralCalibration(0));
  const neutralRef = useRef({ yaw: 0, pitch: 0 });
  const smootherRef = useRef(CreateHeadSmoother());
  const flapDetectorRef = useRef(CreateFlapDetector(settings.nodRangeDeg));
  const frameRef = useRef<{ head: { yaw: number; pitch: number } | null; receivedAt: number }>({ head: null, receivedAt: -Infinity });
  const keysRef = useRef(new Set<string>());
  const pointersRef = useRef(new Map<number, number>());
  const flapRef = useRef(false);
  const hudKeyRef = useRef('');
  const finishRef = useRef<() => void>(() => undefined);
  const beginPlayRef = useRef<() => void>(() => undefined);
  const setPhase = useCallback((next: Phase) => { phaseRef.current = next; setPhaseState(next); }, []);
  const clearPlay = useCallback(() => {
    sessionRef.current = null;
    keysRef.current.clear();
    pointersRef.current.clear();
    flapRef.current = false;
    frameRef.current = { head: null, receivedAt: -Infinity };
    smootherRef.current.Reset();
    flapDetectorRef.current.Reset();
  }, []);
  const stopSensor = useCallback(() => {
    SetInputPreview(null);
    StopSensorInput();
    sensorReadyRef.current = false;
    setSensorReady(false);
    setFaceVisible(false);
  }, []);
  const stopRun = useCallback(() => {
    generationRef.current++;
    clearPlay();
    DisposeAudioFeedback();
    jsPsychLifecycleRef.current?.abort({ abort_reason: 'stop' });
  }, [clearPlay]);
  const showConfiguration = useCallback(() => {
    stopRun();
    stopSensor();
    void ExitContainerFullscreen();
    setSummary(null);
    setPhase('menu');
  }, [setPhase, stopRun, stopSensor]);
  const exit = useCallback(() => { stopRun(); stopSensor(); void ExitGame(); }, [stopRun, stopSensor]);
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    formRef.current?.querySelector('select')?.focus();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { setError(''); showConfiguration(); };
    const pagehide = () => { stopRun(); stopSensor(); void ExitContainerFullscreen(); };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('pagehide', pagehide);
      pagehide();
    };
  }, [showConfiguration, stopRun, stopSensor]);

  const beginPlay = useCallback(() => {
    const config = ToPlayConfig(settingsRef.current);
    clearPlay();
    flapDetectorRef.current = CreateFlapDetector(config.nodRangeDeg);
    sessionRef.current = CreateFlightSession(config, Math.random);
    SendGameEvent('active');
    setPhase('playing');
  }, [clearPlay, setPhase]);
  beginPlayRef.current = beginPlay;
  const beginCalibration = useCallback(() => {
    frameRef.current = { head: null, receivedAt: -Infinity };
    calibrationRef.current = CreateNeutralCalibration(performance.now());
    setCalibration(calibrationRef.current.State());
    SendGameEvent('active');
    setPhase('calibration');
  }, [setPhase]);

  useEffect(() => {
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (!sensorReadyRef.current || !['rules', 'initializing', 'calibration', 'playing'].includes(phaseRef.current)) return;
      if (message.type === 'error') {
        setError(InputErrorMessage(new Error(message.payload.reason), labelsRef.current));
        showConfiguration();
        return;
      }
      if (message.type === 'ready' || message.type !== 'frame') return;
      const frame = message.payload as HeadFrame;
      const now = performance.now();
      const angles = frame.face && frame.yaw !== null && frame.pitch !== null ? { yaw: frame.yaw, pitch: frame.pitch } : null;
      setFaceVisible(Boolean(angles));
      if (phaseRef.current === 'calibration') {
        frameRef.current = { head: angles, receivedAt: now };
        const state = calibrationRef.current.Add(angles, now);
        setCalibration(state);
        if (state.status === 'done' && state.neutral) { neutralRef.current = state.neutral; beginPlayRef.current(); }
        return;
      }
      if (phaseRef.current !== 'playing') return;
      if (!angles || now - frameRef.current.receivedAt > 250) {
        smootherRef.current.Reset();
        flapDetectorRef.current.Reset();
      }
      const head = angles ? smootherRef.current.Filter({ yaw: angles.yaw - neutralRef.current.yaw, pitch: angles.pitch - neutralRef.current.pitch }, frame.timestamp) : null;
      frameRef.current = { head, receivedAt: now };
      if (flapDetectorRef.current.Update(head?.pitch ?? null, now / 1000)) flapRef.current = true;
    };
    window.addEventListener('game:input', receive);
    return () => window.removeEventListener('game:input', receive);
  }, [showConfiguration]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    let scene: SeagullScene;
    try { scene = CreateSeagullScene(document.documentElement, host); }
    catch { setError(labelsRef.current.sceneError); return; }
    sceneRef.current = scene;
    setSceneReady(true);
    const preview = CreateFlightSession(ToPlayConfig({ ...defaultSettings, inputMode: 'keyboard' }), Math.random);
    let last = performance.now();
    let crashStarted: number | null = null;
    let animation = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const session = sessionRef.current;
      if (phaseRef.current === 'calibration' && now - frameRef.current.receivedAt > 250) {
        setFaceVisible(false);
        setCalibration(calibrationRef.current.Add(null, now));
      }
      if (phaseRef.current === 'playing' && session) {
        const head = frameRef.current.head;
        const tracking = !session.config.headControl || (head !== null && now - frameRef.current.receivedAt <= 250);
        if (!tracking) { flapDetectorRef.current.Reset(); smootherRef.current.Reset(); flapRef.current = false; setFaceVisible(false); }
        const left = keysRef.current.has('ArrowLeft') || [...pointersRef.current.values()].includes(-1);
        const right = keysRef.current.has('ArrowRight') || [...pointersRef.current.values()].includes(1);
        const events = StepFlight(session, {
          dt, tracking, targetX: session.config.headControl && head ? HeadTargetX(head.yaw, session.config.turnRangeDeg) : null,
          keyboardDirection: session.config.headControl ? 0 : (Number(right) - Number(left)) as -1 | 0 | 1,
          flap: flapRef.current, head: session.config.headControl && tracking ? head : null,
        }, session.config);
        flapRef.current = false;
        if (events.passed.length) PlaySuccessSound();
        if (events.missed.length) PlayFailureSound();
        const next: Hud = { timeLeft: Math.ceil(session.config.durationSec - session.elapsed), passed: session.results.filter(ring => ring.passed).length,
          missed: session.results.filter(ring => !ring.passed).length, altitude: Math.round(session.altitude * 100), countdown: Math.ceil(session.countdown), frozen: session.frozen, crashed: session.crashed };
        const key = JSON.stringify(next);
        if (key !== hudKeyRef.current) { hudKeyRef.current = key; setHud(next); }
        scene.update(session, dt);
        if (events.crashed) { crashStarted = now; PlayGameEndSound('Defeat'); }
        if (events.finished) { PlayGameEndSound('Victory'); finishRef.current(); }
        if (session.crashed && crashStarted !== null && now - crashStarted >= 1200) finishRef.current();
      } else { crashStarted = null; if (phaseRef.current !== 'calibration') scene.update(preview, dt); }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    const resize = new ResizeObserver(() => scene.resize());
    resize.observe(host);
    return () => { cancelAnimationFrame(animation); resize.disconnect(); scene.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ['initializing', 'calibration', 'playing'].includes(phaseRef.current)) {
        event.preventDefault(); showConfiguration(); return;
      }
      if (phaseRef.current !== 'playing' || settingsRef.current.inputMode !== 'keyboard') return;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(event.key)) return;
      if ((event.target as HTMLElement).tagName === 'BUTTON' && event.key === ' ') return;
      event.preventDefault();
      keysRef.current.add(event.key);
      if (!event.repeat && ['ArrowUp', ' '].includes(event.key)) flapRef.current = true;
    };
    const keyup = (event: KeyboardEvent) => keysRef.current.delete(event.key);
    const blur = () => { keysRef.current.clear(); pointersRef.current.clear(); flapRef.current = false; };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown, true); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  }, [showConfiguration]);
  useEffect(() => {
    if (phase !== 'calibration' || !sensorReady) { SetInputPreview(null); return; }
    const view = cameraSpaceRef.current;
    if (!view) return;
    const update = () => SetInputPreview(ToPreviewRect(view.getBoundingClientRect(), window.innerWidth, window.innerHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(view);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); SetInputPreview(null); };
  }, [phase, sensorReady]);
  const running = phase === 'calibration' || phase === 'playing';
  useEffect(() => {
    const host = jsPsychHostRef.current;
    if (!running || !host) return;
    const lifecycle = new JsPsychExternalLifecycle(initJsPsych({ display_element: host }));
    jsPsychLifecycleRef.current = lifecycle;
    void jsPsychLifecycleRef.current?.start({ moduleId: 'vision:seagull-flight', onStart: () => undefined });
    return () => { lifecycle.dispose(); if (jsPsychLifecycleRef.current === lifecycle) jsPsychLifecycleRef.current = null; };
  }, [running]);

  const finish = useCallback(() => {
    const session = sessionRef.current;
    if (phaseRef.current !== 'playing' || !session) return;
    const completed = SummarizeFlight(session);
    const score = BuildGameScore(completed, session.config);
    stopSensor();
    jsPsychLifecycleRef.current?.finish({ ...score.summary });
    clearPlay();
    setSummary(completed);
    setSaveState(IsHubGame() ? 'saving' : 'local');
    SendGameResult({ ...settingsRef.current }, score.summary, score.rounds);
    void ExitContainerFullscreen();
    setPhase('results');
  }, [clearPlay, setPhase, stopSensor]);
  finishRef.current = finish;
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !sceneReady) return;
    SaveGameSettings(settings);
    setError('');
    setPhase('rules');
  };
  const startTraining = useCallback(async () => {
    if (phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    const generation = generationRef.current;
    if (settings.inputMode === 'head' && !sensorReadyRef.current) {
      setError('');
      setPhase('initializing');
      try { await StartSensorInput(); }
      catch (failure) {
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
    phaseRef.current = 'initializing';
    await RequestContainerFullscreen();
    if (generation !== generationRef.current || phaseRef.current !== 'initializing') { await ExitContainerFullscreen(); return; }
    if (settings.inputMode === 'head') beginCalibration(); else beginPlay();
  }, [beginCalibration, beginPlay, labels, setPhase, settings, showConfiguration]);

  const measure = (key: RangeKey) => key === 'turnRangeDeg' || key === 'nodRangeDeg' ? `${settings[key]}°` : labels.seconds(settings[key]);
  const rangeInput = (key: RangeKey) => {
    const field = rangeSettings.find(item => item.key === key)!;
    return <label key={key}>{labels[key]}：<output>{measure(key)}</output>
      <input name={key} type="range" min={field.min} max={field.max} step={field.step} value={settings[key]}
        onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
      <small className="training-setting-description">{labels[`${key}Hint`]}</small></label>;
  };
  const summaryItems = [{ label: labels.inputMode, value: settings.inputMode === 'head' ? labels.head : labels.keyboard },
    ...rangeSettings.map(({ key }) => ({ label: labels[key], value: measure(key) }))];
  const status = phase === 'initializing' ? labels.opening : sensorReady ? `${labels.ready} ${labels.fullscreenNote}` : '';
  const score = summary ? BuildGameScore(summary, ToPlayConfig(settings)) : null;
  const backLabel = IsHubGame() ? labels.backLobby : labels.backEntry;
  const isPlaying = phase === 'playing';
  const faceStatus = settings.inputMode === 'keyboard' ? labels.keyboardStatus : !sensorReady ? labels.cameraOff : faceVisible ? labels.tracking : labels.noFace;
  return <div className={`seagull-root seagull-flight-phase-${phase}`}>
    <div ref={jsPsychHostRef} className="seagull-jspsych-host" aria-hidden="true" />
    <main className="seagull-stage" aria-label={title}>
      <div ref={canvasHostRef} className="seagull-canvas-host" aria-hidden="true" />
      {phase !== 'calibration' && phase !== 'results' && <header className="seagull-hud">
        <p className="seagull-hud-item"><span>{labels.timeLeft}</span><strong>{labels.seconds(isPlaying ? hud.timeLeft : settings.durationSec)}</strong></p>
        <p className="seagull-hud-item"><span>{labels.passed}</span><strong>{isPlaying ? hud.passed : 0}</strong></p>
        <p className="seagull-hud-item"><span>{labels.missed}</span><strong>{isPlaying ? hud.missed : 0}</strong></p>
        <div className="seagull-height"><label htmlFor="seagull-height">{labels.altitude} <strong>{isPlaying ? hud.altitude : 80}%</strong></label>
          <meter id="seagull-height" min={0} max={100} low={25} value={isPlaying ? hud.altitude : 80} /></div>
        <p className="seagull-hud-item seagull-hud-status"><span>{labels.face}</span><strong>{faceStatus}</strong></p>
        <button type="button" className="btn btn-ghost seagull-stop" onClick={showConfiguration}>{labels.stop}</button>
      </header>}
      {isPlaying && <>
        {hud.countdown > 0 && <p className="seagull-countdown" role="status">{hud.countdown}</p>}
        {(hud.frozen || hud.crashed || hud.altitude < 25) && <p className="seagull-warning" role="status">{hud.crashed ? labels.crashed : hud.frozen ? labels.findFace : labels.lowAltitude}</p>}
        {settings.inputMode === 'keyboard' && <nav className="seagull-controls" aria-label={labels.inputMode}>
          {([-1, 0, 1] as const).map(direction => <button type="button" key={direction} className={`btn ${direction === 0 ? 'btn-primary' : 'btn-ghost'}`}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointersRef.current.set(event.pointerId, direction); }}
            onPointerUp={event => { pointersRef.current.delete(event.pointerId); }} onPointerCancel={event => pointersRef.current.delete(event.pointerId)}
            onLostPointerCapture={event => pointersRef.current.delete(event.pointerId)}
            onClick={event => { if (direction === 0) flapRef.current = true; else if (event.detail === 0 && sessionRef.current) sessionRef.current.targetX = direction; }}>
            {direction < 0 ? labels.left : direction > 0 ? labels.right : labels.flap}</button>)}
        </nav>}
      </>}
      {(phase === 'menu' || phase === 'rules' || phase === 'initializing') && <SeagullTutorial active={phase !== 'menu'} ready={phase === 'rules' && sceneReady} title={title}
        summaryItems={summaryItems} onStart={() => void startTraining()} onBack={showConfiguration} inputReady={sensorReady} keyboard={settings.inputMode === 'keyboard'} status={status} />}
    </main>
    {phase === 'calibration' && <div className="seagull-calibration-overlay">
      <div ref={cameraSpaceRef} className="seagull-calibration-camera-space" aria-hidden="true"><span className="seagull-calibration-cross">+</span></div>
      <section className="seagull-calibration-card" aria-labelledby="seagull-calibration-title">
        <h1 id="seagull-calibration-title">{labels.calibrationTitle}</h1><p>{labels.calibrationInstruction}</p>
        <div className="seagull-calibration-progress" role="progressbar" aria-label={labels.calibrationProgress} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(calibration.progress * 100)}><span style={{ transform: `scaleX(${calibration.progress})` }} /></div>
        <p role="status">{calibration.status === 'failed' ? labels.calibrationFailed : !faceVisible ? labels.findFace : labels.calibrationWaiting}</p>
        <div className="seagull-calibration-actions">
          {calibration.status === 'failed' && <button className="btn btn-primary" type="button" onClick={beginCalibration}>{labels.retry}</button>}
          <button className="btn btn-ghost" type="button" onClick={showConfiguration}>{labels.cancel}</button>
        </div>
      </section>
    </div>}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog" aria-labelledby="seagull-settings-title" onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="seagull-settings-title">{title}</h2></header>
        <div className="training-config-body">
          {error && <p className="seagull-input-error" role="alert">{error}</p>}
          <section className="training-setting"><h3>{labels.settingsTitle}</h3>
            <label>{labels.inputMode}<select name="inputMode" value={settings.inputMode} onChange={event => setSettings({ ...settings, inputMode: event.target.value as SeagullSettings['inputMode'] })}>
              <option value="head">{labels.head}</option><option value="keyboard">{labels.keyboard}</option>
            </select><small className="training-setting-description">{labels.inputHint}</small></label>
            {rangeInput('durationSec')}
          </section>
          <section className="training-setting"><h3>{labels.motionTitle}</h3>{rangeInput('turnRangeDeg')}{rangeInput('nodRangeDeg')}</section>
          <section className="training-setting"><h3>{labels.flightTitle}</h3>{rangeInput('glideSec')}{rangeInput('ringIntervalSec')}</section>
          <section className="training-setting"><h3>{labels.privacyTitle}</h3><p className="training-setting-description">{labels.privacy}</p></section>
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" disabled={!sceneReady} onClick={confirmSettings}>{labels.confirm}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{backLabel}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'results' && summary && score && <div className="experiment-container results-container"><section className="experiment-results">
      <header className="score-header"><h1>{labels.resultsTitle}</h1><p>{title}</p></header>
      <section className="score-priority"><h2>{labels.keyResults}</h2><div className="score-key-grid">
        {[[labels.passed, summary.passed], [labels.missed, summary.missed], [labels.passRate, summary.passRate === null ? labels.none : `${summary.passRate}%`]].map(([label, value]) =>
          <div className="score-key-metric" key={label}><p>{label}</p><strong>{value}</strong></div>)}
      </div><dl className="score-flight-details">
        {[[labels.flaps, summary.flaps], [labels.crashLabel, summary.crashed ? labels.yes : labels.no],
          [labels.maxTurn, summary.maxTurnDeg === null ? labels.none : `${summary.maxTurnDeg}°`], [labels.maxNod, summary.maxNodDeg === null ? labels.none : `${summary.maxNodDeg}°`]].map(([label, value]) =>
          <div className="score-context-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl></section>
      <section className="score-context"><h2>{labels.sessionSettings}</h2><dl className="score-context-list">
        <div className="score-context-item"><dt>{labels.actualDuration}</dt><dd>{labels.seconds(summary.durationSeconds)}</dd></div>
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? labels.localSave : saveState === 'saved' ? labels.saved : saveState === 'error' ? labels.saveError : labels.saving}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" type="button" onClick={() => { setSaveState('saving'); RetryGameSave(); }}>{labels.retry}</button>}
      <button className="btn btn-primary score-return-button" type="button" onClick={exit}>{backLabel}</button>
    </section></div>}
  </div>;
}

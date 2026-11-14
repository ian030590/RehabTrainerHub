import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { initJsPsych } from 'jspsych';
import { defaultConfig, difficulties, IsMotorConfig, type MotorConfig } from './config';
import { copy } from './labels';
import { CreateEmptyMetrics, CreateInitialTarget, CreateLaserEncounter, UpdateLaserEncounter, GetHandCursorPoint, BuildLaserLiveState, ToPercent, FormatHandChoice } from './engine';
import type { GamePhase, HandState, TargetState, SessionRecord, LiveState } from './types';
import { useT } from './i18n/useT';
import { MotorTutorial } from './rules/MotorTutorial';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { IsHubGame, OnSavedSettings, SaveGameSettings, StartHandInput, StopHandInput, SendGameEvent, SendGameResult, RetryGameSave } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PrepareAudioFeedback, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { CreateLaserAudio } from './runtime/laserAudio';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { Clamp } from './gameUtils';

export function MotorCortexRehabGame({ onExit }: { onExit: () => void }) {
  const { lang } = useT();
  const labels = copy[lang];
  const en = lang === 'en';
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const handCanvasRef = useRef<HTMLCanvasElement>(null);
  const jsPsychHostRef = useRef<HTMLDivElement>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const jsPsychLifecycleRef = useRef<JsPsychExternalLifecycle | null>(null);
  const animationRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const phaseRef = useRef<GamePhase>('menu');
  const targetRef = useRef<TargetState | null>(null);
  const enemyRef = useRef(CreateLaserEncounter());
  const laserAudioRef = useRef<ReturnType<typeof CreateLaserAudio> | null>(null);
  const handRef = useRef<HandState>({ x: 0, y: 0, visible: false, handedness: null, lastSeenAt: 0 });
  const metricsRef = useRef(CreateEmptyMetrics());
  const [phase, setPhaseState] = useState<GamePhase>('menu');
  useEffect(() => {
    if (phase === 'playing' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
  useEffect(() => {
    const dispose = () => { laserAudioRef.current?.dispose(); DisposeAudioFeedback(); };
    window.addEventListener('pagehide', dispose);
    return () => { window.removeEventListener('pagehide', dispose); dispose(); };
  }, []);
  const [config, setConfig] = useState<MotorConfig>({ ...defaultConfig });
  const [error, setError] = useState('');
  const [handInputReady, setHandInputReady] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [live, setLive] = useState<LiveState>({ timeRemaining: 60, accuracy: 0, visibility: 0, successes: 0, misses: 0,
    currentHoldPercent: 0, level: 1, targetX: 50, targetY: 42, targetRadius: 66, handX: 64, handY: 62, handVisible: false, insideTarget: false,
    handRaised: false, laserActive: false, enemyPhase: 'active', enemyNumber: 1, enemyMoving: true, enemyFacingLeft: false, defeatFrame: 0, interrupted: false, patrolY: 42 });
  useEffect(() => {
    const update = () => {
      const hand = handRef.current;
      const height = stageRef.current?.clientHeight ?? 0;
      if (document.hidden) { laserAudioRef.current?.stop(); return; }
      if (phase === 'playing' && (!hand.visible || performance.now() - hand.lastSeenAt > 240
        || hand.y > height * config.raiseLinePercent / 100)) { laserAudioRef.current?.setFiring(false); return; }
      laserAudioRef.current?.setFiring(phase === 'playing' && live.laserActive, live.insideTarget, live.currentHoldPercent);
    };
    update();
    const timer = phase === 'playing' ? window.setInterval(update, 60) : null;
    document.addEventListener('visibilitychange', update);
    return () => { if (timer !== null) window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [phase, live.laserActive, live.insideTarget, live.currentHoldPercent, config.raiseLinePercent]);
  useEffect(() => {
    if (phase !== 'playing') DrawHand(handCanvasRef.current, [], config.raiseLinePercent);
  }, [phase, config.raiseLinePercent]);
  useEffect(() => {
    const resize = () => setLive(current => ({ ...current }));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const difficulty = difficulties.find(item => item.id === config.difficulty)!;
  const setPhase = useCallback((next: GamePhase) => { phaseRef.current = next; setPhaseState(next); }, []);
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultConfig, IsMotorConfig);
    if (restored && phaseRef.current === 'menu') setConfig(restored);
  }), []);
  const stopInput = useCallback(() => {
    generationRef.current++;
    setHandInputReady(false);
    StopHandInput();
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    handRef.current.visible = false;
    laserAudioRef.current?.stop();
    handCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 320, 240);
  }, []);
  const showConfiguration = useCallback(() => {
    stopInput(); jsPsychLifecycleRef.current?.abort({ abort_reason: 'configure' });
    setLive(current => ({ ...current, accuracy: 0, visibility: 0, successes: 0, misses: 0,
      currentHoldPercent: 0, level: 1, handVisible: false, handRaised: false, insideTarget: false, laserActive: false, enemyPhase: 'active', enemyNumber: 1,
      enemyMoving: true, enemyFacingLeft: false, defeatFrame: 0, interrupted: false }));
    setResult(null); setPhase('menu');
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [stopInput, setPhase]);
  const exitGame = useCallback(() => { stopInput(); jsPsychLifecycleRef.current?.abort({ abort_reason: 'exit' }); onExit(); }, [stopInput, onExit]);
  useEffect(() => {
    const jsPsych = initJsPsych({ display_element: jsPsychHostRef.current! });
    const lifecycle = new JsPsychExternalLifecycle(jsPsych);
    jsPsychRef.current = jsPsych; jsPsychLifecycleRef.current = lifecycle;
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', showConfiguration);
    return () => { stopInput(); lifecycle.dispose(); window.removeEventListener('game:saved', saved); window.removeEventListener('game:configure', showConfiguration); };
  }, [showConfiguration, stopInput]);
  useEffect(() => {
    if (phase === 'menu') formRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    if (phase === 'ready') rootRef.current?.querySelector<HTMLButtonElement>('.motor-tutorial-ready .btn-primary')?.focus();
  }, [phase]);
  useEffect(() => {
    const receive = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (!['ready', 'initializing', 'playing'].includes(phaseRef.current)) return;
      if (message.type === 'error') {
        showConfiguration();
        setError(message.payload.reason === 'permission' ? labels.permission : message.payload.reason === 'disconnected' ? labels.disconnected : labels.initialization);
      }
      if (message.type !== 'frame' || phaseRef.current !== 'playing') return;
      const stage = stageRef.current;
      const rect = stage ? { width: stage.clientWidth, height: stage.clientHeight } : null;
      const points = message.payload.landmarks as { x: number; y: number; z: number }[];
      DrawHand(handCanvasRef.current, points, config.raiseLinePercent);
      if (points.length && rect) {
        handRef.current = { ...GetHandCursorPoint(points, rect.width, rect.height), visible: true, handedness: null, lastSeenAt: performance.now() };
      } else if (performance.now() - handRef.current.lastSeenAt > 240) handRef.current.visible = false;
    };
    window.addEventListener('game:input', receive);
    return () => window.removeEventListener('game:input', receive);
  }, [labels, config.raiseLinePercent, showConfiguration]);
  useEffect(() => {
    const abort = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && ['playing', 'initializing'].includes(phaseRef.current)) { event.preventDefault(); showConfiguration(); }
    };
    window.addEventListener('keydown', abort);
    return () => window.removeEventListener('keydown', abort);
  }, [showConfiguration]);
  const firingLineOptions = [{ value: 80, label: labels.raiseLow }, { value: 65, label: labels.raiseMiddle }, { value: 50, label: labels.raiseHigh }];
  const summaryItems = [
    { label: labels.drill, value: labels.drillNames[config.drill] }, { label: labels.difficulty, value: labels.difficultyNames[config.difficulty] },
    { label: labels.duration, value: `${config.durationSec}s` }, { label: labels.hand, value: FormatHandChoice(config.handChoice, labels) },
    { label: labels.targetSize, value: `${config.targetSizePercent}%` }, { label: labels.speed, value: `${config.speedPercent}%` },
    { label: labels.raiseLine, value: firingLineOptions.find(item => item.value === config.raiseLinePercent)!.label },
  ];
  const confirm = () => {
    if (!formRef.current?.reportValidity() || !IsMotorConfig(config)) return;
    SaveGameSettings(config);
    setError(''); setLive(current => ({ ...current, timeRemaining: config.durationSec, targetRadius: difficulty.radius * config.targetSizePercent / 100 })); setPhase('rules');
  };
  const handleModalKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); exitGame(); }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); confirm(); }
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input,select,button:not(:disabled)'));
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
  };
  const completeSession = (now: number) => {
    if (phaseRef.current !== 'playing') return;
    const metrics = metricsRef.current;
    const duration = Math.max(1, now - metrics.startedAt);
    const session: SessionRecord = {
      Test_Date: new Date().toISOString(), Participant_ID: 'Guest', Drill: labels.drillNames[config.drill],
      Reference_Module: `Tracking Mode ${['bounce', 'vertical', 'horizontal', 'random'].indexOf(config.drill) + 1}`,
      Difficulty: config.difficulty, Duration_Seconds: Number((duration / 1000).toFixed(1)), Tracking_Hand: config.handChoice,
      Target_Size_Scale: config.targetSizePercent / 100, Speed_Scale: config.speedPercent / 100,
      Adaptive_Level: targetRef.current?.level ?? 1, Accuracy_Percent: ToPercent(metrics.handVisibleMs ? metrics.inTargetMs / metrics.handVisibleMs : 0),
      Hand_Visible_Percent: ToPercent(metrics.handVisibleMs / duration), Successful_Reps: metrics.successes, Interrupted_Holds: metrics.misses,
      Raise_Line_Percent: config.raiseLinePercent, Raised_Percent: ToPercent(metrics.raisedMs / duration),
      Best_Hold_Seconds: Number((metrics.bestHoldMs / 1000).toFixed(2)), Event_Records: metrics.events.map(item => ({ ...item })),
    };
    stopInput(); laserAudioRef.current?.playComplete(); jsPsychLifecycleRef.current?.finish(session as unknown as Record<string, unknown>);
    setResult(session); setPhase('results'); setSaveState(IsHubGame() ? 'saving' : 'local');
    const score = BuildGameScore(session); SendGameResult({ ...config }, score.summary, score.rounds);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };
  const startTraining = async () => {
    if (phaseRef.current !== 'ready' || !IsMotorConfig(config)) return;
    if (!handInputReady) stopInput();
    const generation = generationRef.current;
    setPhase('initializing'); setError('');
    try {
      if (!handInputReady) {
        await StartHandInput(config.handChoice);
        if (generationRef.current !== generation) return;
        setHandInputReady(true); setPhase('ready');
        return;
      }
      PrepareAudioFeedback(jsPsychRef);
      laserAudioRef.current?.dispose();
      laserAudioRef.current = CreateLaserAudio();
      await rootRef.current?.requestFullscreen?.().catch(() => undefined);
      if (generationRef.current !== generation) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        return;
      }
      metricsRef.current = { ...CreateEmptyMetrics(), startedAt: performance.now(), lastTickAt: performance.now() }; targetRef.current = null;
      enemyRef.current = CreateLaserEncounter();
      await jsPsychLifecycleRef.current?.start({ moduleId: 'motor:motor-cortex-rehab', onStart: () => {
        setPhase('playing'); SendGameEvent('active'); let lastLive = 0;
        const tick = (now: number) => {
          if (phaseRef.current !== 'playing') return;
          const rect = { width: stageRef.current!.clientWidth, height: stageRef.current!.clientHeight };
          if (rect.width > 0 && rect.height > 0) {
            targetRef.current ??= CreateInitialTarget(config.drill, difficulty, config.targetSizePercent / 100, config.speedPercent / 100, rect.width, rect.height * config.raiseLinePercent / 100);
            UpdateLaserEncounter({ now, rect, drill: config.drill, activeDifficulty: difficulty, durationSec: config.durationSec, enemy: enemyRef.current,
              raiseLinePercent: config.raiseLinePercent,
              targetSizeScale: config.targetSizePercent / 100, speedScale: config.speedPercent / 100, target: targetRef.current, hand: handRef.current,
              metrics: metricsRef.current, labels, onSuccess: () => { laserAudioRef.current?.setFiring(false); laserAudioRef.current?.playHit(); }, onComplete: completeSession });
            if (phaseRef.current === 'playing' && now - lastLive >= 45) { lastLive = now; setLive(BuildLaserLiveState(now, config.durationSec, rect, targetRef.current, handRef.current, metricsRef.current, enemyRef.current, config.raiseLinePercent)); }
          }
          if (phaseRef.current === 'playing') animationRef.current = requestAnimationFrame(tick);
        };
        animationRef.current = requestAnimationFrame(tick);
      } });
    } catch (reason) {
      if (generationRef.current !== generation) return;
      showConfiguration(); setError(reason instanceof Error && reason.message === 'permission' ? labels.permission : labels.initialization);
    }
  };
  const preview = phase !== 'playing';
  const heroX = Math.max(20, Math.min(80, preview ? 67 : live.handX));
  const stageHeight = stageRef.current?.clientHeight || 600;
  const stageWidth = stageRef.current?.clientWidth || 900;
  const previewRadius = Math.max(1, Math.min(difficulty.radius * config.targetSizePercent / 100,
    stageWidth / 2 - 12, stageHeight * config.raiseLinePercent / 200 - 12));
  const stageRect = stageRef.current?.getBoundingClientRect?.();
  const stageTop = (stageRect?.top ?? 0) + (stageRef.current?.clientTop ?? 0);
  const stageLeft = (stageRect?.left ?? 0) + (stageRef.current?.clientLeft ?? 0);
  const titleBottom = (rootRef.current?.querySelector('.motor-mission-title')?.getBoundingClientRect().bottom ?? stageTop + 40) - stageTop;
  const previewMinimum = Math.max(stageHeight * .15, titleBottom + 18 + previewRadius);
  const previewMaximum = stageHeight * config.raiseLinePercent / 100 - previewRadius - 12;
  const previewY = previewMinimum <= previewMaximum ? Clamp(stageHeight * config.raiseLinePercent / 200, previewMinimum, previewMaximum) : stageHeight * config.raiseLinePercent / 200;
  const buildingSize = Math.max(16, Math.round(Math.min(stageHeight * .15, stageWidth / 8) / 16) * 16);
  const buildingCount = Math.ceil(stageWidth / buildingSize) + 1;
  const gloveHeight = Math.min(stageHeight * (1 - config.raiseLinePercent / 100) * .85, 120);
  const heroY = config.raiseLinePercent + (100 - config.raiseLinePercent) * .5 - gloveHeight * .05 / stageHeight * 100;
  const beamX = live.insideTarget ? live.targetX : live.handX;
  const beamY = live.insideTarget ? live.targetY : live.handY;
  const enemyVariant = ((preview ? 1 : live.enemyNumber) - 1) % 4;
  const defeated = !preview && live.enemyPhase === 'defeated';
  const needsRaise = !preview && live.handVisible && !live.handRaised;
  const promptWidth = Math.min(en ? 190 : 112, stageWidth - 16);
  const promptX = Clamp(stageWidth * live.handX / 100, 8 + promptWidth / 2, stageWidth - 8 - promptWidth / 2);
  let promptY = Clamp(stageHeight * live.handY / 100 - 48, 8, stageHeight - 32);
  if (needsRaise) for (const selector of ['.motor-cortex-camera', '.motor-exit-button']) {
    const obstacle = rootRef.current?.querySelector(selector)?.getBoundingClientRect();
    if (obstacle && stageLeft + promptX - promptWidth / 2 < obstacle.right && stageLeft + promptX + promptWidth / 2 > obstacle.left
      && stageTop + promptY < obstacle.bottom && stageTop + promptY + 24 > obstacle.top) promptY = Math.max(8, obstacle.top - stageTop - 32);
  }
  const style = { '--motor-target-x': `${preview ? 50 : live.targetX}%`, '--motor-target-y': `${preview ? previewY / stageHeight * 100 : live.targetY}%`,
    '--motor-target-size': `${preview ? previewRadius * 2 : live.targetRadius * 2}px`,
    '--motor-hand-x': `${preview ? 67 : live.handX}%`, '--motor-hand-y': `${preview ? 66 : live.handY}%`,
    '--motor-hold-progress': `${preview ? 55 : live.currentHoldPercent * 100}%`,
    '--motor-enemy-health': `${preview ? 45 : (1 - live.currentHoldPercent) * 100}%`,
    '--motor-raise-line': `${config.raiseLinePercent}%`, '--motor-hero-x': `${heroX}%`, '--motor-hero-y': `${heroY}%`,
    '--motor-beam-x': `${beamX}%`, '--motor-beam-y': `${beamY}%`, '--motor-building-size': `${buildingSize}px`,
    '--motor-patrol-y': `${preview ? previewY / stageHeight * 100 : live.patrolY}%`,
    '--motor-prompt-x': `${promptX}px`, '--motor-prompt-y': `${promptY}px`, '--motor-prompt-width': `${promptWidth}px` } as CSSProperties;
  return <div ref={rootRef} className={`motor-cortex-rehab-game motor-cortex-rehab-phase-${phase} motor-cortex-drill-${config.drill}`} style={style}>
    <div ref={jsPsychHostRef} className="motor-jspsych-host" aria-hidden="true" />
    {phase !== 'results' && <div className="motor-cortex-play" aria-hidden={phase === 'menu' || phase === 'ready'}>
      <div className="motor-cortex-hud">{[[labels.timeLeft, `${preview ? config.durationSec : Math.ceil(live.timeRemaining)}s`], [labels.accuracy, `${ToPercent(live.accuracy)}%`], [labels.visible, `${ToPercent(live.visibility)}%`], [labels.reps, live.successes], [labels.level, live.level]].map(([label, value]) => <p key={label} className={label === labels.reps && defeated ? 'is-scored' : ''}><span>{label}</span><strong>{value}</strong></p>)}</div>
      <div ref={stageRef} className="motor-cortex-stage" aria-label={labels.followTarget}>
        <div className="motor-city" aria-hidden="true"><div className="motor-skyline">{Array.from({ length: buildingCount }, (_, index) => <img key={index} src={`./assets/laser-hero/building-${[0, 1, 2, 3, 1, 0, 3, 2][index % 8]}.png`} alt="" draggable={false} />)}</div><div className="motor-road-plane"><div className="motor-street" /><div className="motor-road-centre" /></div></div>
        <p className="motor-mission-title">{labels.missionTitle}</p>
        <div className="motor-cortex-path motor-cortex-path-vertical" /><div className="motor-cortex-path motor-cortex-path-horizontal" />
        <div className={`motor-firing-line ${needsRaise ? 'needs-raise' : ''}`}><p>{labels.raiseLineHint}</p></div>
        <svg className={`motor-laser-beam ${!preview && live.laserActive ? 'is-firing' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line className="motor-laser-edge" x1={heroX} y1={heroY} x2={beamX} y2={beamY} /><line className="motor-laser-core" x1={heroX} y1={heroY} x2={beamX} y2={beamY} /></svg>
        <div className={`motor-cortex-target motor-enemy ${live.insideTarget && !preview ? 'is-hit' : ''} ${defeated ? 'is-defeated' : ''} ${(preview ? phase === 'rules' : live.enemyMoving) ? 'is-moving' : ''}`} data-enemy-number={preview ? 1 : live.enemyNumber} data-facing={live.enemyFacingLeft ? 'left' : 'right'} role="img" aria-label={labels.target}>
          <div className="motor-enemy-shadow" /><div className="motor-enemy-facing"><div className="motor-enemy-body"><img className="motor-enemy-sprite" src={`./assets/laser-hero/enemy-${enemyVariant}.png`} alt="" draggable={false} /><img className="motor-enemy-sprite motor-enemy-step" src={`./assets/laser-hero/enemy-${enemyVariant}-step.png`} alt="" draggable={false} /></div></div>
          <div className="motor-enemy-health" aria-hidden="true"><i /></div>
          {defeated && <><img className="motor-enemy-burst" src={`./assets/laser-hero/${live.defeatFrame < 4 ? `burst-${live.defeatFrame}` : 'smoke'}.png`} alt="" /><img className="motor-enemy-burst motor-reduced-burst" src="./assets/laser-hero/burst-1.png" alt="" /><span className="motor-enemy-pop" aria-hidden="true">+1</span></>}
        </div>
        <div className={`motor-cortex-hand-cursor ${live.handVisible || preview ? 'is-visible' : ''} ${!preview && live.laserActive ? 'is-firing' : ''}`}><img src="./assets/laser-hero/reticle.png" alt="" draggable={false} /></div>
        <div className="motor-hero-foreground" aria-hidden="true"><div className="motor-hero-hand" data-hand={config.handChoice}><i className="motor-hero-sleeve" /><img src="./assets/laser-hero/hero-glove.png" alt="" draggable={false} /></div></div>
        {!preview && live.laserActive && <img className="motor-muzzle-spark" src="./assets/laser-hero/burst-3.png" alt="" />}
        {!preview && live.insideTarget && <img className="motor-impact-spark" src="./assets/laser-hero/burst-2.png" alt="" />}
        <p className={`motor-aim-label ${needsRaise ? 'needs-raise' : ''}`} role="status">{needsRaise ? labels.raiseHigher : !preview && live.laserActive ? labels.firing : labels.handCursor}</p>
      </div>
      <div className="motor-cortex-instruction"><h2>{labels.drillNames[config.drill]}</h2><p>{labels.followTarget}</p><div className="motor-cortex-hold-meter" role="progressbar" aria-label={labels.hold} aria-valuenow={Math.round(preview ? 55 : live.currentHoldPercent * 100)} aria-valuemin={0} aria-valuemax={100}><i /></div><p className="motor-interruption-cue" role="status">{!preview && live.interrupted ? labels.aimAgain : ''}</p></div>
      <div className="motor-cortex-camera"><canvas ref={handCanvasRef} width={320} height={240} aria-label={en ? 'Hand landmark preview' : '手部座標預覽'} />
        {preview && <svg className="motor-hand-placeholder" viewBox="0 0 100 100" aria-hidden="true"><path d="M35 80L15 50Q10 40 20 42L30 52V22Q30 12 38 22V44V12Q44 2 48 12V44V18Q56 8 58 18V48V30Q66 20 68 30V66Q64 88 35 80Z" /></svg>}
        <p>{preview ? (en ? 'Hand landmark preview' : '手部座標預覽') : live.handVisible ? labels.tracking : labels.finding}</p>
      </div>
      {phase === 'playing' && <button className="motor-exit-button btn btn-ghost" onClick={showConfiguration}>{en ? 'Stop' : '停止活動'}</button>}
    </div>}
    {phase === 'menu' && <section className="training-panel" role="dialog" aria-modal="true" aria-labelledby="motor-config-title" onKeyDown={handleModalKey}>
      <form ref={formRef} className="training-config" onSubmit={event => event.preventDefault()}>
        <header className="training-config-header"><div className="training-config-title"><p className="training-config-label">{labels.configLabel}</p><h2 id="motor-config-title">{labels.title}</h2></div></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Session settings' : '活動設定'}</h3>
          <label>{labels.drill}<select name="drill" value={config.drill} onChange={event => setConfig({ ...config, drill: event.target.value as MotorConfig['drill'] })}>{(['bounce', 'vertical', 'horizontal', 'random'] as const).map(value => <option key={value} value={value}>{labels.drillNames[value]}</option>)}</select></label><p>{labels.drillDescriptions[config.drill]}</p>
          <label>{labels.difficulty}<select name="difficulty" value={config.difficulty} onChange={event => setConfig({ ...config, difficulty: event.target.value as MotorConfig['difficulty'] })}>{difficulties.map(item => <option key={item.id} value={item.id}>{labels.difficultyNames[item.id]} · {en ? 'Steady aim' : '穩定瞄準'} {item.holdMs / 1000}s</option>)}</select></label>
          <label>{labels.duration}<select name="durationSec" value={config.durationSec} onChange={event => setConfig({ ...config, durationSec: Number(event.target.value) })}>{[45, 60, 90].map(value => <option key={value} value={value}>{value}s</option>)}</select></label>
          <label>{labels.hand}<select name="handChoice" value={config.handChoice} onChange={event => setConfig({ ...config, handChoice: event.target.value as MotorConfig['handChoice'] })}>{(['any', 'left', 'right'] as const).map(value => <option key={value} value={value}>{FormatHandChoice(value, labels)}</option>)}</select></label>
          <label>{labels.raiseLine}<select name="raiseLinePercent" aria-describedby="motor-firing-line-description" value={config.raiseLinePercent} onChange={event => setConfig({ ...config, raiseLinePercent: Number(event.target.value) })}>{firingLineOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p id="motor-firing-line-description">{labels.raiseLineDesc}</p>
          <label>{labels.targetSize}：<output>{config.targetSizePercent}%</output><input name="targetSizePercent" type="range" required min={75} max={130} step={5} value={config.targetSizePercent} onChange={event => setConfig({ ...config, targetSizePercent: event.target.valueAsNumber })} /></label>
          <label>{labels.speed}：<output>{config.speedPercent}%</output><input name="speedPercent" type="range" required min={70} max={140} step={5} value={config.speedPercent} onChange={event => setConfig({ ...config, speedPercent: event.target.valueAsNumber })} /></label>
        </section><section className="training-setting"><h3>{labels.privacyTitle}</h3><p>{labels.privacyDesc}</p></section>{error && <p role="alert" className="motor-input-error">{error}</p>}</div>
        <footer className="config-actions"><div className="training-config-navigation-buttons"><button type="button" className="btn btn-primary" onClick={confirm}>{en ? 'Confirm settings' : '確認設定'}</button><button type="button" className="btn btn-ghost" onClick={exitGame}>{en ? 'Back' : '返回'}</button></div></footer>
      </form>
    </section>}
    <MotorTutorial active={phase === 'rules'} onBack={showConfiguration} onFinish={() => setPhase('ready')} />
    {phase === 'ready' && <section className="training-panel motor-tutorial-ready" role="dialog" aria-modal="true" aria-labelledby="motor-ready-title" onKeyDown={handleModalKey}>
      <div className="training-config training-confirmation"><header className="training-config-header"><h2 id="motor-ready-title">{labels.title}</h2></header>
        <div className="training-config-body"><section className="training-setting"><h3>{en ? 'Confirm settings' : '確認設定'}</h3><div className="training-config-summary">{summaryItems.map(item => <p className="training-config-summary-item" key={item.label}><strong>{item.label}：</strong>{item.value}</p>)}</div></section><p>{handInputReady ? (en ? 'Camera ready. Start training to enter fullscreen and begin the timer.' : '相機已準備完成。按下開始訓練後進入全螢幕並開始計時。') : (en ? 'Enable the camera first. Start training after hand tracking is ready.' : '請先啟用相機，手部追蹤準備完成後再開始訓練。')}</p></div>
        <footer className="config-actions"><div className="training-config-navigation-buttons"><button type="button" className="btn btn-primary" onClick={() => void startTraining()}>{handInputReady ? (en ? 'Start training' : '開始訓練') : (en ? 'Enable camera' : '啟用相機')}</button><button type="button" className="btn btn-ghost" onClick={showConfiguration}>{en ? 'Back to settings' : '返回設定'}</button></div></footer>
      </div></section>}
    {phase === 'initializing' && <section className="training-panel" role="status"><div className="training-config motor-loading"><h2>{labels.loadingTitle}</h2><p>{en ? 'Confirm camera access in the camera dialog.' : '請在相機視窗確認啟用。'}</p><button className="btn btn-ghost" onClick={showConfiguration}>{en ? 'Cancel' : '取消'}</button></div></section>}
    {phase === 'results' && result && <div className="experiment-container motor-results-container"><section className="experiment-results">
      <h1>{labels.resultsTitle}</h1><p>{en ? 'Records from this session' : '本次活動紀錄'}</p>
      <section className="score-priority"><h2 className="score-priority-title">{en ? 'Key results' : '主要統計'}</h2><dl className="score-key-grid">{[[labels.accuracy, `${result.Accuracy_Percent}%`], [labels.visible, `${result.Hand_Visible_Percent}%`], [labels.reps, result.Successful_Reps]].map(([label, value]) => <div className="score-key-metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section className="score-context"><h2>{en ? 'Session overview' : '當次概況'}</h2><dl className="score-context-list">{[...summaryItems, { label: labels.raisedTime, value: `${result.Raised_Percent}%` }, { label: labels.bestHold, value: `${result.Best_Hold_Seconds}s` }, { label: labels.interrupted, value: result.Interrupted_Holds }, { label: labels.level, value: result.Adaptive_Level }, { label: en ? 'Actual activity duration' : '實際活動時間', value: `${result.Duration_Seconds}s` }].map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>
      <ScoreAnalysis rounds={BuildGameScore(result).rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Results stay on this device.' : '獨立遊玩，成果保留於本機畫面。') : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" onClick={RetryGameSave}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" onClick={exitGame}>{IsHubGame() ? (en ? 'Return to lobby' : '返回大廳') : (en ? 'Return to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

function DrawHand(canvas: HTMLCanvasElement | null, points: { x: number; y: number }[], raiseLinePercent: number) {
  const context = canvas?.getContext('2d');
  if (!context || !canvas) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const styles = getComputedStyle(canvas);
  context.strokeStyle = styles.getPropertyValue('--hand-line').trim(); context.fillStyle = styles.getPropertyValue('--hand-point').trim(); context.lineWidth = 2;
  for (const indices of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]]) {
    context.beginPath(); indices.forEach((index, order) => { const point = points[index]; if (!point) return; if (!order) context.moveTo((1 - point.x) * canvas.width, point.y * canvas.height); else context.lineTo((1 - point.x) * canvas.width, point.y * canvas.height); }); context.stroke();
  }
  for (const point of points) { context.beginPath(); context.arc((1 - point.x) * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI); context.fill(); }
  const palm = points.length ? GetHandCursorPoint(points.map(point => ({ ...point, z: 0 })), canvas.width, canvas.height) : null;
  const belowLine = palm !== null && palm.y > canvas.height * raiseLinePercent / 100;
  context.strokeStyle = styles.getPropertyValue(belowLine ? '--hand-point' : '--hand-line').trim();
  context.lineWidth = belowLine ? 4 : 2;
  context.setLineDash([8, 6]); context.beginPath();
  context.moveTo(0, canvas.height * raiseLinePercent / 100); context.lineTo(canvas.width, canvas.height * raiseLinePercent / 100);
  context.stroke(); context.setLineDash([]);
}

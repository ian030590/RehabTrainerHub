import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { initJsPsych } from 'jspsych';
import { defaultConfig, difficulties, IsMotorConfig, type MotorConfig } from './config';
import { copy } from './labels';
import { CreateEmptyMetrics, CreateInitialTarget, UpdateTrainingLoop, GetHandCursorPoint, BuildLiveState, ToPercent, FormatHandChoice } from './engine';
import type { GamePhase, HandState, TargetState, SessionRecord, LiveState } from './types';
import { useT } from './i18n/useT';
import { MotorTutorial } from './rules/MotorTutorial';
import { JsPsychExternalLifecycle } from './runtime/jsPsychLifecycle';
import { IsHubGame, StartHandInput, StopHandInput, SendGameEvent, SendGameResult, RetryGameSave } from './runtime/hubBridge';
import { PrepareAudioFeedback, PlaySuccessSound, PlayGameEndSound } from './runtime/soundManager';
import { BuildGameScore } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';

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
  const handRef = useRef<HandState>({ x: 0, y: 0, visible: false, handedness: null, lastSeenAt: 0 });
  const metricsRef = useRef(CreateEmptyMetrics());
  const [phase, setPhaseState] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<MotorConfig>({ ...defaultConfig });
  const [error, setError] = useState('');
  const [handInputReady, setHandInputReady] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const [result, setResult] = useState<SessionRecord | null>(null);
  const [live, setLive] = useState<LiveState>({ timeRemaining: 60, accuracy: 0, visibility: 0, successes: 0, misses: 0,
    currentHoldPercent: 0, level: 1, targetX: 50, targetY: 42, targetRadius: 66, handX: 64, handY: 62, handVisible: false, insideTarget: false });
  const difficulty = difficulties.find(item => item.id === config.difficulty)!;
  const setPhase = useCallback((next: GamePhase) => { phaseRef.current = next; setPhaseState(next); }, []);
  const stopInput = useCallback(() => {
    generationRef.current++;
    setHandInputReady(false);
    StopHandInput();
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    handRef.current.visible = false;
    handCanvasRef.current?.getContext('2d')?.clearRect(0, 0, 320, 240);
  }, []);
  const showConfiguration = useCallback(() => {
    stopInput(); jsPsychLifecycleRef.current?.abort({ abort_reason: 'configure' });
    setLive(current => ({ ...current, accuracy: 0, visibility: 0, successes: 0, misses: 0,
      currentHoldPercent: 0, level: 1, handVisible: false, insideTarget: false }));
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
      const rect = stageRef.current?.getBoundingClientRect();
      const points = message.payload.landmarks as { x: number; y: number; z: number }[];
      DrawHand(handCanvasRef.current, points);
      if (points.length && rect) {
        handRef.current = { ...GetHandCursorPoint(points, rect.width, rect.height), visible: true, handedness: null, lastSeenAt: performance.now() };
      } else if (performance.now() - handRef.current.lastSeenAt > 240) handRef.current.visible = false;
    };
    window.addEventListener('game:input', receive);
    return () => window.removeEventListener('game:input', receive);
  }, [labels, showConfiguration]);
  useEffect(() => {
    const abort = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && ['playing', 'initializing'].includes(phaseRef.current)) { event.preventDefault(); showConfiguration(); }
    };
    window.addEventListener('keydown', abort);
    return () => window.removeEventListener('keydown', abort);
  }, [showConfiguration]);
  const summaryItems = [
    { label: labels.drill, value: labels.drillNames[config.drill] }, { label: labels.difficulty, value: labels.difficultyNames[config.difficulty] },
    { label: labels.duration, value: `${config.durationSec}s` }, { label: labels.hand, value: FormatHandChoice(config.handChoice, labels) },
    { label: labels.targetSize, value: `${config.targetSizePercent}%` }, { label: labels.speed, value: `${config.speedPercent}%` },
  ];
  const confirm = () => {
    if (!formRef.current?.reportValidity() || !IsMotorConfig(config)) return;
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
      Best_Hold_Seconds: Number((metrics.bestHoldMs / 1000).toFixed(2)), Event_Records: metrics.events.map(item => ({ ...item })),
    };
    stopInput(); PlayGameEndSound('Victory', jsPsychRef); jsPsychLifecycleRef.current?.finish(session as unknown as Record<string, unknown>);
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
      await rootRef.current?.requestFullscreen?.().catch(() => undefined);
      if (generationRef.current !== generation) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
        return;
      }
      metricsRef.current = { ...CreateEmptyMetrics(), startedAt: performance.now(), lastTickAt: performance.now() }; targetRef.current = null;
      await jsPsychLifecycleRef.current?.start({ moduleId: 'motor:motor-cortex-rehab', onStart: () => {
        setPhase('playing'); SendGameEvent('active'); let lastLive = 0;
        const tick = (now: number) => {
          if (phaseRef.current !== 'playing') return;
          const rect = stageRef.current!.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            targetRef.current ??= CreateInitialTarget(config.drill, difficulty, config.targetSizePercent / 100, config.speedPercent / 100, rect.width, rect.height);
            UpdateTrainingLoop({ now, rect, drill: config.drill, activeDifficulty: difficulty, durationSec: config.durationSec,
              targetSizeScale: config.targetSizePercent / 100, speedScale: config.speedPercent / 100, target: targetRef.current, hand: handRef.current,
              metrics: metricsRef.current, labels, onSuccess: () => PlaySuccessSound(jsPsychRef), onComplete: completeSession });
            if (phaseRef.current === 'playing' && now - lastLive >= 45) { lastLive = now; setLive(BuildLiveState(now, config.durationSec, rect, targetRef.current, handRef.current, metricsRef.current)); }
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
  const style = { '--motor-target-x': `${preview ? 50 : live.targetX}%`, '--motor-target-y': `${preview ? 42 : live.targetY}%`,
    '--motor-target-size': `${preview ? difficulty.radius * config.targetSizePercent / 50 : live.targetRadius * 2}px`,
    '--motor-hand-x': `${preview ? 67 : live.handX}%`, '--motor-hand-y': `${preview ? 66 : live.handY}%`,
    '--motor-hold-progress': `${preview ? 55 : live.currentHoldPercent * 100}%` } as CSSProperties;
  return <div ref={rootRef} className={`motor-cortex-rehab-game motor-cortex-rehab-phase-${phase} motor-cortex-drill-${config.drill}`} style={style}>
    <div ref={jsPsychHostRef} className="motor-jspsych-host" aria-hidden="true" />
    {phase !== 'results' && <div className="motor-cortex-play" aria-hidden={phase === 'menu' || phase === 'ready'}>
      <div className="motor-cortex-hud">{[[labels.timeLeft, `${preview ? config.durationSec : Math.ceil(live.timeRemaining)}s`], [labels.accuracy, `${ToPercent(live.accuracy)}%`], [labels.visible, `${ToPercent(live.visibility)}%`], [labels.reps, live.successes], [labels.level, live.level]].map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div>
      <div ref={stageRef} className="motor-cortex-stage" aria-label={labels.followTarget}>
        <div className="motor-cortex-path motor-cortex-path-vertical" /><div className="motor-cortex-path motor-cortex-path-horizontal" />
        <div className={`motor-cortex-target ${live.insideTarget && !preview ? 'is-hit' : ''}`}><p>{labels.target}</p></div>
        <div className={`motor-cortex-hand-cursor ${live.handVisible || preview ? 'is-visible' : ''}`}><p>{labels.handCursor}</p></div>
      </div>
      <div className="motor-cortex-instruction"><h2>{labels.drillNames[config.drill]}</h2><p>{labels.followTarget}</p><div className="motor-cortex-hold-meter" role="progressbar" aria-label={labels.hold} aria-valuenow={Math.round(preview ? 55 : live.currentHoldPercent * 100)} aria-valuemin={0} aria-valuemax={100}><i /></div></div>
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
          <label>{labels.difficulty}<select name="difficulty" value={config.difficulty} onChange={event => setConfig({ ...config, difficulty: event.target.value as MotorConfig['difficulty'] })}>{difficulties.map(item => <option key={item.id} value={item.id}>{labels.difficultyNames[item.id]} · {item.radius}px / {item.speed}px/s / {item.holdMs}ms</option>)}</select></label>
          <label>{labels.duration}<select name="durationSec" value={config.durationSec} onChange={event => setConfig({ ...config, durationSec: Number(event.target.value) })}>{[45, 60, 90].map(value => <option key={value} value={value}>{value}s</option>)}</select></label>
          <label>{labels.hand}<select name="handChoice" value={config.handChoice} onChange={event => setConfig({ ...config, handChoice: event.target.value as MotorConfig['handChoice'] })}>{(['any', 'left', 'right'] as const).map(value => <option key={value} value={value}>{FormatHandChoice(value, labels)}</option>)}</select></label>
          <label>{labels.targetSize} · {config.targetSizePercent}%<input name="targetSizePercent" type="number" required min={75} max={130} step={5} value={config.targetSizePercent} onChange={event => setConfig({ ...config, targetSizePercent: event.target.valueAsNumber })} /></label>
          <label>{labels.speed} · {config.speedPercent}%<input name="speedPercent" type="number" required min={70} max={140} step={5} value={config.speedPercent} onChange={event => setConfig({ ...config, speedPercent: event.target.valueAsNumber })} /></label>
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
      <section className="score-context"><h2>{en ? 'Session overview' : '當次概況'}</h2><dl className="score-context-list">{[...summaryItems, { label: labels.bestHold, value: `${result.Best_Hold_Seconds}s` }, { label: labels.interrupted, value: result.Interrupted_Holds }, { label: labels.level, value: result.Adaptive_Level }, { label: en ? 'Actual activity duration' : '實際活動時間', value: `${result.Duration_Seconds}s` }].map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>
      <ScoreAnalysis rounds={BuildGameScore(result).rounds} language={lang} />
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Results stay on this device.' : '獨立遊玩，成果保留於本機畫面。') : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      {saveState === 'error' && <button className="btn btn-ghost score-retry-button" onClick={RetryGameSave}>{en ? 'Retry save' : '重試保存'}</button>}
      <button className="btn btn-primary score-return-button" onClick={exitGame}>{IsHubGame() ? (en ? 'Return to lobby' : '返回大廳') : (en ? 'Return to entry' : '返回入口')}</button>
    </section></div>}
  </div>;
}

function DrawHand(canvas: HTMLCanvasElement | null, points: { x: number; y: number }[]) {
  const context = canvas?.getContext('2d');
  if (!context || !canvas) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const styles = getComputedStyle(canvas);
  context.strokeStyle = styles.getPropertyValue('--hand-line').trim(); context.fillStyle = styles.getPropertyValue('--hand-point').trim(); context.lineWidth = 2;
  for (const indices of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]]) {
    context.beginPath(); indices.forEach((index, order) => { const point = points[index]; if (!point) return; if (!order) context.moveTo((1 - point.x) * canvas.width, point.y * canvas.height); else context.lineTo((1 - point.x) * canvas.width, point.y * canvas.height); }); context.stroke();
  }
  for (const point of points) { context.beginPath(); context.arc((1 - point.x) * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI); context.fill(); }
}

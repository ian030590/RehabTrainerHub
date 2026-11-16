import { initJsPsych, type JsPsych } from 'jspsych';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from './i18n/useT';
import { defaultSettings, ValidateSettings, type DrivingSettings } from './settings';
import { BuildGameScore, type DrivingTrial } from './score';
import { ScoreAnalysis } from './ScoreAnalysis';
import { DrivingTutorial } from './rules/DrivingTutorial';
import { DrivingWheelSetup } from './input/DrivingWheelSetup';
import { ChooseDrivingControlMode, GetDrivingControlHint, IsDrivingControlModeAvailable, IsDrivingWheelCalibrationUsable, useDrivingInputCapabilities, useDrivingLastInput, useDrivingWheelCalibration } from './input/drivingInputCapabilities';
import { DisposeDrivingRehabRuntime } from './lifecycle/driving-runtime-lifecycle';
import { PrepareAudioFeedback, DisposeAudioFeedback, PlayMidiMusic, StopMidiMusic } from './runtime/soundManager';
import { ExitGame, IsHubGame, OnSavedSettings, RetryGameSave, SaveGameSettings, SendGameEvent, SendGameResult } from './runtime/hubBridge';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { RestoreSettings } from './runtime/settingsMemory';
import { BuildDrivingRehabTimeline } from './timeline/drivingRehabTimeline';
import { SetDrivingPaused } from './runtime/pauseState';

export function DrivingRehabGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const title = en ? 'Driving Attention Simulation Practice' : '駕駛注意力模擬練習';
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  const [paused, setPaused] = useState(false);
  const [fullscreenInterrupted, setFullscreenInterrupted] = useState(false);
  const [inputAvailable, setInputAvailable] = useState(true);
  const inputAvailableRef = useRef(true);
  const pausedRef = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const restoreStopRef = useRef(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === 'running' && !paused && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase, paused]);
  useEffect(() => { if (paused) { if (inputAvailable) continueRef.current?.focus(); else endRef.current?.focus(); } else if (restoreStopRef.current) { restoreStopRef.current = false; stopRef.current?.focus(); } }, [paused, inputAvailable]);
  useEffect(() => { if (phase === 'results') resultHeadingRef.current?.focus(); }, [phase]);
  useEffect(() => DisposeAudioFeedback, []);
  const capabilities = useDrivingInputCapabilities();
  const lastInput = useDrivingLastInput(phase === 'menu');
  const [controlModeChosen, setControlModeChosen] = useState(false);
  const [settings, setSettings] = useState<DrivingSettings>(() => ({
    ...defaultSettings,
    controlMode: ChooseDrivingControlMode({ capabilities, current: defaultSettings.controlMode, lastInput: null, playerChosen: false }),
  }));
  const nextControlMode = ChooseDrivingControlMode({ capabilities, current: settings.controlMode, lastInput, playerChosen: controlModeChosen });
  useEffect(() => {
    if (phase === 'menu' && nextControlMode !== settings.controlMode) setSettings(current => ({ ...current, controlMode: nextControlMode }));
  }, [phase, nextControlMode, settings.controlMode]);
  const [results, setResults] = useState<DrivingTrial[]>([]);
  const [error, setError] = useState(false);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'local'>('local');
  const calibration = useDrivingWheelCalibration(capabilities.wheelDevice);
  const ready = IsDrivingControlModeAvailable(settings.controlMode, capabilities)
    && (settings.controlMode !== 'wheel' || calibration.calibrated);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const generationRef = useRef(0);
  const skipFinishRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') { setSettings(restored); setControlModeChosen(true); }
  }), []);
  const stopRuntime = useCallback(() => {
    pausedRef.current = false;
    SetDrivingPaused(false);
    setPaused(false);
    inputAvailableRef.current = true;
    setInputAvailable(true);
    generationRef.current++;
    skipFinishRef.current = true;
    DisposeDrivingRehabRuntime();
    const experiment = jsPsychRef.current;
    jsPsychRef.current = null;
    experiment?.abortExperiment();
    DisposeAudioFeedback();
  }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (pausedRef.current) return;
    setFullscreenInterrupted(false);
    pausedRef.current = true;
    SetDrivingPaused(true);
    window.dispatchEvent(new Event('game:pause'));
    DisposeAudioFeedback();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    if (!pausedRef.current || !inputAvailableRef.current || document.visibilityState !== 'visible') return;
    pausedRef.current = false;
    SetDrivingPaused(false);
    restoreStopRef.current = true;
    window.dispatchEvent(new Event('game:resume'));
    setPaused(false);
  }, []);
  const backToSettings = useCallback(() => { generationRef.current++; setPhase('menu'); }, []);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { stopRuntime(); setError(false); setResults([]); setPhase('menu'); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current === 'running') { event.preventDefault(); if (!event.repeat) { if (pausedRef.current) resume(); else pause(); } }
    };
    const fullscreenChanged = () => {
      if (phaseRef.current === 'running' && !skipFinishRef.current && !document.fullscreenElement) { pause(); setFullscreenInterrupted(true); }
    };
    const visibilityChanged = () => { if (phaseRef.current === 'running' && document.visibilityState !== 'visible') pause(); };
    const inputChanged = (event: Event) => {
      const available = (event as CustomEvent<boolean>).detail;
      inputAvailableRef.current = available;
      setInputAvailable(available);
      if (!available) pause();
    };
    window.addEventListener('game:saved', saved);
    window.addEventListener('game:configure', configure);
    window.addEventListener('keydown', escape, true);
    window.addEventListener('game:input-availability', inputChanged);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', stopRuntime);
    return () => {
      window.removeEventListener('game:saved', saved);
      window.removeEventListener('game:configure', configure);
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('game:input-availability', inputChanged);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pagehide', stopRuntime);
      stopRuntime();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [pause, resume, stopRuntime]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = false;
    const failed = () => {
      stopRuntime(); setError(true); setPhase('menu');
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
    const jsPsych = initJsPsych({ display_element: 'jspsych-target', on_finish: () => {
      if (skipFinishRef.current) return;
      const data = jsPsych.data.get().values() as DrivingTrial[];
      const result = data.find(row => row.trial_type === 'three-driving-rehab');
      if (!result || result.response === 'load-error') { failed(); return; }
      if (result.response === 'aborted') { exit(); return; }
      skipFinishRef.current = true;
      const score = BuildGameScore(data);
      DisposeDrivingRehabRuntime();
      DisposeAudioFeedback();
      jsPsychRef.current = null;
      setResults(data);
      setSaveState(IsHubGame() ? 'saving' : 'local');
      SendGameResult({ ...settings }, score.summary, score.rounds);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    } });
    jsPsychRef.current = jsPsych;
    SendGameEvent('active');
    void jsPsych.run(BuildDrivingRehabTimeline(settings, lang, calibration.calibration) as never).catch(() => {
      if (!skipFinishRef.current) failed();
    });
    return () => { if (jsPsychRef.current === jsPsych) stopRuntime(); };
  }, [phase, settings, lang, stopRuntime, exit]);
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready) return;
    SaveGameSettings(settings);
    setError(false);
    setPhase('rules');
  };
  const startTraining = async () => {
    if (!ready || phaseRef.current !== 'rules' || !ValidateSettings(settings)) return;
    if (settings.controlMode === 'wheel' && !IsDrivingWheelCalibrationUsable(calibration.calibration)) return;
    const generation = generationRef.current;
    PrepareAudioFeedback();
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Windowed play remains available. */ }
    if (generation !== generationRef.current || phaseRef.current !== 'rules') {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    setPhase('running');
  };
  const difficultyLabels = { easy: en ? 'Easy' : '簡單', medium: en ? 'Medium' : '中等', hard: en ? 'Hard' : '困難' };
  const qualityLabels = { high: en ? 'High' : '高', medium: en ? 'Medium' : '中', low: en ? 'Low' : '低' };
  const controlLabels = { arrow: en ? 'Arrow keys' : '方向鍵', wasd: en ? 'WASD keys' : 'WASD 鍵', wheel: en ? 'Steering wheel' : '方向盤', touch: en ? 'Touch' : '觸控' };
  const controlStatus = {
    'press-key': en
      ? `Press any key on your keyboard to turn on keyboard controls, then confirm settings.${capabilities.touchAvailable ? ' To use the touchscreen, choose Touch.' : ''}`
      : `按一下鍵盤上的任一鍵，啟用鍵盤操作後即可確認設定。${capabilities.touchAvailable ? '使用觸控螢幕請改選「觸控」。' : ''}`,
    'keyboard-ready': settings.controlMode === 'wasd'
      ? (en ? 'Keyboard detected. Drive with the W, A, S and D keys.' : '已偵測到鍵盤，用 W、A、S、D 鍵操作。')
      : (en ? 'Keyboard detected. Drive with the arrow keys.' : '已偵測到鍵盤，用方向鍵操作。'),
    'touch-ready': en ? 'Touchscreen detected. Drive with the on-screen wheel and pedals.' : '已偵測到觸控螢幕，用畫面上的方向盤和踏板操作。',
    'no-touch': en ? 'No touchscreen detected on this device. Choose another control method.' : '這台裝置沒有偵測到觸控螢幕，請改選其他操作裝置。',
    wheel: en ? 'Follow the wheel calibration steps below to connect and calibrate the wheel.' : '請依下方「方向盤校正」的步驟連接並校正方向盤。',
  }[GetDrivingControlHint(settings.controlMode, capabilities)];
  const summaryItems = [
    { label: en ? 'Difficulty' : '難度', value: difficultyLabels[settings.difficulty] },
    { label: en ? 'Rendering quality' : '畫面品質', value: qualityLabels[settings.renderQuality] },
    { label: en ? 'Controls' : '控制方式', value: controlLabels[settings.controlMode] },
    { label: en ? 'Red-flash cue' : '危險紅光提示', value: settings.redFlashEnabled ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉') },
  ];
  const score = BuildGameScore(results);
  const result = results.find(row => row.trial_type === 'three-driving-rehab');
  const missing = en ? 'N/A' : '無';
  const labels = {
    durationMs: en ? 'Driving duration (ms)' : '模擬經過時間（ms）', meanRt: en ? 'Mean reaction time (ms)' : '平均反應時間（ms）',
    medianRt: en ? 'Median reaction time (ms)' : '反應時間中位數（ms）', events: en ? 'Valid events' : '有效事件數',
    responses: en ? 'Events with responses' : '有反應事件數', collisions: en ? 'Collisions' : '碰撞事件數',
    deviations: en ? 'Lane departures' : '偏離車道次數', fps: en ? 'Mean frame rate (Hz)' : '平均畫面更新率（Hz）',
    avoided: en ? 'Successful avoidance rounds' : '成功閃避回合數', rounds: en ? 'Event rounds' : '事件回合數',
  };
  const primary = ['meanRt', 'avoided', 'rounds'];
  return <div ref={rootRef} className={`driving-rehab-game-root driving-rehab-phase-${phase}`}>
    {(phase === 'menu' || phase === 'rules') && <DrivingTutorial active={phase === 'rules'} ready={ready} title={title} settings={settings}
      summaryItems={summaryItems} onStart={startTraining} onBack={backToSettings} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog" aria-labelledby="driving-settings-title" onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2 id="driving-settings-title">{title}</h2></header>
        <div className="training-config-body">
          <section className="training-setting"><h3>{en ? 'Practice settings' : '練習設定'}</h3>
            <p>{en ? 'Respond to hazards during a delivery route. This practice does not determine real driving ability.' : '在送貨路線中回應突發事件，本練習不判定實際駕駛能力。'}</p>
            {error && <p className="renderer-error" role="alert">{en ? 'Unable to load the driving scene. Try again or choose a lower rendering quality.' : '駕駛場景載入失敗，請重試或降低畫面品質。'}</p>}
            <label>{en ? 'Difficulty' : '難度'}<select name="difficulty" value={settings.difficulty}
              onChange={event => setSettings(current => ({ ...current, difficulty: event.target.value as DrivingSettings['difficulty'] }))}>
              {Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>{en ? 'Rendering quality' : '畫面品質'}<select name="renderQuality" value={settings.renderQuality}
              onChange={event => setSettings(current => ({ ...current, renderQuality: event.target.value as DrivingSettings['renderQuality'] }))}>
              {Object.entries(qualityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label><input name="redFlashEnabled" type="checkbox" checked={settings.redFlashEnabled}
              onChange={event => setSettings(current => ({ ...current, redFlashEnabled: event.target.checked }))} /> {en ? 'Hazard red-flash cue' : '危險紅光提示'}</label>
          </section>
          <section className="training-setting"><h3>{en ? 'Controls' : '控制方式'}</h3>
            <p id="driving-control-status" className="driving-input-status" role="status">{controlStatus}</p>
            <label>{en ? 'Control method' : '操作裝置'}<select name="controlMode" value={settings.controlMode}
              onChange={event => { setControlModeChosen(true); setSettings(current => ({ ...current, controlMode: event.target.value as DrivingSettings['controlMode'] })); }}>
              {Object.entries(controlLabels).map(([value, label]) => <option key={value} value={value}
                disabled={!IsDrivingControlModeAvailable(value as DrivingSettings['controlMode'], capabilities)}>{label}</option>)}
            </select></label>
            {settings.controlMode !== 'wheel' && <p>{en ? 'To use a steering wheel, connect a supported wheel and press any button on it.' : '使用方向盤：連接支援的方向盤後，按一下方向盤上的任一按鈕。'}</p>}
            <button type="button" className="btn btn-ghost driving-rescan-button" onClick={capabilities.rescan}>{en ? 'Rescan devices' : '重新偵測裝置'}</button>
          </section>
          {settings.controlMode === 'wheel' && <DrivingWheelSetup capabilities={capabilities} calibration={calibration} />}
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button type="button" className="btn btn-ghost" onClick={exit}>{en ? 'Back' : '返回'}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings} disabled={!ready} aria-describedby="driving-control-status">{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    {phase === 'running' && <><div inert={paused}><div id="jspsych-target" className="driving-training-experiment" />
      <button ref={stopRef} type="button" className="driving-training-stop btn btn-ghost" onClick={pause}>{en ? 'Stop' : '停止'}</button></div>
      {paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="driving-pause-title"
        onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'); if (buttons.length === 1) { event.preventDefault(); buttons[0].focus(); } else if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
        <h2 id="driving-pause-title">{en ? 'Paused' : '已暫停'}</h2>
        <p>{!inputAvailable ? (en ? 'Reconnect the calibrated wheel; ending the activity will not save this session.' : '請重新連接已校正的方向盤；結束後不會保存這次紀錄。') : fullscreenInterrupted ? (en ? 'Fullscreen ended; ending the activity will not save this session.' : '已退出全螢幕，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束後不會保存這次紀錄。')}</p>
        <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume} disabled={!inputAvailable}>{en ? 'Continue' : '繼續'}</button>
        <button ref={endRef} className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
      </div></div>}</>}
    {phase === 'results' && <div className="experiment-results">
      <header className="score-header"><h1 ref={resultHeadingRef} tabIndex={-1}>{en ? 'Session results' : '當次成果'}</h1><p>{title}</p></header>
      <section className="score-priority"><p className="score-complete">{en ? 'Activity complete' : '已完成本次活動'}</p><dl className="score-key-grid">
        {primary.map(key => <div className="score-key-metric" key={key}><dt>{labels[key as keyof typeof labels]}</dt><dd>{score.summary[key as keyof typeof score.summary] ?? missing}</dd></div>)}
      </dl></section>
      <p className="score-save-status" role="status">{saveState === 'local' ? (en ? 'Shown on this device; no Hub record saved.' : '成果僅在此裝置顯示，未保存至 Hub。') : saveState === 'saved' ? (en ? 'Saved' : '已保存') : saveState === 'error' ? (en ? 'Save failed. Please retry.' : '保存失敗，請重試。') : (en ? 'Saving…' : '保存中…')}</p>
      <div className="score-actions">
        {saveState === 'error' && <button type="button" className="btn btn-ghost score-retry-button" onClick={RetryGameSave}>{en ? 'Retry save' : '重試保存'}</button>}
        <button type="button" className="btn btn-primary score-return-button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
      </div>
      <details className="score-details"><summary>{en ? 'View details' : '查看詳細資料'}</summary>
      <section className="score-context"><h2>{en ? 'Session context' : '當次概況'}</h2><dl className="score-context-list">
        {Object.entries(score.summary).filter(([key]) => !primary.includes(key)).map(([key, value]) => <div className="score-context-item" key={key}><dt>{labels[key as keyof typeof labels]}</dt><dd>{value ?? missing}</dd></div>)}
        {summaryItems.map(item => <div className="score-context-item" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div className="score-context-item"><dt>{en ? 'Route' : '路線'}</dt><dd>{String(result?.route_label ?? result?.route_id ?? missing)}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Completion' : '完成狀態'}</dt><dd>{result?.response === 'completed' ? (en ? 'Route completed' : '路線完成') : (en ? 'Time ended' : '時間結束')}</dd></div>
        <div className="score-context-item"><dt>{en ? 'Measured display refresh rate' : '實測螢幕更新率'}</dt><dd>{result?.refresh_measurement_valid ? `${result.display_refresh_hz} Hz` : (en ? 'Unknown' : '未知')}</dd></div>
      </dl></section>
      <ScoreAnalysis rounds={score.rounds} language={lang} details={(result?.driving_events ?? []).map(event => ({ ...event, reaction_frames: result?.refresh_measurement_valid ? event.reaction_frames : null }))} />
      </details>
    </div>}
  </div>;
}

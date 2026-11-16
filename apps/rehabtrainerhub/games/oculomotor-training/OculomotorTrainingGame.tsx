import { useCallback, useEffect, useRef, useState } from 'react';
import { PrepareAudioFeedback, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { useT } from './i18n/useT';
import { defaultSettings, GetActiveSettingFields, ValidateSettings, type OculomotorSettings } from './settings';
import { BuildGameScore, IsExperimentResult, type ExperimentResult } from './score';
import { OculomotorTutorial } from './rules/OculomotorTutorial';
import { OculomotorResults } from './OculomotorResults';
import { ExitGame, IsHubGame, OnSavedSettings, SaveGameSettings, SendGameEvent } from './runtime/hubBridge';
import { RestoreSettings } from './runtime/settingsMemory';
import { PrepareExperiment } from './runtime/experiment';
import { BuildOculomotorCsvRows } from './oculomotorCsvRows';
import { OculomotorSettingsFields } from './OculomotorSettingsFields';

export function OculomotorTrainingGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const locale = en ? 'en' : 'zh-TW';
  const title = en ? 'Oculomotor practice' : '眼動練習';
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  const [paused, setPaused] = useState(false);
  const [cameraLost, setCameraLost] = useState(false);
  const pausedRef = useRef(false);
  const cameraLostRef = useRef(false);
  const reconnectingRef = useRef(false);
  const stoppedRunRef = useRef<Promise<void>>(Promise.resolve());
  const stopRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const restoreStopRef = useRef(false);
  useEffect(() => {
    if (phase === 'running' && !paused && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase, paused]);
  useEffect(() => { if (paused) continueRef.current?.focus(); else if (restoreStopRef.current) { restoreStopRef.current = false; stopRef.current?.focus(); } }, [paused]);
  useEffect(() => DisposeAudioFeedback, []);
  const [settings, setSettings] = useState<OculomotorSettings>({ ...defaultSettings });
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState('idle');
  const [saveState, setSaveState] = useState('local');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const completedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => OnSavedSettings(saved => {
    const restored = RestoreSettings(saved, defaultSettings, ValidateSettings);
    if (restored && phaseRef.current === 'menu') setSettings(restored);
  }), []);
  const settingsRef = useRef(settings);
  const moduleSettings = useRef<Record<string, OculomotorSettings>>({});
  settingsRef.current = settings;
  const changeSettings = (next: OculomotorSettings) => {
    if (next.module !== settings.module) {
      moduleSettings.current[String(settings.module)] = settings;
      setSettings({ ...(moduleSettings.current[String(next.module)] || defaultSettings), module: next.module,
        ...Object.fromEntries(['screenWidthCm', 'screenHeightCm', 'viewingDistanceCm', 'eyeTrackingSource'].map(key => [key, settings[key]])) });
    } else setSettings(next);
  };
  const stopRuntime = useCallback(() => { const stopped = window.oculomotorExperiment?.Stop(); window.OculomotorInput.Stop(); return Promise.resolve(stopped); }, []);
  const exit = useCallback(() => { window.oculomotorPaused = false; pausedRef.current = false; cameraLostRef.current = false; reconnectingRef.current = false; setPaused(false); void stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const back = useCallback(() => { window.oculomotorPaused = false; pausedRef.current = false; setPaused(false); stopRuntime(); setCameraState('idle'); setError(''); setPhase('menu'); }, [stopRuntime]);
  const pause = useCallback(() => {
    if (phaseRef.current !== 'running' || pausedRef.current) return;
    pausedRef.current = true;
    window.oculomotorPaused = true;
    window.dispatchEvent(new Event('oculomotor:pause'));
    DisposeAudioFeedback();
    setPaused(true);
  }, []);
  const resume = useCallback(async () => {
    if (!pausedRef.current || reconnectingRef.current) return;
    PrepareAudioFeedback();
    if (cameraLostRef.current) {
      reconnectingRef.current = true;
      void rootRef.current?.requestFullscreen?.().catch(() => undefined);
      await stoppedRunRef.current;
      if (!reconnectingRef.current || !pausedRef.current || phaseRef.current !== 'running') return;
      SendGameEvent('input-start');
      return;
    }
    window.oculomotorPaused = false;
    window.dispatchEvent(new Event('oculomotor:resume'));
    pausedRef.current = false;
    restoreStopRef.current = true;
    setPaused(false);
  }, []);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && phaseRef.current === 'running') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) { if (pausedRef.current) resume(); else pause(); }
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [pause, resume]);
  useEffect(() => {
    let cancelled = false;
    void PrepareExperiment().then(() => { if (!cancelled) setReady(true); }).catch(() => {
      if (!cancelled) setError(en ? 'The experiment could not load. Retry to continue.' : '實驗無法載入，請重試。');
    });
    return () => { cancelled = true; };
  }, [en]);
  useEffect(() => {
    if (phase !== 'menu') return;
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, [phase]);
  useEffect(() => {
    const saved = (event: Event) => setSaveState((event as CustomEvent).detail);
    const configure = () => { window.oculomotorPaused = false; pausedRef.current = false; cameraLostRef.current = false; reconnectingRef.current = false; setPaused(false); setCameraLost(false); stopRuntime(); setCameraState('idle'); setResult(null); setError(''); setPhase('menu'); };
    const input = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.type === 'ready') {
        setCameraState('ready'); setError('');
        if (reconnectingRef.current && phaseRef.current === 'running') {
          reconnectingRef.current = false; cameraLostRef.current = false; setCameraLost(false);
          window.oculomotorPaused = false; pausedRef.current = false; restoreStopRef.current = true; setPaused(false);
          window.oculomotorExperiment.Start({ ...settingsRef.current, language: lang });
        }
      }
      if (detail.type === 'error') {
        if (phaseRef.current === 'running') {
          reconnectingRef.current = false; cameraLostRef.current = true; setCameraLost(true);
          pause(); stoppedRunRef.current = stopRuntime(); setCameraState('error'); return;
        }
        stopRuntime(); setCameraState('error');
        setError(en ? 'Camera access or tracking failed. Retry the camera, or select no gaze tracking in settings.' : '相機授權或追蹤失敗，請重試相機，或返回設定選擇不記錄眼動。');
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      }
    };
    const experiment = (event: Event) => {
      if (phaseRef.current !== 'running' || cameraLostRef.current) return;
      const message = (event as CustomEvent).detail;
      if (message.type === 'oculomotor:abort') { back(); return; }
      if (message.type === 'oculomotor:error') { stopRuntime(); setError(String(message.message)); setPhase('menu'); return; }
      if (message.type !== 'oculomotor:complete' || completedRef.current || !IsExperimentResult(message.result)) return;
      completedRef.current = true;
      const completed = message.result;
      const upload = message.upload;
      if (completed.eye_tracking_source === 'webgazer' && completed.gaze_sample_count) {
        if (!upload || !Array.isArray(upload.records) || upload.records.length !== completed.gaze_sample_count) {
          stopRuntime(); setError(en ? 'Captured gaze samples are unavailable.' : '眼動逐筆樣本遺失。'); setPhase('menu'); return;
        }
        SendGameEvent('gaze-csv', { records: BuildOculomotorCsvRows(upload.records), metadata: upload.metadata });
      }
      SendGameEvent('result', { config: { ...settingsRef.current, eyeTrackingSource: completed.eye_tracking_source, endReason: completed.end_reason }, score: BuildGameScore(completed) });
      window.OculomotorInput.Stop();
      setResult(completed); setSaveState(IsHubGame() ? 'saving' : 'local');
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setPhase('results');
    };
    window.addEventListener('game:saved', saved); window.addEventListener('game:configure', configure);
    window.addEventListener('game:input', input); window.addEventListener('oculomotor:event', experiment);
    return () => {
      window.removeEventListener('game:saved', saved); window.removeEventListener('game:configure', configure);
      window.removeEventListener('game:input', input); window.removeEventListener('oculomotor:event', experiment);
      stopRuntime(); if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [back, en, lang, pause, stopRuntime]);
  const confirmSettings = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready) {
      if (!ValidateSettings(settings)) setError(en ? 'Check the values and select at least one direction.' : '請檢查數值，並選擇至少一個方位。');
      return;
    }
    SaveGameSettings(settings);
    setError(''); setPhase('rules');
  };
  const start = async () => {
    if (!ready || phaseRef.current !== 'rules' || !ValidateSettings(settings) || (settings.eyeTrackingSource === 'webgazer' && cameraState !== 'ready')) return;
    if (backgroundMusic) PrepareAudioFeedback();
    completedRef.current = false;
    try { await rootRef.current?.requestFullscreen?.(); } catch { /* Continue with the actual window geometry. */ }
    if (phaseRef.current !== 'rules') { if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); return; }
    setPhase('running');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (phaseRef.current === 'running') { SendGameEvent('active'); window.oculomotorExperiment.Start({ ...settings, language: lang }); }
    }));
  };
  const summaryItems = GetActiveSettingFields(settings).map(field => {
    const value = settings[field.key];
    return { label: field.label[locale], value: field.type === 'checkbox' ? (value ? (en ? 'On' : '開啟') : (en ? 'Off' : '關閉'))
      : field.options?.find(option => option.value === value)?.label[locale] ?? `${value}${field.unit?.[locale] ? ' ' + field.unit[locale] : ''}` };
  });
  return <div ref={rootRef} className="oculomotor-game-root">
    {(phase === 'menu' || phase === 'rules') && <OculomotorTutorial active={phase === 'rules'} language={lang} settings={settings} summaryItems={summaryItems}
      ready={ready} cameraState={cameraState} error={error} onCamera={() => { setCameraState('starting'); setError(''); SendGameEvent('input-start'); }} onStart={() => void start()} onBack={back} />}
    {phase === 'menu' && <dialog ref={dialogRef} className="game-settings-dialog oculomotor-training-phase-menu" onCancel={event => { event.preventDefault(); exit(); }}>
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirmSettings(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirmSettings(); } }}>
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          {error && <p role="alert">{error}<button type="button" onClick={() => {
            setError(''); void PrepareExperiment().then(() => setReady(true)).catch(() => setError(en ? 'Experiment unavailable.' : '實驗無法載入。'));
          }}>{en ? 'Retry' : '重試'}</button></p>}
          <OculomotorSettingsFields settings={settings} language={lang} onChange={changeSettings} />
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
          <button className="btn btn-primary" type="button" onClick={confirmSettings} disabled={!ready}>{en ? 'Confirm settings' : '確認設定'}</button>
        </div></footer>
      </form>
    </dialog>}
    <div id="experiment-root" className="oculomotor-experiment" hidden={phase !== 'running'} inert={paused} />
    {phase === 'running' && <button ref={stopRef} type="button" className="btn btn-ghost oculomotor-stop" onClick={pause} inert={paused}>{en ? 'Stop' : '停止'}</button>}
    {phase === 'running' && paused && <div className="game-interrupt-overlay"><div className="game-interrupt-panel" role="dialog" aria-modal="true" aria-labelledby="oculomotor-pause-title"
      onKeyDown={event => { if (event.key === 'Tab') { const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[1].focus(); } else if (!event.shiftKey && document.activeElement === buttons[1]) { event.preventDefault(); buttons[0].focus(); } } }}>
      <h2 id="oculomotor-pause-title">{en ? 'Paused' : '已暫停'}</h2>
      <p>{cameraLost ? (en ? 'Camera input stopped. Continuing restarts the activity; ending will not save this session.' : '相機輸入已中斷；繼續會重新開始活動，結束後不會保存這次紀錄。') : (en ? 'Ending the activity will not save this session.' : '結束活動後不會保存這次紀錄。')}</p>
      <button ref={continueRef} className="btn btn-primary" type="button" onClick={resume}>{en ? 'Continue' : '繼續'}</button>
      <button className="btn btn-ghost" type="button" onClick={exit}>{en ? 'End activity' : '結束活動'}</button>
    </div></div>}
    {phase === 'results' && result && <OculomotorResults result={result} summaryItems={summaryItems} language={lang} saveState={saveState}
      onRetry={() => { setSaveState('saving'); SendGameEvent('retry'); }} onExit={exit} />}
  </div>;
}

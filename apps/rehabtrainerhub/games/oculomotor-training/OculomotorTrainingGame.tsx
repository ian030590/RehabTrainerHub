import { useCallback, useEffect, useRef, useState } from 'react';
import { PrepareAudioFeedback, PlayMidiMusic, StopMidiMusic, DisposeAudioFeedback } from './runtime/soundManager';
import { backgroundMusic, backgroundMusicOptions } from './music';
import { useT } from './i18n/useT';
import { defaultSettings, GetActiveSettingFields, ValidateSettings, type OculomotorSettings } from './settings';
import { BuildGameScore, IsExperimentResult, type ExperimentResult } from './score';
import { OculomotorTutorial } from './rules/OculomotorTutorial';
import { OculomotorResults } from './OculomotorResults';
import { ExitGame, IsHubGame, SendGameEvent } from './runtime/hubBridge';
import { PrepareExperiment } from './runtime/experiment';
import { BuildOculomotorCsvRows } from './oculomotorCsvRows';
import { OculomotorSettingsFields } from './OculomotorSettingsFields';

export function OculomotorTrainingGame() {
  const { lang } = useT();
  const en = lang === 'en';
  const locale = en ? 'en' : 'zh-TW';
  const title = en ? 'Oculomotor practice' : '眼動練習';
  const [phase, setPhase] = useState<'menu' | 'rules' | 'running' | 'results'>('menu');
  useEffect(() => {
    if (phase === 'running' && backgroundMusic) void PlayMidiMusic(backgroundMusic, backgroundMusicOptions).catch(error => console.warn('Music unavailable.', error));
    return StopMidiMusic;
  }, [phase]);
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
  const stopRuntime = useCallback(() => { window.oculomotorExperiment?.Stop(); window.OculomotorInput.Stop(); }, []);
  const exit = useCallback(() => { stopRuntime(); void ExitGame(); }, [stopRuntime]);
  const back = useCallback(() => { stopRuntime(); setCameraState('idle'); setError(''); setPhase('menu'); }, [stopRuntime]);
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
    const configure = () => { stopRuntime(); setCameraState('idle'); setResult(null); setError(''); setPhase('menu'); };
    const input = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.type === 'ready') { setCameraState('ready'); setError(''); }
      if (detail.type === 'error') {
        stopRuntime(); setCameraState('error');
        setError(en ? 'Camera access or tracking failed. Retry the camera, or select no gaze tracking in settings.' : '相機授權或追蹤失敗，請重試相機，或返回設定選擇不記錄眼動。');
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        if (phaseRef.current === 'running') setPhase('menu');
      }
    };
    const experiment = (event: Event) => {
      if (phaseRef.current !== 'running') return;
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
  }, [back, en, stopRuntime]);
  const confirm = () => {
    if (!formRef.current?.reportValidity() || !ValidateSettings(settings) || !ready) {
      if (!ValidateSettings(settings)) setError(en ? 'Check the values and select at least one direction.' : '請檢查數值，並選擇至少一個方位。');
      return;
    }
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
      <form ref={formRef} className="training-config" onSubmit={event => { event.preventDefault(); confirm(); }}
        onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); confirm(); } }}>
        <header className="training-config-header"><h2>{title}</h2></header>
        <div className="training-config-body">
          {error && <p role="alert">{error}<button type="button" onClick={() => {
            setError(''); void PrepareExperiment().then(() => setReady(true)).catch(() => setError(en ? 'Experiment unavailable.' : '實驗無法載入。'));
          }}>{en ? 'Retry' : '重試'}</button></p>}
          <OculomotorSettingsFields settings={settings} language={lang} onChange={changeSettings} />
        </div>
        <footer className="config-actions"><div className="training-config-navigation-buttons">
          <button className="btn btn-primary" type="button" disabled={!ready} onClick={confirm}>{en ? 'Confirm settings' : '確認設定'}</button>
          <button className="btn btn-ghost" type="button" onClick={exit}>{IsHubGame() ? (en ? 'Back to lobby' : '返回大廳') : (en ? 'Back to entry' : '返回入口')}</button>
        </div></footer>
      </form>
    </dialog>}
    <div id="experiment-root" className="oculomotor-experiment" hidden={phase !== 'running'} />
    {phase === 'running' && <button type="button" className="oculomotor-stop" onClick={exit}>{en ? 'Stop practice' : '停止練習'}</button>}
    {phase === 'results' && result && <OculomotorResults result={result} summaryItems={summaryItems} language={lang} saveState={saveState}
      onRetry={() => { setSaveState('saving'); SendGameEvent('retry'); }} onExit={exit} />}
  </div>;
}

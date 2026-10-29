'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import releases from '@rehab-trainer/ui/officialGameReleases.json';
import { AcceptGameMessage, IsGameSettings, ReadSavedGameSettings, SensorAllowed, WriteSavedGameSettings } from '@rehab-trainer/ui/selfContainedGame.js';
import { GetAuthToken, GetAuthUserIdFromToken, SaveRemoteTrainingRecord } from '@rehab-trainer/ui/auth/authClient';
import { GetOrCreateSubjectIdForUser, IsSubjectId, SetAccountSubjectId } from '@rehab-trainer/ui/storage/subjectId';
import type { TrainingCatalogModule } from '@rehab-trainer/hub-modules/catalog';
import type { GameScore } from '@rehab-trainer/ui/gameScore';
import { CreateHandTrackingBroker } from '@rehab-trainer/ui/handTrackingBroker.js';
import { LoadHandTrackingInput, type HandInputBroker, type HandInputMessage } from '@rehab-trainer/ui/handTrackingInput';
import { ExitFullscreenIfActive } from '@rehab-trainer/ui/fullscreen';
import { useHubLanguage } from '../i18n/HubLanguage';
import { CreateEyeTrackingBroker } from '@rehab-trainer/ui/eyeTrackingBroker.js';
import { LoadEyeTrackingInput, type EyeInputBroker } from '@rehab-trainer/ui/eyeTrackingInput';
import { SaveOculomotorCsv, type OculomotorCsvPayload } from '@rehab-trainer/ui/saveOculomotorCsv';
import { DownloadResultFile, StageResultFile } from '@rehab-trainer/ui/resultFiles.js';
import { CreateSensorInputBroker, type SensorInput } from '@rehab-trainer/ui/sensorInputBroker.js';
import { CreateSensorInputHost, type SensorInputHost } from '@rehab-trainer/ui/sensorInputHost.js';
import { LoadSensorInput } from '@rehab-trainer/ui/sensorInput';
import { CreateRawCoordinateRecorder } from '@rehab-trainer/ui/rawCoordinateRecorder.js';
import { SaveRawCoordinateCsv } from '@rehab-trainer/ui/saveRawCoordinateCsv';
import { GetHubUiCopy } from '../i18n';
import type { PracticeSettings } from '../practicePlans';
import '../practicePlans.css';

// Consent copy for the reviewed sensor proxies: what runs on this device and the only data the game receives.
const sensorConsent: Record<SensorInput, Record<'zh' | 'en', [string, string, string]>> = {
  pose: {
    zh: ['啟用相機', '影像只在此裝置由 MediaPipe 處理，不會離開裝置。遊戲收到的雙手與髖、膝座標，也會以匿名識別碼儲存於當次活動。', '允許相機'],
    en: ['Enable camera', 'MediaPipe processes images on this device; images never leave it. The hand, hip and knee coordinates sent to the game are also saved for this activity under a pseudonymous subject ID.', 'Enable camera'],
  },
  microphone: {
    zh: ['啟用麥克風', '聲音只在此裝置分析。遊戲只收到音量與高低頻比例，不會錄音或上傳。', '允許麥克風'],
    en: ['Enable microphone', 'Sound is analyzed on this device. Only loudness and the balance of high and low sounds reach the game; nothing is recorded or uploaded.', 'Enable microphone'],
  },
  tongue: {
    zh: ['啟用相機', '影像只在此裝置由 MediaPipe 與 TensorFlow 處理，包含校正影像都不會離開裝置。遊戲收到的嘴部位置、舌頭方向與信心值，也會以匿名識別碼儲存於當次活動。', '允許相機'],
    en: ['Enable camera', 'MediaPipe and TensorFlow process images on this device; images, including calibration images, never leave it. The mouth position, tongue direction and confidence sent to the game are also saved for this activity under a pseudonymous subject ID.', 'Enable camera'],
  },
  head: {
    zh: ['啟用相機', '影像只在此裝置由 MediaPipe 處理，不會離開裝置。遊戲收到的頭部轉動角度與臉部是否出現，也會以匿名識別碼儲存於當次活動。', '允許相機'],
    en: ['Enable camera', 'MediaPipe processes images on this device; images never leave it. The head angles and face presence sent to the game are also saved for this activity under a pseudonymous subject ID.', 'Enable camera'],
  },
};

type Result = { config: Record<string, string | number | boolean>; score: GameScore };
type Session = { subjectId: string; recordId: string; token: string; version: string; contentSha256: string; capabilities?: string[]; planSettings?: PracticeSettings | null };
export interface PracticeOverlayModes {
  planLaunch?: { planItemId: string; settings: PracticeSettings | null };
  captureSettings?: (settings: PracticeSettings) => void;
  onSaved?: () => void;
}
// Each game's last confirmed settings stay in this device's storage; the opaque game cannot reach it.
function DeviceStorage() { try { return window.localStorage; } catch { return null; } }
export function R2GameOverlay({ module, onClose, planLaunch, captureSettings, onSaved }: { module: TrainingCatalogModule; onClose: () => void } & PracticeOverlayModes) {
  const release = releases[module.runtimeId as keyof typeof releases];
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).practicePlans;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  const resultRef = useRef<Result | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const lastSettings = useRef<PracticeSettings | null>(null);
  const captured = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const saving = useRef(false);
  const saved = useRef(false);
  const inputRef = useRef<(HandInputBroker & Partial<EyeInputBroker>) | null>(null);
  const sensorRef = useRef<SensorInputHost | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [consentInput, setConsentInput] = useState<SensorInput | null>(null);
  const csvRef = useRef<OculomotorCsvPayload | null>(null);
  const csvFileRef = useRef<{ text: string; fileName: string } | null>(null);
  const csvSaved = useRef(false);
  const rawRecorder = useRef<ReturnType<typeof CreateRawCoordinateRecorder> | null>(null);
  const rawSaved = useRef(new Set<string>());
  const resultFilesRef = useRef(new Map<string, string>());
  const consentReply = useRef<((allowed: boolean) => void) | null>(null);
  const consentButtonRef = useRef<HTMLButtonElement>(null);
  const consentPreviousFocus = useRef<HTMLElement | null>(null);
  const [cameraConsent, setCameraConsent] = useState(false);
  const [nonce] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [generation, setGeneration] = useState(0);
  const source = session ? `${release.origin}/games/${module.runtimeId}/${session.version}/package/index.html` : null;
  const [identity] = useState(() => ({ token: GetAuthToken(), subjectId: GetOrCreateSubjectIdForUser(GetAuthUserIdFromToken(GetAuthToken())) }));
  const close = useCallback(async () => {
    inputRef.current?.Stop();
    sensorRef.current?.Stop();
    rawRecorder.current?.Reset(); rawSaved.current.clear(); sessionRef.current = null;
    await ExitFullscreenIfActive();
    onClose();
  }, [onClose]);

  const acknowledge = useCallback((state: string) => portRef.current?.postMessage({ schema: 'trainerhub.game/v1', sessionNonce: nonce, type: 'saved', state }), [nonce]);
  const save = useCallback(async () => {
    const result = resultRef.current;
    const selected = sessionRef.current;
    const port = portRef.current;
    if (captureSettings || !result || !selected || saving.current) return;
    if (saved.current) { acknowledge('saved'); return; }
    saving.current = true;
    const planFollowed = selected.planSettings == null || Object.entries(selected.planSettings)
      .every(([key, value]) => lastSettings.current?.[key] === value);
    acknowledge('saving');
    try {
      if (GetAuthToken() !== identity.token) throw new Error('Account changed during game');
      for (const file of rawRecorder.current?.Files() ?? []) {
        if (!rawSaved.current.has(file.kind)) {
          await SaveRawCoordinateCsv(file, selected, { ...identity, subjectId: selected.subjectId }, module.runtimeId);
          if (sessionRef.current !== selected || portRef.current !== port) return;
          rawSaved.current.add(file.kind);
        }
      }
      if (module.runtimeId === 'oculomotor-training' && Number(result.score.summary.samples) > 0) {
        if (!csvRef.current || csvRef.current.records.length !== result.score.summary.samples) throw new Error('Missing gaze samples');
        if (!csvSaved.current) {
          await SaveOculomotorCsv(csvRef.current, selected, { ...identity, subjectId: selected.subjectId });
          if (sessionRef.current !== selected || portRef.current !== port) return;
          csvSaved.current = true;
        }
      }
      await SaveRemoteTrainingRecord(window.location.origin, {
        appId: 'rehabtrainerhub', runtimeId: 'hub', officialGameVersion: selected.version, runSessionToken: selected.token, subjectId: selected.subjectId,
        ...(planLaunch ? { planFollowed } : {}),
        record: { id: selected.recordId, savedAt: new Date().toISOString(), userName: '',
          moduleId: module.runtimeId, gameId: module.runtimeId, config: result.config, score: result.score,
          metadata: { release_version: selected.version.replaceAll('.', '_') } },
      });
      if (sessionRef.current !== selected || portRef.current !== port) return;
      saved.current = true;
      acknowledge('saved');
      onSaved?.();
    } catch { if (sessionRef.current === selected && portRef.current === port) acknowledge('error'); }
    finally { if (sessionRef.current === selected) saving.current = false; }
  }, [acknowledge, identity, module.runtimeId, planLaunch, captureSettings, onSaved]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setError(true); }, 12000);
    void fetch('/api/official-game-sessions', {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(identity.token ? { Authorization: `Bearer ${identity.token}` } : {}) },
      body: JSON.stringify({ gameId: module.runtimeId, subjectId: identity.subjectId,
        ...(planLaunch ? { planItemId: planLaunch.planItemId } : {}) }),
    }).then(async response => {
      if (!response.ok) throw new Error('Session unavailable');
      const selected: Session = await response.json();
      if (!IsSubjectId(selected.subjectId) || typeof selected.version !== 'string' || selected.version.length > 64
        || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(selected.version)
        || typeof selected.token !== 'string' || !selected.token || selected.token.length > 2048
        || typeof selected.recordId !== 'string' || !/^[0-9a-f-]{36}$/.test(selected.recordId)
        || typeof selected.contentSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(selected.contentSha256)
        || (selected.capabilities !== undefined && (!Array.isArray(selected.capabilities)
          || selected.capabilities.length > 16 || selected.capabilities.some(value => typeof value !== 'string')))
        || (selected.planSettings != null && !IsGameSettings(selected.planSettings))
        || GetAuthToken() !== identity.token) throw new Error('Invalid game session');
      if (controller.signal.aborted) return;
      lastSettings.current = null;
      captured.current = false;
      const userId = GetAuthUserIdFromToken(identity.token);
      if (userId) SetAccountSubjectId(userId, selected.subjectId);
      sessionRef.current = selected;
      setSession(selected);
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); sessionRef.current = null; };
  }, [identity, module.runtimeId, generation, planLaunch?.planItemId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    dialog?.showModal();
    const fullscreenChanged = () => sensorRef.current?.FullscreenChanged();
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      inputRef.current?.Stop(); sensorRef.current?.Stop(); portRef.current?.close(); void ExitFullscreenIfActive();
      rawRecorder.current?.Reset(); rawSaved.current.clear();
      if (dialog?.open) dialog.close();
      previousFocus?.focus();
      window.scrollTo(scrollLeft, scrollTop);
    };
  }, []);
  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setError(true), 12000);
    return () => clearTimeout(timeout);
  }, [ready, generation]);
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch(source, { method: 'HEAD', cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (response.status === 404 || response.status === 410) {
          inputRef.current?.Stop();
          sensorRef.current?.Stop();
          await ExitFullscreenIfActive();
          portRef.current?.close();
          setUnavailable(true); setReady(false); setError(true);
        }
      } catch { /* A network failure keeps the current session available. */ }
      finally { checking = false; }
    };
    const timer = setInterval(() => void check(), 60000);
    window.addEventListener('online', check);
    return () => { clearInterval(timer); window.removeEventListener('online', check); controller.abort(); };
  }, [source, generation]);

  const initialize = () => {
    if (!session) return;
    if (portRef.current) { inputRef.current?.Stop(); sensorRef.current?.Stop(); void ExitFullscreenIfActive(); setError(true); setReady(false); setUnavailable(true); portRef.current.close(); return; }
    const channel = new MessageChannel();
    portRef.current = channel.port1;
    const state = { gameId: module.runtimeId, version: session.version, sessionNonce: nonce, sequence: -1, complete: false,
      capabilities: session.capabilities ?? [] };
    const settingsStorage = state.capabilities.includes('settings-storage') ? DeviceStorage() : null;
    const savedSettings = (planLaunch ? session.planSettings : null) ?? ReadSavedGameSettings(settingsStorage, module.runtimeId);
    const sensorInputs = (['pose', 'microphone', 'tongue', 'head'] as const).filter(input => SensorAllowed(state, input));
    rawRecorder.current = CreateRawCoordinateRecorder([
      ...(state.capabilities.includes('hand-tracking') ? ['hand' as const] : []),
      ...sensorInputs.filter(input => input !== 'microphone'),
    ]);
    if (state.capabilities.includes('hand-tracking')) {
      inputRef.current = CreateHandTrackingBroker({
        createController: async () => (await LoadHandTrackingInput(release.origin)).CreateController(),
        send: (message: HandInputMessage) => { rawRecorder.current?.Record('hand', message); channel.port1.postMessage({ ...message, sessionNonce: nonce }); },
        requestConsent: () => new Promise<boolean>(resolve => {
          consentPreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          consentReply.current = resolve;
          void ExitFullscreenIfActive().then(() => { if (consentReply.current === resolve) setCameraConsent(true); });
        }),
        cancelConsent: () => { consentReply.current?.(false); consentReply.current = null; setCameraConsent(false); },
      });
    }
    if (module.runtimeId === 'oculomotor-training' && state.capabilities.includes('eye-tracking')) {
      inputRef.current = CreateEyeTrackingBroker({
        createController: async () => (await LoadEyeTrackingInput(release.origin)).CreateController(),
        send: (message: HandInputMessage) => channel.port1.postMessage({ ...message, sessionNonce: nonce }),
        requestConsent: () => new Promise<boolean>(resolve => {
          consentPreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          consentReply.current = resolve;
          void ExitFullscreenIfActive().then(() => { if (consentReply.current === resolve) setCameraConsent(true); });
        }),
        cancelConsent: () => { consentReply.current?.(false); consentReply.current = null; setCameraConsent(false); },
      });
    }
    sensorRef.current = sensorInputs.length === 0 ? null : CreateSensorInputHost({
      inputs: [...sensorInputs], preview: previewRef.current, shell: shellRef.current, page: document,
      post: message => channel.port1.postMessage({ ...message, sessionNonce: nonce }),
      createBroker: (input, send) => CreateSensorInputBroker({
        createController: async () => (await LoadSensorInput(release.origin, input))
          .CreateController(input === 'microphone' ? {} : { previewHost: previewRef.current }),
        send: message => { rawRecorder.current?.Record(input, message); send(message); },
        requestConsent: () => new Promise<boolean>(resolve => {
          consentPreviousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          consentReply.current = resolve;
          const show = () => { if (consentReply.current === resolve) { setConsentInput(input); setCameraConsent(true); } };
          // The dialog sits inside the frame, so it stays visible when the frame itself is fullscreen.
          if (document.fullscreenElement && document.fullscreenElement !== shellRef.current) void ExitFullscreenIfActive().then(show);
          else show();
        }),
        cancelConsent: () => { consentReply.current?.(false); consentReply.current = null; setCameraConsent(false); },
      }),
    });
    let sampleCount = 0;
    channel.port1.onmessage = (event) => {
      if (!AcceptGameMessage(event.data, state)) return;
      const message = event.data;
      if (message.type === 'ready') { setReady(true); setError(false); }
      if (message.type === 'settings') {
        lastSettings.current = message.payload;
        if (captureSettings && !captured.current) {
          captured.current = true;
          captureSettings(message.payload);
          void close();
        }
      }
      if (captureSettings) {
        if (message.type === 'exit') void close();
        return;
      }
      if (!planLaunch && message.type === 'settings') WriteSavedGameSettings(settingsStorage, module.runtimeId, message.payload);
      if (message.type === 'result') { inputRef.current?.Stop(); sensorRef.current?.Stop(); resultRef.current = message.payload; void save(); }
      if (message.type === 'retry') void save();
      if (message.type === 'exit') void close();
      if (message.type === 'input-start' && !sensorRef.current?.Handle(message)) void inputRef.current?.Start(message.payload.hand);
      if (message.type === 'input-stop') { inputRef.current?.Stop(); sensorRef.current?.Stop(); }
      if (['input-capture', 'input-preview', 'fullscreen-request', 'fullscreen-exit'].includes(message.type)) sensorRef.current?.Handle(message);
      if (message.type === 'input-calibrate') inputRef.current?.Calibrate?.(message.payload.x, message.payload.y);
      if (message.type === 'input-reset') inputRef.current?.Reset?.();
      if (message.type === 'gaze-csv' && !csvRef.current) csvRef.current = message.payload;
      if (message.type === 'csv-file') csvFileRef.current = message.payload;
      if (message.type === 'csv-download' && csvFileRef.current) {
        const file = csvFileRef.current;
        const url = URL.createObjectURL(new Blob(['\uFEFF', file.text], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = file.fileName; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      if (message.type === 'result-file') StageResultFile(resultFilesRef.current, message.payload);
      if (message.type === 'result-file-download' && resultFilesRef.current.has(message.payload.fileName)) DownloadResultFile(message.payload.fileName, resultFilesRef.current.get(message.payload.fileName)!);
      if (message.type === 'sample' && sampleCount++ < 100) {
        const body = new FormData();
        body.append('image', message.payload.image, 'drawing.png');
        body.append('metadata', JSON.stringify(message.payload.metadata));
        void fetch('/api/drawing-samples', { method: 'POST', body }).catch(() => undefined);
      }
    };
    channel.port1.start();
    // The iframe has an opaque origin. Transfer only to its captured window;
    // the game verifies the parent's source and origin before accepting this port.
    frameRef.current?.contentWindow?.postMessage({ schema: 'trainerhub.game/v1', type: 'init',
      gameId: module.runtimeId, version: session.version, sessionNonce: nonce, language,
      ...(savedSettings ? { settings: savedSettings } : {}) }, '*', [channel.port2]);
  };
  useEffect(() => { if (cameraConsent) consentButtonRef.current?.focus(); }, [cameraConsent]);
  const sensorCopy = consentInput ? sensorConsent[consentInput][language === 'en' ? 'en' : 'zh'] : null;
  const answerConsent = (allowed: boolean) => {
    const reply = consentReply.current;
    consentReply.current = null; setCameraConsent(false); reply?.(allowed);
    consentPreviousFocus.current?.focus();
  };
  return <dialog className="training-overlay training-overlay-runtime" ref={dialogRef}
    aria-label={module.copy[language === 'en' ? 'en' : 'zh-TW'].title}
    onCancel={event => { event.preventDefault(); void close(); }}>
    {captureSettings && <div className="practice-capture-notice">
      <p>{copy.captureNotice}</p>
      <button className="admin-button admin-button-secondary" type="button" onClick={() => void close()}>{copy.cancel}</button>
    </div>}
    <div ref={shellRef} className={`embedded-training-frame ${ready ? 'is-ready' : ''}`}>
      {session && (['pose', 'tongue', 'head'] as const).some(input => SensorAllowed({ gameId: module.runtimeId, capabilities: session.capabilities ?? [] }, input))
        && <div ref={previewRef} className="training-input-preview" hidden />}
      {!ready && <div className="training-loading-stage" role={error ? 'alert' : 'status'}>
        <p>{error ? (language === 'en' ? 'Game could not be loaded' : '無法載入遊戲') : (language === 'en' ? 'Loading game…' : '正在載入遊戲…')}</p>
        {error && <><button onClick={() => { inputRef.current?.Stop(); sensorRef.current?.Stop(); rawRecorder.current?.Reset(); rawSaved.current.clear(); void ExitFullscreenIfActive(); portRef.current?.close(); portRef.current = null; sessionRef.current = null; resultRef.current = null; csvRef.current = null; csvFileRef.current = null; resultFilesRef.current.clear(); csvSaved.current = false; saving.current = false; saved.current = false; setSession(null); setUnavailable(false); setReady(false); setError(false); setGeneration(value => value + 1); }}>{language === 'en' ? 'Try again' : '重新載入'}</button><button onClick={() => void close()}>{language === 'en' ? 'Back to lobby' : '返回大廳'}</button></>}
      </div>}
      {!unavailable && source && <iframe key={generation} ref={frameRef} src={source} title={release.name} onLoad={initialize}
        sandbox="allow-scripts" allow={`autoplay; fullscreen${session?.capabilities?.includes('gamepad') ? '; gamepad *' : ''}`} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
      {cameraConsent && <div className="training-overlay-camera-consent" role="dialog" aria-modal="true" aria-labelledby="hand-input-consent-title"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); answerConsent(false); }
          if (event.key === 'Tab') {
            event.preventDefault(); const buttons = event.currentTarget.querySelectorAll('button');
            (document.activeElement === buttons[0] ? buttons[1] : buttons[0]).focus();
          }
        }}>
        <section><h2 id="hand-input-consent-title">{sensorCopy?.[0] ?? (language === 'en' ? 'Enable camera' : '啟用相機')}</h2>
          <p>{sensorCopy ? sensorCopy[1] : module.runtimeId === 'oculomotor-training'
            ? (language === 'en' ? 'WebGazer runs on this device. Only gaze coordinates reach the game; camera images are never uploaded.' : '影像只在此裝置由 WebGazer 處理。遊戲只收到眼動座標，不會上傳相機影像。')
            : (language === 'en' ? 'MediaPipe processes images on this device; images never leave it. The hand coordinates sent to the game are also saved for this activity under a pseudonymous subject ID.' : '影像只在此裝置由 MediaPipe 處理，不會離開裝置。遊戲收到的手部座標，也會以匿名識別碼儲存於當次活動。')}</p>
          <button ref={consentButtonRef} type="button" onClick={() => answerConsent(true)}>{sensorCopy?.[2] ?? (language === 'en' ? 'Enable camera' : '允許相機')}</button>
          <button type="button" onClick={() => answerConsent(false)}>{language === 'en' ? 'Cancel' : '取消'}</button>
        </section>
      </div>}
    </div>
  </dialog>;
}

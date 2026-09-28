import { useCallback, useEffect, useRef, useState } from 'react';
import { TrainingRulesPanel } from '@rehab-trainer/ui';
import { GetAuthToken, GetAuthUserIdFromToken, SaveRemoteTrainingRecord } from '@rehab-trainer/ui/auth/authClient';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import {
  GetHostedGameSettings,
  GetHostedGameSessionNonce,
  NotifyHubTrainingActive,
  RequestHubTrainingConfiguration,
  SendHostedGameScore,
} from '@rehab-trainer/ui/embeddedTraining';
import { EnterFullscreenFromUserGesture, ExitFullscreenIfActive, WaitForFullscreenLayout } from '@rehab-trainer/ui/fullscreen';
import { useMediaPermissionPreflight } from '@rehab-trainer/ui/hooks/useMediaPermissionPreflight';
import { useT } from '@rehab-trainer/ui/i18n/games';
import { defaultSiteUrls } from '@rehab-trainer/ui/siteUrls';
import { GetOrCreateSubjectIdForUser } from '@rehab-trainer/ui/storage/subjectId';
import { UploadOculomotorCsv, type OculomotorCsvUpload } from './uploadOculomotorCsv';

type Phase = 'rules' | 'running' | 'results';
type ExperimentResult = {
  actual_duration_ms: number;
  completed_targets: number;
  accuracy_rate: number | null;
  in_threshold_sec: number | null;
  valid_sec: number | null;
  blink_sec: number | null;
  gaze_sample_count: number | null;
  threshold_deg: number | null;
  validation_error_deg: number | null;
  estimated_refresh_hz: number | null;
  end_reason: string;
  module: string;
  eye_tracking_source: 'webgazer' | 'off';
};

type UploadStatus = 'idle' | 'saving' | 'saved' | 'error' | 'empty';

const modeNames: Record<string, [string, string]> = {
  vor: ['中央目標辨識', 'Central target recognition'],
  pursuit: ['追視', 'Smooth pursuit'],
  saccade: ['跳視', 'Saccade'],
  fixation: ['定點注視', 'Fixation'],
};

export function OculomotorTrainingGame() {
  const { lang } = useT();
  const zh = lang !== 'en';
  const [phase, setPhase] = useState<Phase>('rules');
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);
  const finalizedRef = useRef(false);
  const uploadingRef = useRef(false);
  const uploadRef = useRef<OculomotorCsvUpload | null>(null);
  const recordIdRef = useRef<string>(crypto.randomUUID());
  const settings = GetHostedGameSettings();
  const source = settings?.eyeTrackingSource;
  const cameraPermission = useMediaPermissionPreflight({
    active: phase === 'running' && source === 'webgazer',
    video: true,
  });

  const abort = useCallback(() => {
    NotifyHubTrainingActive(false);
    void ExitFullscreenIfActive();
    RequestHubTrainingConfiguration();
  }, []);

  useEffect(() => {
    if (phase !== 'running' || source !== 'webgazer') return;
    if (['denied', 'unsupported', 'error'].includes(cameraPermission.status)) {
      setError(zh ? '攝影機未取得授權，請在瀏覽器允許使用後重試。' : 'Camera access was not granted. Allow it in the browser and retry.');
      abort();
    }
  }, [abort, cameraPermission.status, phase, source, zh]);

  const sendSettings = useCallback(() => {
    if (!settings || (source === 'webgazer' && cameraPermission.status !== 'granted')) return;
    frameRef.current?.contentWindow?.postMessage({
      type: 'oculomotor:start',
      settings: { ...settings, subjectId: GetOrCreateSubjectIdForUser(GetAuthUserIdFromToken(GetAuthToken())) },
    }, window.location.origin);
  }, [cameraPermission.status, settings, source]);

  const finishRecord = useCallback((completed: ExperimentResult) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const record = {
      id: recordIdRef.current, savedAt: new Date().toISOString(), userName: '',
      moduleId: 'oculomotor-training', gameId: 'oculomotor-training',
      gameTitle: '眼動練習', difficulty: 'normal',
      config: settings ?? undefined,
      details: { ...completed }, detailRows: [{ ...completed }],
    };
    if (!SendHostedGameScore(record, { mode: completed.module, eye_tracking_source: completed.eye_tracking_source })) {
      void SaveRemoteTrainingRecord(defaultSiteUrls.hub, {
        appId: 'rehabtrainerhub', runtimeId: 'vision', record,
      }).catch((saveError) => console.error('Unable to save oculomotor summary.', saveError));
    }
  }, [settings]);

  const saveUpload = useCallback((completed: ExperimentResult, upload: OculomotorCsvUpload) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploadStatus('saving');
    setError('');
    void UploadOculomotorCsv(recordIdRef.current, upload).then(() => {
      uploadingRef.current = false;
      setUploadStatus('saved');
      finishRecord(completed);
    }).catch((uploadError) => {
      uploadingRef.current = false;
      setUploadStatus('error');
      setError(uploadError instanceof Error ? uploadError.message : 'CSV upload failed.');
    });
  }, [finishRecord]);

  useEffect(() => {
    if (phase !== 'running') return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as { type?: unknown; result?: unknown; upload?: unknown; message?: unknown } | null;
      if (message?.type === 'oculomotor:ready') {
        sendSettings();
      } else if (message?.type === 'oculomotor:active') {
        NotifyHubTrainingActive(true);
      } else if (message?.type === 'oculomotor:abort') {
        abort();
      } else if (message?.type === 'oculomotor:error') {
        setError(typeof message.message === 'string' ? message.message : 'Experiment error.');
        abort();
      } else if (message?.type === 'oculomotor:complete' && !completedRef.current && isExperimentResult(message.result)) {
        completedRef.current = true;
        const completed = message.result;
        recordIdRef.current = GetHostedGameSessionNonce() ?? recordIdRef.current;
        setResult(completed);
        setPhase('results');
        NotifyHubTrainingActive(false);
        void ExitFullscreenIfActive();
        if (completed.eye_tracking_source === 'webgazer' && completed.gaze_sample_count) {
          if (!isOculomotorCsvUpload(message.upload)
            || message.upload.records.length !== completed.gaze_sample_count) {
            setUploadStatus('error');
            setError('Eye movement samples are unavailable for CSV upload.');
            return;
          }
          uploadRef.current = message.upload;
          saveUpload(completed, message.upload);
        } else {
          setUploadStatus(completed.eye_tracking_source === 'webgazer' ? 'empty' : 'idle');
          finishRecord(completed);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [abort, finishRecord, phase, saveUpload, sendSettings]);

  if (!settings) return null;
  const mode = String(settings.module);
  const modeName = modeNames[mode]?.[zh ? 0 : 1] ?? mode;
  const sourceName = source === 'webgazer' ? 'WebGazer' : zh ? '不記錄' : 'Off';

  return <div className="oculomotor-game">
    {phase === 'rules' && <div className="training-panel">
      <TrainingRulesPanel
        title={zh ? '眼動練習' : 'Oculomotor practice'}
        label={zh ? '活動說明' : 'Instructions'}
        summaryTitle={zh ? '本次設定' : 'Session settings'}
        summaryItems={[
          { label: zh ? '活動' : 'Drill', value: modeName },
          { label: zh ? '眼動來源' : 'Gaze source', value: sourceName },
        ]}
        sections={[{
          title: zh ? '實驗程序' : 'Experiment procedure',
          description: zh
            ? '使用參考專案的目標移動、時間安排、WebGazer 校正與五點驗證。'
            : 'Uses the reference target movement, timing, WebGazer calibration, and five point validation.',
          items: zh ? [
            '先確認螢幕尺寸與觀看距離，活動會使用全螢幕。',
            '選擇 WebGazer 時，請允許攝影機，完成九點校正與五點驗證。',
            '觀看或跟隨目標；按 Esc 可結束當次活動。',
          ] : [
            'Confirm screen size and viewing distance. The activity uses fullscreen.',
            'For WebGazer, allow camera access, then complete nine point calibration and five point validation.',
            'Watch or follow the target. Press Escape to end the session.',
          ],
        }]}
        startLabel={zh ? '開始練習' : 'Start practice'}
        backLabel={zh ? '返回設定' : 'Back to settings'}
        onStart={() => {
          completedRef.current = false;
          finalizedRef.current = false;
          uploadRef.current = null;
          setUploadStatus('idle');
          setError('');
          void EnterFullscreenFromUserGesture(document.documentElement).then(async () => {
            await WaitForFullscreenLayout();
            setPhase('running');
          });
        }}
        onBack={RequestHubTrainingConfiguration}
      />
    </div>}
    {phase === 'running' && <>
      {error && <p role="alert">{error}</p>}
      {source !== 'webgazer' || cameraPermission.status === 'granted'
        ? <iframe
            ref={frameRef}
            title={zh ? '眼動實驗' : 'Oculomotor experiment'}
            src="./reference/index.html"
            allow="camera; fullscreen"
            onLoad={sendSettings}
            className="oculomotor-experiment-frame"
          />
        : <p role="status">{zh ? '準備攝影機中…' : 'Preparing camera…'}</p>}
    </>}
    {phase === 'results' && result && <section className="oculomotor-results training-panel">
      <h2>{zh ? '當次紀錄' : 'Session record'}</h2>
      <h3>{modeName}</h3>
      {uploadStatus === 'saving' && <p role="status">{zh ? '正在上傳眼動 CSV…' : 'Uploading eye movement CSV…'}</p>}
      {uploadStatus === 'saved' && <p role="status">{zh ? '眼動 CSV 已儲存至私人雲端空間。' : 'Eye movement CSV saved to private storage.'}</p>}
      {uploadStatus === 'empty' && <p role="status">{zh ? '本次沒有可上傳的眼動逐筆資料。' : 'No eye movement samples were captured for upload.'}</p>}
      {uploadStatus === 'error' && <p role="alert">
        {zh ? '眼動 CSV 尚未上傳成功。' : 'Eye movement CSV was not uploaded.'} {error}
        {uploadRef.current && <button type="button" className="btn btn-primary" onClick={() => saveUpload(result, uploadRef.current!)}>
          {zh ? '重試上傳' : 'Retry upload'}
        </button>}
      </p>}
      <p>{zh ? '完成目標數' : 'Completed targets'}：{result.completed_targets}</p>
      <p>{zh ? '刺激時間' : 'Stimulus duration'}：{(result.actual_duration_ms / 1000).toFixed(1)} s</p>
      {result.accuracy_rate !== null && <p>{zh ? '有效眼動時間在標比例' : 'On target share of valid gaze time'}：{result.accuracy_rate}%</p>}
      {result.validation_error_deg !== null && <p>{zh ? '五點驗證平均誤差' : 'Five point validation mean error'}：{result.validation_error_deg}°</p>}
      <p>{zh ? '這些數值僅為當次刺激參數與練習紀錄，不代表診斷或療效。' : 'These values describe this session’s stimulus and activity. They do not indicate diagnosis or treatment effect.'}</p>
      {uploadStatus !== 'saving' && <TrainingResultActions onBackHome={() => window.location.reload()} backLabel={zh ? '返回入口' : 'Back to start'} hubLabel={zh ? '返回大廳' : 'Back to lobby'} />}
    </section>}
  </div>;
}

function isExperimentResult(value: unknown): value is ExperimentResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return typeof result.module === 'string' && Object.hasOwn(modeNames, result.module)
    && (result.eye_tracking_source === 'webgazer' || result.eye_tracking_source === 'off')
    && typeof result.end_reason === 'string'
    && Number.isFinite(result.actual_duration_ms)
    && Number.isFinite(result.completed_targets)
    && ['accuracy_rate', 'in_threshold_sec', 'valid_sec', 'blink_sec', 'gaze_sample_count',
      'threshold_deg', 'validation_error_deg', 'estimated_refresh_hz'].every((key) =>
        result[key] === null || (typeof result[key] === 'number' && Number.isFinite(result[key])));
}

function isOculomotorCsvUpload(value: unknown): value is OculomotorCsvUpload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const upload = value as Record<string, unknown>;
  return Array.isArray(upload.records) && upload.records.length > 0 && upload.records.length <= 36000
    && upload.records.every((row) => row && typeof row === 'object' && !Array.isArray(row))
    && !!upload.metadata && typeof upload.metadata === 'object' && !Array.isArray(upload.metadata)
    && Object.values(upload.metadata).every((item) => typeof item === 'string'
      || (typeof item === 'number' && Number.isFinite(item)));
}

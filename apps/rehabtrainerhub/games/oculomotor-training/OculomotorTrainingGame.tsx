import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { ExitFullscreenIfActive } from '@rehab-trainer/ui/fullscreen';
import { GetHostedGameSessionNonce, GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { GetAuthToken } from '@rehab-trainer/ui/auth/authClient';
import { TrainingRulesPanel } from '@rehab-trainer/ui';
import WebGazerExtension from '@jspsych/extension-webgazer';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import {
NotifyHubTrainingAbort,
NotifyHubTrainingComplete,
RequestHubTrainingConfiguration,
} from '@rehab-trainer/ui/embeddedTraining';
import { useMediaPermissionPreflight } from '@rehab-trainer/ui/hooks/useMediaPermissionPreflight';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useT } from '@rehab-trainer/ui/i18n';
import { GetSetting,getActiveUser } from '@rehab-trainer/ui/settings';
import { soundManager } from './runtime/soundManager';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import type { JsPsych } from 'jspsych';
import { initJsPsych } from 'jspsych';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DownloadTrainingCsv } from './exportCsv';
import { HasTobiiHost } from './gaze/tobiiHost';
import { SaveOculomotorGazeRecords, SaveOculomotorRecord, SendOculomotorHostedScore } from './gaze/recordStorage';
import { OculomotorResults } from './results/OculomotorResults';
import { DestroyPixiTrainingRuntime } from './runtime/pixiPool';
import { BuildOculomotorTimeline } from './timeline/oculomotorTimeline';
import { CleanupWebGazerRuntime } from './webgazer/webgazerCalibration';
import { EnsureWebGazerLoaded } from './webgazer/webgazerLoader';

type Phase = 'rules' | 'running' | 'results';

export function OculomotorTrainingGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t, lang } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const [phase, setPhase] = useState<Phase>('rules');
  const [results, setResults] = useState<any[]>([]);
  const [gazeSaveState, setGazeSaveState] = useState<'saving' | 'saved' | 'error'>('saving');
  const completedRecordRef = useRef<Parameters<typeof SaveOculomotorRecord>[0] | null>(null);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);

  const userName = getActiveUser() || 'guest';
  const eyeTrackingSource = GetHostedGameSetting<'off' | 'webgazer' | 'tobii'>('eyeTrackingSource');
  const enableWebGazer = eyeTrackingSource === 'webgazer';
  const cameraPermission = useMediaPermissionPreflight({
    active: enableWebGazer && phase === 'running',
    video: true,
  });

  useEffect(() => {
    if (phase !== 'running') return;
    if (enableWebGazer && !['granted', 'denied', 'error', 'unsupported'].includes(cameraPermission.status)) return;
    let cancelled = false;

    const setup = async () => {
      if (eyeTrackingSource === 'tobii' && !HasTobiiHost()) {
        alert(lang === 'en'
          ? 'Open this game in the Tobii Windows host to record Eye Tracker 5 gaze.'
          : '請使用 Tobii Windows 專用程式開啟此遊戲，才能記錄 Eye Tracker 5 注視資料。');
        RequestHubTrainingConfiguration();
        return;
      }
      if (enableWebGazer) {
        if (cameraPermission.status !== 'granted') {
          alert(t('settings.wg.cameraBlockedAlert'));
          RequestHubTrainingConfiguration();
          return;
        }
        await EnsureWebGazerLoaded();
      }
      if (cancelled) return;

      const jsPsych = initJsPsych({
        display_element: 'jspsych-target',
        extensions: enableWebGazer ? [{ type: WebGazerExtension }] : [],
        on_finish: () => {
          if (skipFinishRef.current) return;
          const data = jsPsych.data.get().values();
          const trainingTrial = data.find((item: any) => item.trial_type === 'pixi-oculomotor-training');
          const completedRecord = {
            id: GetHostedGameSessionNonce() ?? crypto.randomUUID(),
            savedAt: new Date().toISOString(),
            userName,
            moduleId: 'oculomotor-training',
            gameId: 'oculomotor-training',
            gameTitle: t('home.module.oculomotor.title'),
            difficulty: 'normal',
            results: data,
            details: trainingTrial ?? {},
            detailRows: trainingTrial ? [trainingTrial] : [],
          } as Parameters<typeof SaveOculomotorRecord>[0];
          completedRecordRef.current = completedRecord;
          setGazeSaveState('saving');
          void SaveOculomotorRecord(completedRecord)
            .then((saved) => setGazeSaveState(saved ? 'saved' : 'error'))
            .catch((error) => {
              console.error('Unable to save oculomotor data.', error);
              setGazeSaveState('error');
            });

          DestroyPixiTrainingRuntime('oculomotor-training');
          setResults(data);
          jsPsychRef.current = null;
          void ExitFullscreenIfActive();
          setPhase('results');
        },
      });

      const timeline = BuildOculomotorTimeline(jsPsych, t);
      if (cancelled) return;
      skipFinishRef.current = false;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup().catch((err) => {
      if (cancelled) return;
      console.error('Unable to run oculomotor training', err);
      CleanupWebGazerRuntime();
      NotifyHubTrainingAbort();
    });

    return () => {
      cancelled = true;

      DestroyPixiTrainingRuntime('oculomotor-training');
      const active = jsPsychRef.current;
      jsPsychRef.current = null;
      if (active) {
        skipFinishRef.current = true;
        active.abortExperiment();
      }
      CleanupWebGazerRuntime();
    };
  }, [phase, eyeTrackingSource, enableWebGazer, cameraPermission.status, lang]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;

    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DestroyPixiTrainingRuntime('oculomotor-training');
    CleanupWebGazerRuntime();
    void ExitFullscreenIfActive();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  const isZh = lang !== 'en';
  const hasGazeRecords = results.some((item: any) => (
    item.trial_type === 'pixi-oculomotor-training'
    && Array.isArray(item.gaze_records)
    && item.gaze_records.length > 0
  ));
  const mode = GetHostedGameSetting<string>('mode');
  const durationSec = GetHostedGameSetting<number>('durationSec');
  const modeLabels: Record<string, string> = {
    pursuit: isZh ? '追視' : 'Smooth Pursuit',
    'reaction-jumps': isZh ? '跳視' : 'Reaction Jumps',
    'multi-object': isZh ? '多目標追蹤' : 'Multiple Distractions',
    'lilac-chaser': isZh ? '周邊固視' : 'Lilac Chaser',
  };

  return (
    <div ref={fullscreenRootRef} className="oculomotor-training-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? '眼球動作控制訓練' : 'Oculomotor Training'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? '眼球運動訓練' : 'Oculomotor Training'}
            summaryItems={[
              { label: isZh ? '活動模式' : 'Mode', value: modeLabels[mode] ?? mode },
              { label: isZh ? '活動時間' : 'Duration', value: `${durationSec} ${isZh ? '秒' : 's'}` },
            ]}
            sections={isZh ? [
              {
                title: '操作與玩法',
                description: '透過目標追蹤與跳視注視，加強眼球平滑追視與注視穩定度。',
                items: [
                  '頭部保持放鬆並面向螢幕中央。',
                  '僅轉動雙眼跟隨畫面上移動或跳躍的目標標記。',
                  '盡量保持視線精確對準目標，維持流暢追蹤。',
                ],
              },
              { title: '成績計算', description: '結算會記錄活動時長、模式及追蹤歷程。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Improve smooth pursuit and fixation stability with moving targets.',
                items: [
                  'Keep your head relaxed and centered towards the screen.',
                  'Follow the moving or jumping target using only your eyes.',
                  'Maintain precise fixation and smooth tracking across the path.',
                ],
              },
              { title: 'Results', description: 'Records session duration, mode settings, and tracking history.' },
            ]}
            startLabel={isZh ? '開始訓練' : 'Start Training'}
            backLabel={isZh ? '回設定' : 'Back to Settings'}
            onStart={async () => {
              await enterTrainingFullscreen();
              setPhase('running');
            }}
            onBack={() => RequestHubTrainingConfiguration()}
          />
        </div>
      )}

      {phase === 'running' && (
        <div id="jspsych-target" className="experiment-container" style={{ width: '100vw', height: '100vh' }} />
      )}

      {phase === 'results' && (
        <div className="experiment-container results-container" style={{ minHeight: '100vh', padding: '2rem' }}>
          <OculomotorResults results={results} userName={userName} t={t} oculomotorMode={GetHostedGameSetting<string>('mode')} oculomotorPattern={GetHostedGameSetting<string>('movementPath')} />
          {hasGazeRecords && (
            <div className="results-actions">
              <p role="status" aria-live="polite">
                {gazeSaveState === 'saving'
                  ? (isZh ? '逐筆座標 CSV 儲存中…' : 'Saving gaze CSV…')
                  : gazeSaveState === 'saved'
                    ? GetAuthToken()
                      ? (isZh ? '逐筆座標 CSV 已儲存，可於進度頁重新下載。' : 'Gaze CSV saved. Download it later from Progress.')
                      : (isZh ? '逐筆座標 CSV 已儲存；訪客請立即下載副本。' : 'Gaze CSV saved. Guests should download a copy now.')
                    : (isZh ? '逐筆座標 CSV 尚未存到雲端，請重試或立即下載。' : 'Gaze CSV was not saved online. Retry or download it now.')}
              </p>
              {gazeSaveState === 'error' && (
                <button className="btn btn-secondary btn-lg" type="button" onClick={() => {
                  const record = completedRecordRef.current;
                  if (!record) return;
                  setGazeSaveState('saving');
                  void SaveOculomotorGazeRecords(record)
                    .then((saved) => {
                      setGazeSaveState(saved ? 'saved' : 'error');
                      if (saved) SendOculomotorHostedScore(record);
                    })
                    .catch((error) => {
                      console.error('Unable to retry saving oculomotor data.', error);
                      setGazeSaveState('error');
                    });
                }}>
                  {isZh ? '重試儲存 CSV' : 'Retry saving CSV'}
                </button>
              )}
              <button className="btn btn-secondary btn-lg" type="button" onClick={() => DownloadTrainingCsv({
                results,
                moduleId: 'oculomotor-training',
                oculomotorMode: GetHostedGameSetting<string>('mode'),
                oculomotorPattern: GetHostedGameSetting<string>('movementPath'),
                t,
              })}>
                {isZh ? '下載眼動紀錄 CSV' : 'Download gaze records CSV'}
              </button>
            </div>
          )}
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

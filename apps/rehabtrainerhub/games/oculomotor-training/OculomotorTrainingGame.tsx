import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { ExitFullscreenIfActive } from '@rehab-trainer/ui/fullscreen';
import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { TrainingRulesPanel } from './rules/TrainingRulesPanel';
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
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import type { JsPsych } from 'jspsych';
import { initJsPsych } from 'jspsych';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DownloadTrainingCsv } from './exportCsv';
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
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);

  const userName = getActiveUser() || 'guest';
  const enableWebGazer = (GetHostedGameSetting<boolean>('webgazerEnabled'));
  const cameraPermission = useMediaPermissionPreflight({
    active: enableWebGazer && phase === 'running',
    video: true,
  });

  useEffect(() => {
    if (phase !== 'running') return;
    let cancelled = false;

    const setup = async () => {
      if (enableWebGazer) {
        if (cameraPermission.status === 'denied') {
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
          SaveTrainingRecord({
            id: String(Date.now()),
            savedAt: new Date().toISOString(),
            userName,
            moduleId: 'oculomotor-training',
            gameId: 'oculomotor-training',
            gameTitle: t('home.module.oculomotor.title'),
            difficulty: 'normal',
            results: data,
            details: trainingTrial ?? {},
            detailRows: trainingTrial ? [trainingTrial] : [],
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
  }, [phase, enableWebGazer, cameraPermission.status]);

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
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

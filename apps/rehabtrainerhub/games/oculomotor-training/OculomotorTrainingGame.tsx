import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
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

type Phase = 'running' | 'results';

export function OculomotorTrainingGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>('running');
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
          });

          DestroyPixiTrainingRuntime('oculomotor-training');
          setResults(data);
          jsPsychRef.current = null;
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
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  if (phase === 'running') {
    return <div id="jspsych-target" className="experiment-container" style={{ width: '100vw', height: '100vh' }} />;
  }

  return (
    <div className="experiment-container results-container" style={{ minHeight: '100vh', padding: '2rem' }}>
      <OculomotorResults results={results} userName={userName} t={t} oculomotorMode={GetHostedGameSetting<string>('mode')} oculomotorPattern={GetHostedGameSetting<string>('movementPath')} />
      <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
    </div>
  );
}

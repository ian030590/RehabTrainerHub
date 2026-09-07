import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import WebGazerExtension from '@jspsych/extension-webgazer';
import {
  NotifyHubTrainingAbort,
  NotifyHubTrainingComplete,
  RequestHubTrainingConfiguration,
} from '@rehab-trainer/ui/embeddedTraining';
import { useMediaPermissionPreflight } from '@rehab-trainer/ui/hooks/useMediaPermissionPreflight';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useT } from '@rehab-trainer/ui/i18n';
import { GetSetting, getActiveUser } from '@rehab-trainer/ui/settings';
import { DestroyPixiTrainingRuntime } from '@rehab-trainer/ui/pixiPool';
import { soundManager } from '@rehab-trainer/ui/soundManager';
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { EnsureWebGazerLoaded } from './webgazer/webgazerLoader';
import { CleanupWebGazerRuntime } from './webgazer/webgazerCalibration';
import { BuildOculomotorTimeline } from './timeline/oculomotorTimeline';
import { OculomotorResults } from './results/OculomotorResults';
import { DownloadTrainingCsv } from './exportCsv';

type Phase = 'running' | 'results';

export function OculomotorTrainingGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>('running');
  const [results, setResults] = useState<any[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);

  const userName = getActiveUser()?.name || 'guest';
  const enableWebGazer = GetSetting('oculomotorEnableWebgazer');
  const cameraPermission = useMediaPermissionPreflight({
    active: enableWebGazer && phase === 'running',
    video: true,
  });

  useEffect(() => {
    if (phase !== 'running') return;
    let cancelled = false;

    const setup = async () => {
      if (enableWebGazer) {
        if (cameraPermission.status === 'blocked') {
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
          soundManager.destroy();
          DestroyPixiTrainingRuntime('oculomotor-training');
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = BuildOculomotorTimeline();
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
      soundManager.destroy();
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
    soundManager.destroy();
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
      <OculomotorResults
        results={results}
        userName={userName}
        moduleId="oculomotor-training"
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
        onDownloadCsv={() => DownloadTrainingCsv({
          results,
          userName,
          moduleId: 'oculomotor-training',
          oculomotorMode: GetSetting('oculomotorMode'),
          oculomotorPattern: GetSetting('oculomotorPattern'),
          t,
        })}
      />
      <TrainingResultActions
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
      />
    </div>
  );
}

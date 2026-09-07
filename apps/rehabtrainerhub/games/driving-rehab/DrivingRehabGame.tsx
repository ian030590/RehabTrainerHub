import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { initJsPsych } from 'jspsych';
import type { JsPsych } from 'jspsych';
import {
  NotifyHubTrainingAbort,
  NotifyHubTrainingComplete,
} from '@rehab-trainer/ui/embeddedTraining';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { useT } from '@rehab-trainer/ui/i18n';
import { GetSetting, getActiveUser } from '@rehab-trainer/ui/settings';
import { soundManager } from '@rehab-trainer/ui/soundManager';
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { BuildDrivingRehabTimeline } from './timeline/drivingRehabTimeline';
import { DisposeDrivingRehabRuntime } from './engine/driving-runtime-lifecycle';
import { ParseDrivingWheelCalibration } from './engine/driving-input';
import { DrivingResults } from './results/DrivingResults';
import { DownloadTrainingCsv } from './exportCsv';

export function DrivingRehabGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t, lang } = useT();
  const [phase, setPhase] = useState<'running' | 'results'>('running');
  const [results, setResults] = useState<any[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser()?.name || 'guest';

  useEffect(() => {
    if (phase !== 'running') return;
    let cancelled = false;

    const setup = async () => {
      const jsPsych = initJsPsych({
        display_element: 'jspsych-target',
        on_finish: () => {
          if (skipFinishRef.current) return;
          const data = jsPsych.data.get().values();
          SaveTrainingRecord({
            id: String(Date.now()),
            savedAt: new Date().toISOString(),
            userName,
            moduleId: 'driving-rehab',
            gameId: 'driving-rehab',
            gameTitle: t('home.module.driving.title'),
            difficulty: GetSetting('drivingDifficulty'),
            results: data,
          });
          soundManager.destroy();
          DisposeDrivingRehabRuntime();
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = BuildDrivingRehabTimeline({
        driving: {
          redFlashEnabled: GetSetting('drivingRedFlashEnabled'),
          difficulty: GetSetting('drivingDifficulty'),
          controlMode: GetSetting('drivingControlMode'),
          wheelCalibration: ParseDrivingWheelCalibration(GetSetting('drivingWheelCalibration')),
          renderQuality: GetSetting('drivingRenderQuality'),
          language: lang,
        },
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup();

    return () => {
      cancelled = true;
      soundManager.destroy();
      DisposeDrivingRehabRuntime();
      const active = jsPsychRef.current;
      jsPsychRef.current = null;
      if (active) {
        skipFinishRef.current = true;
        active.abortExperiment();
      }
    };
  }, [phase, lang]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;
    soundManager.destroy();
    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DisposeDrivingRehabRuntime();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  if (phase === 'running') {
    return <div id="jspsych-target" className="experiment-container" style={{ width: '100vw', height: '100vh' }} />;
  }

  return (
    <div className="experiment-container results-container" style={{ minHeight: '100vh', padding: '2rem' }}>
      <DrivingResults
        results={results}
        userName={userName}
        moduleId="driving-rehab"
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
        onDownloadCsv={() => DownloadTrainingCsv({ results, userName, moduleId: 'driving-rehab', t })}
      />
      <TrainingResultActions
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
      />
    </div>
  );
}

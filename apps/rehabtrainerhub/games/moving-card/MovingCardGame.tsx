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
import { DestroyPixiTrainingRuntime } from '@rehab-trainer/ui/pixiPool';
import { soundManager } from '@rehab-trainer/ui/soundManager';
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { BuildMovingCardTimeline } from './timeline/movingCardTimeline';
import { DefaultTrainingResults } from './results/DefaultTrainingResults';
import { DownloadTrainingCsv } from './exportCsv';

export function MovingCardGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t } = useT();
  const [phase, setPhase] = useState<'running' | 'results'>('running');
  const [results, setResults] = useState<any[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser()?.name || 'guest';
  const difficulty = GetSetting('difficulty');

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
            moduleId: 'moving-card',
            gameId: 'moving-card',
            gameTitle: t('home.module.movingCard.title'),
            difficulty,
            results: data,
          });
          soundManager.destroy();
          DestroyPixiTrainingRuntime('moving-card');
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = BuildMovingCardTimeline({
        difficulty,
        totalRounds: GetSetting('totalRounds'),
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup();

    return () => {
      cancelled = true;
      soundManager.destroy();
      DestroyPixiTrainingRuntime('moving-card');
      const active = jsPsychRef.current;
      jsPsychRef.current = null;
      if (active) {
        skipFinishRef.current = true;
        active.abortExperiment();
      }
    };
  }, [phase, difficulty]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;
    soundManager.destroy();
    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DestroyPixiTrainingRuntime('moving-card');
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  if (phase === 'running') {
    return <div id="jspsych-target" className="experiment-container" style={{ width: '100vw', height: '100vh' }} />;
  }

  return (
    <div className="experiment-container results-container" style={{ minHeight: '100vh', padding: '2rem' }}>
      <DefaultTrainingResults
        results={results}
        userName={userName}
        moduleId="moving-card"
        difficulty={difficulty}
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
        onDownloadCsv={() => DownloadTrainingCsv({ results, userName, moduleId: 'moving-card', difficulty, t })}
      />
      <TrainingResultActions
        onRestart={() => setPhase('running')}
        onExit={() => NotifyHubTrainingComplete()}
      />
    </div>
  );
}

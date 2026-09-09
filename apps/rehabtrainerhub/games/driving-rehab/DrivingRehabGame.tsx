import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import {
NotifyHubTrainingAbort,
NotifyHubTrainingComplete,
} from '@rehab-trainer/ui/embeddedTraining';
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
import { ParseDrivingWheelCalibration } from './engine/driving-input';
import { DisposeDrivingRehabRuntime } from './engine/driving-runtime-lifecycle';
import { DownloadTrainingCsv } from './exportCsv';
import { DrivingResults } from './results/DrivingResults';
import { BuildDrivingRehabTimeline } from './timeline/drivingRehabTimeline';

export function DrivingRehabGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t, lang } = useT();
  const [phase, setPhase] = useState<'running' | 'results'>('running');
  const [results, setResults] = useState<any[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser() || 'guest';

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
            difficulty: (GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')),
            results: data,
          });

          DisposeDrivingRehabRuntime();
          setResults(data);
          jsPsychRef.current = null;
          setPhase('results');
        },
      });

      const timeline = await BuildDrivingRehabTimeline({
        driving: {
          redFlashEnabled: (GetHostedGameSetting<boolean>('redFlashEnabled')),
          difficulty: ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')],
          controlMode: (GetHostedGameSetting<'arrow' | 'wasd' | 'wheel' | 'touch'>('controlMode')),
          wheelCalibration: ParseDrivingWheelCalibration(localStorage.getItem('rehab_driving-rehab_wheelCalibration') ?? ''),
          renderQuality: (GetHostedGameSetting<'low' | 'medium' | 'high'>('renderQuality')),
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
      <DrivingResults results={results} userName={userName} t={t} />
      <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
    </div>
  );
}

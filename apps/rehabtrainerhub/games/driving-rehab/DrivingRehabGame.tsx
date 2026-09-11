import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { ExitFullscreenIfActive } from '@rehab-trainer/ui/fullscreen';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
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
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const [phase, setPhase] = useState<'rules' | 'running' | 'results'>('rules');
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
          void ExitFullscreenIfActive();
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
    void ExitFullscreenIfActive();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  const isZh = lang !== 'en';

  return (
    <div ref={fullscreenRootRef} className="driving-rehab-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? '安全駕駛模擬訓練' : 'Driving Rehab Simulation'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? '安全駕駛模擬訓練' : 'Driving Rehab Simulation'}
            summaryItems={[
              { label: isZh ? '難度' : 'Difficulty', value: GetHostedGameSetting<string>('difficulty') },
              { label: isZh ? '控制方式' : 'Control Mode', value: GetHostedGameSetting<string>('controlMode') },
            ]}
            sections={isZh ? [
              {
                title: '操作與玩法',
                description: '控制車輛在車道內行駛，應對突發路況與剎車提示。',
                items: [
                  '依照選擇的控制方式操控車輛轉向與加速。',
                  '行駛中注意車道維持，避免偏離道路或碰撞邊界。',
                  '出現紅色警示或突發路況時，迅速踩下煞車。',
                ],
              },
              { title: '成績計算', description: '結算會記錄偏離車道次數、平均反應時間與行駛距離。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Keep your vehicle in the lane and respond quickly to hazard prompts.',
                items: [
                  'Control steering and acceleration using your configured mode.',
                  'Maintain lane position and avoid running off the road.',
                  'Brake promptly when red hazard flashes appear.',
                ],
              },
              { title: 'Results', description: 'Records lane deviations, average braking reaction time, and travel distance.' },
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
          <DrivingResults results={results} userName={userName} t={t} />
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

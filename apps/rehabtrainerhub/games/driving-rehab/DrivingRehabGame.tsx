import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { ExitFullscreenIfActive } from '@rehab-trainer/ui/fullscreen';
import { GetHostedGameSetting, RequestHubTrainingConfiguration } from '@rehab-trainer/ui/embeddedTraining';
import { TrainingRulesPanel } from './rules/TrainingRulesPanel';
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
            detailRows: data.find((row: any) => row.trial_type === 'three-driving-rehab')?.driving_events ?? [],
            details: data.find((row: any) => row.trial_type === 'three-driving-rehab') ?? {},
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
                description: '控制車輛在車道內行駛，注意逆行車輛跨越車道；車種與車身顏色會隨機變換。',
                items: [
                  '依照選擇的控制方式操控車輛轉向與加速。',
                  '行駛中注意車道維持，避免偏離道路或碰撞邊界。',
                  '逆行車開始跨越車道時，踩下煞車或向左、向右轉向避讓。',
                ],
              },
              { title: '成績計算', description: '每次逆行跨車道事件計為一回合，從車輛開始跨車道至首次煞車或左右轉向計算反應時間。預先持續按住的操作不算新反應；沒有反應的回合不填反應時間。' },
              { title: '成功閃避', description: '未撞到逆行車且雙方已完全通過，才判定成功閃避。高級難度在閃避期間撞到其他車輛也算失敗；中級與初級不因此扣除閃避成功。尚未完成的事件不判定成功或失敗。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Watch for oncoming vehicles crossing lanes. Vehicle types and body colors vary randomly.',
                items: [
                  'Control steering and acceleration using your configured mode.',
                  'Maintain lane position and avoid running off the road.',
                  'Brake or steer left or right when the oncoming vehicle starts crossing lanes.',
                ],
              },
              { title: 'Results', description: 'Each lane-crossing event is one round. Reaction time runs from the start of crossing to the first brake or left/right steering response. Held controls are not new responses; unanswered rounds have no reaction time.' },
              { title: 'Successful avoidance', description: 'Avoidance succeeds after both vehicles pass without hitting the oncoming vehicle. On advanced difficulty, hitting another vehicle during avoidance also counts as failure; beginner and intermediate still count as successful avoidance. Unfinished events have no outcome yet.' },
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

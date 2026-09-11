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
import { DownloadTrainingCsv } from './exportCsv';
import { DefaultTrainingResults } from './results/DefaultTrainingResults';
import { DestroyPixiTrainingRuntime } from './runtime/pixiPool';
import { BuildMovingCardTimeline } from './timeline/movingCardTimeline';

export function MovingCardGame() {
  const location = useLocation();
  void IsTrainingFlowLaunchState(location?.state);
  const { t, lang } = useT();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const [phase, setPhase] = useState<'rules' | 'running' | 'results'>('rules');
  const [results, setResults] = useState<any[]>([]);
  const jsPsychRef = useRef<JsPsych | null>(null);
  const skipFinishRef = useRef(false);
  const userName = getActiveUser() || 'guest';
  const difficulty = (GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty'));

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

          DestroyPixiTrainingRuntime('moving-card');
          setResults(data);
          jsPsychRef.current = null;
          void ExitFullscreenIfActive();
          setPhase('results');
        },
      });

      const timeline = BuildMovingCardTimeline({
        difficulty: ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[difficulty],
        totalRounds: (GetHostedGameSetting<number>('rounds')),
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup();

    return () => {
      cancelled = true;

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

    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DestroyPixiTrainingRuntime('moving-card');
    void ExitFullscreenIfActive();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  const isZh = lang !== 'en';
  const rounds = GetHostedGameSetting<number>('rounds');

  return (
    <div ref={fullscreenRootRef} className="moving-card-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? '動態卡片視覺追蹤訓練' : 'Dynamic Card Tracking'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? '動態卡片訓練' : 'Moving Card Training'}
            summaryItems={[
              { label: isZh ? '難度' : 'Difficulty', value: difficulty },
              { label: isZh ? '回合數' : 'Rounds', value: String(rounds) },
            ]}
            sections={isZh ? [
              {
                title: '操作與玩法',
                description: '觀察上方提示的目標卡片，在移動的一群卡片中找出相符者並點擊。',
                items: [
                  '注意上方顯示的目標圖案。',
                  '下方卡片會持續移動與變換位置，考驗動態視力與追蹤能力。',
                  '點擊正確的目標卡片，盡可能維持高正確率與反應速度。',
                ],
              },
              { title: '成績計算', description: '結算會記錄答對題數、反應時間與正確率。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Identify the target card from a moving set of cards.',
                items: [
                  'Observe the target pattern shown at the top.',
                  'Cards move across the screen; track them dynamically.',
                  'Click the matching card as accurately and quickly as possible.',
                ],
              },
              { title: 'Results', description: 'Records correct matches, response latency, and overall accuracy.' },
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
          <DefaultTrainingResults results={results} userName={userName} t={t} />
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

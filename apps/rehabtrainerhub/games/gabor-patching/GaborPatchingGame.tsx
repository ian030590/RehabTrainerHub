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
import { getActiveUser } from '@rehab-trainer/ui/settings';
import { soundManager } from './runtime/soundManager';
import { SaveTrainingRecord } from '@rehab-trainer/ui/storage/trainingRecords';
import { IsTrainingFlowLaunchState } from '@rehab-trainer/ui/trainingFlow';
import type { JsPsych } from 'jspsych';
import { initJsPsych } from 'jspsych';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DownloadTrainingCsv } from './exportCsv';
import { GaborResults } from './results/GaborResults';
import { DestroyPixiTrainingRuntime } from './runtime/pixiPool';
import { BuildGaborPatchingTimeline } from './timeline/gaborPatchingTimeline';

export function GaborPatchingGame() {
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
            moduleId: 'gabor-patching',
            gameId: 'gabor-patching',
            gameTitle: t('home.module.gaborPatching.title'),
            difficulty: 'normal',
            results: data,
          });

          DestroyPixiTrainingRuntime('gabor-patching');
          setResults(data);
          jsPsychRef.current = null;
          void ExitFullscreenIfActive();
          setPhase('results');
        },
      });

      const timeline = BuildGaborPatchingTimeline({
        gabor: {
          durationSec: GetHostedGameSetting<number>('durationSec'),
          maxSpots: GetHostedGameSetting<number>('maxSpots'),
        },
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup();

    return () => {
      cancelled = true;

      DestroyPixiTrainingRuntime('gabor-patching');
      const active = jsPsychRef.current;
      jsPsychRef.current = null;
      if (active) {
        skipFinishRef.current = true;
        active.abortExperiment();
      }
    };
  }, [phase]);

  const abortTraining = useCallback(() => {
    if (phase !== 'running') return;
    skipFinishRef.current = true;

    jsPsychRef.current?.abortExperiment();
    jsPsychRef.current = null;
    DestroyPixiTrainingRuntime('gabor-patching');
    void ExitFullscreenIfActive();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  const isZh = lang !== 'en';
  const durationSec = GetHostedGameSetting<number>('durationSec');
  const maxSpots = GetHostedGameSetting<number>('maxSpots');

  return (
    <div ref={fullscreenRootRef} className="gabor-patching-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? 'Gabor 斑塊對比敏感度訓練' : 'Gabor Patch Contrast Training'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? 'Gabor 斑塊訓練' : 'Gabor Patch Training'}
            summaryItems={[
              { label: isZh ? '刺激時間' : 'Duration', value: `${durationSec} ${isZh ? '秒' : 's'}` },
              { label: isZh ? '最大刺激數' : 'Max Patches', value: String(maxSpots) },
            ]}
            sections={isZh ? [
              {
                title: '操作與玩法',
                description: '在畫面上尋找並點擊出現的 Gabor 條紋斑塊。',
                items: [
                  '畫面中會隨機浮現不同朝向與對比度的 Gabor 條紋斑塊。',
                  '請盡可能快速且準確地用滑鼠或手指點擊斑塊。',
                  '斑塊會在一段時間後消失或淡出，請保持注意力集中。',
                ],
              },
              { title: '成績計算', description: '結算會記錄點擊成功率、反應時間與辨識表現。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Locate and click the Gabor patch stimuli appearing on screen.',
                items: [
                  'Gabor patches with various orientations and contrasts will appear randomly.',
                  'Click or tap on the patches as quickly and accurately as possible.',
                  'Patches fade or disappear over time; maintain focused visual attention.',
                ],
              },
              { title: 'Results', description: 'Records hit rate, average reaction time, and identification accuracy.' },
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
          <GaborResults results={results} userName={userName} t={t} />
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

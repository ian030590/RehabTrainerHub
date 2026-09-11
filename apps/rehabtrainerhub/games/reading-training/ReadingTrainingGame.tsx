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
import { getRandomStory } from './reading/stories';
import { ReadingResults } from './results/ReadingResults';
import { DestroyPixiTrainingRuntime } from './runtime/pixiPool';
import { BuildReadingTimeline } from './timeline/readingTimeline';

export function ReadingTrainingGame() {
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
          const questions = data.filter((row: any) => typeof row.correct === 'boolean');
          const presentation = data.find((row: any) => typeof row.total_words === 'number');
          SaveTrainingRecord({
            id: String(Date.now()),
            savedAt: new Date().toISOString(),
            userName,
            moduleId: 'reading-training',
            gameId: 'reading-training',
            gameTitle: t('home.module.reading.title'),
            difficulty: 'normal',
            results: data,
            detailRows: questions,
            details: {
              questionCount: questions.length,
              correctCount: questions.filter((row: any) => row.correct).length,
              reading_time: presentation?.reading_time ?? null,
              total_words: presentation?.total_words ?? null,
              presented_segments: presentation?.presented_segments ?? null,
              presentation_completed: presentation?.presentation_completed ?? null,
              passage_index: presentation?.passage_index ?? null,
              language_code: presentation?.language_code ?? null,
              configuredWpm: GetHostedGameSetting<number>('wordsPerMinute'),
            },
          });

          DestroyPixiTrainingRuntime('reading-training');
          setResults(data);
          jsPsychRef.current = null;
          void ExitFullscreenIfActive();
          setPhase('results');
        },
      });

      const story = getRandomStory(lang, GetHostedGameSetting<number>('passage'));
      const timeline = BuildReadingTimeline({
        reading: {
          story,
          wps: (GetHostedGameSetting<number>('wordsPerMinute') / 60),
          crowding: (GetHostedGameSetting<number>('crowding') / 100),
          contrast: (GetHostedGameSetting<number>('contrast') / 100),
        },
      });

      if (cancelled) return;
      jsPsychRef.current = jsPsych;
      jsPsych.run(timeline as any);
    };

    void setup();

    return () => {
      cancelled = true;

      DestroyPixiTrainingRuntime('reading-training');
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
    DestroyPixiTrainingRuntime('reading-training');
    void ExitFullscreenIfActive();
    NotifyHubTrainingAbort();
  }, [phase]);

  useTrainingAbort({ active: phase === 'running', onAbort: abortTraining });

  const isZh = lang !== 'en';
  const wordsPerMinute = GetHostedGameSetting<number>('wordsPerMinute');
  const crowding = GetHostedGameSetting<number>('crowding');

  return (
    <div ref={fullscreenRootRef} className="reading-training-game-root" style={{ width: '100%', minHeight: '100dvh' }}>
      {phase === 'rules' && (
        <div className="training-panel">
          <TrainingRulesPanel
            title={isZh ? '動態閱讀視覺訓練' : 'Dynamic Reading Training'}
            label={isZh ? '遊戲規則說明' : 'Game Rules'}
            summaryTitle={isZh ? '動態閱讀訓練' : 'Reading Training'}
            summaryItems={[
              { label: isZh ? '呈現速度' : 'Speed', value: `${wordsPerMinute} ${isZh ? '字/分' : 'wpm'}` },
              { label: isZh ? '文字間距' : 'Spacing', value: `${crowding}%` },
            ]}
            sections={isZh ? [
              {
                title: '操作與玩法',
                description: '利用 RSVP 快速序列視覺呈現技術，訓練快速閱讀與視覺資訊擷取。',
                items: [
                  '注視螢幕中央，文字或詞句將以設定的速度逐一快速閃現。',
                  '請在心裡默讀並理解文章故事的內容脈絡。',
                  '閱讀結束後，請回答後續的閱讀理解測驗。',
                ],
              },
              { title: '成績計算', description: '結算會記錄閱讀速度（WPM）與理解測驗答對率。' },
            ] : [
              {
                title: 'How to Play',
                description: 'Rapid Serial Visual Presentation (RSVP) training for reading speed and comprehension.',
                items: [
                  'Focus on the center of the screen as words flash sequentially.',
                  'Silently read and follow the narrative of the story.',
                  'Answer the comprehension questions presented after reading.',
                ],
              },
              { title: 'Results', description: 'Records words-per-minute speed and quiz comprehension accuracy.' },
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
          <ReadingResults results={results} userName={userName} t={t} />
          <TrainingResultActions onBackHome={() => window.location.reload()} backLabel="返回入口" hubLabel="返回大廳" />
        </div>
      )}
    </div>
  );
}

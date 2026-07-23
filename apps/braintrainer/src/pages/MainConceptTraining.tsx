import { useMemo, useState, type ReactNode } from 'react';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import {
  TrainingConfigOptionGroup,
  TrainingConfigPanel,
  TrainingConfigSection,
} from '@rehab-trainer/ui/components/TrainingConfigPanel';
import { StartTrainingButton } from '@rehab-trainer/ui/components/StartTrainingButton';
import { TrainingRulesPanel } from '@rehab-trainer/ui/components/TrainingRulesPanel';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { CreateCsvContent } from '@rehab-trainer/ui/csv';
import { DownloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { useFullscreenTrainingRoot } from '@rehab-trainer/ui/hooks/useFullscreenTrainingRoot';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import { useNavigate } from 'react-router-dom';
import { useT, type TranslationKey } from '../i18n';
import { SaveTrainingRecord, type BrainTrainingRecord } from '../utils/trainingRecords';

type Rating = 'Accurate' | 'Inaccurate' | 'Absent';
type Phase = 'menu' | 'instructions' | 'playing' | 'results';

interface MainConceptQuestion {
  id: string;
  concept: string;
  elements: string[];
  correctRatings: Rating[];
  correctSentenceIndexes: number[];
}

interface TrainingSet {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  sourceTask: string;
  transcript: string[];
  questions: MainConceptQuestion[];
  zh: {
    transcript: string[];
    questions: MainConceptQuestion[];
  };
}

interface AnswerState {
  ratings: Array<Rating | null>;
  selectedSentenceIndexes: number[];
}

interface FeedbackState {
  kind: 'success' | 'error' | 'warning';
  lines: string[];
}

interface TrialResult {
  questionId: string;
  concept: string;
  correct: boolean;
  attempts: number;
  userRatings: string;
  correctRatings: string;
  selectedSentenceText: string;
  correctSentenceText: string;
}

interface SessionSummary {
  date: string;
  participant: string;
  setTitle: string;
  total: number;
  correct: number;
  accuracy: number;
  durationSeconds: number;
  trials: TrialResult[];
}

const ratingKeys: Record<Rating, TranslationKey> = {
  Accurate: 'mainConcept.rating.accurate',
  Inaccurate: 'mainConcept.rating.inaccurate',
  Absent: 'mainConcept.rating.absent',
};

const trainingSets: TrainingSet[] = [
  {
    id: 'broken-window-1',
    titleKey: 'mainConcept.module.brokenWindow1',
    descriptionKey: 'mainConcept.module.brokenWindow1Desc',
    sourceTask: 'broken_window',
    transcript: [
      'Okay.',
      "I've done this before.",
      'He kicked the ball.',
      'It went through the glass.',
      "It's his dad sitting on the couch.",
      "It's not good.",
    ],
    questions: [
      {
        id: 'bw1-1',
        concept: 'The boy was outside',
        elements: ['The boy', 'was', 'outside'],
        correctRatings: ['Absent', 'Absent', 'Absent'],
        correctSentenceIndexes: [],
      },
      {
        id: 'bw1-2',
        concept: 'The boy was playing soccer',
        elements: ['The boy', 'was playing', 'soccer'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [2],
      },
      {
        id: 'bw1-3',
        concept: 'The ball broke the window',
        elements: ['The ball', 'broke', 'the window'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [3],
      },
      {
        id: 'bw1-4',
        concept: 'The man was sitting',
        elements: ['The man', 'was sitting'],
        correctRatings: ['Accurate', 'Accurate'],
        correctSentenceIndexes: [4],
      },
    ],
    zh: {
      transcript: [
        '好。',
        '我以前做過這個。',
        '他踢了球。',
        '球穿過玻璃。',
        '那是他爸爸坐在沙發上。',
        '這樣不好。',
      ],
      questions: [
        {
          id: 'bw1-1',
          concept: '男孩在外面',
          elements: ['男孩', '在', '外面'],
          correctRatings: ['Absent', 'Absent', 'Absent'],
          correctSentenceIndexes: [],
        },
        {
          id: 'bw1-2',
          concept: '男孩在踢足球',
          elements: ['男孩', '在踢', '足球'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [2],
        },
        {
          id: 'bw1-3',
          concept: '球打破窗戶',
          elements: ['球', '打破', '窗戶'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [3],
        },
        {
          id: 'bw1-4',
          concept: '男人坐著',
          elements: ['男人', '坐著'],
          correctRatings: ['Accurate', 'Accurate'],
          correctSentenceIndexes: [4],
        },
      ],
    },
  },
  {
    id: 'broken-window-2',
    titleKey: 'mainConcept.module.brokenWindow2',
    descriptionKey: 'mainConcept.module.brokenWindow2Desc',
    sourceTask: 'broken_window',
    transcript: [
      'Okay.',
      'He is kicking the ball.',
      'The lamp gets hit.',
      'The man yelled.',
    ],
    questions: [
      {
        id: 'bw2-1',
        concept: 'The boy was playing soccer',
        elements: ['The boy', 'was playing', 'soccer'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [1],
      },
      {
        id: 'bw2-2',
        concept: 'The ball broke a lamp',
        elements: ['The ball', 'broke', 'a lamp'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [2],
      },
      {
        id: 'bw2-3',
        concept: 'The man looked out of the window',
        elements: ['The man', 'looked', 'out of the window'],
        correctRatings: ['Accurate', 'Absent', 'Absent'],
        correctSentenceIndexes: [3],
      },
    ],
    zh: {
      transcript: [
        '好。',
        '他在踢球。',
        '燈被打到了。',
        '男人大叫。',
      ],
      questions: [
        {
          id: 'bw2-1',
          concept: '男孩在踢足球',
          elements: ['男孩', '在踢', '足球'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [1],
        },
        {
          id: 'bw2-2',
          concept: '球打破一盞燈',
          elements: ['球', '打破', '一盞燈'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [2],
        },
        {
          id: 'bw2-3',
          concept: '男人看向窗外',
          elements: ['男人', '看向', '窗外'],
          correctRatings: ['Accurate', 'Absent', 'Absent'],
          correctSentenceIndexes: [3],
        },
      ],
    },
  },
  {
    id: 'cat-rescue-1',
    titleKey: 'mainConcept.module.catRescue1',
    descriptionKey: 'mainConcept.module.catRescue1Desc',
    sourceTask: 'cat_rescue',
    transcript: [
      'The cat is stuck up in a tree.',
      'The dog is barking up the tree.',
      'Father is out there and he is stuck himself.',
      'The fire department is coming.',
      'They are coming out with a ladder to help get the cat and father out of the tree.',
    ],
    questions: [
      {
        id: 'cr1-1',
        concept: 'The cat was in the tree',
        elements: ['The cat', 'was in', 'the tree'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [0],
      },
      {
        id: 'cr1-2',
        concept: 'The dog was barking',
        elements: ['The dog', 'was barking'],
        correctRatings: ['Accurate', 'Accurate'],
        correctSentenceIndexes: [1],
      },
      {
        id: 'cr1-3',
        concept: 'The father is stuck in the tree',
        elements: ['The father', 'is stuck', 'in the tree'],
        correctRatings: ['Accurate', 'Accurate', 'Absent'],
        correctSentenceIndexes: [2],
      },
      {
        id: 'cr1-4',
        concept: 'The fire department comes with a ladder',
        elements: ['The fire department', 'comes', 'with a ladder'],
        correctRatings: ['Accurate', 'Accurate', 'Accurate'],
        correctSentenceIndexes: [3, 4],
      },
    ],
    zh: {
      transcript: [
        '貓卡在樹上。',
        '狗對著樹叫。',
        '爸爸在外面，他自己也卡住了。',
        '消防隊來了。',
        '他們帶著梯子出來，要幫忙把貓和爸爸從樹上救下來。',
      ],
      questions: [
        {
          id: 'cr1-1',
          concept: '貓在樹上',
          elements: ['貓', '在', '樹上'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [0],
        },
        {
          id: 'cr1-2',
          concept: '狗在叫',
          elements: ['狗', '在叫'],
          correctRatings: ['Accurate', 'Accurate'],
          correctSentenceIndexes: [1],
        },
        {
          id: 'cr1-3',
          concept: '爸爸卡在樹上',
          elements: ['爸爸', '卡住', '樹上'],
          correctRatings: ['Accurate', 'Accurate', 'Absent'],
          correctSentenceIndexes: [2],
        },
        {
          id: 'cr1-4',
          concept: '消防隊帶著梯子來',
          elements: ['消防隊', '來', '帶著梯子'],
          correctRatings: ['Accurate', 'Accurate', 'Accurate'],
          correctSentenceIndexes: [3, 4],
        },
      ],
    },
  },
];

ValidateTrainingSets(trainingSets);

export function MainConceptTraining() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { fullscreenRootRef, enterTrainingFullscreen } = useFullscreenTrainingRoot<HTMLDivElement>();
  const [phase, setPhase] = useState<Phase>('menu');
  const [selectedSetId, setSelectedSetId] = useState(trainingSets[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(() => CreateEmptyAnswer(trainingSets[0].questions[0]));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [acceptedTrial, setAcceptedTrial] = useState<TrialResult | null>(null);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<TrialResult[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const activeSet = useMemo(() => {
    const set = trainingSets.find((item) => item.id === selectedSetId) ?? trainingSets[0];
    return LocalizeTrainingSet(set, lang);
  }, [lang, selectedSetId]);
  const currentQuestion = activeSet.questions[currentIndex] ?? activeSet.questions[0];
  const setTitle = t(activeSet.titleKey);
  const progressText = `${currentIndex + 1} / ${activeSet.questions.length}`;
  const locked = Boolean(acceptedTrial);

  const openInstructions = async () => {
    await enterTrainingFullscreen();
    setFeedback(null);
    setAcceptedTrial(null);
    setSummary(null);
    setPhase('instructions');
  };

  const startSession = async () => {
    await enterTrainingFullscreen();
    const firstQuestion = activeSet.questions[0];
    setCurrentIndex(0);
    setAnswer(CreateEmptyAnswer(firstQuestion));
    setFeedback(null);
    setAcceptedTrial(null);
    setAttempts({});
    setResults([]);
    setSummary(null);
    setStartedAt(Date.now());
    setPhase('playing');
  };

  const returnToMenu = () => {
    setPhase('menu');
    setFeedback(null);
    setAcceptedTrial(null);
    setSummary(null);
  };

  useTrainingAbort({
    active: phase === 'instructions' || phase === 'playing',
    onAbort: returnToMenu,
  });

  const exitToThinkingTraining = () => {
    navigate('/thinking-training');
  };

  const selectTrainingSet = (id: string) => {
    setSelectedSetId(id);
    setFeedback(null);
  };

  const setRating = (elementIndex: number, rating: Rating) => {
    if (locked) return;
    setAnswer((current) => ({
      ...current,
      ratings: current.ratings.map((value, index) => (index === elementIndex ? rating : value)),
    }));
    setFeedback(null);
  };

  const toggleSentence = (sentenceIndex: number) => {
    if (locked) return;
    setAnswer((current) => {
      const selected = current.selectedSentenceIndexes.includes(sentenceIndex)
        ? current.selectedSentenceIndexes.filter((index) => index !== sentenceIndex)
        : [...current.selectedSentenceIndexes, sentenceIndex].sort((left, right) => left - right);
      return { ...current, selectedSentenceIndexes: selected };
    });
    setFeedback(null);
  };

  const submitAnswer = () => {
    if (!answer.ratings.every(Boolean)) {
      setFeedback({ kind: 'error', lines: [t('mainConcept.feedback.completeRatings')] });
      return;
    }

    const nextAttempt = (attempts[currentQuestion.id] ?? 0) + 1;
    setAttempts((current) => ({ ...current, [currentQuestion.id]: nextAttempt }));

    const ratingsCorrect = currentQuestion.correctRatings.every((rating, index) => answer.ratings[index] === rating);
    const sentencesCorrect = SameNumberList(answer.selectedSentenceIndexes, currentQuestion.correctSentenceIndexes);
    if (!ratingsCorrect || !sentencesCorrect) {
      const lines = [t('mainConcept.feedback.tryAgain')];
      if (!ratingsCorrect) lines.push(t('mainConcept.feedback.ratingsMismatch'));
      if (!sentencesCorrect) lines.push(t('mainConcept.feedback.sentencesMismatch'));
      setFeedback({ kind: 'error', lines });
      return;
    }

    const trial = BuildTrial(currentQuestion, activeSet.transcript, answer, true, nextAttempt, t);
    setAcceptedTrial(trial);
    setFeedback({ kind: 'success', lines: [t('mainConcept.feedback.correct'), ...BuildAnswerLines(trial, t)] });
  };

  const skipQuestion = () => {
    const nextAttempt = (attempts[currentQuestion.id] ?? 0) + 1;
    setAttempts((current) => ({ ...current, [currentQuestion.id]: nextAttempt }));
    const trial = BuildTrial(currentQuestion, activeSet.transcript, answer, false, nextAttempt, t);
    setAcceptedTrial(trial);
    setFeedback({ kind: 'warning', lines: [t('mainConcept.feedback.skipped'), ...BuildAnswerLines(trial, t)] });
  };

  const goNext = () => {
    if (!acceptedTrial) return;
    const nextResults = [...results, acceptedTrial];
    setResults(nextResults);
    if (currentIndex >= activeSet.questions.length - 1) {
      finishSession(nextResults);
      return;
    }

    const nextQuestion = activeSet.questions[currentIndex + 1];
    setCurrentIndex((index) => index + 1);
    setAnswer(CreateEmptyAnswer(nextQuestion));
    setFeedback(null);
    setAcceptedTrial(null);
  };

  const finishSession = (finalResults: TrialResult[]) => {
    const now = new Date();
    const correct = finalResults.filter((trial) => trial.correct).length;
    const total = activeSet.questions.length;
    const durationSeconds = Math.max(1, Math.round((now.getTime() - (startedAt ?? now.getTime())) / 1000));
    const date = FormatTestDate(now);
    const nextSummary: SessionSummary = {
      date,
      participant: GetAuthUserNameFromToken() || 'Signed-in user',
      setTitle,
      total,
      correct,
      accuracy: Math.round((correct / total) * 100),
      durationSeconds,
      trials: finalResults,
    };
    setSummary(nextSummary);
    setFeedback(null);
    setAcceptedTrial(null);
    setPhase('results');
    const record: BrainTrainingRecord = {
      id: `main_concept_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      userName: nextSummary.participant,
      moduleId: 'thinking-training',
      gameId: 'main-concept',
      gameTitle: t('mainConcept.title'),
      difficulty: nextSummary.setTitle,
      trainingDate: nextSummary.date,
      details: {
        Training_Set: nextSummary.setTitle,
        Source_Task: activeSet.sourceTask,
        Total_Questions: nextSummary.total,
        Correct_Count: nextSummary.correct,
        Accuracy_Percent: nextSummary.accuracy,
        Duration_Seconds: nextSummary.durationSeconds,
      },
      detailRows: ToDetailRows(nextSummary.trials),
    };
    void SaveTrainingRecord(record);
  };

  const downloadResult = () => {
    if (!summary) return;
    DownloadCsvFile(ToCsv(summary), `main_concept_${summary.date}_${Date.now()}.csv`);
  };

  const wrapFullscreenRoot = (content: ReactNode) => (
    <div ref={fullscreenRootRef} className={`main-concept-fullscreen-root main-concept-fullscreen-root-${phase}`}>
      {content}
    </div>
  );

  if (phase === 'menu') {
    return wrapFullscreenRoot(
      <div className="training-panel main-concept-fullscreen-panel">
        <TrainingConfigPanel
          className="main-concept-config"
          label={t('mainConcept.configLabel')}
          title={t('mainConcept.title')}
          summaryTitle={t('mainConcept.title')}
          summaryItems={[
            { label: t('mainConcept.trainingSet'), value: setTitle },
            { label: t('mainConcept.source'), value: t('mainConcept.reference') },
          ]}
          actions={(
            <>
              <StartTrainingButton onClick={() => void openInstructions()}>
                {lang === 'zh' ? '規則說明' : 'Rules'}
              </StartTrainingButton>
              <button className="btn btn-ghost btn-lg" onClick={exitToThinkingTraining}>{t('training.cancel')}</button>
            </>
          )}
        >
            <TrainingConfigSection
              title={t('mainConcept.trainingSet')}
              description={t('mainConcept.trainingSetDesc')}
              value={setTitle}
            >
              <TrainingConfigOptionGroup columns={3}>
                {trainingSets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    className={`training-option ${selectedSetId === set.id ? 'active' : ''}`}
                    onClick={() => selectTrainingSet(set.id)}
                  >
                    <span className="training-option-title">{t(set.titleKey)}</span>
                    <span className="training-option-meta">{t(set.descriptionKey)}</span>
                  </button>
                ))}
              </TrainingConfigOptionGroup>
            </TrainingConfigSection>

            <TrainingConfigSection
              title={t('mainConcept.focusTitle')}
              description={t('mainConcept.focusDesc')}
              value={t('mainConcept.reference')}
            />
        </TrainingConfigPanel>
      </div>
    );
  }

  if (phase === 'instructions') {
    return wrapFullscreenRoot(
      <div className="training-panel main-concept-fullscreen-panel">
        <TrainingRulesPanel
          className="main-concept-config main-concept-instructions-config"
          label={t('mainConcept.instructions.label')}
          title={t('mainConcept.instructions.title')}
          summaryTitle={t('mainConcept.title')}
          summaryItems={[
            { label: t('mainConcept.trainingSet'), value: setTitle },
            { label: t('mainConcept.results.question'), value: activeSet.questions.length },
          ]}
          sections={[
            {
              title: t('mainConcept.instructions.goalTitle'),
              description: t('mainConcept.instructions.goalDesc'),
              meta: setTitle,
              items: [
                t('mainConcept.instructions.step1'),
                t('mainConcept.instructions.step2'),
                t('mainConcept.instructions.step3'),
                t('mainConcept.instructions.step4'),
              ],
            },
            {
              title: t('mainConcept.instructions.ratingTitle'),
              description: t('mainConcept.instructions.ratingDesc'),
              items: [
                <><strong>{t('mainConcept.rating.accurate')}</strong>{t('mainConcept.instructions.ratingAccurate')}</>,
                <><strong>{t('mainConcept.rating.inaccurate')}</strong>{t('mainConcept.instructions.ratingInaccurate')}</>,
                <><strong>{t('mainConcept.rating.absent')}</strong>{t('mainConcept.instructions.ratingAbsent')}</>,
              ],
            },
            {
              title: t('mainConcept.transcript'),
              description: t('mainConcept.instructions.transcriptPreview'),
              items: activeSet.transcript.map((sentence, index) => `${index + 1}. ${sentence}`),
            },
          ]}
          startLabel={lang === 'zh' ? '開始訓練' : 'Start Training'}
          backLabel={t('training.returnSettings')}
          onStart={() => void startSession()}
          onBack={returnToMenu}
        />
      </div>
    );
  }

  if (phase === 'results' && summary) {
    return wrapFullscreenRoot(
      <div className="experiment-container experiment-container-scrollable main-concept-results-container">
        <div className="experiment-results">
          <h1>{t('mainConcept.results.title')}</h1>
          <div className="training-result-summary">
            <span>
              <small>{t('mainConcept.results.score')}</small>
              <strong>{summary.correct} / {summary.total}</strong>
            </span>
            <span>
              <small>{t('mainConcept.results.accuracy')}</small>
              <strong>{summary.accuracy}%</strong>
            </span>
            <span>
              <small>{t('mainConcept.results.duration')}</small>
              <strong>{summary.durationSeconds}s</strong>
            </span>
          </div>

          <table className="results-table main-concept-results-table">
            <thead>
              <tr>
                <th>{t('mainConcept.results.question')}</th>
                <th>{t('mainConcept.concept')}</th>
                <th>{t('mainConcept.results.correct')}</th>
                <th>{t('mainConcept.results.attempts')}</th>
              </tr>
            </thead>
            <tbody>
              {summary.trials.map((trial, index) => (
                <tr key={trial.questionId}>
                  <td>{index + 1}</td>
                  <td>{trial.concept}</td>
                  <td className={trial.correct ? 'result-success' : 'result-fail'}>
                    {trial.correct ? t('mainConcept.results.correct') : t('mainConcept.results.incorrect')}
                  </td>
                  <td>{trial.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <TrainingResultActions
            downloadLabel={t('training.downloadCsvRecord')}
            restartLabel={t('training.restart')}
            backLabel={t('training.returnHome')}
            onDownloadCsv={downloadResult}
            onRestart={() => void openInstructions()}
            onBackHome={returnToMenu}
          />
        </div>
      </div>
    );
  }

  return wrapFullscreenRoot(
    <div className="main-concept-session">
      <div className="main-concept-shell">
        <header className="main-concept-header">
          <div>
            <span>{setTitle}</span>
            <h1>{t('mainConcept.title')}</h1>
          </div>
          <div className="main-concept-header-actions">
            <strong>{t('mainConcept.progress')}: {progressText}</strong>
            <button className="btn btn-ghost btn-sm" onClick={returnToMenu}>{t('training.returnMenu')}</button>
          </div>
        </header>

        <div className="main-concept-layout">
          <aside className="main-concept-panel main-concept-transcript">
            <div className="main-concept-panel-heading">
              <h2>{t('mainConcept.transcript')}</h2>
              <p>{t('mainConcept.transcriptDesc')}</p>
            </div>
            <div className="main-concept-sentence-list">
              {activeSet.transcript.map((sentence, index) => (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  type="button"
                  className={`main-concept-sentence ${answer.selectedSentenceIndexes.includes(index) ? 'active' : ''}`}
                  onClick={() => toggleSentence(index)}
                  aria-pressed={answer.selectedSentenceIndexes.includes(index)}
                  disabled={locked}
                >
                  <span>{index + 1}</span>
                  <strong>{sentence}</strong>
                </button>
              ))}
            </div>
          </aside>

          <main className="main-concept-panel main-concept-question" id="main-content">
            <div className="main-concept-panel-heading">
              <h2>{t('mainConcept.concept')}</h2>
              <p>{currentQuestion.concept}</p>
            </div>

            <section className="main-concept-elements" aria-label={t('mainConcept.elements')}>
              {currentQuestion.elements.map((element, elementIndex) => (
                <div key={`${currentQuestion.id}-${element}`} className="main-concept-element">
                  <div>
                    <span>{t('mainConcept.elements')}</span>
                    <strong>{element}</strong>
                  </div>
                  <div className="main-concept-rating-group" aria-label={t('mainConcept.ratingPrompt')}>
                    {(Object.keys(ratingKeys) as Rating[]).map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`main-concept-rating ${answer.ratings[elementIndex] === rating ? 'active' : ''}`}
                        onClick={() => setRating(elementIndex, rating)}
                        disabled={locked}
                      >
                        {t(ratingKeys[rating])}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {feedback && (
              <div className={`main-concept-feedback ${feedback.kind}`}>
                {feedback.lines.map((line) => <p key={line}>{line}</p>)}
              </div>
            )}

            <div className="main-concept-actions">
              {acceptedTrial ? (
                <button className="btn btn-primary btn-lg" onClick={goNext}>
                  {currentIndex >= activeSet.questions.length - 1 ? t('mainConcept.finish') : t('mainConcept.next')}
                </button>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={submitAnswer}>{t('mainConcept.check')}</button>
              )}
              <button className="btn btn-secondary btn-lg" onClick={skipQuestion} disabled={locked}>{t('mainConcept.skip')}</button>
              <button className="btn btn-ghost btn-lg" onClick={exitToThinkingTraining}>{t('training.cancel')}</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function CreateEmptyAnswer(question: MainConceptQuestion): AnswerState {
  return {
    ratings: question.elements.map(() => null),
    selectedSentenceIndexes: [],
  };
}

function LocalizeTrainingSet(set: TrainingSet, lang: string): TrainingSet {
  if (lang !== 'zh') return set;
  return {
    ...set,
    transcript: set.zh.transcript,
    questions: set.zh.questions,
  };
}

function SameNumberList(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function BuildTrial(
  question: MainConceptQuestion,
  transcript: string[],
  answer: AnswerState,
  correct: boolean,
  attempts: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): TrialResult {
  return {
    questionId: question.id,
    concept: question.concept,
    correct,
    attempts,
    userRatings: answer.ratings.map((rating) => (rating ? t(ratingKeys[rating]) : '')).join(' | '),
    correctRatings: question.correctRatings.map((rating) => t(ratingKeys[rating])).join(' | '),
    selectedSentenceText: IndexesToText(answer.selectedSentenceIndexes, transcript),
    correctSentenceText: IndexesToText(question.correctSentenceIndexes, transcript),
  };
}

function IndexesToText(indexes: number[], transcript: string[]): string {
  return indexes.map((index) => transcript[index]).filter(Boolean).join(' | ');
}

function BuildAnswerLines(trial: TrialResult, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string[] {
  return [
    `${t('mainConcept.results.correctRatings')}: ${trial.correctRatings}`,
    `${t('mainConcept.results.correctSentences')}: ${trial.correctSentenceText || t('mainConcept.none')}`,
  ];
}

function ToDetailRows(trials: TrialResult[]): Array<Record<string, unknown>> {
  return trials.map((trial, index) => ({
    Question: index + 1,
    Concept: trial.concept,
    Correct: trial.correct,
    Attempts: trial.attempts,
    User_Ratings: trial.userRatings,
    Correct_Ratings: trial.correctRatings,
    Selected_Sentences: trial.selectedSentenceText,
    Correct_Sentences: trial.correctSentenceText,
  }));
}

function ToCsv(summary: SessionSummary): string {
  const columns = [
    'Training_Date',
    'Participant_ID',
    'Training_Set',
    'Total_Questions',
    'Correct_Count',
    'Accuracy_Percent',
    'Duration_Seconds',
    'Question',
    'Concept',
    'Correct',
    'Attempts',
    'User_Ratings',
    'Correct_Ratings',
    'Selected_Sentences',
    'Correct_Sentences',
  ];
  const rows = summary.trials.map((trial, index) => ({
    Training_Date: summary.date,
    Participant_ID: summary.participant,
    Training_Set: summary.setTitle,
    Total_Questions: summary.total,
    Correct_Count: summary.correct,
    Accuracy_Percent: summary.accuracy,
    Duration_Seconds: summary.durationSeconds,
    Question: index + 1,
    Concept: trial.concept,
    Correct: trial.correct,
    Attempts: trial.attempts,
    User_Ratings: trial.userRatings,
    Correct_Ratings: trial.correctRatings,
    Selected_Sentences: trial.selectedSentenceText,
    Correct_Sentences: trial.correctSentenceText,
  }));

  return CreateCsvContent([
    columns,
    ...rows.map((row) => columns.map((column) => row[column as keyof typeof row])),
  ]);
}

function FormatTestDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ValidateTrainingSets(sets: TrainingSet[]): void {
  sets.forEach((set) => {
    ValidateQuestions(set.questions, set.transcript.length);
    ValidateQuestions(set.zh.questions, set.zh.transcript.length);
  });
}

function ValidateQuestions(questions: MainConceptQuestion[], transcriptLength: number): void {
  questions.forEach((question) => {
      if (question.elements.length !== question.correctRatings.length) {
        throw new Error(`Invalid main concept training data: ${question.id}`);
      }
      question.correctSentenceIndexes.forEach((index) => {
        if (index < 0 || index >= transcriptLength) {
          throw new Error(`Invalid main concept sentence index: ${question.id}`);
        }
      });
  });
}

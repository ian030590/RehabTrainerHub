import { useMemo, useState } from 'react';
import { useT, type TranslationKey } from '../../i18n';
import { downloadCsvFile } from '../../utils/downloadFile';
import { getActiveUser } from '../../utils/settings';
import { saveTrainingSessionRecord } from '../../utils/trainingRecords';
import { csvCell, formatTestDate } from './gameUtils';
import { verifySelectedTrainingUser } from './selectedUserGuard';
import { StartTrainingButton } from './StartTrainingButton';
import { TrainingConfigSummary } from './TrainingConfigSummary';

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

const RATING_KEYS: Record<Rating, TranslationKey> = {
  Accurate: 'mainConcept.rating.accurate',
  Inaccurate: 'mainConcept.rating.inaccurate',
  Absent: 'mainConcept.rating.absent',
};

const TRAINING_SETS: TrainingSet[] = [
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

validateTrainingSets(TRAINING_SETS);

interface MainConceptTrainingProps {
  onExit: () => void;
}

export function MainConceptTraining({ onExit }: MainConceptTrainingProps) {
  const { t, lang } = useT();
  const [phase, setPhase] = useState<Phase>('menu');
  const [selectedSetId, setSelectedSetId] = useState(TRAINING_SETS[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(() => createEmptyAnswer(TRAINING_SETS[0].questions[0]));
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [acceptedTrial, setAcceptedTrial] = useState<TrialResult | null>(null);
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [results, setResults] = useState<TrialResult[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const activeSet = useMemo(() => {
    const set = TRAINING_SETS.find((item) => item.id === selectedSetId) ?? TRAINING_SETS[0];
    return localizeTrainingSet(set, lang);
  }, [lang, selectedSetId]);
  const currentQuestion = activeSet.questions[currentIndex] ?? activeSet.questions[0];
  const setTitle = t(activeSet.titleKey);
  const progressText = `${currentIndex + 1} / ${activeSet.questions.length}`;
  const locked = Boolean(acceptedTrial);

  const openInstructions = () => {
    if (!verifySelectedTrainingUser()) return;
    setFeedback(null);
    setAcceptedTrial(null);
    setSummary(null);
    setPhase('instructions');
  };

  const startSession = () => {
    if (!verifySelectedTrainingUser()) return;
    const firstQuestion = activeSet.questions[0];
    setCurrentIndex(0);
    setAnswer(createEmptyAnswer(firstQuestion));
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
    const sentencesCorrect = sameNumberList(answer.selectedSentenceIndexes, currentQuestion.correctSentenceIndexes);
    if (!ratingsCorrect || !sentencesCorrect) {
      const lines = [t('mainConcept.feedback.tryAgain')];
      if (!ratingsCorrect) lines.push(t('mainConcept.feedback.ratingsMismatch'));
      if (!sentencesCorrect) lines.push(t('mainConcept.feedback.sentencesMismatch'));
      setFeedback({ kind: 'error', lines });
      return;
    }

    const trial = buildTrial(currentQuestion, activeSet.transcript, answer, true, nextAttempt, t);
    setAcceptedTrial(trial);
    setFeedback({ kind: 'success', lines: [t('mainConcept.feedback.correct'), ...buildAnswerLines(trial, t)] });
  };

  const skipQuestion = () => {
    const nextAttempt = (attempts[currentQuestion.id] ?? 0) + 1;
    setAttempts((current) => ({ ...current, [currentQuestion.id]: nextAttempt }));
    const trial = buildTrial(currentQuestion, activeSet.transcript, answer, false, nextAttempt, t);
    setAcceptedTrial(trial);
    setFeedback({ kind: 'warning', lines: [t('mainConcept.feedback.skipped'), ...buildAnswerLines(trial, t)] });
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
    setAnswer(createEmptyAnswer(nextQuestion));
    setFeedback(null);
    setAcceptedTrial(null);
  };

  const finishSession = (finalResults: TrialResult[]) => {
    const correct = finalResults.filter((trial) => trial.correct).length;
    const total = activeSet.questions.length;
    const durationSeconds = Math.max(1, Math.round((Date.now() - (startedAt ?? Date.now())) / 1000));
    const date = formatTestDate(new Date());
    const nextSummary: SessionSummary = {
      date,
      participant: getActiveUser() || t('exp.unknownUser'),
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
    void saveTrainingSessionRecord({
      userName: nextSummary.participant,
      moduleId: 'speech-training',
      moduleName: t('home.module.speech.title'),
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
      detailRows: toDetailRows(nextSummary.trials),
    });
  };

  const downloadResult = () => {
    if (!summary) return;
    downloadCsvFile(toCsv(summary), `main_concept_${summary.date}_${Date.now()}.csv`);
  };

  if (phase === 'menu') {
    return (
      <div className="training-panel main-concept-fullscreen-panel">
        <div className="training-config main-concept-config">
          <header className="training-config-header">
            <div>
              <span className="training-config-label">{t('mainConcept.configLabel')}</span>
              <h1>{t('mainConcept.title')}</h1>
            </div>
          </header>

          <div className="training-config-body">
            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{t('mainConcept.trainingSet')}</h2>
                  <p>{t('mainConcept.trainingSetDesc')}</p>
                </div>
                <span>{setTitle}</span>
              </div>
              <div className="training-option-grid training-option-grid-three">
                {TRAINING_SETS.map((set) => (
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
              </div>
            </section>

            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{t('mainConcept.focusTitle')}</h2>
                  <p>{t('mainConcept.focusDesc')}</p>
                </div>
                <span>{t('mainConcept.reference')}</span>
              </div>
            </section>
          </div>

          <div className="training-config-footer">
            <TrainingConfigSummary
              title={t('mainConcept.title')}
              items={[
                { label: t('mainConcept.trainingSet'), value: setTitle },
                { label: t('mainConcept.source'), value: t('mainConcept.reference') },
              ]}
            />
            <div className="training-config-actions">
              <StartTrainingButton onClick={openInstructions}>{t('training.startGame')}</StartTrainingButton>
              <button className="btn btn-ghost btn-lg" onClick={onExit}>{t('training.cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'instructions') {
    return (
      <div className="training-panel main-concept-fullscreen-panel">
        <div className="training-config main-concept-config main-concept-instructions-config">
          <header className="training-config-header">
            <div>
              <span className="training-config-label">{t('mainConcept.instructions.label')}</span>
              <h1>{t('mainConcept.instructions.title')}</h1>
            </div>
          </header>

          <div className="training-config-body">
            <section className="training-setting training-setting-wide">
              <div className="training-setting-header">
                <div>
                  <h2>{t('mainConcept.instructions.goalTitle')}</h2>
                  <p>{t('mainConcept.instructions.goalDesc')}</p>
                </div>
                <span>{setTitle}</span>
              </div>
              <ol className="main-concept-instruction-list">
                <li>{t('mainConcept.instructions.step1')}</li>
                <li>{t('mainConcept.instructions.step2')}</li>
                <li>{t('mainConcept.instructions.step3')}</li>
                <li>{t('mainConcept.instructions.step4')}</li>
              </ol>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{t('mainConcept.instructions.ratingTitle')}</h2>
                  <p>{t('mainConcept.instructions.ratingDesc')}</p>
                </div>
              </div>
              <div className="main-concept-instruction-list">
                <p><strong>{t('mainConcept.rating.accurate')}</strong>{t('mainConcept.instructions.ratingAccurate')}</p>
                <p><strong>{t('mainConcept.rating.inaccurate')}</strong>{t('mainConcept.instructions.ratingInaccurate')}</p>
                <p><strong>{t('mainConcept.rating.absent')}</strong>{t('mainConcept.instructions.ratingAbsent')}</p>
              </div>
            </section>

            <section className="training-setting">
              <div className="training-setting-header">
                <div>
                  <h2>{t('mainConcept.transcript')}</h2>
                  <p>{t('mainConcept.instructions.transcriptPreview')}</p>
                </div>
              </div>
              <div className="main-concept-preview-list">
                {activeSet.transcript.map((sentence, index) => (
                  <span key={`${activeSet.id}-${index}`}>{index + 1}. {sentence}</span>
                ))}
              </div>
            </section>
          </div>

          <div className="training-config-footer">
            <TrainingConfigSummary
              title={t('mainConcept.title')}
              items={[
                { label: t('mainConcept.trainingSet'), value: setTitle },
                { label: t('mainConcept.results.question'), value: activeSet.questions.length },
              ]}
            />
            <div className="training-config-actions">
              <StartTrainingButton onClick={startSession}>{t('mainConcept.instructions.begin')}</StartTrainingButton>
              <button className="btn btn-ghost btn-lg" onClick={returnToMenu}>{t('training.returnSettings')}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'results' && summary) {
    return (
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

          <div className="results-actions">
            <button className="btn btn-primary btn-lg" onClick={downloadResult}>{t('training.downloadCsvRecord')}</button>
            <button className="btn btn-secondary btn-lg" onClick={openInstructions}>{t('training.playAgain')}</button>
            <button className="btn btn-ghost btn-lg" onClick={returnToMenu}>{t('training.returnMenu')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
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

          <main className="main-concept-panel main-concept-question">
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
                    {(Object.keys(RATING_KEYS) as Rating[]).map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        className={`main-concept-rating ${answer.ratings[elementIndex] === rating ? 'active' : ''}`}
                        onClick={() => setRating(elementIndex, rating)}
                        disabled={locked}
                      >
                        {t(RATING_KEYS[rating])}
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
              <button className="btn btn-ghost btn-lg" onClick={onExit}>{t('training.cancel')}</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function createEmptyAnswer(question: MainConceptQuestion): AnswerState {
  return {
    ratings: question.elements.map(() => null),
    selectedSentenceIndexes: [],
  };
}

function localizeTrainingSet(set: TrainingSet, lang: string): TrainingSet {
  if (lang !== 'zh') return set;
  return {
    ...set,
    transcript: set.zh.transcript,
    questions: set.zh.questions,
  };
}

function sameNumberList(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function buildTrial(
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
    userRatings: answer.ratings.map((rating) => (rating ? t(RATING_KEYS[rating]) : '')).join(' | '),
    correctRatings: question.correctRatings.map((rating) => t(RATING_KEYS[rating])).join(' | '),
    selectedSentenceText: indexesToText(answer.selectedSentenceIndexes, transcript),
    correctSentenceText: indexesToText(question.correctSentenceIndexes, transcript),
  };
}

function indexesToText(indexes: number[], transcript: string[]): string {
  return indexes.map((index) => transcript[index]).filter(Boolean).join(' | ');
}

function buildAnswerLines(trial: TrialResult, t: (key: TranslationKey, params?: Record<string, string | number>) => string): string[] {
  return [
    `${t('mainConcept.results.correctRatings')}: ${trial.correctRatings}`,
    `${t('mainConcept.results.correctSentences')}: ${trial.correctSentenceText || t('mainConcept.none')}`,
  ];
}

function toDetailRows(trials: TrialResult[]): Array<Record<string, unknown>> {
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

function toCsv(summary: SessionSummary): string {
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

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column as keyof typeof row])).join(',')),
  ].join('\n');
}

function validateTrainingSets(sets: TrainingSet[]): void {
  sets.forEach((set) => {
    validateQuestions(set.questions, set.transcript.length);
    validateQuestions(set.zh.questions, set.zh.transcript.length);
  });
}

function validateQuestions(questions: MainConceptQuestion[], transcriptLength: number): void {
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

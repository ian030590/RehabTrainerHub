import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import {
  type BrainTrainingRecord,
  downloadTrainingRecordCsv,
  downloadTrainingRecordJson,
  saveTrainingRecord,
} from '../utils/trainingRecords';
import { useT } from '../i18n';
import './UFOVPage.css';

type Phase = 'intro' | 'calibrating' | 'fixation' | 'stimulus' | 'mask' | 'central-response' | 'axis-response' | 'feedback' | 'results';
type CentralTarget = 'car' | 'truck';
type Direction = 'up' | 'down';
type SubtestId = 1 | 2 | 3;

interface Subtest {
  id: SubtestId;
  hasPeripheral: boolean;
  hasDistractors: boolean;
}

interface Slot {
  axis: number;
  ring: number;
  x: number;
  y: number;
}

interface TrialStimulus {
  id: string;
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  durationMs: number;
  centralTarget: CentralTarget;
  peripheralSlot?: Slot;
}

interface TrialRecord {
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  durationMs: number;
  centralTarget: CentralTarget;
  centralResponse: CentralTarget;
  peripheralAxis?: number;
  peripheralResponse?: number;
  correct: boolean;
  responseTimeMs: number;
}

interface SubtestResult {
  subtestId: SubtestId;
  thresholdMs: number;
  trialCount: number;
  aborted: boolean;
}

interface RunState {
  minDurationMs: number;
  subtestIndex: number;
  practiceLeft: number;
  testTrial: number;
  durationMs: number;
  stepMs: number;
  reversals: number[];
  lastDirection: Direction | null;
  limitStreak: number;
  failAtMaxStreak: number;
  subtestTrials: TrialRecord[];
  allTrials: TrialRecord[];
  results: SubtestResult[];
}

const SUBTESTS: Subtest[] = [
  { id: 1, hasPeripheral: false, hasDistractors: false },
  { id: 2, hasPeripheral: true, hasDistractors: false },
  { id: 3, hasPeripheral: true, hasDistractors: true },
];
const PRACTICE_TRIALS = 5;
const MAX_TEST_TRIALS = 24;
const MAX_REVERSALS = 8;
const MAX_DURATION_MS = 500;
const PRACTICE_DURATION_MS = 240;
const FIXATION_MS = 1000;
const MASK_MS = 500;
const START_DURATION_MS = 240;
const START_STEP_MS = 40;
const MIN_STEP_MS = 8;
const AXES = [0, 1, 2, 3, 4, 5, 6, 7];
const SLOTS = createSlots();

const copy = {
  zh: {
    title: 'UFOV 注意力測驗',
    intro: '完成三個階段：處理速度、分散注意力、選擇性注意力。',
    start: '開始測驗',
    restart: '重新開始',
    calibrating: '正在測量螢幕更新率',
    fixation: '請看中央十字',
    mask: '請保持注視',
    centralQuestion: '剛才中央出現的是哪一個？',
    axisQuestion: '剛才周邊目標出現在哪個方向？',
    car: '汽車',
    truck: '卡車',
    correct: '正確',
    incorrect: '再試一次',
    formal: '正式測驗',
    practice: '練習',
    trial: '題',
    duration: '呈現時間',
    refresh: '螢幕更新',
    results: '測驗結果',
    threshold: '閾值',
    aborted: '已中止',
    saveNote: '結果已存入 BrainTrainer 訓練紀錄。',
    downloadCsv: '下載 CSV',
    downloadJson: '下載 JSON',
    center: '中央',
    directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
    subtests: {
      1: 'Subtest 1 處理速度',
      2: 'Subtest 2 分散注意力',
      3: 'Subtest 3 選擇性注意力',
    },
    summaries: {
      1: '辨識中央汽車或卡車。',
      2: '辨識中央目標，並指出周邊目標方向。',
      3: '在干擾物中辨識中央目標與周邊目標方向。',
    },
  },
  en: {
    title: 'UFOV Attention Test',
    intro: 'Complete three stages: processing speed, divided attention, and selective attention.',
    start: 'Start test',
    restart: 'Restart',
    calibrating: 'Measuring screen refresh rate',
    fixation: 'Look at the center cross',
    mask: 'Keep looking at the center',
    centralQuestion: 'Which item appeared in the center?',
    axisQuestion: 'Which direction contained the peripheral target?',
    car: 'Car',
    truck: 'Truck',
    correct: 'Correct',
    incorrect: 'Try again',
    formal: 'Test',
    practice: 'Practice',
    trial: 'Trial',
    duration: 'Display time',
    refresh: 'Refresh',
    results: 'Results',
    threshold: 'Threshold',
    aborted: 'Aborted',
    saveNote: 'Saved to BrainTrainer training records.',
    downloadCsv: 'Download CSV',
    downloadJson: 'Download JSON',
    center: 'Center',
    directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
    subtests: {
      1: 'Subtest 1 Processing Speed',
      2: 'Subtest 2 Divided Attention',
      3: 'Subtest 3 Selective Attention',
    },
    summaries: {
      1: 'Identify the central car or truck.',
      2: 'Identify the central target and the peripheral target direction.',
      3: 'Identify the central target and peripheral direction among distractors.',
    },
  },
} as const;

export function UFOVPage() {
  const { lang } = useT();
  const labels = copy[lang];
  const [phase, setPhase] = useState<Phase>('intro');
  const [refreshMs, setRefreshMs] = useState(16.67);
  const [trial, setTrial] = useState<TrialStimulus | null>(null);
  const [centralResponse, setCentralResponse] = useState<CentralTarget | null>(null);
  const [feedbackCorrect, setFeedbackCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<SubtestResult[]>([]);
  const [savedRecord, setSavedRecord] = useState<BrainTrainingRecord | null>(null);
  const runRef = useRef<RunState | null>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const responseStartedAtRef = useRef(0);

  const activeSubtest = runRef.current ? SUBTESTS[runRef.current.subtestIndex] : SUBTESTS[0];
  const activeStageLabel = trial?.practice ? labels.practice : labels.formal;
  const allTrials = useMemo(() => savedRecord?.detailRows ?? [], [savedRecord]);

  const cancelTimers = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    rafRef.current = null;
    timeoutRef.current = null;
  }, []);

  const runFrameDelay = useCallback((durationMs: number, onDone: () => void) => {
    cancelTimers();
    let startedAt: number | null = null;
    const tick = (now: number) => {
      startedAt ??= now;
      if (now - startedAt >= durationMs) {
        rafRef.current = null;
        onDone();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelTimers]);

  const beginTrial = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    const subtest = SUBTESTS[run.subtestIndex];
    const practice = run.practiceLeft > 0;
    const durationMs = practice ? Math.max(PRACTICE_DURATION_MS, run.minDurationMs) : run.durationMs;
    const nextTrial: TrialStimulus = {
      id: crypto.randomUUID(),
      subtestId: subtest.id,
      practice,
      trialNumber: practice ? PRACTICE_TRIALS - run.practiceLeft + 1 : run.testTrial + 1,
      durationMs,
      centralTarget: Math.random() > 0.5 ? 'car' : 'truck',
      peripheralSlot: subtest.hasPeripheral ? SLOTS[Math.floor(Math.random() * SLOTS.length)] : undefined,
    };

    setTrial(nextTrial);
    setCentralResponse(null);
    setFeedbackCorrect(null);
    setPhase('fixation');
    runFrameDelay(FIXATION_MS, () => {
      setPhase('stimulus');
      runFrameDelay(durationMs, () => {
        setPhase('mask');
        runFrameDelay(MASK_MS, () => {
          responseStartedAtRef.current = performance.now();
          setPhase('central-response');
        });
      });
    });
  }, [runFrameDelay]);

  const beginSubtest = useCallback((subtestIndex: number) => {
    const run = runRef.current;
    if (!run) return;
    run.subtestIndex = subtestIndex;
    run.practiceLeft = PRACTICE_TRIALS;
    run.testTrial = 0;
    run.durationMs = Math.max(START_DURATION_MS, run.minDurationMs);
    run.stepMs = START_STEP_MS;
    run.reversals = [];
    run.lastDirection = null;
    run.limitStreak = 0;
    run.failAtMaxStreak = 0;
    run.subtestTrials = [];
    beginTrial();
  }, [beginTrial]);

  const finishRun = useCallback((nextResults: SubtestResult[], trials: TrialRecord[]) => {
    cancelTimers();
    const now = new Date();
    const thresholds = Object.fromEntries(nextResults.map((item) => [`subtest${item.subtestId}`, item.thresholdMs]));
    const record: BrainTrainingRecord = {
      id: `ufov_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      trainingDate: formatDate(now),
      userName: getAuthUserNameFromToken() || 'Guest',
      moduleId: 'attention-training',
      gameId: 'ufov',
      gameTitle: labels.title,
      difficulty: 'adaptive',
      details: {
        refreshMs: Math.round(refreshMs),
        ...thresholds,
        aborted: nextResults.some((item) => item.aborted),
      },
      detailRows: trials.map((item) => ({
        Subtest: item.subtestId,
        Phase: item.practice ? 'practice' : 'test',
        Trial: item.trialNumber,
        Duration_ms: Math.round(item.durationMs),
        Central_Target: item.centralTarget,
        Central_Response: item.centralResponse,
        Peripheral_Axis: item.peripheralAxis ?? '',
        Peripheral_Response: item.peripheralResponse ?? '',
        Correct: item.correct,
        Response_Time_ms: Math.round(item.responseTimeMs),
      })),
    };
    setResults(nextResults);
    setSavedRecord(record);
    setPhase('results');
    void saveTrainingRecord(record);
  }, [cancelTimers, labels.title, refreshMs]);

  const completeSubtest = useCallback((aborted: boolean) => {
    const run = runRef.current;
    if (!run) return;
    const subtest = SUBTESTS[run.subtestIndex];
    const result: SubtestResult = {
      subtestId: subtest.id,
      thresholdMs: aborted ? MAX_DURATION_MS : estimateThreshold(run.subtestTrials),
      trialCount: run.subtestTrials.filter((item) => !item.practice).length,
      aborted,
    };
    const nextResults = [...run.results, result];
    run.results = nextResults;

    if (aborted || run.subtestIndex >= SUBTESTS.length - 1) {
      finishRun(nextResults, run.allTrials);
      return;
    }

    beginSubtest(run.subtestIndex + 1);
  }, [beginSubtest, finishRun]);

  const finishTrial = useCallback((central: CentralTarget, axisResponse?: number) => {
    const run = runRef.current;
    if (!run || !trial) return;
    const subtest = SUBTESTS[run.subtestIndex];
    const correct = central === trial.centralTarget && (!subtest.hasPeripheral || axisResponse === trial.peripheralSlot?.axis);
    const record: TrialRecord = {
      subtestId: subtest.id,
      practice: trial.practice,
      trialNumber: trial.trialNumber,
      durationMs: trial.durationMs,
      centralTarget: trial.centralTarget,
      centralResponse: central,
      peripheralAxis: trial.peripheralSlot?.axis,
      peripheralResponse: axisResponse,
      correct,
      responseTimeMs: performance.now() - responseStartedAtRef.current,
    };
    run.subtestTrials.push(record);
    run.allTrials.push(record);

    if (trial.practice) {
      run.practiceLeft -= 1;
      setFeedbackCorrect(correct);
      setPhase('feedback');
      timeoutRef.current = window.setTimeout(beginTrial, 850);
      return;
    }

    run.testTrial += 1;
    const direction: Direction = correct ? 'down' : 'up';
    if (run.lastDirection && run.lastDirection !== direction) {
      run.reversals.push(trial.durationMs);
      run.stepMs = Math.max(MIN_STEP_MS, run.stepMs * 0.75);
    }
    run.lastDirection = direction;

    const delta = correct ? -run.stepMs : run.stepMs * 3;
    const nextDuration = clamp(trial.durationMs + delta, run.minDurationMs, MAX_DURATION_MS);
    const atLimit = nextDuration === trial.durationMs && (nextDuration === run.minDurationMs || nextDuration === MAX_DURATION_MS);
    run.limitStreak = atLimit ? run.limitStreak + 1 : 0;
    run.failAtMaxStreak = !correct && trial.durationMs >= MAX_DURATION_MS ? run.failAtMaxStreak + 1 : 0;
    run.durationMs = nextDuration;

    const aborted = run.failAtMaxStreak >= 3;
    const done = aborted
      || run.testTrial >= MAX_TEST_TRIALS
      || run.reversals.length >= MAX_REVERSALS
      || run.limitStreak >= 3;
    if (done) {
      completeSubtest(aborted);
      return;
    }

    timeoutRef.current = window.setTimeout(beginTrial, 250);
  }, [beginTrial, completeSubtest, trial]);

  const handleCentralResponse = (answer: CentralTarget) => {
    setCentralResponse(answer);
    if (!activeSubtest.hasPeripheral) {
      finishTrial(answer);
      return;
    }
    setPhase('axis-response');
  };

  const handleAxisResponse = (axis: number) => {
    if (!centralResponse) return;
    finishTrial(centralResponse, axis);
  };

  const startRun = async () => {
    cancelTimers();
    setPhase('calibrating');
    setSavedRecord(null);
    setResults([]);
    const measured = await measureRefreshMs();
    setRefreshMs(measured);
    runRef.current = {
      minDurationMs: Math.max(measured, 16.67),
      subtestIndex: 0,
      practiceLeft: PRACTICE_TRIALS,
      testTrial: 0,
      durationMs: START_DURATION_MS,
      stepMs: START_STEP_MS,
      reversals: [],
      lastDirection: null,
      limitStreak: 0,
      failAtMaxStreak: 0,
      subtestTrials: [],
      allTrials: [],
      results: [],
    };
    beginSubtest(0);
  };

  useEffect(() => () => cancelTimers(), [cancelTimers]);

  return (
    <main className="page-content ufov-page" id="main-content">
      <section className="ufov-shell" aria-labelledby="ufov-title">
        <div className="ufov-panel">
          <h1 className="section-title" id="ufov-title">{labels.title}</h1>
          <p className="section-subtitle">{labels.intro}</p>
          {phase === 'intro' && (
            <div className="ufov-actions">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => void startRun()}>
                {labels.start}
              </button>
            </div>
          )}
          {phase !== 'intro' && phase !== 'results' && (
            <div className="ufov-status" aria-live="polite">
              <span>{labels.subtests[activeSubtest.id]} · {activeStageLabel} {trial?.trialNumber ?? 1}</span>
              <span>{labels.duration}: {Math.round(trial?.durationMs ?? START_DURATION_MS)} ms</span>
              <span>{labels.refresh}: {refreshMs.toFixed(1)} ms</span>
            </div>
          )}
          {phase === 'calibrating' && <p className="ufov-feedback">{labels.calibrating}</p>}
          {phase !== 'intro' && phase !== 'calibrating' && phase !== 'results' && (
            <UFOVStage
              labels={labels}
              phase={phase}
              subtest={activeSubtest}
              trial={trial}
              onCentralResponse={handleCentralResponse}
              onAxisResponse={handleAxisResponse}
            />
          )}
          {phase === 'feedback' && (
            <p className="ufov-feedback" aria-live="polite">
              {feedbackCorrect ? labels.correct : labels.incorrect}
            </p>
          )}
          {phase === 'results' && savedRecord && (
            <section className="ufov-results" aria-labelledby="ufov-results-title">
              <h2 className="section-title" id="ufov-results-title">{labels.results}</h2>
              <div className="ufov-result-grid">
                {results.map((item) => (
                  <article className="ufov-result" key={item.subtestId}>
                    <span>{labels.subtests[item.subtestId]}</span>
                    <strong>{Math.round(item.thresholdMs)} ms</strong>
                    <span>{item.aborted ? labels.aborted : `${labels.trial}: ${item.trialCount}`}</span>
                  </article>
                ))}
              </div>
              <p>{labels.saveNote}</p>
              <div className="ufov-actions">
                <button className="btn btn-primary" type="button" onClick={() => downloadTrainingRecordCsv(savedRecord)}>
                  {labels.downloadCsv}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => downloadTrainingRecordJson(savedRecord)}>
                  {labels.downloadJson}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => void startRun()}>
                  {labels.restart}
                </button>
              </div>
              <span className="ufov-feedback">{allTrials.length} {labels.trial}</span>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function UFOVStage({
  labels,
  phase,
  subtest,
  trial,
  onCentralResponse,
  onAxisResponse,
}: {
  labels: (typeof copy)[keyof typeof copy];
  phase: Phase;
  subtest: Subtest;
  trial: TrialStimulus | null;
  onCentralResponse: (answer: CentralTarget) => void;
  onAxisResponse: (axis: number) => void;
}) {
  return (
    <div className="ufov-response">
      <div className="ufov-stage" aria-label={trial ? labels.subtests[trial.subtestId] : labels.title}>
        {phase === 'fixation' && <div className="ufov-fixation">+</div>}
        {phase === 'stimulus' && trial && (
          <>
            <CentralStimulus target={trial.centralTarget} labels={labels} />
            {subtest.hasPeripheral && trial.peripheralSlot && (
              <PeripheralStimuli
                distractors={subtest.hasDistractors}
                targetSlot={trial.peripheralSlot}
              />
            )}
          </>
        )}
        {phase === 'mask' && <div className="ufov-mask" aria-label={labels.mask} />}
      </div>
      {phase === 'central-response' && (
        <>
          <p>{labels.centralQuestion}</p>
          <div className="ufov-choice-row">
            <button className="btn btn-primary ufov-choice" type="button" onClick={() => onCentralResponse('car')}>
              {labels.car}
            </button>
            <button className="btn btn-primary ufov-choice" type="button" onClick={() => onCentralResponse('truck')}>
              {labels.truck}
            </button>
          </div>
        </>
      )}
      {phase === 'axis-response' && (
        <>
          <p>{labels.axisQuestion}</p>
          <div className="ufov-axis-pad">
            <span className="ufov-axis-center">{labels.center}</span>
            {AXES.map((axis) => {
              const point = axisPoint(axis, 39);
              return (
                <button
                  className="btn btn-secondary ufov-axis-button"
                  key={axis}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  type="button"
                  onClick={() => onAxisResponse(axis)}
                >
                  {labels.directions[axis]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CentralStimulus({ target, labels }: { target: CentralTarget; labels: (typeof copy)[keyof typeof copy] }) {
  return (
    <div className={`ufov-central ${target === 'truck' ? 'ufov-central-truck' : ''}`}>
      {target === 'car' ? labels.car : labels.truck}
    </div>
  );
}

function PeripheralStimuli({ distractors, targetSlot }: { distractors: boolean; targetSlot: Slot }) {
  return (
    <>
      {SLOTS.map((slot) => {
        const isTarget = slot.axis === targetSlot.axis && slot.ring === targetSlot.ring;
        if (!isTarget && !distractors) return null;
        return (
          <span
            aria-hidden="true"
            className={`ufov-slot ${isTarget ? 'ufov-target' : 'ufov-distractor'}`}
            key={`${slot.axis}-${slot.ring}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {isTarget ? '●' : '▲'}
          </span>
        );
      })}
    </>
  );
}

function createSlots(): Slot[] {
  return AXES.flatMap((axis) => [20, 30, 40].map((radius, ring) => ({
    axis,
    ring,
    ...axisPoint(axis, radius),
  })));
}

function axisPoint(axis: number, radius: number) {
  const angle = (-90 + axis * 45) * Math.PI / 180;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateThreshold(trials: TrialRecord[]) {
  const formalDurations = trials
    .filter((trial) => !trial.practice)
    .slice(-8)
    .map((trial) => trial.durationMs);
  if (formalDurations.length === 0) return MAX_DURATION_MS;
  return formalDurations.reduce((sum, value) => sum + value, 0) / formalDurations.length;
}

async function measureRefreshMs() {
  const samples: number[] = [];
  let last = 0;
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (last) samples.push(now - last);
      last = now;
      if (samples.length >= 24) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const usable = samples.filter((sample) => sample > 4 && sample < 40);
  if (usable.length === 0) return 16.67;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

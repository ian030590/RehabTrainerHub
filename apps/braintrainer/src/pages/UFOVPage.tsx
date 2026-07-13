import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { ConfigDialog } from '@rehab-trainer/ui/components/ConfigDialog';
import { initJsPsych, JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import {
  type BrainTrainingRecord,
  downloadTrainingRecordCsv,
  saveTrainingRecord,
} from '../utils/trainingRecords';
import { useT } from '../i18n';
import './UFOVPage.css';

type CentralTarget = 'car' | 'truck';
type Direction = 'up' | 'down';
type SubtestId = 1 | 2 | 3;
type UfovRunMode = 'instruction' | 'practice' | 'formal';
type UfovLabels = (typeof copy)[keyof typeof copy];

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

interface UfovExperimentData {
  results: SubtestResult[];
  trials: TrialRecord[];
  refresh_ms: number;
  aborted: boolean;
  mode: UfovRunMode;
  subtest_id: SubtestId;
}

interface UfovRunConfig {
  subtestId: SubtestId;
  mode: UfovRunMode;
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
const MIN_DURATION_MS = 1;
const PRACTICE_DURATION_MS = 240;
const FIXATION_MS = 1000;
const MASK_MS = 500;
const START_DURATION_MS = MAX_DURATION_MS;
const START_STEP_MS = 40;
const MIN_STEP_MS = 8;
const AXES = [0, 1, 2, 3, 4, 5, 6, 7];
const AXIS_SYMBOLS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const SLOTS = createSlots();

const copy = {
  zh: {
    title: 'UFOV 注意力測驗',
    intro: '完成三個階段：處理速度、分散注意力、選擇性注意力。',
    start: '開始',
    restart: '重新開始',
    settingsTitle: 'UFOV 設定',
    chooseSubtest: '選擇 Subtest',
    chooseMode: '選擇流程',
    modeInstruction: '說明',
    modeInstructionDesc: '只顯示操作說明，不開始計分。',
    modePractice: '練習',
    modePracticeDesc: '固定速度練習 5 題，提供正誤回饋。',
    modeFormal: '正式測驗',
    modeFormalDesc: '進入 adaptive 正式測驗並儲存結果。',
    openSettings: '設定測驗',
    cancel: '取消',
    calibrating: '正在測量螢幕更新率',
    car: '汽車',
    truck: '卡車',
    correct: '正確',
    incorrect: '再試一次',
    trial: '題',
    refresh: '螢幕更新',
    results: '測驗結果',
    aborted: '已中止',
    saveNote: '結果已存入 BrainTrainer 訓練紀錄。',
    practiceResult: '練習答對',
    downloadCsv: '下載 CSV',
    directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
    subtests: {
      1: 'Subtest 1 處理速度',
      2: 'Subtest 2 分散注意力',
      3: 'Subtest 3 選擇性注意力',
    },
    instructions: {
      1: '看著中央方框。刺激出現後，選出中央出現的是汽車或卡車。',
      2: '看著中央方框。刺激出現後，先選中央車輛，再選周邊目標出現的方向。',
      3: '看著中央方框。刺激出現後，在干擾物中辨識中央車輛，並選出周邊目標方向。',
    },
  },
  en: {
    title: 'UFOV Attention Test',
    intro: 'Complete three stages: processing speed, divided attention, and selective attention.',
    start: 'Start',
    restart: 'Restart',
    settingsTitle: 'UFOV Settings',
    chooseSubtest: 'Choose Subtest',
    chooseMode: 'Choose Flow',
    modeInstruction: 'Instructions',
    modeInstructionDesc: 'Show instructions only, without scoring.',
    modePractice: 'Practice',
    modePracticeDesc: 'Run 5 fixed-speed practice trials with feedback.',
    modeFormal: 'Formal Test',
    modeFormalDesc: 'Run the adaptive formal test and save results.',
    openSettings: 'Configure Test',
    cancel: 'Cancel',
    calibrating: 'Measuring screen refresh rate',
    car: 'Car',
    truck: 'Truck',
    correct: 'Correct',
    incorrect: 'Try again',
    trial: 'Trial',
    refresh: 'Refresh',
    results: 'Results',
    aborted: 'Aborted',
    saveNote: 'Saved to BrainTrainer training records.',
    practiceResult: 'Practice correct',
    downloadCsv: 'Download CSV',
    directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
    subtests: {
      1: 'Subtest 1 Processing Speed',
      2: 'Subtest 2 Divided Attention',
      3: 'Subtest 3 Selective Attention',
    },
    instructions: {
      1: 'Look at the center box. After the stimulus appears, choose whether the center item was a car or truck.',
      2: 'Look at the center box. After the stimulus appears, choose the center vehicle, then choose the peripheral target direction.',
      3: 'Look at the center box. After the stimulus appears, identify the center vehicle among distractors and choose the peripheral target direction.',
    },
  },
} as const;

const ufovInfo = {
  name: 'ufov-experiment',
  version: '1.0.0',
  parameters: {
    labels: {
      type: ParameterType.COMPLEX,
      default: copy.zh,
    },
    refresh_ms: {
      type: ParameterType.FLOAT,
      default: 16.67,
    },
    config: {
      type: ParameterType.COMPLEX,
      default: { subtestId: 1, mode: 'formal' } satisfies UfovRunConfig,
    },
  },
  data: {
    results: { type: ParameterType.COMPLEX },
    trials: { type: ParameterType.COMPLEX },
    refresh_ms: { type: ParameterType.FLOAT },
    aborted: { type: ParameterType.BOOL },
    mode: { type: ParameterType.STRING },
    subtest_id: { type: ParameterType.INT },
  },
} as const;

type UfovInfo = typeof ufovInfo;

class UfovExperimentPlugin implements JsPsychPlugin<UfovInfo> {
  static info = ufovInfo;

  constructor(private jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: TrialType<UfovInfo>) {
    void this.runExperiment(displayElement, trial);
  }

  private async runExperiment(displayElement: HTMLElement, trial: TrialType<UfovInfo>) {
    const labels = trial.labels as UfovLabels;
    const config = trial.config as UfovRunConfig;
    const subtestIndex = SUBTESTS.findIndex((item) => item.id === config.subtestId);
    const run: RunState = {
      minDurationMs: MIN_DURATION_MS,
      subtestIndex: subtestIndex >= 0 ? subtestIndex : 0,
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

    this.resetSubtest(run, run.subtestIndex);
    const aborted = await this.runSubtest(displayElement, labels, run, config.mode);
    run.results.push({
      subtestId: SUBTESTS[run.subtestIndex].id,
      thresholdMs: config.mode === 'formal' && !aborted ? estimateThreshold(run.subtestTrials) : MAX_DURATION_MS,
      trialCount: run.subtestTrials.filter((item) => !item.practice).length,
      aborted,
    });

    displayElement.replaceChildren();
    this.jsPsych.finishTrial({
      results: run.results,
      trials: run.allTrials,
      refresh_ms: trial.refresh_ms,
      aborted: run.results.some((item) => item.aborted),
      mode: config.mode,
      subtest_id: SUBTESTS[run.subtestIndex].id,
    });
  }

  private resetSubtest(run: RunState, subtestIndex: number) {
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
  }

  private async runSubtest(displayElement: HTMLElement, labels: UfovLabels, run: RunState, mode: UfovRunMode) {
    let aborted = false;
    while (mode === 'practice' && run.practiceLeft > 0) {
      const record = await this.runOneTrial(displayElement, labels, run, true);
      run.subtestTrials.push(record);
      run.allTrials.push(record);
      run.practiceLeft -= 1;
      this.showFeedback(displayElement, labels, record.correct);
      await waitMs(this.jsPsych, 850);
    }
    if (mode === 'practice') return false;
    if (mode === 'instruction') return false;

    while (!aborted) {
      const record = await this.runOneTrial(displayElement, labels, run, false);
      run.subtestTrials.push(record);
      run.allTrials.push(record);
      this.updateStaircase(run, record);
      aborted = run.failAtMaxStreak >= 3;
      const done = aborted
        || run.testTrial >= MAX_TEST_TRIALS
        || run.reversals.length >= MAX_REVERSALS
        || run.limitStreak >= 3;
      if (done) return aborted;
      await waitMs(this.jsPsych, 250);
    }
    return aborted;
  }

  private async runOneTrial(displayElement: HTMLElement, labels: UfovLabels, run: RunState, practice: boolean) {
    const subtest = SUBTESTS[run.subtestIndex];
    const stimulus: TrialStimulus = {
      subtestId: subtest.id,
      practice,
      trialNumber: practice ? PRACTICE_TRIALS - run.practiceLeft + 1 : run.testTrial + 1,
      durationMs: practice ? Math.max(PRACTICE_DURATION_MS, run.minDurationMs) : run.durationMs,
      centralTarget: Math.random() > 0.5 ? 'car' : 'truck',
      peripheralSlot: subtest.hasPeripheral ? SLOTS[Math.floor(Math.random() * SLOTS.length)] : undefined,
    };

    this.renderStage(displayElement, labels, 'fixation', subtest, stimulus);
    await waitMs(this.jsPsych, FIXATION_MS);
    this.renderStage(displayElement, labels, 'stimulus', subtest, stimulus);
    await waitMs(this.jsPsych, stimulus.durationMs);
    this.renderStage(displayElement, labels, 'mask', subtest, stimulus);
    await waitMs(this.jsPsych, MASK_MS);

    const responseStartedAt = performance.now();
    const centralResponse = await this.askCentral(displayElement, labels);
    const peripheralResponse = subtest.hasPeripheral
      ? await this.askAxis(displayElement, labels)
      : undefined;
    const correct = centralResponse === stimulus.centralTarget
      && (!subtest.hasPeripheral || peripheralResponse === stimulus.peripheralSlot?.axis);

    return {
      subtestId: subtest.id,
      practice,
      trialNumber: stimulus.trialNumber,
      durationMs: stimulus.durationMs,
      centralTarget: stimulus.centralTarget,
      centralResponse,
      peripheralAxis: stimulus.peripheralSlot?.axis,
      peripheralResponse,
      correct,
      responseTimeMs: performance.now() - responseStartedAt,
    };
  }

  private updateStaircase(run: RunState, record: TrialRecord) {
    run.testTrial += 1;
    const direction: Direction = record.correct ? 'down' : 'up';
    if (run.lastDirection && run.lastDirection !== direction) {
      run.reversals.push(record.durationMs);
      run.stepMs = Math.max(MIN_STEP_MS, run.stepMs * 0.75);
    }
    run.lastDirection = direction;

    const delta = record.correct ? -run.stepMs : run.stepMs * 3;
    const nextDuration = clamp(record.durationMs + delta, run.minDurationMs, MAX_DURATION_MS);
    const atLimit = nextDuration === record.durationMs && (nextDuration === run.minDurationMs || nextDuration === MAX_DURATION_MS);
    run.limitStreak = atLimit ? run.limitStreak + 1 : 0;
    run.failAtMaxStreak = !record.correct && record.durationMs >= MAX_DURATION_MS ? run.failAtMaxStreak + 1 : 0;
    run.durationMs = nextDuration;
  }

  private renderStage(displayElement: HTMLElement, labels: UfovLabels, phase: 'fixation' | 'stimulus' | 'mask', subtest: Subtest, stimulus: TrialStimulus) {
    const stage = document.createElement('div');
    stage.className = 'ufov-stage';
    stage.setAttribute('aria-label', labels.subtests[stimulus.subtestId]);
    if (phase === 'fixation') {
      const fixation = document.createElement('div');
      fixation.className = 'ufov-fixation-box';
      fixation.setAttribute('aria-hidden', 'true');
      stage.appendChild(fixation);
    }
    if (phase === 'stimulus') {
      stage.appendChild(createCentralStimulus(stimulus.centralTarget, labels));
      if (subtest.hasPeripheral && stimulus.peripheralSlot) {
        stage.appendChild(createPeripheralStimuli(subtest.hasDistractors, stimulus.peripheralSlot));
      }
    }
    if (phase === 'mask') {
      stage.appendChild(createNoiseMask());
    }
    displayElement.replaceChildren(stage);
  }

  private askCentral(displayElement: HTMLElement, labels: UfovLabels) {
    return new Promise<CentralTarget>((resolve) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const row = document.createElement('div');
      row.className = 'ufov-choice-row';
      row.append(
        vehicleButton('car', labels, () => resolve('car')),
        vehicleButton('truck', labels, () => resolve('truck')),
      );
      stage.appendChild(row);
      displayElement.replaceChildren(stage);
    });
  }

  private askAxis(displayElement: HTMLElement, labels: UfovLabels) {
    return new Promise<number>((resolve) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const pad = document.createElement('div');
      pad.className = 'ufov-axis-pad';
      const center = document.createElement('span');
      center.className = 'ufov-axis-center';
      center.setAttribute('aria-hidden', 'true');
      pad.appendChild(center);
      AXES.forEach((axis) => {
        const point = axisPoint(axis, 39);
        const button = responseButton(labels.directions[axis], 'btn btn-secondary ufov-axis-button', () => resolve(axis), AXIS_SYMBOLS[axis]);
        button.style.left = `${point.x}%`;
        button.style.top = `${point.y}%`;
        pad.appendChild(button);
      });
      stage.appendChild(pad);
      displayElement.replaceChildren(stage);
    });
  }

  private showFeedback(displayElement: HTMLElement, labels: UfovLabels, correct: boolean) {
    const stage = document.createElement('div');
    stage.className = 'ufov-stage ufov-response-stage';
    const feedback = document.createElement('p');
    feedback.className = 'ufov-feedback';
    feedback.textContent = correct ? '✓' : '×';
    feedback.setAttribute('aria-label', correct ? labels.correct : labels.incorrect);
    stage.appendChild(feedback);
    displayElement.replaceChildren(stage);
  }
}

export function UFOVPage() {
  const { lang } = useT();
  const labels = copy[lang];
  const displayRef = useRef<HTMLDivElement | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const skipFinishRef = useRef(false);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [refreshMs, setRefreshMs] = useState(16.67);
  const [selectedSubtest, setSelectedSubtest] = useState<SubtestId>(1);
  const [selectedMode, setSelectedMode] = useState<UfovRunMode>('formal');
  const [instructionSubtest, setInstructionSubtest] = useState<SubtestId | null>(null);
  const [results, setResults] = useState<SubtestResult[]>([]);
  const [savedRecord, setSavedRecord] = useState<BrainTrainingRecord | null>(null);

  const finishExperiment = useCallback((data: UfovExperimentData) => {
    const now = new Date();
    const isFormal = data.mode === 'formal';
    const correctCount = data.trials.filter((item) => item.correct).length;
    const thresholds = isFormal
      ? Object.fromEntries(data.results.map((item) => [`subtest${item.subtestId}`, item.thresholdMs]))
      : {};
    const record: BrainTrainingRecord = {
      id: `ufov_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      trainingDate: formatDate(now),
      userName: getAuthUserNameFromToken() || 'Guest',
      moduleId: 'attention-training',
      gameId: 'ufov',
      gameTitle: labels.title,
      difficulty: data.mode,
      details: {
        refreshMs: Math.round(data.refresh_ms),
        subtest: data.subtest_id,
        mode: data.mode,
        correctCount,
        trialCount: data.trials.length,
        ...thresholds,
        aborted: data.aborted,
      },
      detailRows: data.trials.map((item) => ({
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
    setResults(data.results);
    setSavedRecord(record);
    setIsRunning(false);
    jsPsychRef.current = null;
    void saveTrainingRecord(record);
  }, [labels.title]);

  const startRun = async (config: UfovRunConfig) => {
    const displayElement = displayRef.current;
    if (!displayElement) return;
    if (jsPsychRef.current) {
      skipFinishRef.current = true;
      jsPsychRef.current.abortExperiment();
      jsPsychRef.current = null;
    }
    displayElement.replaceChildren();
    setInstructionSubtest(null);
    setIsCalibrating(true);
    setSavedRecord(null);
    setResults([]);
    const measured = await measureRefreshMs();
    setRefreshMs(measured);
    setIsCalibrating(false);
    setIsRunning(true);

    const jsPsych = initJsPsych({
      display_element: displayElement,
      on_finish: () => {
        if (skipFinishRef.current) {
          skipFinishRef.current = false;
          return;
        }
        const values = jsPsych.data.get().last(1).values();
        const data = values[0] as Partial<UfovExperimentData> | undefined;
        if (!data?.results || !data.trials) return;
        finishExperiment(data as UfovExperimentData);
      },
    });
    jsPsychRef.current = jsPsych;
    jsPsych.run([{
      type: UfovExperimentPlugin,
      labels,
      refresh_ms: measured,
      config,
    }]);
  };

  const startSelectedFlow = async () => {
    setIsConfigOpen(false);
    setSavedRecord(null);
    setResults([]);
    displayRef.current?.replaceChildren();
    if (selectedMode === 'instruction') {
      setInstructionSubtest(selectedSubtest);
      setIsRunning(false);
      setIsCalibrating(false);
      return;
    }
    await startRun({ subtestId: selectedSubtest, mode: selectedMode });
  };

  useEffect(() => () => {
    if (jsPsychRef.current) {
      skipFinishRef.current = true;
      jsPsychRef.current.abortExperiment();
    }
    jsPsychRef.current = null;
  }, []);

  useEffect(() => {
    const active = isRunning || isCalibrating;
    document.body.classList.toggle('ufov-game-active', active);
    return () => document.body.classList.remove('ufov-game-active');
  }, [isRunning, isCalibrating]);

  return (
    <main className="page-content ufov-page" id="main-content">
      <section className="ufov-shell" aria-labelledby="ufov-title">
        <div className="ufov-panel">
          {!isRunning && !isCalibrating && (
            <>
              <h1 className="section-title" id="ufov-title">{labels.title}</h1>
              <p className="section-subtitle">{labels.intro}</p>
            </>
          )}
          {!isRunning && !isCalibrating && !savedRecord && (
            <div className="ufov-actions">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => setIsConfigOpen(true)}>
                {labels.openSettings}
              </button>
            </div>
          )}
          {isCalibrating && <p className="ufov-feedback">{labels.calibrating}</p>}
          {instructionSubtest && (
            <section className="ufov-instructions" aria-labelledby="ufov-instructions-title">
              <h2 id="ufov-instructions-title">{labels.subtests[instructionSubtest]}</h2>
              <p>{labels.instructions[instructionSubtest]}</p>
              <div className="ufov-actions">
                <button className="btn btn-primary" type="button" onClick={() => setIsConfigOpen(true)}>
                  {labels.openSettings}
                </button>
              </div>
            </section>
          )}
          <div ref={displayRef} />
          {savedRecord && (
            <section className="ufov-results" aria-labelledby="ufov-results-title">
              <h2 className="section-title" id="ufov-results-title">{labels.results}</h2>
              <div className="results-summary">
                {results.map((item) => (
                  <span key={item.subtestId}>
                    {labels.subtests[item.subtestId]}{' '}
                    <b className="results-summary-value">
                      {savedRecord.difficulty === 'formal'
                        ? `${Math.round(item.thresholdMs)} ms`
                        : formatPracticeScore(savedRecord)}
                    </b>
                    {' '}
                    <span className="ufov-result-meta">
                      {item.aborted ? labels.aborted : `${labels.trial}: ${getResultTrialCount(savedRecord, item)}`}
                    </span>
                  </span>
                ))}
                <span>
                  {labels.trial}{' '}
                  <b className="results-summary-value">{savedRecord.detailRows?.length ?? 0}</b>
                </span>
              </div>
              <div className="config-summary">
                <strong>{savedRecord.difficulty === 'formal' ? labels.saveNote : `${labels.practiceResult} ${formatPracticeScore(savedRecord)}`}</strong>
              </div>
              <div className="config-actions ufov-result-actions">
                <button className="btn btn-primary btn-lg config-start-btn" type="button" onClick={() => downloadTrainingRecordCsv(savedRecord)}>
                  {labels.downloadCsv}
                </button>
                <button className="btn btn-ghost btn-lg" type="button" onClick={() => setIsConfigOpen(true)}>
                  {labels.restart}
                </button>
              </div>
            </section>
          )}
          {!savedRecord && !isRunning && !isConfigOpen && (
            <span className="ufov-feedback">{labels.refresh}: {refreshMs.toFixed(1)} ms</span>
          )}
        </div>
      </section>
      {isConfigOpen && !isRunning && !isCalibrating && (
        <ConfigDialog ariaLabel={labels.settingsTitle} onClose={() => setIsConfigOpen(false)}>
          <div className="ufov-config-dialog">
            <h2 id="ufov-config-title">{labels.settingsTitle}</h2>
            <div className="config-section">
              <div className="config-label">{labels.chooseSubtest}</div>
              <div className="difficulty-selector">
                {SUBTESTS.map((subtest) => (
                  <button
                    className={`diff-btn ${selectedSubtest === subtest.id ? 'active' : ''}`}
                    key={subtest.id}
                    onClick={() => setSelectedSubtest(subtest.id)}
                    type="button"
                  >
                    <span className="diff-btn-label">{labels.subtests[subtest.id]}</span>
                    <span className="diff-btn-desc">{labels.instructions[subtest.id]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="config-section">
              <div className="config-label">{labels.chooseMode}</div>
              <div className="difficulty-selector">
                {(['instruction', 'practice', 'formal'] as UfovRunMode[]).map((mode) => (
                  <button
                    className={`diff-btn ${selectedMode === mode ? 'active' : ''}`}
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    type="button"
                  >
                    <span className="diff-btn-label">
                      {mode === 'instruction' && labels.modeInstruction}
                      {mode === 'practice' && labels.modePractice}
                      {mode === 'formal' && labels.modeFormal}
                    </span>
                    <span className="diff-btn-desc">
                      {mode === 'instruction' && labels.modeInstructionDesc}
                      {mode === 'practice' && labels.modePracticeDesc}
                      {mode === 'formal' && labels.modeFormalDesc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="config-actions">
              <button className="btn btn-primary btn-lg config-start-btn" type="button" onClick={() => void startSelectedFlow()}>
                <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
                  <polygon fill="currentColor" points="5,3 19,12 5,21" />
                </svg>
                {labels.start}
              </button>
              <button className="btn btn-ghost btn-lg" type="button" onClick={() => setIsConfigOpen(false)}>
                {labels.cancel}
              </button>
            </div>
            <div className="config-summary">
              <strong>{labels.subtests[selectedSubtest]}</strong> · <strong>
                {selectedMode === 'instruction' && labels.modeInstruction}
                {selectedMode === 'practice' && labels.modePractice}
                {selectedMode === 'formal' && labels.modeFormal}
              </strong>
            </div>
          </div>
        </ConfigDialog>
      )}
    </main>
  );
}

function formatPracticeScore(record: BrainTrainingRecord) {
  return `${Number(record.details?.correctCount ?? 0)}/${Number(record.details?.trialCount ?? 0)}`;
}

function getResultTrialCount(record: BrainTrainingRecord, result: SubtestResult) {
  return record.difficulty === 'formal'
    ? result.trialCount
    : Number(record.details?.trialCount ?? 0);
}

function responseButton(label: string, className: string, onClick: () => void, text = label) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick, { once: true });
  return button;
}

function createCentralStimulus(target: CentralTarget, labels: UfovLabels) {
  const element = document.createElement('div');
  element.className = `ufov-central ufov-central-${target}`;
  element.setAttribute('aria-label', target === 'car' ? labels.car : labels.truck);
  element.appendChild(createStimulusSquare(target));
  return element;
}

function vehicleButton(target: CentralTarget, labels: UfovLabels, onClick: () => void) {
  const button = responseButton(
    target === 'car' ? labels.car : labels.truck,
    'btn btn-primary ufov-choice',
    onClick,
    '',
  );
  button.appendChild(createStimulusSquare(target));
  return button;
}

function createStimulusSquare(target: CentralTarget) {
  const square = document.createElement('span');
  square.className = 'ufov-stimulus-square';
  square.appendChild(createVehicleIcon(target));
  return square;
}

function createVehicleIcon(target: CentralTarget) {
  const vehicle = document.createElement('span');
  vehicle.className = `ufov-vehicle ufov-vehicle-${target}`;
  const roof = document.createElement('span');
  roof.className = 'ufov-vehicle-roof';
  const body = document.createElement('span');
  body.className = 'ufov-vehicle-body';
  const leftWheel = document.createElement('span');
  leftWheel.className = 'ufov-vehicle-wheel ufov-vehicle-wheel-left';
  const rightWheel = document.createElement('span');
  rightWheel.className = 'ufov-vehicle-wheel ufov-vehicle-wheel-right';
  vehicle.append(roof, body, leftWheel, rightWheel);
  return vehicle;
}

function createPeripheralStimuli(distractors: boolean, targetSlot: Slot) {
  const fragment = document.createDocumentFragment();
  SLOTS.forEach((slot) => {
    const isTarget = slot.axis === targetSlot.axis && slot.ring === targetSlot.ring;
    if (!isTarget && !distractors) return;
    const element = document.createElement('span');
    element.className = `ufov-slot ${isTarget ? 'ufov-target' : 'ufov-distractor'}`;
    element.style.left = `${slot.x}%`;
    element.style.top = `${slot.y}%`;
    element.setAttribute('aria-hidden', 'true');
    if (isTarget) {
      element.appendChild(createStimulusSquare('car'));
    } else {
      element.textContent = '▲';
    }
    fragment.appendChild(element);
  });
  return fragment;
}

function createNoiseMask() {
  const mask = document.createElement('canvas');
  mask.className = 'ufov-mask-canvas';
  mask.setAttribute('aria-hidden', 'true');
  mask.width = Math.max(1, Math.ceil(window.innerWidth));
  mask.height = Math.max(1, Math.ceil(window.innerHeight));
  const context = mask.getContext('2d');
  if (!context) return mask;

  const imageData = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const value = Math.random() > 0.5 ? 255 : 0;
    imageData.data[index] = value;
    imageData.data[index + 1] = value;
    imageData.data[index + 2] = value;
    imageData.data[index + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return mask;
}

function createSlots(): Slot[] {
  return AXES.flatMap((axis) => [9, 18, 27].map((radius, ring) => ({
    axis,
    ring,
    ...axisPoint(axis, radius, true),
  })));
}

function axisPoint(axis: number, radius: number, compensateStageAspect = false) {
  const angle = (-90 + axis * 45) * Math.PI / 180;
  const yRadius = compensateStageAspect ? radius * (800 / 533) : radius;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * yRadius,
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

function waitMs(jsPsych: JsPsych, durationMs: number) {
  return new Promise<void>((resolve) => {
    jsPsych.pluginAPI.setTimeout(resolve, durationMs);
  });
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

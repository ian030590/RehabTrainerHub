import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import { createCsvContent } from '@rehab-trainer/ui/csv';
import {
  measureDisplayRefreshRate,
  type DisplayRefreshInfo,
} from '@rehab-trainer/ui/displayTiming';
import { downloadCsvFile } from '@rehab-trainer/ui/downloadFile';
import { exitFullscreenIfActive, waitForFullscreenLayout } from '@rehab-trainer/ui/fullscreen';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import {
  drawUfovCanvasStage,
  ensureUfovCanvasStage,
  prepareUfovNoiseMask,
  renderUfovCanvasStage,
  type UfovCanvasPhase,
} from '@rehab-trainer/ui/ufovCanvas';
import {
  estimateUfovThresholdMs,
  getFastestCorrectStimulusDurationMs,
  getUfovDirectionAccuracy,
  shouldStopUfovAdaptiveRun,
  UFOV_ADAPTIVE_STOP,
  type UfovDirectionAccuracy,
} from '@rehab-trainer/ui/ufovResults';
import { initJsPsych, JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { useNavigate } from 'react-router-dom';
import '@rehab-trainer/ui/components/UfovPage.css';

type CentralTarget = 'car' | 'truck';
type Direction = 'up' | 'down';
export type SubtestId = 1 | 2 | 3;
export type UfovRunMode = 'instruction' | 'practice' | 'formal';
type UfovLabels = (typeof copy)[keyof typeof copy];
type DetailRow = Record<string, unknown>;

export interface UfovTrainingRecord {
  id: string;
  savedAt: string;
  trainingDate?: string;
  userName: string;
  moduleId: string;
  gameId: string;
  gameTitle: string;
  difficulty: string;
  details?: DetailRow;
  detailRows?: DetailRow[];
}

export interface UfovPageProps {
  appName: string;
  backPath: string;
  lang: 'zh' | 'en';
  moduleId: string;
  initialSubtestId?: SubtestId;
  initialMode?: UfovRunMode;
  autoStart?: boolean;
  onSaveRecord?: (record: UfovTrainingRecord) => Promise<void> | void;
}

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
  durationFrames: number;
  displayFrameCount: number;
  plannedDurationMs: number;
  centralTarget: CentralTarget;
  peripheralSlot?: Slot;
}

interface TrialRecord {
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  durationFrames: number;
  displayFrameCount: number;
  plannedDurationMs: number;
  durationMs: number;
  actualDurationMs: number;
  actualFrameCount: number;
  droppedFrameCount: number;
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
  minDurationFrames: number;
  subtestIndex: number;
  practiceLeft: number;
  testTrial: number;
  durationFrames: number;
  stepFrames: number;
  maxDurationFrames: number;
  practiceDurationFrames: number;
  refreshMs: number;
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
  refresh_hz: number;
  refresh_is_60hz_family: boolean;
  refresh_device_kind: DisplayRefreshInfo['deviceKind'];
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
const MIN_DURATION_FRAMES = 1;
const MAX_DURATION_MS = 500;
const PRACTICE_DURATION_MS = 250;
const FIXATION_MS = 1000;
const MASK_MS = 500;
const START_STEP_MS = 50;
const MIN_STEP_FRAMES = 1;
const AXES = [0, 1, 2, 3, 4, 5, 6, 7];
const OUTER_RING_INDEX = 2;
const SLOTS = createSlots();
const PERIPHERAL_TARGET_SLOTS = SLOTS.filter((slot) => slot.ring === OUTER_RING_INDEX);

const copy = {
  zh: {
    title: 'UFOV 注意力測驗',
    intro: '完成三個階段：處理速度、分散注意力、選擇性注意力。',
    restart: '重新開始',
    car: '汽車',
    truck: '卡車',
    correct: '正確',
    incorrect: '再試一次',
    trial: '題',
    results: '測驗結果',
    aborted: '已中止',
    saveNote: '結果已存入 {appName} 訓練紀錄。',
    csvOnlyNote: '完整結果可下載為 CSV。',
    practiceResult: '練習答對',
    downloadCsv: '下載 CSV',
    backHome: '返回主畫面',
    actualProcessingSpeed: '實際處理速度',
    tableTrial: '題次',
    tableVehicle: '題目車子種類',
    tableDirection: '外圍車子方向',
    tableCorrect: '答對與否',
    tableProcessingSpeed: '處理速度（實際值）',
    directionAccuracy: '各方向答對率',
    noPeripheral: '無',
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
    restart: 'Restart',
    car: 'Car',
    truck: 'Truck',
    correct: 'Correct',
    incorrect: 'Try again',
    trial: 'Trial',
    results: 'Results',
    aborted: 'Aborted',
    saveNote: 'Saved to {appName} training records.',
    csvOnlyNote: 'Complete results can be downloaded as CSV.',
    practiceResult: 'Practice correct',
    downloadCsv: 'Download CSV',
    backHome: 'Back to Home',
    actualProcessingSpeed: 'Actual processing speed',
    tableTrial: 'Trial',
    tableVehicle: 'Target vehicle',
    tableDirection: 'Peripheral direction',
    tableCorrect: 'Correct',
    tableProcessingSpeed: 'Processing speed (actual)',
    directionAccuracy: 'Direction accuracy',
    noPeripheral: 'None',
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
    refresh_hz: {
      type: ParameterType.FLOAT,
      default: 60,
    },
    refresh_is_60hz_family: {
      type: ParameterType.BOOL,
      default: true,
    },
    refresh_device_kind: {
      type: ParameterType.STRING,
      default: 'unknown',
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
    refresh_hz: { type: ParameterType.FLOAT },
    refresh_is_60hz_family: { type: ParameterType.BOOL },
    refresh_device_kind: { type: ParameterType.STRING },
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
    const refreshMs = Number(trial.refresh_ms) > 0 ? Number(trial.refresh_ms) : 1000 / 60;
    const maxDurationFrames = msToFrameCount(MAX_DURATION_MS, refreshMs);
    const run: RunState = {
      minDurationFrames: MIN_DURATION_FRAMES,
      subtestIndex: subtestIndex >= 0 ? subtestIndex : 0,
      practiceLeft: PRACTICE_TRIALS,
      testTrial: 0,
      durationFrames: maxDurationFrames,
      stepFrames: msToFrameCount(START_STEP_MS, refreshMs),
      maxDurationFrames,
      practiceDurationFrames: msToFrameCount(PRACTICE_DURATION_MS, refreshMs),
      refreshMs,
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
      thresholdMs: config.mode === 'formal' && !aborted
        ? estimateUfovThresholdMs(run.reversals, run.subtestTrials, framesToMs(run.maxDurationFrames, run.refreshMs))
        : averageTrialDuration(run.subtestTrials),
      trialCount: run.subtestTrials.filter((item) => !item.practice).length,
      aborted,
    });

    displayElement.replaceChildren();
    this.jsPsych.finishTrial({
      results: run.results,
      trials: run.allTrials,
      refresh_ms: trial.refresh_ms,
      refresh_hz: trial.refresh_hz,
      refresh_is_60hz_family: trial.refresh_is_60hz_family,
      refresh_device_kind: trial.refresh_device_kind,
      aborted: run.results.some((item) => item.aborted),
      mode: config.mode,
      subtest_id: SUBTESTS[run.subtestIndex].id,
    });
  }

  private resetSubtest(run: RunState, subtestIndex: number) {
    run.subtestIndex = subtestIndex;
    run.practiceLeft = PRACTICE_TRIALS;
    run.testTrial = 0;
    run.durationFrames = Math.max(run.maxDurationFrames, run.minDurationFrames);
    run.stepFrames = msToFrameCount(START_STEP_MS, run.refreshMs);
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
      const done = shouldStopUfovAdaptiveRun(run);
      aborted = run.failAtMaxStreak >= UFOV_ADAPTIVE_STOP.failAtMaxStreakLimit;
      if (done) return aborted;
      await waitMs(this.jsPsych, 250);
    }
    return aborted;
  }

  private async runOneTrial(displayElement: HTMLElement, labels: UfovLabels, run: RunState, practice: boolean) {
    const subtest = SUBTESTS[run.subtestIndex];
    const durationFrames = practice
      ? Math.max(run.practiceDurationFrames, run.minDurationFrames)
      : run.durationFrames;
    const stimulus: TrialStimulus = {
      subtestId: subtest.id,
      practice,
      trialNumber: practice ? PRACTICE_TRIALS - run.practiceLeft + 1 : run.testTrial + 1,
      durationFrames,
      displayFrameCount: durationFrames,
      plannedDurationMs: framesToMs(durationFrames, run.refreshMs),
      centralTarget: Math.random() > 0.5 ? 'car' : 'truck',
      peripheralSlot: subtest.hasPeripheral ? pickPeripheralTargetSlot() : undefined,
    };

    this.renderStage(displayElement, labels, 'fixation', subtest, stimulus);
    await waitMs(this.jsPsych, FIXATION_MS);
    const presentation = await this.presentStimulusForFrames(displayElement, labels, subtest, stimulus, run.refreshMs);
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
      durationFrames: stimulus.durationFrames,
      displayFrameCount: stimulus.displayFrameCount,
      plannedDurationMs: stimulus.plannedDurationMs,
      durationMs: presentation.actualDurationMs,
      actualDurationMs: presentation.actualDurationMs,
      actualFrameCount: presentation.actualFrameCount,
      droppedFrameCount: presentation.droppedFrameCount,
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
      run.stepFrames = Math.max(MIN_STEP_FRAMES, Math.round(run.stepFrames * 0.75));
    }
    run.lastDirection = direction;

    const deltaFrames = record.correct ? -run.stepFrames : run.stepFrames * 3;
    const nextDurationFrames = clamp(record.durationFrames + deltaFrames, run.minDurationFrames, run.maxDurationFrames);
    const atLimit = nextDurationFrames === record.durationFrames
      && (nextDurationFrames === run.minDurationFrames || nextDurationFrames === run.maxDurationFrames);
    run.limitStreak = atLimit ? run.limitStreak + 1 : 0;
    run.failAtMaxStreak = !record.correct && record.durationFrames >= run.maxDurationFrames ? run.failAtMaxStreak + 1 : 0;
    run.durationFrames = nextDurationFrames;
  }

  private presentStimulusForFrames(
    displayElement: HTMLElement,
    labels: UfovLabels,
    subtest: Subtest,
    stimulus: TrialStimulus,
    refreshMs: number,
  ) {
    return new Promise<{ actualDurationMs: number; actualFrameCount: number; droppedFrameCount: number }>((resolve) => {
      const stage = ensureUfovCanvasStage(displayElement, labels.subtests[stimulus.subtestId]);
      const maskImageData = prepareUfovNoiseMask(stage);
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        drawUfovCanvasStage(stage, this.getCanvasStageOptions(labels, 'stimulus', subtest, stimulus));
        this.jsPsych.pluginAPI.setTimeout(() => {
          drawUfovCanvasStage(stage, this.getCanvasStageOptions(labels, 'mask', subtest, stimulus, maskImageData));
          resolve({
            actualDurationMs: stimulus.plannedDurationMs,
            actualFrameCount: stimulus.displayFrameCount,
            droppedFrameCount: 0,
          });
        }, stimulus.plannedDurationMs);
        return;
      }

      let startTimestamp = 0;
      let elapsedFrames = 0;

      window.requestAnimationFrame((timestamp) => {
        startTimestamp = timestamp;
        drawUfovCanvasStage(stage, this.getCanvasStageOptions(labels, 'stimulus', subtest, stimulus));

        const tick = (nextTimestamp: number) => {
          elapsedFrames += 1;
          if (elapsedFrames >= stimulus.displayFrameCount) {
            drawUfovCanvasStage(stage, this.getCanvasStageOptions(labels, 'mask', subtest, stimulus, maskImageData));
            const actualDurationMs = nextTimestamp - startTimestamp;
            resolve({
              actualDurationMs,
              actualFrameCount: elapsedFrames,
              droppedFrameCount: Math.max(0, Math.round(actualDurationMs / refreshMs) - stimulus.displayFrameCount),
            });
            return;
          }

          window.requestAnimationFrame(tick);
        };

        window.requestAnimationFrame(tick);
      });
    });
  }

  private renderStage(displayElement: HTMLElement, labels: UfovLabels, phase: 'fixation' | 'stimulus' | 'mask', subtest: Subtest, stimulus: TrialStimulus) {
    renderUfovCanvasStage(displayElement, this.getCanvasStageOptions(labels, phase, subtest, stimulus));
  }

  private getCanvasStageOptions(
    labels: UfovLabels,
    phase: UfovCanvasPhase,
    subtest: Subtest,
    stimulus: TrialStimulus,
    maskImageData?: ImageData | null,
  ) {
    return {
      ariaLabel: labels.subtests[stimulus.subtestId],
      phase,
      centralTarget: stimulus.centralTarget,
      hasPeripheral: subtest.hasPeripheral,
      hasDistractors: subtest.hasDistractors,
      peripheralSlot: stimulus.peripheralSlot,
      slots: SLOTS,
      maskImageData,
    };
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
      AXES.forEach((axis) => {
        const guide = document.createElement('span');
        guide.className = 'ufov-axis-guide';
        guide.style.transform = `rotate(${-90 + axis * 45}deg)`;
        guide.setAttribute('aria-hidden', 'true');
        pad.appendChild(guide);
      });
      const center = document.createElement('span');
      center.className = 'ufov-axis-center';
      center.setAttribute('aria-hidden', 'true');
      pad.appendChild(center);
      AXES.forEach((axis) => {
        const point = axisPoint(axis, 27, true);
        const button = responseButton(
          `${axis + 1}. ${labels.directions[axis]}`,
          'ufov-axis-button',
          () => resolve(axis),
          String(axis + 1),
        );
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

export function UfovPage({
  appName,
  backPath,
  lang,
  moduleId,
  initialSubtestId = 1,
  initialMode = 'formal',
  autoStart = false,
  onSaveRecord,
}: UfovPageProps) {
  const navigate = useNavigate();
  const labels = copy[lang];
  const displayRef = useRef<HTMLDivElement | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const skipFinishRef = useRef(false);
  const allowProgrammaticFullscreenExitRef = useRef(false);
  const autoStartRef = useRef(false);
  const [isRunning, setIsRunning] = useState(autoStart && initialMode !== 'instruction');
  const [instructionSubtest, setInstructionSubtest] = useState<SubtestId | null>(null);
  const [results, setResults] = useState<SubtestResult[]>([]);
  const [resultTrials, setResultTrials] = useState<TrialRecord[]>([]);
  const [directionAccuracy, setDirectionAccuracy] = useState<UfovDirectionAccuracy[]>([]);
  const [savedRecord, setSavedRecord] = useState<UfovTrainingRecord | null>(null);

  const finishExperiment = useCallback((data: UfovExperimentData) => {
    const now = new Date();
    const isFormal = data.mode === 'formal';
    const correctCount = data.trials.filter((item) => item.correct).length;
    const nextDirectionAccuracy = getUfovDirectionAccuracy(data.trials);
    const primaryResult = data.results[0];
    const thresholdProcessingSpeedMs = primaryResult ? roundMs(primaryResult.thresholdMs) : 0;
    const bestCorrectProcessingSpeedMs = roundMs(getFastestCorrectStimulusDurationMs(data.trials, thresholdProcessingSpeedMs));
    const processingSpeedMs = thresholdProcessingSpeedMs;
    const thresholds = isFormal
      ? Object.fromEntries(data.results.map((item) => [`subtest${item.subtestId}`, item.thresholdMs]))
      : {};
    const summary = data.results.map((item) => ({
      subtest: item.subtestId,
      processingSpeedMs: roundMs(item.thresholdMs),
      trialCount: item.trialCount,
      aborted: item.aborted,
    }));
    const record: UfovTrainingRecord = {
      id: `ufov_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      trainingDate: formatDate(now),
      userName: getAuthUserNameFromToken() || 'Guest',
      moduleId,
      gameId: 'ufov',
      gameTitle: labels.title,
      difficulty: data.mode,
      details: {
        refreshMs: roundMs(data.refresh_ms),
        refreshHz: roundMs(data.refresh_hz),
        refresh60HzFamily: data.refresh_is_60hz_family,
        refreshDeviceKind: data.refresh_device_kind,
        displayFrameMs: roundMs(data.refresh_ms),
        subtest: data.subtest_id,
        mode: data.mode,
        correctCount,
        trialCount: data.trials.length,
        processingSpeedMs,
        bestCorrectProcessingSpeedMs,
        thresholdProcessingSpeedMs,
        summaryScoreMs: processingSpeedMs,
        ufovSummary: summary,
        directionAccuracy: nextDirectionAccuracy,
        ...thresholds,
        aborted: data.aborted,
      },
      detailRows: data.trials.map((item) => ({
        Subtest: item.subtestId,
        Phase: item.practice ? 'practice' : 'test',
        Trial: item.trialNumber,
        Target_Vehicle: item.centralTarget,
        Target_Vehicle_Label: formatVehicle(item.centralTarget, labels),
        Peripheral_Axis: item.peripheralAxis ?? '',
        Peripheral_Direction: formatAxis(item.peripheralAxis, labels),
        Peripheral_Direction_Correct: typeof item.peripheralAxis === 'number'
          ? item.peripheralResponse === item.peripheralAxis
          : '',
        Correct: item.correct,
        Processing_Speed_ms: roundMs(item.actualDurationMs),
        Requested_Display_Frames: item.durationFrames,
        Actual_Display_Frames: item.actualFrameCount,
        Dropped_Frames: item.droppedFrameCount,
        Actual_Duration_ms: roundMs(item.actualDurationMs),
        Requested_Duration_ms: roundMs(item.plannedDurationMs),
        Central_Response: item.centralResponse,
        Peripheral_Response: item.peripheralResponse ?? '',
        Peripheral_Response_Direction: formatAxis(item.peripheralResponse, labels),
        Response_Time_ms: Math.round(item.responseTimeMs),
      })),
    };
    setResults(data.results);
    setResultTrials(data.trials);
    setDirectionAccuracy(nextDirectionAccuracy);
    setSavedRecord(record);
    setIsRunning(false);
    jsPsychRef.current = null;
    void onSaveRecord?.(record);
    allowProgrammaticFullscreenExitRef.current = true;
    void exitFullscreenIfActive();
  }, [labels, moduleId, onSaveRecord]);

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
    setSavedRecord(null);
    setResults([]);
    setResultTrials([]);
    setDirectionAccuracy([]);
    setIsRunning(true);
    document.body.classList.add('ufov-game-active');
    await waitForFullscreenLayout();

    const measured = await measureDisplayRefreshRate();
    const runConfig = measured.isMobileOrTablet && config.subtestId !== 1
      ? { ...config, subtestId: 1 as SubtestId }
      : config;

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
      refresh_ms: measured.refreshMs,
      refresh_hz: measured.refreshHz,
      refresh_is_60hz_family: measured.is60HzFamily,
      refresh_device_kind: measured.deviceKind,
      config: runConfig,
    }]);
  };

  const abortRun = useCallback(() => {
    if (allowProgrammaticFullscreenExitRef.current) {
      allowProgrammaticFullscreenExitRef.current = false;
      return;
    }
    skipFinishRef.current = true;
    if (jsPsychRef.current) {
      jsPsychRef.current.abortExperiment();
      jsPsychRef.current = null;
    }
    setIsRunning(false);
    setInstructionSubtest(null);
    setResults([]);
    setResultTrials([]);
    setSavedRecord(null);
    setDirectionAccuracy([]);
    void exitFullscreenIfActive();
    navigate(backPath);
  }, [backPath, navigate]);

  useTrainingAbort({
    active: isRunning || instructionSubtest !== null,
    onAbort: abortRun,
  });

  useEffect(() => {
    if (!autoStart || autoStartRef.current || savedRecord) return;
    autoStartRef.current = true;
    if (initialMode === 'instruction') {
      setInstructionSubtest(initialSubtestId);
      return;
    }
    void startRun({ subtestId: initialSubtestId, mode: initialMode });
  }, [autoStart, initialMode, initialSubtestId, savedRecord]);

  useEffect(() => () => {
    if (jsPsychRef.current) {
      skipFinishRef.current = true;
      jsPsychRef.current.abortExperiment();
    }
    jsPsychRef.current = null;
    void exitFullscreenIfActive();
  }, []);

  useLayoutEffect(() => {
    document.body.classList.toggle('ufov-game-active', isRunning);
    return () => document.body.classList.remove('ufov-game-active');
  }, [isRunning]);

  return (
    <main className="page-content ufov-page" id="main-content">
      <section className="ufov-shell" aria-labelledby="ufov-title">
        <div className="ufov-panel">
          {!isRunning && (
            <>
              <h1 className="section-title" id="ufov-title">{labels.title}</h1>
              <p className="section-subtitle">{labels.intro}</p>
            </>
          )}
          {!isRunning && !savedRecord && (
            <div className="ufov-actions">
              <button className="btn btn-primary btn-lg" type="button" onClick={() => navigate(backPath)}>
                {labels.backHome}
              </button>
            </div>
          )}
          {instructionSubtest && (
            <section className="ufov-instructions" aria-labelledby="ufov-instructions-title">
              <h2 id="ufov-instructions-title">{labels.subtests[instructionSubtest]}</h2>
              <p>{labels.instructions[instructionSubtest]}</p>
              <div className="ufov-actions">
                <button className="btn btn-primary" type="button" onClick={() => navigate(backPath)}>
                  {labels.backHome}
                </button>
              </div>
            </section>
          )}
          <div ref={displayRef} />
          {savedRecord && (
            <section className="ufov-results" aria-labelledby="ufov-results-title">
              <h2 className="section-title" id="ufov-results-title">{labels.results}</h2>
              <ResultSummary
                items={[
                  { label: labels.actualProcessingSpeed, value: `${roundMs(Number(savedRecord.details?.processingSpeedMs ?? 0))} ms` },
                  ...results.map((item) => ({
                    label: labels.subtests[item.subtestId],
                    value: savedRecord.difficulty === 'formal'
                      ? `${Math.round(item.thresholdMs)} ms`
                      : formatPracticeScore(savedRecord),
                    meta: (
                      <>
                        {' '}
                        <span className="ufov-result-meta">
                          {item.aborted ? labels.aborted : `${labels.trial}: ${getResultTrialCount(savedRecord, item)}`}
                        </span>
                      </>
                    ),
                  })),
                  { label: labels.trial, value: savedRecord.detailRows?.length ?? 0 },
                ]}
              />
              {directionAccuracy.some((item) => item.total > 0) && (
                <div className="ufov-table-wrap">
                  <h3 className="ufov-direction-accuracy-title">{labels.directionAccuracy}</h3>
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>{labels.tableDirection}</th>
                        <th>{labels.tableCorrect}</th>
                        <th>{labels.directionAccuracy}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directionAccuracy
                        .filter((item) => item.total > 0)
                        .map((item) => (
                          <tr key={item.axis}>
                            <td>{formatAxis(item.axis, labels)}</td>
                            <td>{item.correct} / {item.total}</td>
                            <td>{formatAccuracy(item.accuracyPercent)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="ufov-table-wrap">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>{labels.tableTrial}</th>
                      <th>{labels.tableVehicle}</th>
                      <th>{labels.tableDirection}</th>
                      <th>{labels.tableCorrect}</th>
                      <th>{labels.tableProcessingSpeed}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultTrials.map((trial) => (
                      <tr key={`${trial.practice ? 'p' : 't'}-${trial.trialNumber}`}>
                        <td>{trial.trialNumber}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          {formatVehicle(trial.centralTarget, labels)}
                        </td>
                        <td>{formatAxis(trial.peripheralAxis, labels)}</td>
                        <td className={trial.correct ? 'result-success' : 'result-fail'}>
                          {trial.correct ? '✓' : '✗'}
                        </td>
                        <td>{roundMs(trial.actualDurationMs)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="config-summary">
                <strong>
                  {savedRecord.difficulty === 'formal'
                    ? onSaveRecord ? formatSaveNote(labels, appName) : labels.csvOnlyNote
                    : `${labels.practiceResult} ${formatPracticeScore(savedRecord)}`}
                </strong>
              </div>
              <TrainingResultActions
                className="config-actions ufov-result-actions"
                downloadLabel={labels.downloadCsv}
                restartLabel={labels.restart}
                backLabel={labels.backHome}
                onDownloadCsv={() => downloadUfovTrainingRecordCsv(savedRecord)}
                onRestart={() => navigate(backPath)}
                onBackHome={() => navigate(backPath)}
              />
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function formatPracticeScore(record: UfovTrainingRecord) {
  return `${Number(record.details?.correctCount ?? 0)}/${Number(record.details?.trialCount ?? 0)}`;
}

function getResultTrialCount(record: UfovTrainingRecord, result: SubtestResult) {
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

function createSlots(): Slot[] {
  return AXES.flatMap((axis) => [9, 18, 27].map((radius, ring) => ({
    axis,
    ring,
    ...axisPoint(axis, radius, true),
  })));
}

function pickPeripheralTargetSlot() {
  return PERIPHERAL_TARGET_SLOTS[Math.floor(Math.random() * PERIPHERAL_TARGET_SLOTS.length)];
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

function averageTrialDuration(trials: TrialRecord[]) {
  if (trials.length === 0) return MAX_DURATION_MS;
  return trials.reduce((sum, trial) => sum + trial.durationMs, 0) / trials.length;
}

function waitMs(jsPsych: JsPsych, durationMs: number) {
  return new Promise<void>((resolve) => {
    jsPsych.pluginAPI.setTimeout(resolve, durationMs);
  });
}

function msToFrameCount(durationMs: number, refreshMs: number) {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) return Math.max(1, Math.round(durationMs / (1000 / 60)));
  return Math.max(1, Math.round(durationMs / refreshMs));
}

function framesToMs(frames: number, refreshMs: number) {
  return frames * refreshMs;
}

function roundMs(value: number) {
  return Number(value.toFixed(2));
}

function formatVehicle(target: CentralTarget, labels: UfovLabels) {
  return target === 'car' ? labels.car : labels.truck;
}

function formatAxis(axis: number | undefined, labels: UfovLabels) {
  return typeof axis === 'number' ? labels.directions[axis] : labels.noPeripheral;
}

function formatAccuracy(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function formatSaveNote(labels: UfovLabels, appName: string) {
  return labels.saveNote.replace('{appName}', appName);
}

function downloadUfovTrainingRecordCsv(record: UfovTrainingRecord): void {
  downloadCsvFile(
    buildUfovTrainingRecordsCsv([record]),
    `${safeFilePart(record.gameId)}_${record.trainingDate ?? formatDate(new Date())}.csv`,
  );
}

function buildUfovTrainingRecordsCsv(records: UfovTrainingRecord[]): string {
  const rows = records.flatMap((record) => {
    const details = record.details ?? {};
    const detailRows = record.detailRows?.length ? record.detailRows : [{}];
    return detailRows.map((detailRow, index): DetailRow => ({
      Saved_At: record.savedAt,
      Training_Date: record.trainingDate ?? '',
      User: record.userName,
      Module_ID: record.moduleId,
      Game_ID: record.gameId,
      Game: record.gameTitle,
      Difficulty: record.difficulty,
      Detail_Row: detailRows.length > 1 ? index + 1 : '',
      ...details,
      ...detailRow,
    }));
  });
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return createCsvContent([
    columns,
    ...rows.map((row) => columns.map((column) => row[column])),
  ]);
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'ufov';
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

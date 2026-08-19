import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import { TrainingResultActions } from '@rehab-trainer/ui/components/TrainingResultActions';
import {
  MeasureDisplayRefreshRate,
  type DisplayRefreshInfo,
} from '@rehab-trainer/ui/displayTiming';
import { ExitFullscreenIfActive, WaitForFullscreenLayout } from '@rehab-trainer/ui/fullscreen';
import { useTrainingAbort } from '@rehab-trainer/ui/hooks/useTrainingAbort';
import {
  DrawPeripheralAttentionCanvasStage,
  EnsurePeripheralAttentionCanvasStage,
  PreparePeripheralAttentionNoiseMask,
  RenderPeripheralAttentionCanvasStage,
  type PeripheralAttentionCanvasPhase,
} from '@rehab-trainer/ui/peripheralAttentionCanvas';
import {
  EstimatePeripheralAttentionThresholdMs,
  GetFastestCorrectStimulusDurationMs,
  GetPeripheralAttentionDirectionAccuracy,
  ShouldStopPeripheralAttentionAdaptiveRun,
  type PeripheralAttentionDirectionAccuracy,
} from '@rehab-trainer/ui/peripheralAttentionResults';
import { initJsPsych, JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { useNavigate } from 'react-router-dom';
import '@rehab-trainer/ui/components/PeripheralAttentionPage.css';

type CentralTarget = 'car' | 'truck';
type Direction = 'up' | 'down';
export type SubtestId = 1 | 2 | 3;
export type PeripheralAttentionRunMode = 'instruction' | 'practice' | 'formal';
export type UfovRunMode = PeripheralAttentionRunMode;
type PeripheralAttentionLabels = (typeof copy)[keyof typeof copy];
type DetailRow = Record<string, unknown>;

export interface PeripheralAttentionTrainingRecord {
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

export type UfovTrainingRecord = PeripheralAttentionTrainingRecord;
export type UfovDirectionAccuracy = PeripheralAttentionDirectionAccuracy;

export interface PeripheralAttentionPageProps {
  appName: string;
  backPath: string;
  lang: 'zh' | 'en';
  moduleId: string;
  initialSubtestId?: SubtestId;
  initialMode?: PeripheralAttentionRunMode;
  autoStart?: boolean;
  onSaveRecord?: (record: PeripheralAttentionTrainingRecord) => Promise<void> | void;
}

export type UfovPageProps = PeripheralAttentionPageProps;

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

interface PeripheralAttentionRunConfig {
  subtestId: SubtestId;
  mode: PeripheralAttentionRunMode;
}

interface AdaptiveState {
  direction: Direction;
  stepFrames: number;
  reversals: number[];
  limitStreak: number;
  failAtMaxStreak: number;
}

interface ExperimentPluginInfo {
  name: string;
  version: string;
  parameters: {
    labels: { type: ParameterType.OBJECT; default: undefined };
    refresh_ms: { type: ParameterType.FLOAT; default: undefined };
    refresh_hz: { type: ParameterType.FLOAT; default: undefined };
    refresh_is_60hz_family: { type: ParameterType.BOOL; default: undefined };
    refresh_device_kind: { type: ParameterType.STRING; default: undefined };
    config: { type: ParameterType.OBJECT; default: undefined };
  };
  data: {
    subtest_id: { type: ParameterType.INT };
    mode: { type: ParameterType.STRING };
    refresh_ms: { type: ParameterType.FLOAT };
    refresh_hz: { type: ParameterType.FLOAT };
    refresh_is_60hz_family: { type: ParameterType.BOOL };
    refresh_device_kind: { type: ParameterType.STRING };
    trials: { type: ParameterType.OBJECT };
    results: { type: ParameterType.OBJECT };
    aborted: { type: ParameterType.BOOL };
  };
}

interface PeripheralAttentionExperimentData {
  subtest_id: SubtestId;
  mode: PeripheralAttentionRunMode;
  refresh_ms: number;
  refresh_hz: number;
  refresh_is_60hz_family: boolean;
  refresh_device_kind: DisplayRefreshInfo['deviceKind'];
  trials: TrialRecord[];
  results: SubtestResult[];
  aborted: boolean;
}

const subtests: readonly Subtest[] = [
  { id: 1, hasPeripheral: false, hasDistractors: false },
  { id: 2, hasPeripheral: true, hasDistractors: false },
  { id: 3, hasPeripheral: true, hasDistractors: true },
];
const practiceTrials = 5;
const maxTestTrials = 48;
const minDurationFrames = 1;
const maxDurationMs = 500;
const practiceDurationMs = 250;
const fixationMs = 1000;
const maskMs = 500;
const startStepMs = 50;
const minStepFrames = 1;
const axes = [0, 1, 2, 3, 4, 5, 6, 7];
const outerRingIndex = 2;
const slots = CreateSlots();
const peripheralTargetSlots = slots.filter((slot) => slot.ring === outerRingIndex);

const copy = {
  zh: {
    title: '周邊注意力訓練',
    intro: '完成中央目標辨識、分散注意與選擇性注意三階段。本工具為非醫療練習，結果不代表診斷或治療建議。',
    restart: '重新開始',
    car: '汽車',
    truck: '卡車',
    correct: '正確',
    incorrect: '再試一次',
    trial: '題',
    results: '作答結果',
    aborted: '已中止',
    saveNote: '結果已存入 {appName} 訓練紀錄。',
    csvOnlyNote: '完整作答結果可下載為 CSV。',
    practiceResult: '練習答對',
    downloadCsv: '下載 CSV',
    backHome: '返回主畫面',
    backLobby: '返回大廳',
    actualProcessingSpeed: '刺激呈現時間參考值',
    tableTrial: '題次',
    tableVehicle: '題目車子種類',
    tableDirection: '外圍車子方向',
    tableCorrect: '答對與否',
    tableProcessingSpeed: '刺激實際呈現時間',
    directionAccuracy: '各方向答對率',
    noPeripheral: '無',
    directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
    subtests: {
      1: 'Subtest 1 中央目標辨識',
      2: 'Subtest 2 分散注意作答',
      3: 'Subtest 3 選擇性注意作答',
    },
    instructions: {
      1: '看著中央方框。刺激出現後，選出中央出現的是汽車或卡車。',
      2: '看著中央方框。刺激出現後，先選中央車輛，再選周邊目標出現的方向。',
      3: '看著中央方框。刺激出現後，在干擾物中辨識中央車輛，並選出周邊目標方向。',
    },
  },
  en: {
    title: 'Peripheral Attention Training',
    intro: 'Complete central-target recognition, divided-attention, and selective-attention activities. This is non-medical practice; results do not represent a diagnosis or treatment advice.',
    restart: 'Restart',
    car: 'Car',
    truck: 'Truck',
    correct: 'Correct',
    incorrect: 'Try again',
    trial: 'Trial',
    results: 'Response Results',
    aborted: 'Aborted',
    saveNote: 'Saved to {appName} training records.',
    csvOnlyNote: 'Complete response results can be downloaded as CSV.',
    practiceResult: 'Practice correct',
    downloadCsv: 'Download CSV',
    backHome: 'Back to Home',
    backLobby: 'Back to Lobby',
    actualProcessingSpeed: 'Reference stimulus presentation time',
    tableTrial: 'Trial',
    tableVehicle: 'Target vehicle',
    tableDirection: 'Peripheral direction',
    tableCorrect: 'Correct',
    tableProcessingSpeed: 'Actual stimulus presentation time',
    directionAccuracy: 'Direction accuracy',
    noPeripheral: 'None',
    directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
    subtests: {
      1: 'Subtest 1 Central Target Recognition',
      2: 'Subtest 2 Divided-Attention Responses',
      3: 'Subtest 3 Selective-Attention Responses',
    },
    instructions: {
      1: 'Look at the center box. After the stimulus appears, choose whether the center item was a car or truck.',
      2: 'Look at the center box. After the stimulus appears, choose the center vehicle, then choose the peripheral target direction.',
      3: 'Look at the center box. After the stimulus appears, identify the center vehicle among distractors and choose the peripheral target direction.',
    },
  },
};

const experimentPluginInfo: ExperimentPluginInfo = {
  name: 'peripheral-attention-experiment',
  version: '1.0.0',
  parameters: {
    labels: { type: ParameterType.OBJECT, default: undefined },
    refresh_ms: { type: ParameterType.FLOAT, default: undefined },
    refresh_hz: { type: ParameterType.FLOAT, default: undefined },
    refresh_is_60hz_family: { type: ParameterType.BOOL, default: undefined },
    refresh_device_kind: { type: ParameterType.STRING, default: undefined },
    config: { type: ParameterType.OBJECT, default: undefined },
  },
  data: {
    subtest_id: { type: ParameterType.INT },
    mode: { type: ParameterType.STRING },
    refresh_ms: { type: ParameterType.FLOAT },
    refresh_hz: { type: ParameterType.FLOAT },
    refresh_is_60hz_family: { type: ParameterType.BOOL },
    refresh_device_kind: { type: ParameterType.STRING },
    trials: { type: ParameterType.OBJECT },
    results: { type: ParameterType.OBJECT },
    aborted: { type: ParameterType.BOOL },
  },
};

class PeripheralAttentionExperimentPlugin implements JsPsychPlugin<ExperimentPluginInfo> {
  static readonly info = experimentPluginInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  async trial(
    displayElement: HTMLElement,
    trial: TrialType<ExperimentPluginInfo>,
    onLoad?: () => void,
  ) {
    onLoad?.();
    const labels = trial.labels as PeripheralAttentionLabels;
    const refreshMs = Number(trial.refresh_ms) || (1000 / 60);
    const config = trial.config as PeripheralAttentionRunConfig;
    const subtest = subtests.find((item) => item.id === config.subtestId) ?? subtests[0];
    const trials: TrialRecord[] = [];
    const results: SubtestResult[] = [];
    const minStep = minStepFrames;
    const maxDurationFrames = Math.max(minDurationFrames, MsToFrameCount(maxDurationMs, refreshMs));
    const practiceDurationFrames = Math.max(minDurationFrames, MsToFrameCount(practiceDurationMs, refreshMs));
    const startStepFrames = Math.max(minStep, MsToFrameCount(startStepMs, refreshMs));
    const isPracticeMode = config.mode === 'practice';
    const totalPracticeTrials = practiceTrials;
    const currentDurationFrames = isPracticeMode ? practiceDurationFrames : maxDurationFrames;
    let durationFrames = currentDurationFrames;
    let adaptiveState: AdaptiveState = {
      direction: 'down',
      stepFrames: startStepFrames,
      reversals: [],
      limitStreak: 0,
      failAtMaxStreak: 0,
    };
    let aborted = false;

    try {
      const practiceLimit = isPracticeMode ? totalPracticeTrials : 0;
      for (let index = 0; index < practiceLimit; index += 1) {
        const stimulus = this.createStimulus(subtest, true, index + 1, practiceDurationFrames, refreshMs);
        const record = await this.runTrial(displayElement, labels, subtest, stimulus, refreshMs);
        trials.push(record);
        this.showFeedback(displayElement, labels, record.correct);
        await WaitMs(this.jsPsych, 300);
      }

      if (!isPracticeMode) {
        let testTrialNumber = 0;
        while (testTrialNumber < maxTestTrials) {
          testTrialNumber += 1;
          const stimulus = this.createStimulus(subtest, false, testTrialNumber, durationFrames, refreshMs);
          const record = await this.runTrial(displayElement, labels, subtest, stimulus, refreshMs);
          trials.push(record);

          adaptiveState = this.updateAdaptiveState(
            adaptiveState,
            record.correct,
            durationFrames,
            minDurationFrames,
            maxDurationFrames,
            minStep,
            refreshMs,
          );
          durationFrames = this.nextDurationFrames(
            durationFrames,
            record.correct,
            adaptiveState.stepFrames,
            minDurationFrames,
            maxDurationFrames,
          );

          if (ShouldStopPeripheralAttentionAdaptiveRun({
            testTrial: testTrialNumber,
            reversals: adaptiveState.reversals,
            refreshMs,
            limitStreak: adaptiveState.limitStreak,
            failAtMaxStreak: adaptiveState.failAtMaxStreak,
          })) {
            break;
          }
        }
      }
    } catch {
      aborted = true;
    }

    const testTrials = trials.filter((item) => !item.practice);
    const formalThreshold = EstimatePeripheralAttentionThresholdMs({
      testTrial: testTrials.length,
      reversals: adaptiveState.reversals,
      refreshMs,
      limitStreak: adaptiveState.limitStreak,
      failAtMaxStreak: adaptiveState.failAtMaxStreak,
    }, testTrials, maxDurationMs);
    const practiceThreshold = isPracticeMode ? practiceDurationMs : AverageTrialDuration(trials);
    const thresholdMs = config.mode === 'formal' ? formalThreshold : practiceThreshold;

    results.push({
      subtestId: subtest.id,
      thresholdMs,
      trialCount: trials.length,
      aborted,
    });

    this.jsPsych.finishTrial({
      subtest_id: subtest.id,
      mode: config.mode,
      refresh_ms: Number(trial.refresh_ms) || refreshMs,
      refresh_hz: Number(trial.refresh_hz) || (1000 / refreshMs),
      refresh_is_60hz_family: Boolean(trial.refresh_is_60hz_family),
      refresh_device_kind: String(trial.refresh_device_kind || 'desktop') as DisplayRefreshInfo['deviceKind'],
      trials,
      results,
      aborted,
    });
  }

  private createStimulus(
    subtest: Subtest,
    practice: boolean,
    trialNumber: number,
    durationFrames: number,
    refreshMs: number,
  ): TrialStimulus {
    const centralTarget: CentralTarget = Math.random() < 0.5 ? 'car' : 'truck';
    const peripheralSlot = subtest.hasPeripheral ? PickPeripheralTargetSlot() : undefined;
    return {
      subtestId: subtest.id,
      practice,
      trialNumber,
      durationFrames,
      displayFrameCount: durationFrames,
      plannedDurationMs: FramesToMs(durationFrames, refreshMs),
      centralTarget,
      peripheralSlot,
    };
  }

  private updateAdaptiveState(
    state: AdaptiveState,
    correct: boolean,
    currentFrames: number,
    minFrames: number,
    maxFrames: number,
    minStep: number,
    refreshMs: number,
  ): AdaptiveState {
    const nextDirection: Direction = correct ? 'down' : 'up';
    const reversed = state.direction !== nextDirection;
    const reversals = reversed ? [...state.reversals, FramesToMs(currentFrames, refreshMs)] : state.reversals;
    const halvedStep = reversed ? Math.max(minStep, Math.floor(state.stepFrames / 2)) : state.stepFrames;
    const limitStreak = (correct && currentFrames <= minFrames) || (!correct && currentFrames >= maxFrames)
      ? state.limitStreak + 1
      : 0;
    const failAtMaxStreak = !correct && currentFrames >= maxFrames ? state.failAtMaxStreak + 1 : 0;

    return {
      direction: nextDirection,
      stepFrames: halvedStep,
      reversals,
      limitStreak,
      failAtMaxStreak,
    };
  }

  private nextDurationFrames(
    currentFrames: number,
    correct: boolean,
    stepFrames: number,
    minFrames: number,
    maxFrames: number,
  ) {
    const delta = correct ? -stepFrames : stepFrames;
    return Clamp(currentFrames + delta, minFrames, maxFrames);
  }

  private async runTrial(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    subtest: Subtest,
    stimulus: TrialStimulus,
    refreshMs: number,
  ): Promise<TrialRecord> {
    const stage = EnsurePeripheralAttentionCanvasStage(displayElement, labels.subtests[stimulus.subtestId]);
    const maskImageData = PreparePeripheralAttentionNoiseMask(stage);

    this.renderStage(displayElement, labels, 'fixation', subtest, stimulus);
    await WaitMs(this.jsPsych, fixationMs);

    const timing = await this.presentStimulus(stage, labels, subtest, stimulus, maskImageData, refreshMs);
    await WaitMs(this.jsPsych, maskMs);

    const startTime = performance.now();
    const centralResponse = await this.askCentral(displayElement, labels);
    const peripheralResponse = subtest.hasPeripheral ? await this.askAxis(displayElement, labels) : undefined;
    const responseTimeMs = performance.now() - startTime;

    const correct = centralResponse === stimulus.centralTarget
      && (!subtest.hasPeripheral || peripheralResponse === stimulus.peripheralSlot?.axis);

    return {
      subtestId: stimulus.subtestId,
      practice: stimulus.practice,
      trialNumber: stimulus.trialNumber,
      durationFrames: stimulus.durationFrames,
      displayFrameCount: stimulus.displayFrameCount,
      plannedDurationMs: stimulus.plannedDurationMs,
      durationMs: FramesToMs(stimulus.durationFrames, refreshMs),
      actualDurationMs: timing.actualDurationMs,
      actualFrameCount: timing.actualFrameCount,
      droppedFrameCount: timing.droppedFrameCount,
      centralTarget: stimulus.centralTarget,
      centralResponse,
      peripheralAxis: stimulus.peripheralSlot?.axis,
      peripheralResponse,
      correct,
      responseTimeMs,
    };
  }

  private presentStimulus(
    stage: HTMLElement,
    labels: PeripheralAttentionLabels,
    subtest: Subtest,
    stimulus: TrialStimulus,
    maskImageData: ImageData | null,
    refreshMs: number,
  ) {
    return new Promise<{ actualDurationMs: number; actualFrameCount: number; droppedFrameCount: number }>((resolve) => {
      let startTimestamp = 0;
      let elapsedFrames = 0;

      window.requestAnimationFrame((firstTimestamp) => {
        startTimestamp = firstTimestamp;
        DrawPeripheralAttentionCanvasStage(stage, this.getCanvasStageOptions(labels, 'stimulus', subtest, stimulus));

        if (stimulus.displayFrameCount <= 1) {
          window.requestAnimationFrame((nextTimestamp) => {
            DrawPeripheralAttentionCanvasStage(stage, this.getCanvasStageOptions(labels, 'mask', subtest, stimulus, maskImageData));
            const actualDurationMs = nextTimestamp - startTimestamp;
            resolve({
              actualDurationMs,
              actualFrameCount: 1,
              droppedFrameCount: Math.max(0, Math.round(actualDurationMs / refreshMs) - 1),
            });
          });
          return;
        }

        const tick = (nextTimestamp: number) => {
          elapsedFrames += 1;
          if (elapsedFrames >= stimulus.displayFrameCount) {
            DrawPeripheralAttentionCanvasStage(stage, this.getCanvasStageOptions(labels, 'mask', subtest, stimulus, maskImageData));
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

  private renderStage(displayElement: HTMLElement, labels: PeripheralAttentionLabels, phase: 'fixation' | 'stimulus' | 'mask', subtest: Subtest, stimulus: TrialStimulus) {
    RenderPeripheralAttentionCanvasStage(displayElement, this.getCanvasStageOptions(labels, phase, subtest, stimulus));
  }

  private getCanvasStageOptions(
    labels: PeripheralAttentionLabels,
    phase: PeripheralAttentionCanvasPhase,
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
      slots: slots,
      maskImageData,
    };
  }

  private askCentral(displayElement: HTMLElement, labels: PeripheralAttentionLabels) {
    return new Promise<CentralTarget>((resolve) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const row = document.createElement('div');
      row.className = 'ufov-choice-row';
      row.append(
        VehicleButton('car', labels, () => resolve('car')),
        VehicleButton('truck', labels, () => resolve('truck')),
      );
      stage.appendChild(row);
      displayElement.replaceChildren(stage);
    });
  }

  private askAxis(displayElement: HTMLElement, labels: PeripheralAttentionLabels) {
    return new Promise<number>((resolve) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const pad = document.createElement('div');
      pad.className = 'ufov-axis-pad';
      axes.forEach((axis) => {
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
      axes.forEach((axis) => {
        const point = AxisPoint(axis, 27, true);
        const button = ResponseButton(
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

  private showFeedback(displayElement: HTMLElement, labels: PeripheralAttentionLabels, correct: boolean) {
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

export function PeripheralAttentionPage({
  appName,
  backPath,
  lang,
  moduleId,
  initialSubtestId = 1,
  initialMode = 'formal',
  autoStart = false,
  onSaveRecord,
}: PeripheralAttentionPageProps) {
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
  const [directionAccuracy, setDirectionAccuracy] = useState<PeripheralAttentionDirectionAccuracy[]>([]);
  const [savedRecord, setSavedRecord] = useState<PeripheralAttentionTrainingRecord | null>(null);

  const finishExperiment = useCallback((data: PeripheralAttentionExperimentData) => {
    const now = new Date();
    const isFormal = data.mode === 'formal';
    const correctCount = data.trials.filter((item) => item.correct).length;
    const nextDirectionAccuracy = GetPeripheralAttentionDirectionAccuracy(data.trials);
    const primaryResult = data.results[0];
    const thresholdProcessingSpeedMs = primaryResult ? RoundMs(primaryResult.thresholdMs) : 0;
    const processingSpeedMs = isFormal
      ? RoundMs(GetFastestCorrectStimulusDurationMs(data.trials, thresholdProcessingSpeedMs))
      : thresholdProcessingSpeedMs;
    const thresholds = isFormal
      ? Object.fromEntries(data.results.map((item) => [`subtest${item.subtestId}`, item.thresholdMs]))
      : {};
    const summary = data.results.map((item) => ({
      subtest: item.subtestId,
      processingSpeedMs: RoundMs(item.thresholdMs),
      trialCount: item.trialCount,
      aborted: item.aborted,
    }));
    const record: PeripheralAttentionTrainingRecord = {
      id: `ufov_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now.toISOString(),
      trainingDate: FormatDate(now),
      userName: GetAuthUserNameFromToken() || 'Signed-in user',
      moduleId,
      gameId: 'ufov',
      gameTitle: labels.title,
      difficulty: data.mode,
      details: {
        refreshMs: RoundMs(data.refresh_ms),
        refreshHz: RoundMs(data.refresh_hz),
        refresh60HzFamily: data.refresh_is_60hz_family,
        refreshDeviceKind: data.refresh_device_kind,
        displayFrameMs: RoundMs(data.refresh_ms),
        subtest: data.subtest_id,
        mode: data.mode,
        correctCount,
        trialCount: data.trials.length,
        processingSpeedMs,
        bestCorrectProcessingSpeedMs: processingSpeedMs,
        thresholdProcessingSpeedMs,
        summaryScoreMs: processingSpeedMs,
        ufovSummary: summary,
        ...thresholds,
        directionAccuracy: nextDirectionAccuracy,
        aborted: data.aborted,
      },
      detailRows: data.trials.map((item) => ({
        Subtest: item.subtestId,
        Phase: item.practice ? 'practice' : 'test',
        Trial: item.trialNumber,
        Target_Vehicle: item.centralTarget,
        Target_Vehicle_Label: FormatVehicle(item.centralTarget, labels),
        Peripheral_Axis: item.peripheralAxis ?? '',
        Peripheral_Direction: FormatAxis(item.peripheralAxis, labels),
        Correct: item.correct,
        Processing_Speed_ms: RoundMs(item.actualDurationMs),
        Requested_Display_Frames: item.durationFrames,
        Actual_Display_Frames: item.actualFrameCount,
        Dropped_Frames: item.droppedFrameCount,
        Actual_Duration_ms: RoundMs(item.actualDurationMs),
        Requested_Duration_ms: RoundMs(item.plannedDurationMs),
        Central_Response: item.centralResponse,
        Peripheral_Response: item.peripheralResponse ?? '',
        Peripheral_Response_Direction: FormatAxis(item.peripheralResponse, labels),
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
    void ExitFullscreenIfActive();
  }, [labels, moduleId, onSaveRecord]);

  const startRun = async (config: PeripheralAttentionRunConfig) => {
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
    await WaitForFullscreenLayout();

    const measured = await MeasureDisplayRefreshRate();
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
        const data = values[0] as Partial<PeripheralAttentionExperimentData> | undefined;
        if (!data?.results || !data.trials) return;
        finishExperiment(data as PeripheralAttentionExperimentData);
      },
    });
    jsPsychRef.current = jsPsych;

    jsPsych.run([{
      type: PeripheralAttentionExperimentPlugin,
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
    setDirectionAccuracy([]);
    setSavedRecord(null);
    void ExitFullscreenIfActive();
    navigate(backPath);
  }, [backPath, navigate]);

  useTrainingAbort({
    active: isRunning,
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
    void ExitFullscreenIfActive();
  }, []);

  useLayoutEffect(() => {
    document.body.classList.toggle('ufov-game-active', isRunning);
    return () => document.body.classList.remove('ufov-game-active');
  }, [isRunning]);

  return (
    <main className="page-content ufov-page" id="main-content">
      <section className="ufov-shell" aria-labelledby="peripheral-attention-title">
        <div className="ufov-panel">
          {!isRunning && (
            <>
              <h1 className="section-title" id="peripheral-attention-title">{labels.title}</h1>
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
            <section className="ufov-instructions" aria-labelledby="peripheral-attention-instructions-title">
              <h2 id="peripheral-attention-instructions-title">{labels.subtests[instructionSubtest]}</h2>
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
            <section className="ufov-results" aria-labelledby="peripheral-attention-results-title">
              <h2 className="section-title" id="peripheral-attention-results-title">{labels.results}</h2>
              <ResultSummary
                items={[
                  { label: labels.actualProcessingSpeed, value: `${RoundMs(Number(savedRecord.details?.processingSpeedMs ?? 0))} ms` },
                  ...results.map((item) => ({
                    label: labels.subtests[item.subtestId],
                    value: savedRecord.difficulty === 'formal'
                      ? `${Math.round(item.thresholdMs)} ms`
                      : FormatPracticeScore(savedRecord),
                    meta: (
                      <>
                        {' '}
                        <span className="ufov-result-meta">
                          {item.aborted ? labels.aborted : `${labels.trial}: ${GetResultTrialCount(savedRecord, item)}`}
                        </span>
                      </>
                    ),
                  })),
                  { label: labels.trial, value: savedRecord.detailRows?.length ?? 0 },
                ]}
              />
              {directionAccuracy.length > 0 && (
                <div className="ufov-table-wrap">
                  <h3 className="ufov-direction-accuracy-title">{labels.directionAccuracy}</h3>
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>{labels.tableDirection}</th>
                        <th>{labels.tableCorrect}</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {directionAccuracy.map((stat) => (
                        <tr key={stat.axis}>
                          <td>{FormatAxis(stat.axis, labels)}</td>
                          <td>{`${stat.correct}/${stat.total}`}</td>
                          <td>{`${stat.accuracyPercent}%`}</td>
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
                          {FormatVehicle(trial.centralTarget, labels)}
                        </td>
                        <td>{FormatAxis(trial.peripheralAxis, labels)}</td>
                        <td className={trial.correct ? 'result-success' : 'result-fail'}>
                          {trial.correct ? '✓' : '✗'}
                        </td>
                        <td>{RoundMs(trial.actualDurationMs)} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="config-summary">
                <strong>
                  {savedRecord.difficulty === 'formal'
                    ? onSaveRecord ? FormatSaveNote(labels, appName) : labels.csvOnlyNote
                    : `${labels.practiceResult} ${FormatPracticeScore(savedRecord)}`}
                </strong>
              </div>
              <TrainingResultActions
                className="config-actions ufov-result-actions"
                backLabel={labels.backHome}
                onBackHome={() => navigate(backPath)}
                hubLabel={labels.backLobby}
              />
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function FormatPracticeScore(record: PeripheralAttentionTrainingRecord) {
  return `${Number(record.details?.correctCount ?? 0)}/${Number(record.details?.trialCount ?? 0)}`;
}

function GetResultTrialCount(record: PeripheralAttentionTrainingRecord, result: SubtestResult) {
  return record.difficulty === 'formal'
    ? result.trialCount
    : Number(record.details?.trialCount ?? 0);
}

function ResponseButton(label: string, className: string, onClick: () => void, text = label) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick, { once: true });
  return button;
}

function VehicleButton(target: CentralTarget, labels: PeripheralAttentionLabels, onClick: () => void) {
  const button = ResponseButton(
    target === 'car' ? labels.car : labels.truck,
    'btn btn-primary ufov-choice',
    onClick,
    '',
  );
  button.appendChild(CreateStimulusSquare(target));
  return button;
}

function CreateStimulusSquare(target: CentralTarget) {
  const square = document.createElement('span');
  square.className = 'ufov-stimulus-square';
  square.appendChild(CreateVehicleIcon(target));
  return square;
}

function CreateVehicleIcon(target: CentralTarget) {
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

function CreateSlots(): Slot[] {
  return axes.flatMap((axis) => [9, 18, 27].map((radius, ring) => ({
    axis,
    ring,
    ...AxisPoint(axis, radius, true),
  })));
}

function PickPeripheralTargetSlot() {
  return peripheralTargetSlots[Math.floor(Math.random() * peripheralTargetSlots.length)];
}

function AxisPoint(axis: number, radius: number, compensateStageAspect = false) {
  const angle = (-90 + axis * 45) * Math.PI / 180;
  const yRadius = compensateStageAspect ? radius * (800 / 533) : radius;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * yRadius,
  };
}

function Clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function AverageTrialDuration(trials: TrialRecord[]) {
  if (trials.length === 0) return maxDurationMs;
  return trials.reduce((sum, trial) => sum + trial.durationMs, 0) / trials.length;
}

function WaitMs(jsPsych: JsPsych, durationMs: number) {
  return new Promise<void>((resolve) => {
    jsPsych.pluginAPI.setTimeout(resolve, durationMs);
  });
}

function MsToFrameCount(durationMs: number, refreshMs: number) {
  if (!Number.isFinite(refreshMs) || refreshMs <= 0) return Math.max(1, Math.round(durationMs / (1000 / 60)));
  return Math.max(1, Math.round(durationMs / refreshMs));
}

function FramesToMs(frames: number, refreshMs: number) {
  return frames * refreshMs;
}

function RoundMs(value: number) {
  return Number(value.toFixed(2));
}

function FormatVehicle(target: CentralTarget, labels: PeripheralAttentionLabels) {
  return target === 'car' ? labels.car : labels.truck;
}

function FormatAxis(axis: number | undefined, labels: PeripheralAttentionLabels) {
  return typeof axis === 'number' ? labels.directions[axis] : labels.noPeripheral;
}

function FormatSaveNote(labels: PeripheralAttentionLabels, appName: string) {
  return labels.saveNote.replace('{appName}', appName);
}

function FormatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

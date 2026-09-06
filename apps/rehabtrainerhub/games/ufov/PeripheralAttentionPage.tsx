// Canonical Hub-owned peripheral-attention module; bundled by the brain runtime.
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
  CalculatePeripheralAttentionScreenGeometry,
  CreatePeripheralAttentionCanvasSlots,
  DrawPeripheralAttentionCanvasStage,
  EnsurePeripheralAttentionCanvasStage,
  PreparePeripheralAttentionNoiseMask,
  RenderPeripheralAttentionCanvasStage,
  type PeripheralAttentionCanvasPhase,
  type PeripheralAttentionCanvasSlot,
  type PeripheralAttentionScreenGeometry,
} from '@rehab-trainer/ui/peripheralAttentionCanvas';
import {
  EstimatePeripheralAttentionThresholdMs,
  GetFastestCorrectStimulusDurationMs,
  ShouldStopPeripheralAttentionAdaptiveRun,
} from '@rehab-trainer/ui/peripheralAttentionResults';
import {
  EvaluatePeripheralAttentionFrameSync,
  GetPeripheralAttentionSyncRecoveryAction,
  ShouldCountPeripheralAttentionTrial,
  peripheralAttentionTrialRefreshOptions,
  type PeripheralAttentionFrameSyncMeasurement,
} from './peripheralAttentionTiming';
import { initJsPsych, JsPsych, ParameterType } from 'jspsych';
import type { JsPsychPlugin, TrialType } from 'jspsych';
import { useNavigate } from 'react-router-dom';
import '@rehab-trainer/ui/components/PeripheralAttentionPage.css';

type CentralTarget = 'car' | 'truck';
type Direction = 'up' | 'down';
export type SubtestId = 1 | 2 | 3;
export type PeripheralAttentionRunMode = 'instruction' | 'practice' | 'formal';
export type PeripheralAttentionStopCondition = 'adaptive_80' | 'fixed_trials';
export type PeripheralAttentionTargetAxis = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type UfovRunMode = PeripheralAttentionRunMode;
export type UfovTargetAxis = PeripheralAttentionTargetAxis;
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

export interface PeripheralAttentionPageProps {
  appName: string;
  backPath: string;
  lang: 'zh' | 'en';
  moduleId: string;
  subjectId?: string;
  initialSubtestId?: SubtestId;
  initialMode?: PeripheralAttentionRunMode;
  trialCount?: number;
  targetAxes?: PeripheralAttentionTargetAxis[];
  stopCondition?: PeripheralAttentionStopCondition;
  contrastPercent?: number;
  targetVisualAngleDeg?: number;
  vehicleVisualAngleDeg?: number;
  screenWidthCm?: number;
  screenHeightCm?: number;
  viewingDistanceCm?: number;
  autoStart?: boolean;
  onSaveRecord?: (record: PeripheralAttentionTrainingRecord) => Promise<void> | void;
}

export type UfovPageProps = PeripheralAttentionPageProps;

interface Subtest {
  id: SubtestId;
  hasPeripheral: boolean;
  hasDistractors: boolean;
}

type TargetSlot = PeripheralAttentionCanvasSlot & {
  axis: PeripheralAttentionTargetAxis;
  isTargetCandidate: true;
};

interface TrialStimulus {
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  desiredDurationMs: number;
  durationFrames: number;
  displayFrameCount: number;
  plannedDurationMs: number;
  centralTarget: CentralTarget;
  peripheralSlot?: TargetSlot;
}

interface TrialRecord extends PeripheralAttentionFrameSyncMeasurement {
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  durationFrames: number;
  displayFrameCount: number;
  plannedDurationMs: number;
  durationMs: number;
  refreshMs: number;
  refreshHz: number;
  refreshSampleCount: number;
  refreshStandardDeviationMs: number;
  syncRetryCount: number;
  centralTarget: CentralTarget;
  centralResponse: CentralTarget;
  peripheralAxis?: number;
  peripheralResponse?: number;
  correct: boolean;
  responseTimeMs: number;
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
  mouseTrajectory?: { x: number; y: number; t: number }[];
}

interface TimingAttemptRecord extends PeripheralAttentionFrameSyncMeasurement {
  subtestId: SubtestId;
  practice: boolean;
  trialNumber: number;
  attemptNumber: number;
  refreshMs: number;
  refreshHz: number;
  refreshSampleCount: number;
  refreshStandardDeviationMs: number;
}

interface TrialAttemptResult {
  timingAttempt: TimingAttemptRecord;
  record: TrialRecord | null;
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
  trialCount: number;
  targetAxes: readonly PeripheralAttentionTargetAxis[];
  stopCondition: PeripheralAttentionStopCondition;
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
  screenWidthCm: number;
  screenHeightCm: number;
  viewingDistanceCm: number;
  geometry: PeripheralAttentionScreenGeometry;
}

interface AdaptiveState {
  direction: Direction | null;
  stepMs: number;
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
    configured_trial_count: { type: ParameterType.INT };
    target_axes: { type: ParameterType.OBJECT };
    stop_condition: { type: ParameterType.STRING };
    contrast_percent: { type: ParameterType.FLOAT };
    target_visual_angle_deg: { type: ParameterType.FLOAT };
    vehicle_visual_angle_deg: { type: ParameterType.FLOAT };
    screen_width_cm: { type: ParameterType.FLOAT };
    screen_height_cm: { type: ParameterType.FLOAT };
    viewing_distance_cm: { type: ParameterType.FLOAT };
    refresh_ms: { type: ParameterType.FLOAT };
    refresh_hz: { type: ParameterType.FLOAT };
    refresh_is_60hz_family: { type: ParameterType.BOOL };
    refresh_device_kind: { type: ParameterType.STRING };
    trials: { type: ParameterType.OBJECT };
    timing_attempts: { type: ParameterType.OBJECT };
    invalid_timing_attempt_count: { type: ParameterType.INT };
    synchronization_pause_count: { type: ParameterType.INT };
    results: { type: ParameterType.OBJECT };
    aborted: { type: ParameterType.BOOL };
  };
}

interface PeripheralAttentionExperimentData {
  subtest_id: SubtestId;
  mode: PeripheralAttentionRunMode;
  configured_trial_count: number;
  target_axes: PeripheralAttentionTargetAxis[];
  stop_condition: PeripheralAttentionStopCondition;
  contrast_percent: number;
  target_visual_angle_deg: number;
  vehicle_visual_angle_deg: number;
  screen_width_cm: number;
  screen_height_cm: number;
  viewing_distance_cm: number;
  refresh_ms: number;
  refresh_hz: number;
  refresh_is_60hz_family: boolean;
  refresh_device_kind: DisplayRefreshInfo['deviceKind'];
  trials: TrialRecord[];
  timing_attempts: TimingAttemptRecord[];
  invalid_timing_attempt_count: number;
  synchronization_pause_count: number;
  results: SubtestResult[];
  aborted: boolean;
}

const subtests: readonly Subtest[] = [
  { id: 1, hasPeripheral: false, hasDistractors: false },
  { id: 2, hasPeripheral: true, hasDistractors: false },
  { id: 3, hasPeripheral: true, hasDistractors: true },
];
const practiceTrials = 5;
const defaultMaxTestTrials = 48;
const minConfiguredTestTrials = 1;
const maxConfiguredTestTrials = 240;
const minDurationFrames = 1;
const maxDurationMs = 500;
const practiceDurationMs = 250;
const fixationMs = 1000;
const maskMs = 500;
const startStepMs = 50;
const peripheralAttentionTargetAxes = [0, 1, 2, 3, 4, 5, 6, 7];
const outerRingIndex = 2;
const slots = CreatePeripheralAttentionCanvasSlots();
const peripheralTargetSlots = slots.filter((slot): slot is TargetSlot => (
  slot.ring === outerRingIndex && slot.isTargetCandidate && slot.axis !== null
));
const experimentRunAbortSignals = new WeakMap<JsPsych, AbortSignal>();

const directionArrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

const copy = {
  zh: {
    title: '周邊視野訓練',
    intro: '完成處理速度、分散注意力與選擇性注意力三階段活動。本活動為非醫療練習工具，結果不代表認知評估、診斷或治療建議。',
    restart: '重新開始',
    car: '汽車',
    truck: '卡車',
    correct: '正確',
    incorrect: '再試一次',
    trial: '題',
    results: '作答結果',
    aborted: '已中止',
    saveNote: '結果已存入 {appName} 訓練紀錄。',
    csvOnlyNote: '完整結果可下載為 CSV。',
    practiceResult: '練習答對',
    downloadCsv: '下載 CSV',
    downloadCsvClinical: '下載 CSV 數據',
    downloadJsonTrajectory: '下載 JSON (含軌跡)',
    backHome: '返回清單',
    backLobby: '返回大廳',
    actualProcessingSpeed: '刺激呈現時間',
    tableTrial: '題次',
    tableVehicle: '題目車子種類',
    tableDirection: '外圍車子方向',
    tableCorrect: '答對與否',
    tableProcessingSpeed: '刺激呈現時間',
    syncRetrying: '偵測到畫面更新不穩定，這一題不計分，正在重新同步。',
    syncPauseTitle: '已暫停以重新同步畫面',
    syncPauseBody: '剛才的題目沒有計入結果。請保持此頁顯示在前景，準備好後重新檢查畫面更新。',
    syncResume: '重新檢查並繼續',
    noPeripheral: '無',
    directions: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
    spatialDashboardTitle: '8 方向空間搜尋表現分析',
    spatialDashboardSubtitle: '計算在不同視野方向（上、右上、右、右下、下、左下、左、左上）的搜尋成功率與反應耗時',
    compassUntested: '未測試',
    compassGood: '良好',
    compassMid: '中等',
    compassPoor: '偏弱',
    compassTotal: '呈現次數',
    compassAvgRt: '平均作答反應',
    compassAvgDuration: '刺激呈現時間',
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
    title: 'Peripheral Visual Field Training',
    intro: 'Complete three stages for processing speed, divided attention, and selective attention. This is a non-medical practice tool; results are not cognitive assessments, diagnoses, or treatment advice.',
    restart: 'Restart',
    car: 'Car',
    truck: 'Truck',
    correct: 'Correct',
    incorrect: 'Try again',
    trial: 'Trial',
    results: 'Response Results',
    aborted: 'Aborted',
    saveNote: 'Saved to {appName} training records.',
    csvOnlyNote: 'Complete results can be downloaded as CSV.',
    practiceResult: 'Practice correct',
    downloadCsv: 'Download CSV',
    downloadCsvClinical: 'Download CSV Data',
    downloadJsonTrajectory: 'Download JSON (with Trajectory)',
    backHome: 'Back to List',
    backLobby: 'Back to Lobby',
    actualProcessingSpeed: 'Stimulus Presentation Time',
    tableTrial: 'Trial',
    tableVehicle: 'Target Vehicle',
    tableDirection: 'Peripheral Direction',
    tableCorrect: 'Correct',
    tableProcessingSpeed: 'Stimulus Time',
    syncRetrying: 'Display timing was unstable. This trial was not counted while timing resynchronizes.',
    syncPauseTitle: 'Paused to resynchronize the display',
    syncPauseBody: 'The previous trial was not counted. Keep this page visible, then check display timing again when ready.',
    syncResume: 'Check timing and continue',
    noPeripheral: 'None',
    directions: ['Up', 'Up right', 'Right', 'Down right', 'Down', 'Down left', 'Left', 'Up left'],
    spatialDashboardTitle: '8-Direction Spatial Search Performance',
    spatialDashboardSubtitle: 'Response rate and reaction time across visual field directions (Up, Up right, Right, Down right, Down, Down left, Left, Up left)',
    compassUntested: 'Untested',
    compassGood: 'Good',
    compassMid: 'Moderate',
    compassPoor: 'Needs attention',
    compassTotal: 'Presentations',
    compassAvgRt: 'Mean reaction time',
    compassAvgDuration: 'Stimulus duration',
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
};

const experimentPluginInfo: ExperimentPluginInfo = {
  name: 'peripheral-attention-experiment',
  version: '1.0.0',
  parameters: {
    labels: {
      type: ParameterType.OBJECT,
      default: undefined,
    },
    refresh_ms: {
      type: ParameterType.FLOAT,
      default: undefined,
    },
    refresh_hz: {
      type: ParameterType.FLOAT,
      default: undefined,
    },
    refresh_is_60hz_family: {
      type: ParameterType.BOOL,
      default: undefined,
    },
    refresh_device_kind: {
      type: ParameterType.STRING,
      default: undefined,
    },
    config: {
      type: ParameterType.OBJECT,
      default: undefined,
    },
  },
  data: {
    subtest_id: { type: ParameterType.INT },
    mode: { type: ParameterType.STRING },
    configured_trial_count: { type: ParameterType.INT },
    target_axes: { type: ParameterType.OBJECT },
    stop_condition: { type: ParameterType.STRING },
    contrast_percent: { type: ParameterType.FLOAT },
    target_visual_angle_deg: { type: ParameterType.FLOAT },
    vehicle_visual_angle_deg: { type: ParameterType.FLOAT },
    screen_width_cm: { type: ParameterType.FLOAT },
    screen_height_cm: { type: ParameterType.FLOAT },
    viewing_distance_cm: { type: ParameterType.FLOAT },
    refresh_ms: { type: ParameterType.FLOAT },
    refresh_hz: { type: ParameterType.FLOAT },
    refresh_is_60hz_family: { type: ParameterType.BOOL },
    refresh_device_kind: { type: ParameterType.STRING },
    trials: { type: ParameterType.OBJECT },
    timing_attempts: { type: ParameterType.OBJECT },
    invalid_timing_attempt_count: { type: ParameterType.INT },
    synchronization_pause_count: { type: ParameterType.INT },
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
    const abortSignal = experimentRunAbortSignals.get(this.jsPsych);
    ThrowIfPeripheralAttentionRunAborted(abortSignal);
    const labels = trial.labels as PeripheralAttentionLabels;
    const refreshMs = Number(trial.refresh_ms) || (1000 / 60);
    const config = trial.config as PeripheralAttentionRunConfig;
    const subtest = subtests.find((item) => item.id === config.subtestId) ?? subtests[0];
    const maxTestTrials = config.stopCondition === 'fixed_trials'
      ? NormalizeTrialCount(config.trialCount)
      : 60;
    const targetAxes = NormalizeTargetAxes(config.targetAxes);
    const trials: TrialRecord[] = [];
    const timingAttempts: TimingAttemptRecord[] = [];
    const results: SubtestResult[] = [];
    const isPracticeMode = config.mode === 'practice';
    const totalPracticeTrials = practiceTrials;
    let currentRefreshMs = refreshMs;
    let durationMs = isPracticeMode ? practiceDurationMs : maxDurationMs;
    let adaptiveState: AdaptiveState = {
      direction: null,
      stepMs: startStepMs,
      reversals: [],
      limitStreak: 0,
      failAtMaxStreak: 0,
    };
    let invalidTimingAttemptCount = 0;
    let synchronizationPauseCount = 0;
    let aborted = false;

    try {
      const practiceLimit = isPracticeMode ? totalPracticeTrials : 0;
      for (let index = 0; index < practiceLimit; index += 1) {
        const stimulus = this.createStimulus(subtest, true, index + 1, practiceDurationMs, currentRefreshMs, targetAxes);
        const attempt = await this.runTrial(displayElement, labels, subtest, stimulus, currentRefreshMs, config, 1, abortSignal);
        timingAttempts.push(attempt.timingAttempt);
        currentRefreshMs = attempt.timingAttempt.refreshMs;
        if (!attempt.timingAttempt.syncValid) invalidTimingAttemptCount += 1;
        if (!attempt.record) continue;
        trials.push(attempt.record);
        this.showFeedback(displayElement, labels, attempt.record.correct);
        await WaitMs(this.jsPsych, 300, abortSignal);
      }

      if (!isPracticeMode) {
        let testTrialNumber = 0;
        let attemptNumber = 0;
        let consecutiveInvalidAttempts = 0;
        while (testTrialNumber < maxTestTrials) {
          attemptNumber += 1;
          const stimulus = this.createStimulus(
            subtest,
            false,
            testTrialNumber + 1,
            durationMs,
            currentRefreshMs,
            targetAxes,
          );
          const attempt = await this.runTrial(
            displayElement,
            labels,
            subtest,
            stimulus,
            currentRefreshMs,
            config,
            attemptNumber,
            abortSignal,
          );
          timingAttempts.push(attempt.timingAttempt);
          currentRefreshMs = attempt.timingAttempt.refreshMs;
          const shouldCountTrial = ShouldCountPeripheralAttentionTrial(config.mode, attempt.timingAttempt.syncValid);
          if (!shouldCountTrial) {
            invalidTimingAttemptCount += 1;
            consecutiveInvalidAttempts += 1;
            if (GetPeripheralAttentionSyncRecoveryAction(consecutiveInvalidAttempts) === 'retry') {
              this.showSynchronizationRetry(displayElement, labels);
              await WaitMs(this.jsPsych, 450, abortSignal);
            } else {
              synchronizationPauseCount += 1;
              consecutiveInvalidAttempts = 0;
              await this.waitForSynchronizationResume(displayElement, labels, abortSignal);
            }
            continue;
          }

          const record = attempt.record;
          if (!record) throw new Error('Synchronized formal trial did not produce a response record.');
          record.syncRetryCount = attemptNumber - 1;
          trials.push(record);
          testTrialNumber += 1;
          attemptNumber = 0;
          consecutiveInvalidAttempts = 0;

          adaptiveState = this.updateAdaptiveState(
            adaptiveState,
            record.correct,
            record.durationMs,
            currentRefreshMs,
            maxDurationMs,
          );
          durationMs = this.nextDurationMs(
            record.durationMs,
            record.correct,
            adaptiveState.stepMs,
            currentRefreshMs,
            maxDurationMs,
          );

          if (config.stopCondition === 'fixed_trials' ? testTrialNumber >= maxTestTrials : ShouldStopPeripheralAttentionAdaptiveRun({
            testTrial: testTrialNumber,
            reversals: adaptiveState.reversals,
            refreshMs: currentRefreshMs,
            limitStreak: adaptiveState.limitStreak,
            failAtMaxStreak: adaptiveState.failAtMaxStreak,
          }, maxTestTrials)) {
            break;
          }
        }
      }
    } catch (error) {
      if (abortSignal?.aborted || IsPeripheralAttentionAbortError(error)) return;
      aborted = true;
    }

    ThrowIfPeripheralAttentionRunAborted(abortSignal);

    const testTrials = trials.filter((item) => !item.practice);
    const formalThreshold = EstimatePeripheralAttentionThresholdMs({
      testTrial: testTrials.length,
      reversals: adaptiveState.reversals,
      refreshMs: currentRefreshMs,
      limitStreak: adaptiveState.limitStreak,
      failAtMaxStreak: adaptiveState.failAtMaxStreak,
    }, testTrials, maxDurationMs);
    const practiceThreshold = isPracticeMode ? practiceDurationMs : AverageTrialDuration(trials);
    const thresholdMs = config.mode === 'formal' ? formalThreshold : practiceThreshold;

    results.push({
      subtestId: subtest.id,
      thresholdMs,
      trialCount: isPracticeMode ? trials.length : testTrials.length,
      aborted,
    });

    this.jsPsych.finishTrial({
      subtest_id: subtest.id,
      mode: config.mode,
      configured_trial_count: maxTestTrials,
      target_axes: targetAxes,
      stop_condition: config.stopCondition,
      contrast_percent: config.contrastPercent,
      target_visual_angle_deg: config.targetVisualAngleDeg,
      vehicle_visual_angle_deg: config.vehicleVisualAngleDeg,
      screen_width_cm: config.screenWidthCm,
      screen_height_cm: config.screenHeightCm,
      viewing_distance_cm: config.viewingDistanceCm,
      refresh_ms: Number(trial.refresh_ms) || refreshMs,
      refresh_hz: Number(trial.refresh_hz) || (1000 / refreshMs),
      refresh_is_60hz_family: Boolean(trial.refresh_is_60hz_family),
      refresh_device_kind: String(trial.refresh_device_kind || 'desktop') as DisplayRefreshInfo['deviceKind'],
      trials,
      timing_attempts: timingAttempts,
      invalid_timing_attempt_count: invalidTimingAttemptCount,
      synchronization_pause_count: synchronizationPauseCount,
      results,
      aborted,
    });
  }

  private createStimulus(
    subtest: Subtest,
    practice: boolean,
    trialNumber: number,
    desiredDurationMs: number,
    refreshMs: number,
    targetAxes: readonly PeripheralAttentionTargetAxis[],
  ): TrialStimulus {
    const durationFrames = Math.max(minDurationFrames, MsToFrameCount(desiredDurationMs, refreshMs));
    const centralTarget: CentralTarget = Math.random() < 0.5 ? 'car' : 'truck';
    const peripheralSlot = subtest.hasPeripheral ? PickPeripheralTargetSlot(targetAxes) : undefined;
    return {
      subtestId: subtest.id,
      practice,
      trialNumber,
      desiredDurationMs,
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
    currentDurationMs: number,
    refreshMs: number,
    maximumDurationMs: number,
  ): AdaptiveState {
    const nextDirection: Direction = correct ? 'down' : 'up';
    const reversed = state.direction !== null && state.direction !== nextDirection;
    const reversals = reversed ? [...state.reversals, currentDurationMs] : state.reversals;
    const halvedStep = reversed ? Math.max(refreshMs, state.stepMs * 0.75) : state.stepMs;
    const atMinimum = currentDurationMs <= refreshMs * 1.25;
    const atMaximum = currentDurationMs >= maximumDurationMs - refreshMs * 0.5;
    const limitStreak = (correct && atMinimum) || (!correct && atMaximum)
      ? state.limitStreak + 1
      : 0;
    const failAtMaxStreak = !correct && atMaximum ? state.failAtMaxStreak + 1 : 0;

    return {
      direction: nextDirection,
      stepMs: halvedStep,
      reversals,
      limitStreak,
      failAtMaxStreak,
    };
  }

  private nextDurationMs(
    currentDurationMs: number,
    correct: boolean,
    stepMs: number,
    minimumDurationMs: number,
    maximumDurationMs: number,
  ) {
    const delta = correct ? -stepMs : stepMs * 3;
    return Clamp(currentDurationMs + delta, minimumDurationMs, maximumDurationMs);
  }

  private async runTrial(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    subtest: Subtest,
    initialStimulus: TrialStimulus,
    fallbackRefreshMs: number,
    config: PeripheralAttentionRunConfig,
    attemptNumber: number,
    abortSignal?: AbortSignal,
  ): Promise<TrialAttemptResult> {
    const stage = EnsurePeripheralAttentionCanvasStage(displayElement, labels.subtests[initialStimulus.subtestId]);
    const maskImageData = PreparePeripheralAttentionNoiseMask(stage);

    this.renderStage(displayElement, labels, 'fixation', subtest, initialStimulus, config);
    const [trialRefresh] = await Promise.all([
      MeasureDisplayRefreshRate({ ...peripheralAttentionTrialRefreshOptions, signal: abortSignal }),
      WaitMs(this.jsPsych, fixationMs, abortSignal),
    ]);
    ThrowIfPeripheralAttentionRunAborted(abortSignal);
    const refreshMs = Number.isFinite(trialRefresh.refreshMs) && trialRefresh.refreshMs > 0
      ? trialRefresh.refreshMs
      : fallbackRefreshMs;
    const durationFrames = Math.max(minDurationFrames, MsToFrameCount(initialStimulus.desiredDurationMs, refreshMs));
    const stimulus: TrialStimulus = {
      ...initialStimulus,
      durationFrames,
      displayFrameCount: durationFrames,
      plannedDurationMs: FramesToMs(durationFrames, refreshMs),
    };

    const timing = await this.presentStimulus(
      stage,
      labels,
      subtest,
      stimulus,
      maskImageData,
      trialRefresh,
      config,
      abortSignal,
    );
    const timingAttempt: TimingAttemptRecord = {
      ...timing,
      subtestId: stimulus.subtestId,
      practice: stimulus.practice,
      trialNumber: stimulus.trialNumber,
      attemptNumber,
      refreshMs,
      refreshHz: refreshMs > 0 ? 1000 / refreshMs : 0,
      refreshSampleCount: trialRefresh.sampleCount,
      refreshStandardDeviationMs: trialRefresh.standardDeviationMs,
    };
    await WaitMs(this.jsPsych, maskMs, abortSignal);

    if (!ShouldCountPeripheralAttentionTrial(config.mode, timing.syncValid)) {
      return { timingAttempt, record: null };
    }

    const startTime = performance.now();
    const mouseTrajectory: { x: number; y: number; t: number }[] = [];
    const onMouseMove = (event: MouseEvent) => {
      mouseTrajectory.push({
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
        t: Math.round(performance.now() - startTime),
      });
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    let centralResponse: CentralTarget;
    let peripheralResponse: number | undefined;
    try {
      centralResponse = await this.askCentral(displayElement, labels, abortSignal);
      peripheralResponse = subtest.hasPeripheral
        ? await this.askAxis(displayElement, labels, abortSignal)
        : undefined;
    } finally {
      window.removeEventListener('mousemove', onMouseMove);
    }
    const responseTimeMs = performance.now() - startTime;

    const correct = centralResponse === stimulus.centralTarget
      && (!subtest.hasPeripheral || peripheralResponse === stimulus.peripheralSlot?.axis);

    const record: TrialRecord = {
      ...timing,
      subtestId: stimulus.subtestId,
      practice: stimulus.practice,
      trialNumber: stimulus.trialNumber,
      durationFrames: stimulus.durationFrames,
      displayFrameCount: stimulus.displayFrameCount,
      plannedDurationMs: stimulus.plannedDurationMs,
      durationMs: FramesToMs(stimulus.durationFrames, refreshMs),
      refreshMs,
      refreshHz: refreshMs > 0 ? 1000 / refreshMs : 0,
      refreshSampleCount: trialRefresh.sampleCount,
      refreshStandardDeviationMs: trialRefresh.standardDeviationMs,
      syncRetryCount: 0,
      centralTarget: stimulus.centralTarget,
      centralResponse,
      peripheralAxis: stimulus.peripheralSlot?.axis,
      peripheralResponse,
      correct,
      responseTimeMs,
      contrastPercent: config.contrastPercent,
      targetVisualAngleDeg: config.targetVisualAngleDeg,
      vehicleVisualAngleDeg: config.vehicleVisualAngleDeg,
      mouseTrajectory: mouseTrajectory.length > 0 ? mouseTrajectory : undefined,
    };
    return { timingAttempt, record };
  }

  private presentStimulus(
    stage: HTMLElement,
    labels: PeripheralAttentionLabels,
    subtest: Subtest,
    stimulus: TrialStimulus,
    maskImageData: ImageData | null,
    refreshInfo: DisplayRefreshInfo,
    config: PeripheralAttentionRunConfig,
    abortSignal?: AbortSignal,
  ) {
    return new Promise<PeripheralAttentionFrameSyncMeasurement>((resolve, reject) => {
      const frameTimestamps: number[] = [];
      let elapsedFrames = 0;
      let frameId = 0;
      let watchdogTimeoutId = 0;
      let finished = false;
      let visibilityInterrupted = typeof document !== 'undefined' && document.visibilityState !== 'visible';
      const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') visibilityInterrupted = true;
      };

      const cleanup = () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        if (watchdogTimeoutId) window.clearTimeout(watchdogTimeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        abortSignal?.removeEventListener('abort', abortPresentation);
      };
      const abortPresentation = () => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(CreatePeripheralAttentionAbortError());
      };
      const finishPresentation = () => {
        if (finished) return;
        finished = true;
        cleanup();
        DrawPeripheralAttentionCanvasStage(
          stage,
          this.getCanvasStageOptions(labels, 'mask', subtest, stimulus, maskImageData, config),
        );
        resolve(EvaluatePeripheralAttentionFrameSync({
          requestedFrameCount: stimulus.displayFrameCount,
          refreshMs: refreshInfo.refreshMs,
          refreshMeasured: refreshInfo.measured && !refreshInfo.isFallback,
          refreshStandardDeviationMs: refreshInfo.standardDeviationMs,
          frameTimestamps,
          visibilityInterrupted,
        }));
      };
      const scheduleFrame = (callback: (timestamp: number) => void) => {
        frameId = window.requestAnimationFrame((timestamp) => {
          frameId = 0;
          if (abortSignal?.aborted) {
            abortPresentation();
            return;
          }
          callback(timestamp);
        });
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      abortSignal?.addEventListener('abort', abortPresentation, { once: true });
      if (abortSignal?.aborted) {
        abortPresentation();
        return;
      }
      watchdogTimeoutId = window.setTimeout(
        finishPresentation,
        Math.max(1_000, stimulus.displayFrameCount * Math.max(refreshInfo.refreshMs, 1) * 4),
      );

      scheduleFrame((firstTimestamp) => {
        frameTimestamps.push(firstTimestamp);
        DrawPeripheralAttentionCanvasStage(stage, this.getCanvasStageOptions(labels, 'stimulus', subtest, stimulus, undefined, config));

        if (stimulus.displayFrameCount <= 1) {
          scheduleFrame((nextTimestamp) => {
            frameTimestamps.push(nextTimestamp);
            finishPresentation();
          });
          return;
        }

        const tick = (nextTimestamp: number) => {
          frameTimestamps.push(nextTimestamp);
          elapsedFrames += 1;
          if (elapsedFrames >= stimulus.displayFrameCount) {
            finishPresentation();
            return;
          }

          scheduleFrame(tick);
        };

        scheduleFrame(tick);
      });
    });
  }

  private renderStage(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    phase: 'fixation' | 'stimulus' | 'mask',
    subtest: Subtest,
    stimulus: TrialStimulus,
    config: PeripheralAttentionRunConfig,
  ) {
    RenderPeripheralAttentionCanvasStage(displayElement, this.getCanvasStageOptions(labels, phase, subtest, stimulus, undefined, config));
  }

  private getCanvasStageOptions(
    labels: PeripheralAttentionLabels,
    phase: PeripheralAttentionCanvasPhase,
    subtest: Subtest,
    stimulus: TrialStimulus,
    maskImageData?: ImageData | null,
    config?: PeripheralAttentionRunConfig,
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
      geometry: config?.geometry,
      contrastPercent: config?.contrastPercent,
    };
  }

  private askCentral(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    abortSignal?: AbortSignal,
  ) {
    return new Promise<CentralTarget>((resolve, reject) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const row = document.createElement('div');
      row.className = 'ufov-choice-row';
      const cleanup = () => abortSignal?.removeEventListener('abort', handleAbort);
      const finish = (response: CentralTarget) => {
        cleanup();
        resolve(response);
      };
      const handleAbort = () => {
        cleanup();
        reject(CreatePeripheralAttentionAbortError());
      };
      row.append(
        VehicleButton('car', labels, () => finish('car')),
        VehicleButton('truck', labels, () => finish('truck')),
      );
      stage.appendChild(row);
      displayElement.replaceChildren(stage);
      abortSignal?.addEventListener('abort', handleAbort, { once: true });
      if (abortSignal?.aborted) handleAbort();
    });
  }

  private askAxis(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    abortSignal?: AbortSignal,
  ) {
    return new Promise<number>((resolve, reject) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const pad = document.createElement('div');
      pad.className = 'ufov-axis-pad';
      peripheralAttentionTargetAxes.forEach((axis) => {
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
      const cleanup = () => abortSignal?.removeEventListener('abort', handleAbort);
      const finish = (axis: number) => {
        cleanup();
        resolve(axis);
      };
      const handleAbort = () => {
        cleanup();
        reject(CreatePeripheralAttentionAbortError());
      };
      peripheralAttentionTargetAxes.forEach((axis) => {
        const point = AxisPoint(axis, 27, true);
        const button = ResponseButton(
          `${axis + 1}. ${labels.directions[axis]}`,
          'ufov-axis-button',
          () => finish(axis),
          String(axis + 1),
        );
        button.style.left = `${point.x}%`;
        button.style.top = `${point.y}%`;
        pad.appendChild(button);
      });
      stage.appendChild(pad);
      displayElement.replaceChildren(stage);
      abortSignal?.addEventListener('abort', handleAbort, { once: true });
      if (abortSignal?.aborted) handleAbort();
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

  private showSynchronizationRetry(displayElement: HTMLElement, labels: PeripheralAttentionLabels) {
    const stage = document.createElement('div');
    stage.className = 'ufov-stage ufov-response-stage';
    const message = document.createElement('p');
    message.className = 'ufov-feedback';
    message.textContent = labels.syncRetrying;
    message.setAttribute('role', 'status');
    stage.appendChild(message);
    displayElement.replaceChildren(stage);
  }

  private waitForSynchronizationResume(
    displayElement: HTMLElement,
    labels: PeripheralAttentionLabels,
    abortSignal?: AbortSignal,
  ) {
    return new Promise<void>((resolve, reject) => {
      const stage = document.createElement('div');
      stage.className = 'ufov-stage ufov-response-stage';
      const panel = document.createElement('div');
      panel.className = 'ufov-sync-pause';
      const title = document.createElement('h2');
      title.textContent = labels.syncPauseTitle;
      const body = document.createElement('p');
      body.textContent = labels.syncPauseBody;
      const cleanup = () => abortSignal?.removeEventListener('abort', handleAbort);
      const resume = () => {
        cleanup();
        resolve();
      };
      const handleAbort = () => {
        cleanup();
        reject(CreatePeripheralAttentionAbortError());
      };
      const button = ResponseButton(labels.syncResume, 'btn btn-primary btn-lg', resume);
      panel.append(title, body, button);
      stage.appendChild(panel);
      displayElement.replaceChildren(stage);
      button.focus();
      abortSignal?.addEventListener('abort', handleAbort, { once: true });
      if (abortSignal?.aborted) handleAbort();
    });
  }
}

export function PeripheralAttentionPage({
  appName,
  backPath,
  lang,
  moduleId,
  subjectId = '',
  initialSubtestId = 1,
  initialMode = 'formal',
  trialCount = defaultMaxTestTrials,
  targetAxes = [...peripheralAttentionTargetAxes] as PeripheralAttentionTargetAxis[],
  stopCondition = 'adaptive_80',
  contrastPercent = 100,
  targetVisualAngleDeg = 15,
  vehicleVisualAngleDeg = 2.5,
  screenWidthCm = 53.1,
  screenHeightCm = 29.9,
  viewingDistanceCm = 50,
  autoStart = false,
  onSaveRecord,
}: PeripheralAttentionPageProps) {
  const navigate = useNavigate();
  const labels = copy[lang];
  const displayRef = useRef<HTMLDivElement | null>(null);
  const jsPsychRef = useRef<ReturnType<typeof initJsPsych> | null>(null);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const runGenerationRef = useRef(0);
  const allowProgrammaticFullscreenExitRef = useRef(false);
  const autoStartRef = useRef(false);
  const [isRunning, setIsRunning] = useState(autoStart && initialMode !== 'instruction');
  const [instructionSubtest, setInstructionSubtest] = useState<SubtestId | null>(null);
  const [results, setResults] = useState<SubtestResult[]>([]);
  const [resultTrials, setResultTrials] = useState<TrialRecord[]>([]);
  const [savedRecord, setSavedRecord] = useState<PeripheralAttentionTrainingRecord | null>(null);

  const finishExperiment = useCallback((data: PeripheralAttentionExperimentData) => {
    const now = new Date();
    const isFormal = data.mode === 'formal';
    const formalTrials = data.trials.filter((item) => !item.practice);
    const correctCount = data.trials.filter((item) => item.correct).length;
    const invalidTimingReasonCounts = data.timing_attempts.reduce<Record<string, number>>((counts, attempt) => {
      if (attempt.syncValid) return counts;
      counts[attempt.syncReason] = (counts[attempt.syncReason] ?? 0) + 1;
      return counts;
    }, {});
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
        subjectId: subjectId || GetAuthUserNameFromToken() || 'participant',
        refreshMs: RoundMs(data.refresh_ms),
        refreshHz: RoundMs(data.refresh_hz),
        refresh60HzFamily: data.refresh_is_60hz_family,
        refreshDeviceKind: data.refresh_device_kind,
        displayFrameMs: RoundMs(data.refresh_ms),
        subtest: data.subtest_id,
        mode: data.mode,
        configuredTrialCount: data.configured_trial_count,
        stopCondition: data.stop_condition,
        confidenceThreshold: data.stop_condition === 'adaptive_80' ? '80%' : '',
        contrastPercent: data.contrast_percent,
        targetVisualAngleDeg: data.target_visual_angle_deg,
        vehicleVisualAngleDeg: data.vehicle_visual_angle_deg,
        screenWidthCm: data.screen_width_cm,
        screenHeightCm: data.screen_height_cm,
        viewingDistanceCm: data.viewing_distance_cm,
        targetAxes: data.target_axes,
        targetDirections: data.target_axes.map((axis) => FormatAxis(axis, labels)).join(' | '),
        correctCount,
        trialCount: data.trials.length,
        perTrialRafTimingMeasured: true,
        allFormalTrialsSynchronized: isFormal
          ? formalTrials.length > 0 && formalTrials.every((item) => item.syncValid)
          : null,
        timingAttemptCount: data.timing_attempts.length,
        invalidTimingAttemptCount: data.invalid_timing_attempt_count,
        invalidTimingReasonCounts,
        synchronizationPauseCount: data.synchronization_pause_count,
        processingSpeedMs,
        bestCorrectProcessingSpeedMs: processingSpeedMs,
        thresholdProcessingSpeedMs,
        summaryScoreMs: processingSpeedMs,
        ufovSummary: summary,
        ...thresholds,
        aborted: data.aborted,
        mouseTrajectorySampleCount: data.trials.reduce((sum, item) => sum + (item.mouseTrajectory?.length ?? 0), 0),
      },
      detailRows: data.trials.map((item) => ({
        Subject_ID: subjectId || '-',
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
        Estimated_Display_Frames: item.estimatedDisplayFrameCount,
        Dropped_Frames: item.droppedFrameCount,
        Actual_Duration_ms: RoundMs(item.actualDurationMs),
        Requested_Duration_ms: RoundMs(StimulusDuration(item)),
        Frame_Sync_Valid: item.syncValid,
        Frame_Sync_Reason: item.syncReason,
        Per_Trial_Refresh_ms: RoundMs(item.refreshMs),
        Per_Trial_Refresh_Hz: RoundMs(item.refreshHz),
        Per_Trial_Refresh_Samples: item.refreshSampleCount,
        Per_Trial_Refresh_SD_ms: RoundMs(item.refreshStandardDeviationMs),
        Measured_Frame_ms: RoundMs(item.measuredFrameMs),
        Measured_Frame_Jitter_ms: RoundMs(item.frameJitterMs),
        Max_Frame_Interval_ms: RoundMs(item.maxFrameIntervalMs),
        Sync_Retry_Count: item.syncRetryCount,
        Central_Response: item.centralResponse,
        Peripheral_Response: item.peripheralResponse ?? '',
        Peripheral_Response_Direction: FormatAxis(item.peripheralResponse, labels),
        Response_Time_ms: Math.round(item.responseTimeMs),
        Contrast_Percent: item.contrastPercent,
        Target_Visual_Angle_Deg: item.targetVisualAngleDeg,
        Vehicle_Visual_Angle_Deg: item.vehicleVisualAngleDeg,
        Mouse_Trajectory_Samples: item.mouseTrajectory?.length ?? 0,
      })),
    };
    setResults(data.results);
    setResultTrials(data.trials);
    setSavedRecord(record);
    setIsRunning(false);
    jsPsychRef.current = null;
    void onSaveRecord?.(record);
    allowProgrammaticFullscreenExitRef.current = true;
    void ExitFullscreenIfActive();
  }, [labels, moduleId, onSaveRecord, subjectId]);

  const startRun = async (config: PeripheralAttentionRunConfig) => {
    const displayElement = displayRef.current;
    if (!displayElement) return;
    runGenerationRef.current += 1;
    const runGeneration = runGenerationRef.current;
    runAbortControllerRef.current?.abort();
    if (jsPsychRef.current) {
      jsPsychRef.current.abortExperiment();
      jsPsychRef.current = null;
    }
    const runAbortController = new AbortController();
    const abortSignal = runAbortController.signal;
    runAbortControllerRef.current = runAbortController;
    const isCurrentRun = () => (
      !abortSignal.aborted
      && runGenerationRef.current === runGeneration
      && displayRef.current === displayElement
    );
    displayElement.replaceChildren();
    setInstructionSubtest(null);
    setSavedRecord(null);
    setResults([]);
    setResultTrials([]);
    setIsRunning(true);
    document.body.classList.add('ufov-game-active');
    await WaitForFullscreenLayout();
    if (!isCurrentRun()) return;

    const measured = await MeasureDisplayRefreshRate({ signal: abortSignal });
    if (!isCurrentRun()) return;
    const runConfig = measured.isMobileOrTablet && config.subtestId !== 1
      ? { ...config, subtestId: 1 as SubtestId }
      : config;

    const jsPsych = initJsPsych({
      display_element: displayElement,
      on_finish: () => {
        if (!isCurrentRun()) return;
        const values = jsPsych.data.get().last(1).values();
        const data = values[0] as Partial<PeripheralAttentionExperimentData> | undefined;
        if (!data?.results || !data.trials) return;
        experimentRunAbortSignals.delete(jsPsych);
        if (runAbortControllerRef.current === runAbortController) {
          runAbortControllerRef.current = null;
        }
        finishExperiment(data as PeripheralAttentionExperimentData);
      },
    });
    experimentRunAbortSignals.set(jsPsych, abortSignal);
    jsPsychRef.current = jsPsych;

    void jsPsych.run([{
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
    runGenerationRef.current += 1;
    runAbortControllerRef.current?.abort();
    runAbortControllerRef.current = null;
    if (jsPsychRef.current) {
      jsPsychRef.current.abortExperiment();
      jsPsychRef.current = null;
    }
    setIsRunning(false);
    setInstructionSubtest(null);
    setResults([]);
    setResultTrials([]);
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
    void startRun({
      subtestId: initialSubtestId,
      mode: initialMode,
      trialCount,
      targetAxes,
      stopCondition,
      contrastPercent: Clamp(contrastPercent, 5, 100),
      targetVisualAngleDeg: Clamp(targetVisualAngleDeg, 5, 35),
      vehicleVisualAngleDeg: Clamp(vehicleVisualAngleDeg, .8, 5),
      screenWidthCm: Clamp(screenWidthCm, 10, 250),
      screenHeightCm: Clamp(screenHeightCm, 10, 200),
      viewingDistanceCm: Clamp(viewingDistanceCm, 20, 300),
      geometry: CalculatePeripheralAttentionScreenGeometry(
        Clamp(screenWidthCm, 10, 250),
        Clamp(screenHeightCm, 10, 200),
        Clamp(viewingDistanceCm, 20, 300),
        Clamp(targetVisualAngleDeg, 5, 35),
        Clamp(vehicleVisualAngleDeg, .8, 5),
      ),
    });
  }, [autoStart, contrastPercent, initialMode, initialSubtestId, savedRecord, screenHeightCm, screenWidthCm, stopCondition, targetAxes, targetVisualAngleDeg, trialCount, vehicleVisualAngleDeg, viewingDistanceCm]);

  useEffect(() => () => {
    runGenerationRef.current += 1;
    runAbortControllerRef.current?.abort();
    runAbortControllerRef.current = null;
    if (jsPsychRef.current) {
      jsPsychRef.current.abortExperiment();
    }
    jsPsychRef.current = null;
    void ExitFullscreenIfActive();
  }, []);

  useLayoutEffect(() => {
    document.body.classList.toggle('ufov-game-active', isRunning);
    return () => document.body.classList.remove('ufov-game-active');
  }, [isRunning]);

  const dirStats = peripheralAttentionTargetAxes.map((axis) => {
    const dirTrials = resultTrials.filter((t) => !t.practice && t.peripheralAxis === axis);
    const dirCorrect = dirTrials.filter((t) => t.correct).length;
    const totalCount = dirTrials.length;
    const acc = totalCount > 0 ? Math.round((dirCorrect / totalCount) * 100) : null;
    const avgRt = totalCount > 0 ? Math.round(dirTrials.reduce((s, t) => s + (t.responseTimeMs || 0), 0) / totalCount) : 0;
    const avgDuration = totalCount > 0 ? RoundMs(dirTrials.reduce((s, t) => s + (t.actualDurationMs || t.durationMs || 0), 0) / totalCount) : 0;

    let tagClass = 'tag-none';
    let tagText = labels.compassUntested;
    if (acc !== null) {
      if (acc >= 80) {
        tagClass = 'tag-good';
        tagText = `${acc}% ${labels.compassGood}`;
      } else if (acc >= 50) {
        tagClass = 'tag-mid';
        tagText = `${acc}% ${labels.compassMid}`;
      } else {
        tagClass = 'tag-poor';
        tagText = `${acc}% ${labels.compassPoor}`;
      }
    }

    return {
      axis,
      name: labels.directions[axis],
      arrow: directionArrows[axis] ?? '',
      totalCount,
      acc,
      avgRt,
      avgDuration,
      tagClass,
      tagText,
    };
  });

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
              {Number(savedRecord.details?.subtest) !== 1 && (
                <div className="spatial-dashboard">
                  <div className="spatial-dashboard-title">
                    <h3>{labels.spatialDashboardTitle}</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      {labels.spatialDashboardSubtitle}
                    </p>
                  </div>
                  <div className="spatial-grid-compass">
                    {dirStats.map((dir) => (
                      <div key={dir.axis} className="compass-card">
                        <div className="compass-card-header">
                          <span className="compass-card-dir">
                            <span style={{ fontSize: '16px' }}>{dir.arrow}</span>
                            <span>{dir.name}</span>
                          </span>
                          <span className={`compass-card-tag ${dir.tagClass}`}>{dir.tagText}</span>
                        </div>
                        <div className="compass-card-stats">
                          <span>{labels.compassTotal}：<strong>{dir.totalCount} {labels.trial}</strong></span>
                          <span>{labels.compassAvgRt}：<strong>{dir.avgRt > 0 ? `${dir.avgRt} ms` : '--'}</strong></span>
                          <span>{labels.compassAvgDuration}：<strong>{dir.avgDuration > 0 ? `${dir.avgDuration} ms` : '--'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
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
              <div className="ufov-export-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => ExportAutoDownloadCsvs(savedRecord, resultTrials, labels, subjectId, Number(savedRecord.details?.subtest ?? 1) as SubtestId)}
                >
                  {labels.downloadCsvClinical}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => ExportJsonData(savedRecord, resultTrials, labels, subjectId, Number(savedRecord.details?.subtest ?? 1) as SubtestId)}
                >
                  {labels.downloadJsonTrajectory}
                </button>
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

function StimulusDuration(item: TrialRecord) {
  return item.plannedDurationMs;
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
  const svgNs = 'http://www.w3.org/2000/svg';
  const vehicle = document.createElementNS(svgNs, 'svg');
  vehicle.setAttribute('viewBox', '0 0 72 56');
  vehicle.setAttribute('class', `ufov-vehicle ufov-vehicle-${target}`);
  vehicle.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(svgNs, 'path');
  body.setAttribute('fill', '#fff');
  body.setAttribute('d', target === 'car'
    ? 'M 21 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 14.2 6.5 Q 16.5 1.5 21 1.5 Z'
    : 'M 38.8 1.5 L 51 1.5 Q 55.5 1.5 57.8 6.5 L 71.5 38.5 Q 73.5 43.5 68 44.5 L 66.5 44.5 A 12 12 0 0 0 42.5 44.5 L 42.5 46 L 29.5 46 L 29.5 44.5 A 12 12 0 0 0 5.5 44.5 L 4.5 44.5 Q -1.5 43.5 .5 38.5 L 3.5 31.5 L 37.5 31.5 L 37.5 3.5 Q 37.5 1.5 38.8 1.5 Z');
  vehicle.appendChild(body);
  const windows = target === 'car'
    ? [
        'M 24.5 5.5 L 30.2 5.5 Q 33.2 5.5 33.2 8.5 L 33.2 18.5 Q 33.2 21.5 30.2 21.5 L 17.5 21.5 Q 14.5 21.5 15.5 18.5 L 20 8.5 Q 21 5.5 24.5 5.5 Z',
        'M 41.8 5.5 L 47.5 5.5 Q 51 5.5 52 8.5 L 56.5 18.5 Q 57.5 21.5 54.5 21.5 L 41.8 21.5 Q 38.8 21.5 38.8 18.5 L 38.8 8.5 Q 38.8 5.5 41.8 5.5 Z',
      ]
    : ['M 41.8 5.5 L 47.5 5.5 Q 51 5.5 52 8.5 L 56.5 18.5 Q 57.5 21.5 54.5 21.5 L 41.8 21.5 Q 38.8 21.5 38.8 18.5 L 38.8 8.5 Q 38.8 5.5 41.8 5.5 Z'];
  windows.forEach((d) => {
    const windowPath = document.createElementNS(svgNs, 'path');
    windowPath.setAttribute('d', d);
    windowPath.setAttribute('fill', '#000');
    vehicle.appendChild(windowPath);
  });
  [17.5, 54.5].forEach((cx) => {
    const wheel = document.createElementNS(svgNs, 'circle');
    wheel.setAttribute('cx', String(cx)); wheel.setAttribute('cy', '44.5'); wheel.setAttribute('r', '8.5'); wheel.setAttribute('fill', '#fff');
    vehicle.appendChild(wheel);
  });
  return vehicle;
}

function PickPeripheralTargetSlot(targetAxes: readonly PeripheralAttentionTargetAxis[]) {
  const candidates = peripheralTargetSlots.filter((slot) => targetAxes.includes(slot.axis));
  const availableSlots = candidates.length > 0 ? candidates : peripheralTargetSlots;
  return availableSlots[Math.floor(Math.random() * availableSlots.length)];
}

function Clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NormalizeTrialCount(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return defaultMaxTestTrials;
  return Math.round(Clamp(numeric, minConfiguredTestTrials, maxConfiguredTestTrials));
}

function NormalizeTargetAxes(value: unknown): PeripheralAttentionTargetAxis[] {
  if (!Array.isArray(value)) return [...peripheralAttentionTargetAxes] as PeripheralAttentionTargetAxis[];

  const normalizedAxes = Array.from(new Set(
    value
      .map((item) => Number(item))
      .filter((item): item is PeripheralAttentionTargetAxis => Number.isInteger(item) && peripheralAttentionTargetAxes.includes(item)),
  ));

  return normalizedAxes.length > 0 ? normalizedAxes : [...peripheralAttentionTargetAxes] as PeripheralAttentionTargetAxis[];
}

function AverageTrialDuration(trials: TrialRecord[]) {
  if (trials.length === 0) return maxDurationMs;
  return trials.reduce((sum, trial) => sum + trial.durationMs, 0) / trials.length;
}

class PeripheralAttentionAbortError extends Error {
  constructor() {
    super('Peripheral attention run aborted.');
    this.name = 'AbortError';
  }
}

function CreatePeripheralAttentionAbortError() {
  return new PeripheralAttentionAbortError();
}

function IsPeripheralAttentionAbortError(error: unknown) {
  return error instanceof PeripheralAttentionAbortError;
}

function ThrowIfPeripheralAttentionRunAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw CreatePeripheralAttentionAbortError();
}

function WaitMs(jsPsych: JsPsych, durationMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', handleAbort);
      callback();
    };
    const timeoutId = jsPsych.pluginAPI.setTimeout(() => finish(resolve), durationMs);
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      finish(() => reject(CreatePeripheralAttentionAbortError()));
    };
    signal?.addEventListener('abort', handleAbort, { once: true });
    if (signal?.aborted) handleAbort();
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

function CsvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function TriggerDownload(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (error) {
    console.error('Failed to trigger download:', error);
  }
}

function ExportAutoDownloadCsvs(
  record: PeripheralAttentionTrainingRecord,
  trials: TrialRecord[],
  labels: PeripheralAttentionLabels,
  subjectId: string,
  subtestId: SubtestId,
) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const subtestCode = `Subtest${subtestId}`;

  const rawScoreFilename = `${dateStr}-${timeStr}-${subtestCode}-原始分數.csv`;
  const rawScoreHeaders = [
    '受試者代號',
    '測驗日期',
    '測驗時間',
    'Subtest項目代碼',
    'Subtest項目名稱',
    '題次序號',
    '題次類型',
    '設定呈現時間 (ms)',
    '實際呈現時間 (ms)',
    '呈現影格數',
    '遺失影格數',
    '螢幕更新率 (Hz)',
    '對比度 (%)',
    '車輛大小視角 (度)',
    '周邊偏心視角 (度)',
    '中央目標種類',
    '中央作答選擇',
    '中央作答正確',
    '周邊目標方位代碼',
    '周邊目標方位名稱',
    '周邊作答選擇代碼',
    '周邊作答選擇名稱',
    '周邊作答正確',
    '本題整體判定',
    '作答反應時間 (ms)',
    '滑鼠軌跡取樣數',
    '滑鼠軌跡數據 (JSON)',
  ];

  const rawScoreRows = trials.map((t, idx) => {
    const trialNum = t.trialNumber || (idx + 1);
    const isPractice = Boolean(t.practice);
    const plannedMs = RoundMs(Number(t.plannedDurationMs || t.durationMs || 0));
    const actualMs = RoundMs(Number(t.actualDurationMs || t.durationMs || 0));
    const frames = t.actualFrameCount || t.durationFrames || 0;
    const dropped = t.droppedFrameCount || 0;
    const fps = RoundMs(t.refreshHz || 60);
    const contrastStr = `${t.contrastPercent ?? 100}%`;
    const vehicleSizeStr = `${(t.vehicleVisualAngleDeg ?? 2.5).toFixed(1)}°`;
    const targetAngleStr = `${(t.targetVisualAngleDeg ?? 15).toFixed(1)}°`;

    const centralTargetName = t.centralTarget === 'car' ? labels.car : labels.truck;
    const centralRespName = t.centralResponse === 'car' ? labels.car : (t.centralResponse === 'truck' ? labels.truck : (t.centralResponse || ''));
    const centralCorrectStr = t.centralResponse === t.centralTarget ? 'TRUE' : 'FALSE';

    const hasPeri = typeof t.peripheralAxis === 'number';
    const periAxis = hasPeri ? t.peripheralAxis : 'N/A';
    const periDirName = hasPeri ? (labels.directions[t.peripheralAxis!] ?? String(t.peripheralAxis)) : labels.noPeripheral;

    const hasPeriResp = typeof t.peripheralResponse === 'number';
    const periRespAxis = hasPeriResp ? t.peripheralResponse : 'N/A';
    const periRespDirName = hasPeriResp ? (labels.directions[t.peripheralResponse!] ?? String(t.peripheralResponse)) : labels.noPeripheral;

    const periCorrectStr = hasPeri ? (t.peripheralResponse === t.peripheralAxis ? 'TRUE' : 'FALSE') : 'N/A';
    const trialCorrectStr = t.correct ? 'TRUE' : 'FALSE';
    const userRt = Math.round(t.responseTimeMs || 0);
    const mouseSamples = Array.isArray(t.mouseTrajectory) ? t.mouseTrajectory.length : 0;
    const mouseJson = JSON.stringify(t.mouseTrajectory || []);

    return [
      CsvEscape(subjectId || '-'),
      CsvEscape(isoDate),
      CsvEscape(isoTime),
      CsvEscape(`Subtest ${subtestId}`),
      CsvEscape(labels.subtests[subtestId]),
      trialNum,
      CsvEscape(isPractice ? '練習題' : '正式題'),
      plannedMs,
      actualMs,
      frames,
      dropped,
      fps,
      CsvEscape(contrastStr),
      CsvEscape(vehicleSizeStr),
      CsvEscape(targetAngleStr),
      CsvEscape(centralTargetName),
      CsvEscape(centralRespName),
      CsvEscape(centralCorrectStr),
      CsvEscape(periAxis),
      CsvEscape(periDirName),
      CsvEscape(periRespAxis),
      CsvEscape(periRespDirName),
      CsvEscape(periCorrectStr),
      CsvEscape(trialCorrectStr),
      userRt,
      mouseSamples,
      CsvEscape(mouseJson),
    ].join(',');
  });

  const rawScoreCsvContent = '\uFEFF' + [
    rawScoreHeaders.join(','),
    ...rawScoreRows,
  ].join('\r\n');

  const statScoreFilename = `${dateStr}-${timeStr}-${subtestCode}-統計成績.csv`;
  const statHeaders = [
    '參數項目',
    '參數代碼',
    '設定數值',
    '單位',
    '詳細說明',
  ];

  const formalTrials = trials.filter((t) => !t.practice);
  const practiceCount = trials.filter((t) => t.practice).length;
  const totalFormalTrials = formalTrials.length;
  const correctFormalTrials = formalTrials.filter((t) => t.correct).length;
  const incorrectFormalTrials = totalFormalTrials - correctFormalTrials;
  const accuracyRate = totalFormalTrials > 0 ? Math.round((correctFormalTrials / totalFormalTrials) * 100) : 0;

  const centralCorrectCount = formalTrials.filter((t) => t.centralResponse === t.centralTarget).length;
  const centralAccuracy = totalFormalTrials > 0 ? Math.round((centralCorrectCount / totalFormalTrials) * 100) : 0;

  const periTrials = formalTrials.filter((t) => typeof t.peripheralAxis === 'number');
  const periCorrectCount = periTrials.filter((t) => t.peripheralResponse === t.peripheralAxis).length;
  const peripheralAccuracy = periTrials.length > 0 ? Math.round((periCorrectCount / periTrials.length) * 100) : null;

  const meanRt = totalFormalTrials > 0
    ? Math.round(formalTrials.reduce((sum, t) => sum + (t.responseTimeMs || 0), 0) / totalFormalTrials)
    : 0;

  const dirStats = peripheralAttentionTargetAxes.map((axis) => {
    const dirTrials = formalTrials.filter((t) => t.peripheralAxis === axis);
    const dirCorrect = dirTrials.filter((t) => t.correct).length;
    const dirTotal = dirTrials.length;
    const acc = dirTotal > 0 ? Math.round((dirCorrect / dirTotal) * 100) : null;
    const avgRt = dirTotal > 0 ? Math.round(dirTrials.reduce((s, t) => s + (t.responseTimeMs || 0), 0) / dirTotal) : 0;
    return { axis, name: labels.directions[axis], total: dirTotal, correct: dirCorrect, acc, avgRt };
  });

  const statRows: [string, string, string | number, string, string][] = [
    ['測驗日期', 'test_date', isoDate, 'YYYY-MM-DD', '測驗進行日期'],
    ['測驗時間', 'test_time', isoTime, 'HH:mm:ss', '測驗完成時間'],
    ['受試者代號', 'subject_id', subjectId || '-', '-', '受試者識別碼'],
    ['測驗項目代碼', 'subtest_code', `Subtest ${subtestId}`, '-', 'UFOV 測驗核心項目'],
    ['測驗項目名稱', 'subtest_name', labels.subtests[subtestId] ?? `Subtest ${subtestId}`, '-', labels.instructions[subtestId] ?? ''],
    ['測驗模式', 'test_mode', record.difficulty === 'formal' ? '正式紀錄 (Formal)' : (record.difficulty === 'practice' ? '練習模式 (Practice)' : '說明模式 (Instruction)'), '-', record.difficulty],
    ['終止條件設定', 'stop_condition', String(record.details?.stopCondition ?? 'adaptive_80') === 'adaptive_80' ? '80%信度自適應階梯 (Adaptive 80%)' : `固定題數 (${record.details?.configuredTrialCount ?? totalFormalTrials} 題)`, '-', String(record.details?.stopCondition ?? '')],
    ['處理速度反應門檻 (final_rt)', 'final_threshold_rt_ms', RoundMs(Number(record.details?.thresholdProcessingSpeedMs ?? 0)), 'ms (毫秒)', '階梯法自動收斂出信度80%之處理速度門檻'],
    ['最快正確呈現時間', 'fastest_correct_duration_ms', RoundMs(Number(record.details?.bestCorrectProcessingSpeedMs ?? 0)), 'ms (毫秒)', '測驗中正確辨識之最短刺激呈現時間'],
    ['正式題總題數', 'formal_trials_total', totalFormalTrials, '題', '正式測驗完成題數'],
    ['正式題正確題數', 'formal_trials_correct', correctFormalTrials, '題', '正式測驗答對題數'],
    ['正式題錯誤題數', 'formal_trials_incorrect', incorrectFormalTrials, '題', '正式測驗答錯題數'],
    ['整體正確率', 'accuracy_rate_percent', `${accuracyRate}%`, '% (百分比)', '正式測驗正確作答比例'],
    ['中央目標正確率', 'central_accuracy_percent', `${centralAccuracy}%`, '% (百分比)', '中央車輛辨識正確率'],
    ['周邊目標正確率', 'peripheral_accuracy_percent', peripheralAccuracy !== null ? `${peripheralAccuracy}%` : 'N/A', peripheralAccuracy !== null ? '% (百分比)' : '-', subtestId !== 1 ? '周邊方位搜尋正確率' : '此Subtest不包含周邊目標'],
    ['平均作答反應時間', 'mean_response_time_ms', meanRt, 'ms (毫秒)', '受試者自題目出現至點擊完成之平均作答反應時間'],
    ['練習題完成題數', 'practice_trials_count', practiceCount, '題', '測驗前進行之練習題數'],
    ['螢幕物理寬度', 'screen_width_cm', Number(record.details?.screenWidthCm ?? 53.1), 'cm (公分)', '校準設定之螢幕物理寬度'],
    ['螢幕物理高度', 'screen_height_cm', Number(record.details?.screenHeightCm ?? 29.9), 'cm (公分)', '校準設定之螢幕物理高度'],
    ['觀看距離', 'viewing_distance_cm', Number(record.details?.viewingDistanceCm ?? 50), 'cm (公分)', '受試者與螢幕之設定距離'],
    ['周邊偏心視角設定', 'target_visual_angle_deg', Number(record.details?.targetVisualAngleDeg ?? 15).toFixed(1), 'deg (度 / °)', '周邊目標刺激物偏心視角'],
    ['車輛大小視角設定', 'vehicle_visual_angle_deg', Number(record.details?.vehicleVisualAngleDeg ?? 2.5).toFixed(1), 'deg (度 / °)', '車輛刺激物大小視角'],
    ['刺激對比度設定', 'contrast_percent', `${record.details?.contrastPercent ?? 100}%`, '% (百分比)', '刺激物與背景之對比強度'],
    ['螢幕即時更新率', 'refresh_rate_hz', Number(record.details?.refreshHz ?? 60), 'Hz (赫茲)', 'rAF 實測畫面更新頻率 (FPS)'],
    ['影格刷新間隔', 'frame_interval_ms', Number(record.details?.refreshMs ?? 16.67), 'ms (毫秒)', '單一影格持續時間'],
    ['測驗結束狀態', 'test_aborted', record.details?.aborted ? '中斷 (Aborted)' : '正常完成 (Completed)', '-', record.details?.aborted ? '因達到連續失敗上限或中斷' : '正常完成設定題數或收斂門檻'],
    ...dirStats.map((d) => [
      `8方向空間搜尋-${d.name} (${d.axis})`,
      `spatial_dir_${d.axis}_${d.name}`,
      d.acc !== null ? `${d.acc}%` : '未測試',
      d.acc !== null ? '% (百分比)' : '-',
      `呈現 ${d.total} 次, 答對 ${d.correct} 次, 平均作答耗時 ${d.avgRt > 0 ? `${d.avgRt} ms` : 'N/A'}`,
    ] as [string, string, string | number, string, string]),
  ];

  const statScoreCsvContent = '\uFEFF' + [
    statHeaders.join(','),
    ...statRows.map((r) => r.map(CsvEscape).join(',')),
  ].join('\r\n');

  TriggerDownload(rawScoreFilename, rawScoreCsvContent);
  setTimeout(() => {
    TriggerDownload(statScoreFilename, statScoreCsvContent);
  }, 250);
}

function ExportJsonData(
  record: PeripheralAttentionTrainingRecord,
  trials: TrialRecord[],
  labels: PeripheralAttentionLabels,
  subjectId: string,
  subtestId: SubtestId,
) {
  const exportObject = {
    experiment: 'UFOV Assessment & Training',
    version: '2.0.0-platform',
    date_time: FormatDate(new Date()),
    subjectId: subjectId || '-',
    subtestId,
    contrast: `${record.details?.contrastPercent ?? 100}%`,
    targetVisualAngle: `${Number(record.details?.targetVisualAngleDeg ?? 15).toFixed(1)}°`,
    vehicleVisualAngle: `${Number(record.details?.vehicleVisualAngleDeg ?? 2.5).toFixed(1)}°`,
    final_rt: Number(record.details?.thresholdProcessingSpeedMs ?? 0),
    refreshHz: Number(record.details?.refreshHz ?? 60),
    refreshMs: Number(record.details?.refreshMs ?? 16.67),
    trials: trials.map((t) => ({
      subjectId: subjectId || '-',
      trial_id: t.trialNumber,
      trial_rt: RoundMs(Number(t.actualDurationMs || t.durationMs || 0)),
      trial_fps: RoundMs(t.refreshHz || 60),
      actual_duration_ms: RoundMs(t.actualDurationMs || t.durationMs || 0),
      planned_duration_ms: RoundMs(t.plannedDurationMs || 0),
      duration_frames: t.durationFrames,
      actual_frame_count: t.actualFrameCount || t.durationFrames,
      dropped_frame_count: t.droppedFrameCount || 0,
      contrast_percent: t.contrastPercent,
      vehicle_visual_angle_deg: t.vehicleVisualAngleDeg,
      central_target: t.centralTarget,
      central_response: t.centralResponse,
      central_is_correct: t.centralResponse === t.centralTarget,
      peripheral_axis: typeof t.peripheralAxis === 'number' ? t.peripheralAxis : null,
      peripheral_direction: typeof t.peripheralAxis === 'number' ? labels.directions[t.peripheralAxis] : null,
      peripheral_response: typeof t.peripheralResponse === 'number' ? t.peripheralResponse : null,
      peripheral_response_direction: typeof t.peripheralResponse === 'number' ? labels.directions[t.peripheralResponse] : null,
      peripheral_is_correct: typeof t.peripheralAxis === 'number' ? t.peripheralResponse === t.peripheralAxis : null,
      trial_is_correct: t.correct,
      user_reaction_time_ms: Math.round(t.responseTimeMs || 0),
      mouse_trajectory: t.mouseTrajectory || [],
    })),
  };

  const jsonContent = JSON.stringify(exportObject, null, 2);
  TriggerDownload(`ufov_training_data_${new Date().toISOString().slice(0, 10)}.json`, jsonContent, 'application/json;charset=utf-8;');
}

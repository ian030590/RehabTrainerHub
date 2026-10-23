import { MeasureDisplayRefreshRate, type DisplayRefreshInfo } from '../runtime/displayTiming';
import {
  CreatePeripheralAttentionCanvasSlots, DrawPeripheralAttentionCanvasStage, EnsurePeripheralAttentionCanvasStage,
  PreparePeripheralAttentionNoiseMask, RenderPeripheralAttentionCanvasStage,
  type PeripheralAttentionCanvasPhase, type PeripheralAttentionCanvasSlot, type PeripheralAttentionScreenGeometry,
} from '../runtime/peripheralAttentionCanvas';
import { EstimatePeripheralAttentionThresholdMs, ShouldStopPeripheralAttentionAdaptiveRun } from '../runtime/peripheralAttentionResults';
import {
  EvaluatePeripheralAttentionFrameSync, GetPeripheralAttentionSyncRecoveryAction, peripheralAttentionTrialRefreshOptions,
  ShouldCountPeripheralAttentionTrial, type PeripheralAttentionFrameSyncMeasurement,
} from '../timing/peripheralAttentionTiming';
import { FramesToMs, InitialAdaptiveState, MaxTestTrials, MsToFrameCount, NextDurationMs, UpdateAdaptiveState, ufovTiming, type AdaptiveState } from './staircase';
import type { UfovSession, UfovTimingAttempt, UfovTrial, Vehicle } from './ufovSummary';

export interface UfovRunConfig {
  subtestId: 1 | 2 | 3;
  mode: 'formal' | 'practice';
  stopCondition: string;
  trialCount: number;
  targetAxes: number[];
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
  screenWidthCm: number;
  screenHeightCm: number;
  viewingDistanceCm: number;
  geometry: PeripheralAttentionScreenGeometry;
}

export type UfovPrompt = { kind: 'watch' } | { kind: 'vehicle' } | { kind: 'direction' } | { kind: 'feedback'; correct: boolean }
  | { kind: 'retry' } | { kind: 'pause' };

// The run draws the canvas inside `host`; the component shows each prompt and calls `answer` with the choice.
export interface UfovRunView {
  host: HTMLElement;
  label: string;
  prompt(prompt: UfovPrompt, answer?: (value?: number | Vehicle) => void): void;
  progress(trial: number, practice: boolean): void;
}

type TargetSlot = PeripheralAttentionCanvasSlot & { axis: number };
interface Stimulus {
  practice: boolean; trialNumber: number; desiredDurationMs: number; durationFrames: number; displayFrameCount: number;
  plannedDurationMs: number; centralTarget: Vehicle; peripheralSlot?: TargetSlot;
}
type Attempt = UfovTimingAttempt & PeripheralAttentionFrameSyncMeasurement & {
  subtestId: number; practice: boolean; trialNumber: number; attemptNumber: number; refreshMs: number; refreshHz: number;
  refreshSampleCount: number; refreshStandardDeviationMs: number;
};

const slots = CreatePeripheralAttentionCanvasSlots();
const targetSlots = slots.filter((slot): slot is TargetSlot => slot.ring === 2 && slot.isTargetCandidate && slot.axis !== null);

class UfovAbortError extends Error {
  constructor() { super('UFOV run stopped.'); this.name = 'AbortError'; }
}
function ThrowIfUfovRunAborted(signal: AbortSignal) {
  if (signal.aborted) throw new UfovAbortError();
}
function WaitMs(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, durationMs);
    const stop = () => { window.clearTimeout(timer); reject(new UfovAbortError()); };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
  });
}

export class UfovRun {
  private readonly controller = new AbortController();
  private readonly hasPeripheral: boolean;
  private readonly hasDistractors: boolean;

  constructor(private readonly config: UfovRunConfig, private readonly view: UfovRunView, private readonly finish: (session: UfovSession) => void) {
    this.hasPeripheral = config.subtestId !== 1;
    this.hasDistractors = config.subtestId === 3;
  }

  stop() { this.controller.abort(); }

  async start() {
    const abortSignal = this.controller.signal;
    try {
      const measured = await MeasureDisplayRefreshRate({ signal: abortSignal });
      ThrowIfUfovRunAborted(abortSignal);
      const session = await this.run(measured, abortSignal);
      if (!abortSignal.aborted) this.finish(session);
    } catch (error) {
      if (!abortSignal.aborted && !(error instanceof UfovAbortError)) throw error;
    }
  }

  private async run(measured: DisplayRefreshInfo, abortSignal: AbortSignal): Promise<UfovSession> {
    const config = this.config;
    const practiceMode = config.mode === 'practice';
    const maxTestTrials = MaxTestTrials(config);
    const trials: UfovTrial[] = [];
    const timingAttempts: Attempt[] = [];
    let currentRefreshMs = Number(measured.refreshMs) || 1000 / 60;
    let durationMs: number = practiceMode ? ufovTiming.practiceDurationMs : ufovTiming.maxDurationMs;
    let adaptiveState: AdaptiveState = InitialAdaptiveState();
    let invalidTimingAttemptCount = 0;
    let synchronizationPauseCount = 0;
    let aborted = false;
    try {
      for (let index = 0; practiceMode && index < ufovTiming.practiceTrials; index++) {
        this.view.progress(index + 1, true);
        const attempt = await this.runTrial(this.createStimulus(true, index + 1, ufovTiming.practiceDurationMs, currentRefreshMs), currentRefreshMs, 1, abortSignal);
        timingAttempts.push(attempt.timingAttempt);
        currentRefreshMs = attempt.timingAttempt.refreshMs;
        if (!attempt.timingAttempt.syncValid) invalidTimingAttemptCount += 1;
        if (!attempt.record) continue;
        trials.push(attempt.record);
        this.view.prompt({ kind: 'feedback', correct: attempt.record.correct });
        await WaitMs(300, abortSignal);
      }
      let testTrialNumber = 0;
      let attemptNumber = 0;
      let consecutiveInvalidAttempts = 0;
      while (!practiceMode && testTrialNumber < maxTestTrials) {
        attemptNumber += 1;
        this.view.progress(testTrialNumber + 1, false);
        const attempt = await this.runTrial(this.createStimulus(false, testTrialNumber + 1, durationMs, currentRefreshMs), currentRefreshMs, attemptNumber, abortSignal);
        timingAttempts.push(attempt.timingAttempt);
        currentRefreshMs = attempt.timingAttempt.refreshMs;
        const shouldCountTrial = ShouldCountPeripheralAttentionTrial(config.mode, attempt.timingAttempt.syncValid);
        if (!shouldCountTrial) {
          invalidTimingAttemptCount += 1;
          consecutiveInvalidAttempts += 1;
          if (GetPeripheralAttentionSyncRecoveryAction(consecutiveInvalidAttempts) === 'retry') {
            this.view.prompt({ kind: 'retry' });
            await WaitMs(450, abortSignal);
          } else {
            synchronizationPauseCount += 1;
            consecutiveInvalidAttempts = 0;
            await this.waitForSynchronizationResume(abortSignal);
          }
          continue;
        }
        const record = attempt.record;
        if (!record) throw new Error('A synchronized trial did not produce a response.');
        record.syncRetryCount = attemptNumber - 1;
        trials.push(record);
        testTrialNumber += 1;
        attemptNumber = 0;
        consecutiveInvalidAttempts = 0;
        adaptiveState = UpdateAdaptiveState(adaptiveState, record.correct, record.durationMs, currentRefreshMs, ufovTiming.maxDurationMs);
        durationMs = NextDurationMs(record.durationMs, record.correct, adaptiveState.stepMs, currentRefreshMs, ufovTiming.maxDurationMs);
        if (config.stopCondition === 'fixed_trials' ? testTrialNumber >= maxTestTrials : ShouldStopPeripheralAttentionAdaptiveRun({
          testTrial: testTrialNumber, reversals: adaptiveState.reversals, refreshMs: currentRefreshMs,
          limitStreak: adaptiveState.limitStreak, failAtMaxStreak: adaptiveState.failAtMaxStreak,
        }, maxTestTrials)) break;
      }
    } catch (error) {
      if (abortSignal.aborted || error instanceof UfovAbortError) throw error;
      aborted = true;
    }
    ThrowIfUfovRunAborted(abortSignal);
    const testTrials = trials.filter(trial => !trial.practice);
    const thresholdMs = practiceMode ? ufovTiming.practiceDurationMs : EstimatePeripheralAttentionThresholdMs({
      testTrial: testTrials.length, reversals: adaptiveState.reversals, refreshMs: currentRefreshMs,
      limitStreak: adaptiveState.limitStreak, failAtMaxStreak: adaptiveState.failAtMaxStreak,
    }, testTrials, ufovTiming.maxDurationMs);
    return {
      subtest_id: config.subtestId,
      mode: config.mode,
      configured_trial_count: maxTestTrials,
      target_axes: [...config.targetAxes],
      stop_condition: config.stopCondition,
      contrast_percent: config.contrastPercent,
      target_visual_angle_deg: config.targetVisualAngleDeg,
      vehicle_visual_angle_deg: config.vehicleVisualAngleDeg,
      screen_width_cm: config.screenWidthCm,
      screen_height_cm: config.screenHeightCm,
      viewing_distance_cm: config.viewingDistanceCm,
      refresh_ms: Number(measured.refreshMs) || 1000 / 60,
      refresh_hz: Number(measured.refreshHz) || 60,
      refresh_is_60hz_family: Boolean(measured.is60HzFamily),
      refresh_device_kind: measured.deviceKind,
      trials,
      timing_attempts: timingAttempts,
      invalid_timing_attempt_count: invalidTimingAttemptCount,
      synchronization_pause_count: synchronizationPauseCount,
      results: [{ subtestId: config.subtestId, thresholdMs, trialCount: practiceMode ? trials.length : testTrials.length, aborted }],
      aborted,
    };
  }

  private createStimulus(practice: boolean, trialNumber: number, desiredDurationMs: number, refreshMs: number): Stimulus {
    const durationFrames = MsToFrameCount(desiredDurationMs, refreshMs);
    const candidates = targetSlots.filter(slot => this.config.targetAxes.includes(slot.axis));
    const pool = candidates.length ? candidates : targetSlots;
    return {
      practice, trialNumber, desiredDurationMs, durationFrames, displayFrameCount: durationFrames,
      plannedDurationMs: FramesToMs(durationFrames, refreshMs),
      centralTarget: Math.random() < .5 ? 'car' : 'truck',
      peripheralSlot: this.hasPeripheral ? pool[Math.floor(Math.random() * pool.length)] : undefined,
    };
  }

  private canvasOptions(phase: PeripheralAttentionCanvasPhase, stimulus: Stimulus, maskImageData?: ImageData | null) {
    return {
      ariaLabel: this.view.label, phase, centralTarget: stimulus.centralTarget, hasPeripheral: this.hasPeripheral,
      hasDistractors: this.hasDistractors, peripheralSlot: stimulus.peripheralSlot, slots, maskImageData,
      geometry: this.config.geometry, contrastPercent: this.config.contrastPercent,
    };
  }

  private async runTrial(initialStimulus: Stimulus, fallbackRefreshMs: number, attemptNumber: number, abortSignal: AbortSignal) {
    this.view.prompt({ kind: 'watch' });
    const stage = EnsurePeripheralAttentionCanvasStage(this.view.host, this.view.label);
    const maskImageData = PreparePeripheralAttentionNoiseMask(stage);
    RenderPeripheralAttentionCanvasStage(this.view.host, this.canvasOptions('fixation', initialStimulus));
    // Each trial measures the refresh again during the fixation box, then plans its frames from that measurement.
    const [trialRefresh] = await Promise.all([
      MeasureDisplayRefreshRate({ ...peripheralAttentionTrialRefreshOptions, signal: abortSignal }),
      WaitMs(ufovTiming.fixationMs, abortSignal),
    ]);
    ThrowIfUfovRunAborted(abortSignal);
    const refreshMs = Number.isFinite(trialRefresh.refreshMs) && trialRefresh.refreshMs > 0 ? trialRefresh.refreshMs : fallbackRefreshMs;
    const durationFrames = MsToFrameCount(initialStimulus.desiredDurationMs, refreshMs);
    const stimulus: Stimulus = { ...initialStimulus, durationFrames, displayFrameCount: durationFrames, plannedDurationMs: FramesToMs(durationFrames, refreshMs) };
    const timing = await this.presentStimulus(stage, stimulus, maskImageData, trialRefresh, abortSignal);
    const timingAttempt: Attempt = {
      ...timing, subtestId: this.config.subtestId, practice: stimulus.practice, trialNumber: stimulus.trialNumber, attemptNumber,
      refreshMs, refreshHz: refreshMs > 0 ? 1000 / refreshMs : 0,
      refreshSampleCount: trialRefresh.sampleCount, refreshStandardDeviationMs: trialRefresh.standardDeviationMs,
    };
    await WaitMs(ufovTiming.maskMs, abortSignal);
    if (!ShouldCountPeripheralAttentionTrial(this.config.mode, timing.syncValid)) return { timingAttempt, record: null };

    const startTime = performance.now();
    const mouseTrajectory: { x: number; y: number; t: number }[] = [];
    const onMouseMove = (event: MouseEvent) => {
      mouseTrajectory.push({ x: Math.round(event.clientX), y: Math.round(event.clientY), t: Math.round(performance.now() - startTime) });
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    let centralResponse: Vehicle;
    let peripheralResponse: number | undefined;
    try {
      centralResponse = await this.ask('vehicle', abortSignal) as Vehicle;
      peripheralResponse = this.hasPeripheral ? await this.ask('direction', abortSignal) as number : undefined;
    } finally {
      window.removeEventListener('mousemove', onMouseMove);
    }
    const record: UfovTrial = {
      ...timing,
      subtestId: this.config.subtestId,
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
      correct: centralResponse === stimulus.centralTarget && (!this.hasPeripheral || peripheralResponse === stimulus.peripheralSlot?.axis),
      responseTimeMs: performance.now() - startTime,
      contrastPercent: this.config.contrastPercent,
      targetVisualAngleDeg: this.config.targetVisualAngleDeg,
      vehicleVisualAngleDeg: this.config.vehicleVisualAngleDeg,
      mouseTrajectory: mouseTrajectory.length > 0 ? mouseTrajectory : undefined,
    };
    return { timingAttempt, record };
  }

  // Draws the stimulus on one animation frame, counts the requested frames, then draws the mask.
  private presentStimulus(stage: HTMLElement, stimulus: Stimulus, maskImageData: ImageData | null, refreshInfo: DisplayRefreshInfo, abortSignal: AbortSignal) {
    return new Promise<PeripheralAttentionFrameSyncMeasurement>((resolve, reject) => {
      const frameTimestamps: number[] = [];
      let elapsedFrames = 0;
      let frameId = 0;
      let watchdogTimeoutId = 0;
      let finished = false;
      let visibilityInterrupted = document.visibilityState !== 'visible';
      const handleVisibilityChange = () => { if (document.visibilityState !== 'visible') visibilityInterrupted = true; };
      const cleanup = () => {
        if (frameId) window.cancelAnimationFrame(frameId);
        if (watchdogTimeoutId) window.clearTimeout(watchdogTimeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        abortSignal.removeEventListener('abort', abortPresentation);
      };
      const abortPresentation = () => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new UfovAbortError());
      };
      const finishPresentation = () => {
        if (finished) return;
        finished = true;
        cleanup();
        DrawPeripheralAttentionCanvasStage(stage, this.canvasOptions('mask', stimulus, maskImageData));
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
        frameId = window.requestAnimationFrame(timestamp => {
          frameId = 0;
          if (abortSignal.aborted) { abortPresentation(); return; }
          callback(timestamp);
        });
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      abortSignal.addEventListener('abort', abortPresentation, { once: true });
      if (abortSignal.aborted) { abortPresentation(); return; }
      watchdogTimeoutId = window.setTimeout(finishPresentation, Math.max(1_000, stimulus.displayFrameCount * Math.max(refreshInfo.refreshMs, 1) * 4));
      scheduleFrame(firstTimestamp => {
        frameTimestamps.push(firstTimestamp);
        DrawPeripheralAttentionCanvasStage(stage, this.canvasOptions('stimulus', stimulus));
        const tick = (nextTimestamp: number) => {
          frameTimestamps.push(nextTimestamp);
          elapsedFrames += 1;
          if (elapsedFrames >= stimulus.displayFrameCount) { finishPresentation(); return; }
          scheduleFrame(tick);
        };
        scheduleFrame(tick);
      });
    });
  }

  private ask(kind: 'vehicle' | 'direction', abortSignal: AbortSignal) {
    return new Promise<number | Vehicle>((resolve, reject) => {
      const stop = () => reject(new UfovAbortError());
      abortSignal.addEventListener('abort', stop, { once: true });
      this.view.prompt({ kind }, value => {
        abortSignal.removeEventListener('abort', stop);
        if (value !== undefined) resolve(value);
      });
      if (abortSignal.aborted) stop();
    });
  }

  private waitForSynchronizationResume(abortSignal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const stop = () => reject(new UfovAbortError());
      abortSignal.addEventListener('abort', stop, { once: true });
      this.view.prompt({ kind: 'pause' }, () => { abortSignal.removeEventListener('abort', stop); resolve(); });
      if (abortSignal.aborted) stop();
    });
  }
}

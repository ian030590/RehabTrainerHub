import HtmlButtonResponsePlugin from '@jspsych/plugin-html-button-response';
import HtmlKeyboardResponsePlugin from '@jspsych/plugin-html-keyboard-response';
import PreloadPlugin from '@jspsych/plugin-preload';
import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import WebGazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebGazerValidatePlugin from '@jspsych/plugin-webgazer-validate';
import type { JsPsych } from 'jspsych';
import { SetSetting } from './settings';

export const officialWebGazerFlowOrder = [
  'preload',
  'camera_instructions',
  'init_camera',
  'calibration_instructions',
  'calibration_signal_check',
  'calibration',
  'validation_instructions',
  'validation_signal_check',
  'validation',
  'recalibrate',
  'calibration_done',
  'begin',
  'trial',
  'show_data',
] as const;

export interface WebGazerCalibrationCopy {
  beginInstructions: string;
  beginPrompt: string;
  beginTitle: string;
  buttonText: string;
  calibrationDoneText: string;
  cameraInstructions: string;
  cameraPermissionButtonText: string;
  cameraPreviewLabel: string;
  cameraTitle: string;
  continueButtonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
  signalCheckCalibration: string;
  signalCheckInstructions: string;
  signalCheckTitle: string;
  signalCheckValidation: string;
  signalMissingInstructions: string;
  signalMissingTitle: string;
  signalRetryButtonText: string;
  signalSkipButtonText: string;
  signalSkippedText: string;
  signalSkippedTitle: string;
  recalibrateInstructions: string;
  recalibrateTitle: string;
  showDataMissing: string;
  showDataPrompt: string;
  showDataSummary: string;
  showDataTitle: string;
  title: string;
  validationInstructions: string;
  validationNoClick: string;
  validationTitle: string;
}

export interface WebGazerPreloadAssets {
  audio?: readonly string[];
  images?: readonly string[];
}

interface WebGazerLike {
  clearData?: () => void | Promise<void>;
  end?: () => void;
  pause?: () => void;
  showFaceFeedbackBox?: (show: boolean) => void;
  showFaceOverlay?: (show: boolean) => void;
  showVideo?: (show: boolean) => void;
  stopVideo?: () => void;
}

interface WebGazerExtensionLike {
  hideVideo?: () => void;
  onGazeUpdate?: (callback: (prediction: unknown) => void) => (() => void);
  pause?: () => void;
  resume?: () => void;
  showVideo?: () => void;
  startSampleInterval?: (interval?: number) => void;
  stopSampleInterval?: () => void;
}

type EyeSignalStage = 'calibration' | 'validation';

interface EyeTrackingRunState {
  recordEyeTracking: boolean;
}

type WebGazerTrialData = Record<string, unknown> & {
  gaze_samples?: unknown[];
  webgazer_data?: unknown[];
};

const officialCalibrationPoints = [
  [25, 25],
  [75, 25],
  [50, 50],
  [25, 75],
  [75, 75],
] as const;

const minimumPercentInRoi = 50;
const eyeSignalCheckDurationMs = 3000;
const eyeSignalSamplingIntervalMs = 100;
const webGazerLivePreviewClass = 'webgazer-live-preview';

function GetWebGazer(): WebGazerLike | undefined {
  return (window as Window & { webgazer?: WebGazerLike }).webgazer;
}

function GetWebGazerExtension(jsPsych: JsPsych): WebGazerExtensionLike | undefined {
  return jsPsych.extensions?.webgazer as unknown as WebGazerExtensionLike | undefined;
}

function ActivateWebGazerPreview(label: string): void {
  const container = document.querySelector<HTMLElement>('#webgazerVideoContainer');
  if (!container) return;
  container.classList.add(webGazerLivePreviewClass);
  container.setAttribute('aria-label', label);
  container.setAttribute('role', 'img');
}

function DeactivateWebGazerPreview(): void {
  const container = document.querySelector<HTMLElement>('#webgazerVideoContainer');
  if (!container) return;
  container.classList.remove(webGazerLivePreviewClass);
  container.removeAttribute('aria-label');
  container.removeAttribute('role');
}

function CreateInstructionPanel(step: string, title: string, paragraphs: readonly string[]) {
  return `
    <section class="webgazer-flow-instructions" data-webgazer-step="${step}">
      <h1>${title}</h1>
      ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
    </section>
  `;
}

function ShouldRecalibrate(jsPsych: JsPsych): boolean {
  const validationData = jsPsych.data.get().filter({ task: 'validate' }).values().at(-1);
  const percentInRoi = validationData?.percent_in_roi;
  return !Array.isArray(percentInRoi)
    || percentInRoi.length === 0
    || percentInRoi.some((value) => (
      typeof value !== 'number'
      || !Number.isFinite(value)
      || value < minimumPercentInRoi
    ));
}

function IsValidEyeSignal(prediction: unknown): boolean {
  if (!prediction || typeof prediction !== 'object') return false;
  const candidate = prediction as Record<string, unknown>;
  return [candidate.x, candidate.y].every((value) => (
    typeof value === 'number' && Number.isFinite(value)
  ));
}

function CreateSignalCheckPanel(
  step: string,
  title: string,
  paragraphs: readonly string[],
  state: 'checking' | 'missing',
) {
  return `
    <section
      class="webgazer-flow-instructions webgazer-signal-panel"
      data-webgazer-step="${step}"
      data-webgazer-signal-state="${state}"
      ${state === 'missing' ? 'role="alert"' : 'aria-live="polite"'}
    >
      <h1>${title}</h1>
      ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}
      ${state === 'checking' ? '<div class="webgazer-signal-progress" aria-hidden="true"></div>' : ''}
    </section>
  `;
}

function CreateEyeSignalCheck(
  jsPsych: JsPsych,
  copy: WebGazerCalibrationCopy,
  stage: EyeSignalStage,
  runState: EyeTrackingRunState,
) {
  const step = `${stage}_signal_check`;
  const stageInstructions = stage === 'calibration'
    ? copy.signalCheckCalibration
    : copy.signalCheckValidation;
  let cleanupActiveCheck = () => {};

  return {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateSignalCheckPanel(
      step,
      copy.signalCheckTitle,
      [stageInstructions, copy.signalCheckInstructions],
      'checking',
    ),
    choices: [],
    data: {
      eye_signal_stage: stage,
      webgazer_flow_step: step,
    },
    on_load: () => {
      const extension = GetWebGazerExtension(jsPsych);
      const displayElement = jsPsych.getDisplayElement();
      let attempts = 0;
      let settled = false;
      let timeoutId = 0;
      let stopGazeUpdates: (() => void) | undefined;

      const stopCheckCycle = () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutId = 0;
        }
        stopGazeUpdates?.();
        stopGazeUpdates = undefined;
        extension?.stopSampleInterval?.();
      };

      const stopPreview = () => {
        extension?.pause?.();
        extension?.hideVideo?.();
        DeactivateWebGazerPreview();
      };

      const finishWithSignal = () => {
        if (settled) return;
        settled = true;
        stopCheckCycle();
        stopPreview();
        jsPsych.finishTrial({
          eye_signal_check_attempts: attempts,
          eye_signal_detected: true,
          eye_tracking_recording: 'recorded',
        });
      };

      const skipEyeTracking = () => {
        if (settled) return;
        settled = true;
        runState.recordEyeTracking = false;
        stopCheckCycle();
        CleanupWebGazerRuntime();
        jsPsych.finishTrial({
          eye_signal_check_attempts: attempts,
          eye_signal_detected: false,
          eye_tracking_recording: 'skipped_by_participant',
        });
      };

      const startCheck = () => {
        if (settled) return;
        attempts += 1;
        stopCheckCycle();
        displayElement.innerHTML = CreateSignalCheckPanel(
          step,
          copy.signalCheckTitle,
          [stageInstructions, copy.signalCheckInstructions],
          'checking',
        );

        extension?.showVideo?.();
        ActivateWebGazerPreview(copy.cameraPreviewLabel);
        extension?.resume?.();
        stopGazeUpdates = extension?.onGazeUpdate?.((prediction) => {
          if (IsValidEyeSignal(prediction)) finishWithSignal();
        });
        extension?.startSampleInterval?.(eyeSignalSamplingIntervalMs);

        timeoutId = window.setTimeout(() => {
          if (settled) return;
          stopCheckCycle();
          displayElement.innerHTML = CreateSignalCheckPanel(
            step,
            copy.signalMissingTitle,
            [copy.signalMissingInstructions],
            'missing',
          );

          const panel = displayElement.querySelector<HTMLElement>('[data-webgazer-signal-state="missing"]');
          if (!panel) return;
          const actions = document.createElement('div');
          actions.className = 'webgazer-signal-actions';

          const retryButton = document.createElement('button');
          retryButton.type = 'button';
          retryButton.className = 'jspsych-btn';
          retryButton.textContent = copy.signalRetryButtonText;
          retryButton.addEventListener('click', startCheck, { once: true });

          const skipButton = document.createElement('button');
          skipButton.type = 'button';
          skipButton.className = 'jspsych-btn webgazer-signal-skip';
          skipButton.textContent = copy.signalSkipButtonText;
          skipButton.addEventListener('click', skipEyeTracking, { once: true });

          actions.append(retryButton, skipButton);
          panel.append(actions);
        }, eyeSignalCheckDurationMs);
      };

      cleanupActiveCheck = () => {
        settled = true;
        stopCheckCycle();
        stopPreview();
      };
      startCheck();
    },
    on_finish: () => cleanupActiveCheck(),
  };
}

function RunWhileRecordingEyeTracking(
  trial: object,
  runState: EyeTrackingRunState,
) {
  return {
    timeline: [trial],
    conditional_function: () => runState.recordEyeTracking,
  };
}

function CountOfficialWebGazerSamples(data: WebGazerTrialData): number {
  if (!Array.isArray(data.webgazer_data)) return 0;
  return data.webgazer_data.filter((sample) => {
    if (!sample || typeof sample !== 'object') return false;
    const candidate = sample as Record<string, unknown>;
    return [candidate.x, candidate.y, candidate.t].every((value) => (
      typeof value === 'number' && Number.isFinite(value)
    ));
  }).length;
}

/**
 * Consume the native extension payload after its on_finish hook has attached
 * webgazer_data to the formal trial. The compact gaze/target rows are built
 * from the same extension callbacks during the moving-target trial. Both the
 * canonical extension payload and the paired rows are retained so saved data
 * can be audited against jsPsych's native output.
 */
export function ConsumeOfficialWebGazerTrialData(data: WebGazerTrialData): void {
  const officialSampleCount = CountOfficialWebGazerSamples(data);
  const pairedSampleCount = Array.isArray(data.gaze_samples) ? data.gaze_samples.length : 0;
  const consumedNativeData = officialSampleCount > 0 && pairedSampleCount > 0;

  data.webgazer_sample_count = officialSampleCount;
  data.gaze_sample_count = pairedSampleCount;
  data.webgazer_data_consumed = consumedNativeData;
  data.gaze_coordinate_source = consumedNativeData
    ? 'jspsych-webgazer-extension'
    : undefined;

  if (!consumedNativeData) {
    data.aoi_score = undefined;
    data.mean_target_distance_px = undefined;
    data.target_distance_sd_px = undefined;
    data.time_to_first_fixation_ms = undefined;
    data.average_pupil_size_px = undefined;
    data.pupil_size_sd_px = undefined;
    data.blink_count = undefined;
  }
}

export async function ResetWebGazerCalibrationData() {
  await GetWebGazer()?.clearData?.();
}

/** Stop the global WebGazer runtime when a jsPsych host is unmounted/cancelled. */
export function CleanupWebGazerRuntime() {
  const webgazer = GetWebGazer();
  DeactivateWebGazerPreview();
  const cleanupActions = [
    () => webgazer?.pause?.(),
    () => webgazer?.showVideo?.(false),
    () => webgazer?.showFaceOverlay?.(false),
    () => webgazer?.showFaceFeedbackBox?.(false),
    () => webgazer?.stopVideo?.(),
    () => webgazer?.end?.(),
  ];
  cleanupActions.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // Continue cleaning a partially initialized runtime.
    }
  });
  document.querySelector('#webgazer-center-style')?.remove();
}

/**
 * Build the complete sequence from jsPsych's official WebGazer example. The
 * formal trial is supplied by the oculomotor module and remains the only
 * module-owned renderer in the sequence.
 */
export function CreateWebGazerExperimentTimeline(
  jsPsych: JsPsych,
  copy: WebGazerCalibrationCopy,
  trial: object,
  preloadAssets: WebGazerPreloadAssets = {},
): object[] {
  const runState: EyeTrackingRunState = { recordEyeTracking: true };
  const preload = {
    type: PreloadPlugin,
    images: [...(preloadAssets.images ?? [])].filter(Boolean),
    audio: [...(preloadAssets.audio ?? [])].filter(Boolean),
    data: { webgazer_flow_step: 'preload' },
  };

  const cameraInstructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'camera_instructions',
      copy.cameraTitle,
      [copy.cameraInstructions],
    ),
    choices: [copy.cameraPermissionButtonText],
    data: { webgazer_flow_step: 'camera_instructions' },
  };

  const initCamera = {
    type: WebGazerInitCameraPlugin,
    instructions: `
      <div class="webgazer-native-camera-instructions">
        ${[copy.instruction1, copy.instruction3]
          .map((paragraph) => `<p>${paragraph}</p>`)
          .join('')}
      </div>
    `,
    button_text: copy.continueButtonText,
    data: { webgazer_flow_step: 'init_camera' },
    on_load: () => ActivateWebGazerPreview(copy.cameraPreviewLabel),
    on_finish: DeactivateWebGazerPreview,
  };

  const nativeCalibrationInstructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'calibration_instructions',
      copy.title,
      [copy.instruction2, copy.instruction3],
    ),
    choices: [copy.buttonText],
    data: { webgazer_flow_step: 'calibration_instructions' },
  };

  const nativeCalibration = {
    type: WebGazerCalibratePlugin,
    calibration_points: officialCalibrationPoints.map((point) => [...point]),
    calibration_mode: 'click',
    repetitions_per_point: 2,
    randomize_calibration_order: true,
    data: { webgazer_flow_step: 'calibration' },
  };

  const nativeValidationInstructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'validation_instructions',
      copy.validationTitle,
      [copy.validationInstructions, copy.validationNoClick],
    ),
    choices: [copy.continueButtonText],
    post_trial_gap: 1000,
    data: { webgazer_flow_step: 'validation_instructions' },
  };

  const nativeValidation = {
    type: WebGazerValidatePlugin,
    validation_points: officialCalibrationPoints.map((point) => [...point]),
    roi_radius: 200,
    time_to_saccade: 1000,
    validation_duration: 2000,
    data: {
      task: 'validate',
      webgazer_flow_step: 'validation',
    },
  };

  const calibrationInstructions = RunWhileRecordingEyeTracking(
    nativeCalibrationInstructions,
    runState,
  );
  const calibrationSignalCheck = RunWhileRecordingEyeTracking(
    CreateEyeSignalCheck(jsPsych, copy, 'calibration', runState),
    runState,
  );
  const calibration = RunWhileRecordingEyeTracking(nativeCalibration, runState);
  const validationInstructions = RunWhileRecordingEyeTracking(
    nativeValidationInstructions,
    runState,
  );
  const validationSignalCheck = RunWhileRecordingEyeTracking(
    CreateEyeSignalCheck(jsPsych, copy, 'validation', runState),
    runState,
  );
  const validation = RunWhileRecordingEyeTracking(nativeValidation, runState);

  const recalibrateInstructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'recalibrate_instructions',
      copy.recalibrateTitle,
      [copy.recalibrateInstructions],
    ),
    choices: [copy.continueButtonText],
    data: { webgazer_flow_step: 'recalibrate_instructions' },
  };

  const recalibrate = {
    timeline: [
      recalibrateInstructions,
      calibrationSignalCheck,
      calibration,
      validationInstructions,
      validationSignalCheck,
      validation,
    ],
    conditional_function: () => (
      runState.recordEyeTracking && ShouldRecalibrate(jsPsych)
    ),
    data: {
      phase: 'recalibration',
      webgazer_flow_step: 'recalibrate',
    },
  };

  const calibrationDone = {
    type: HtmlButtonResponsePlugin,
    stimulus: () => CreateInstructionPanel(
      'calibration_done',
      runState.recordEyeTracking ? copy.title : copy.signalSkippedTitle,
      [runState.recordEyeTracking ? copy.calibrationDoneText : copy.signalSkippedText],
    ),
    choices: [copy.continueButtonText],
    data: { webgazer_flow_step: 'calibration_done' },
    on_finish: () => {
      if (runState.recordEyeTracking) {
        SetSetting('webGazerCalibrationAt', new Date().toISOString());
      }
    },
  };

  const begin = {
    type: HtmlKeyboardResponsePlugin,
    stimulus: CreateInstructionPanel(
      'begin',
      copy.beginTitle,
      [copy.beginInstructions, copy.beginPrompt],
    ),
    choices: ['Enter', ' '],
    data: { webgazer_flow_step: 'begin' },
  };

  const trackedFormalTrial = {
    ...trial,
    data: {
      ...((trial as { data?: Record<string, unknown> }).data ?? {}),
      eye_tracking_recording: 'recorded',
      webgazer_flow_step: 'trial',
    },
  };

  const untrackedFormalTrial = {
    ...(trial as Record<string, unknown>),
    enable_webgazer: false,
    show_gaze_point: false,
    data: {
      ...((trial as { data?: Record<string, unknown> }).data ?? {}),
      eye_tracking_recording: 'skipped_by_participant',
      webgazer_flow_step: 'trial',
    },
  };
  delete untrackedFormalTrial.extensions;
  delete untrackedFormalTrial.on_finish;

  const formalTrial = {
    timeline: [
      {
        timeline: [trackedFormalTrial],
        conditional_function: () => runState.recordEyeTracking,
      },
      {
        timeline: [untrackedFormalTrial],
        conditional_function: () => !runState.recordEyeTracking,
      },
    ],
  };

  const showData = {
    type: HtmlKeyboardResponsePlugin,
    stimulus: () => {
      const trialData = jsPsych.data.getLastTrialData().values()[0] as
        | Record<string, unknown>
        | undefined;
      const sampleCount = trialData?.webgazer_data_consumed === true
        && typeof trialData.webgazer_sample_count === 'number'
        ? trialData.webgazer_sample_count
        : 0;
      const summary = !runState.recordEyeTracking
        ? copy.signalSkippedText
        : sampleCount > 0
          ? copy.showDataSummary.replace('{count}', String(sampleCount))
          : copy.showDataMissing;
      return CreateInstructionPanel(
        'show_data',
        runState.recordEyeTracking ? copy.showDataTitle : copy.signalSkippedTitle,
        [summary, copy.showDataPrompt],
      );
    },
    choices: ['Enter', ' '],
    data: { webgazer_flow_step: 'show_data' },
  };

  const flow = [
    preload,
    cameraInstructions,
    initCamera,
    calibrationInstructions,
    calibrationSignalCheck,
    calibration,
    validationInstructions,
    validationSignalCheck,
    validation,
    recalibrate,
    calibrationDone,
    begin,
    formalTrial,
    showData,
  ];

  if (flow.length !== officialWebGazerFlowOrder.length) {
    throw new Error('The official jsPsych WebGazer flow is incomplete.');
  }
  return flow;
}

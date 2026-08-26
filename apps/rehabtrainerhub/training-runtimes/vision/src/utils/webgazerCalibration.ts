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
  'calibration',
  'validation_instructions',
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
  cameraTitle: string;
  continueButtonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
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

function GetWebGazer(): WebGazerLike | undefined {
  return (window as Window & { webgazer?: WebGazerLike }).webgazer;
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
  };

  const calibrationInstructions = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'calibration_instructions',
      copy.title,
      [copy.instruction2, copy.instruction3],
    ),
    choices: [copy.buttonText],
    data: { webgazer_flow_step: 'calibration_instructions' },
  };

  const calibration = {
    type: WebGazerCalibratePlugin,
    calibration_points: officialCalibrationPoints.map((point) => [...point]),
    calibration_mode: 'click',
    repetitions_per_point: 2,
    randomize_calibration_order: true,
    data: { webgazer_flow_step: 'calibration' },
  };

  const validationInstructions = {
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

  const validation = {
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
      calibration,
      validationInstructions,
      validation,
    ],
    conditional_function: () => ShouldRecalibrate(jsPsych),
    data: {
      phase: 'recalibration',
      webgazer_flow_step: 'recalibrate',
    },
  };

  const calibrationDone = {
    type: HtmlButtonResponsePlugin,
    stimulus: CreateInstructionPanel(
      'calibration_done',
      copy.title,
      [copy.calibrationDoneText],
    ),
    choices: [copy.continueButtonText],
    data: { webgazer_flow_step: 'calibration_done' },
    on_finish: () => {
      SetSetting('webGazerCalibrationAt', new Date().toISOString());
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

  const formalTrial = {
    ...trial,
    data: {
      ...((trial as { data?: Record<string, unknown> }).data ?? {}),
      webgazer_flow_step: 'trial',
    },
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
      const summary = sampleCount > 0
        ? copy.showDataSummary.replace('{count}', String(sampleCount))
        : copy.showDataMissing;
      return CreateInstructionPanel(
        'show_data',
        copy.showDataTitle,
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
    calibration,
    validationInstructions,
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

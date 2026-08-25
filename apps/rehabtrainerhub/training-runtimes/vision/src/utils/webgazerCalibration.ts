import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import WebGazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebGazerValidatePlugin from '@jspsych/plugin-webgazer-validate';
import { SetSetting } from './settings';

export interface WebGazerCalibrationCopy {
  buttonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
  title: string;
}

interface WebGazerLike {
  clearData?: () => void | Promise<void>;
  pause?: () => void;
  showVideo?: (show: boolean) => void;
  showFaceOverlay?: (show: boolean) => void;
  showFaceFeedbackBox?: (show: boolean) => void;
  stopVideo?: () => void;
  end?: () => void;
}

function GetWebGazer(): WebGazerLike | undefined {
  return (window as Window & { webgazer?: WebGazerLike }).webgazer;
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
 * The official jsPsych plugins own camera positioning, calibration, and
 * validation. Omitting point arrays intentionally uses their 3×3 defaults.
 */
export function CreateWebGazerCalibrationTimeline(copy: WebGazerCalibrationCopy): object[] {
  return [
    {
      type: WebGazerInitCameraPlugin,
      instructions: `
        <div class="webgazer-jspsych-instructions">
          <h2>${copy.title}</h2>
          <p>${copy.instruction1}</p>
          <p>${copy.instruction2}</p>
          <p>${copy.instruction3}</p>
        </div>
      `,
      button_text: copy.buttonText,
    },
    {
      type: WebGazerCalibratePlugin,
      calibration_mode: 'click',
      repetitions_per_point: 2,
      randomize_calibration_order: true,
    },
    {
      type: WebGazerValidatePlugin,
      randomize_validation_order: false,
      roi_radius: 120,
      time_to_saccade: 700,
      validation_duration: 1200,
      show_validation_data: true,
      on_finish: () => {
        SetSetting('webGazerCalibrationAt', new Date().toISOString());
      },
    },
  ];
}

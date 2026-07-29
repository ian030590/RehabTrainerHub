import WebGazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import WebGazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import { SetSetting } from './settings';

export interface WebGazerCalibrationCopy {
  buttonText: string;
  instruction1: string;
  instruction2: string;
  instruction3: string;
  title: string;
}

const desktopCalibrationPoints = [
  [10, 10], [50, 10], [90, 10],
  [10, 50], [50, 50], [90, 50],
  [10, 90], [50, 90], [90, 90],
] as const;

const touchCalibrationPoints = [
  [14, 16], [50, 16], [86, 16],
  [14, 50], [50, 50], [86, 50],
  [14, 84], [50, 84], [86, 84],
] as const;

function IsTouchCalibrationViewport() {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia?.('(any-pointer: coarse)').matches);
}

export async function ResetWebGazerCalibrationData() {
  const webgazer = (window as Window & {
    webgazer?: { clearData?: () => void | Promise<void> };
  }).webgazer;
  await webgazer?.clearData?.();
}

export function CreateWebGazerCalibrationTimeline(copy: WebGazerCalibrationCopy): object[] {
  const touchViewport = IsTouchCalibrationViewport();

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
      calibration_points: touchViewport ? touchCalibrationPoints : desktopCalibrationPoints,
      calibration_mode: 'click',
      repetitions_per_point: 2,
      randomize_calibration_order: true,
      point_size: touchViewport ? 48 : 28,
      on_finish: () => SetSetting('webGazerCalibrationAt', new Date().toISOString()),
    },
  ];
}

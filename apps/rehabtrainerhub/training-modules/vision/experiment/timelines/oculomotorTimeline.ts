// Timeline local to the Hub-owned oculomotor module.
import WebGazerExtension from '@jspsych/extension-webgazer';
import PixiOculomotorTrainingPlugin from '../plugins/pixi-oculomotor-training';
import { GetSetting } from '../../utils/settings';
import { PixelFromDegree, PixelFromMillimeter } from '../../utils/spatialUtils';
import {
  ConsumeOfficialWebGazerTrialData,
  CreateWebGazerExperimentTimeline,
} from '../../utils/webgazerCalibration';
import type { BuildTimelineOverrides } from './types';

export function BuildOculomotorTimeline(overrides?: BuildTimelineOverrides): object[] {
  const mode = overrides?.oculomotor?.mode ?? GetSetting('oculomotorMode');
  const pattern = overrides?.oculomotor?.pattern ?? GetSetting('oculomotorPattern');
  const durationSec = overrides?.oculomotor?.durationSec ?? GetSetting('oculomotorDurationSec');
  const speedDegPerSec = overrides?.oculomotor?.speedDegPerSec ?? GetSetting('oculomotorSpeedDegPerSec');
  const targetSizeMm = overrides?.oculomotor?.targetSizeMm ?? GetSetting('oculomotorTargetSizeMm');
  const distractorCount = overrides?.oculomotor?.distractorCount ?? GetSetting('oculomotorDistractorCount');
  const targetColor = overrides?.oculomotor?.targetColor ?? GetSetting('oculomotorTargetColor');
  const backgroundColor = overrides?.oculomotor?.backgroundColor ?? GetSetting('oculomotorBackgroundColor');
  const targetShape = overrides?.oculomotor?.targetShape ?? GetSetting('oculomotorTargetShape');
  const customTargetImage = overrides?.oculomotor?.customTargetImage ?? GetSetting('oculomotorCustomTargetImage');
  const opacity = overrides?.oculomotor?.opacity ?? GetSetting('oculomotorTargetOpacity');
  const backgroundImage = overrides?.oculomotor?.backgroundImage ?? GetSetting('oculomotorBackgroundImage');
  const audio = overrides?.oculomotor?.audio ?? GetSetting('oculomotorAudio');
  const bounceJitter = overrides?.oculomotor?.bounceJitter ?? GetSetting('oculomotorBounceJitter');
  const enableWebGazer = GetSetting('oculomotorEnableWebgazer');
  const showGazepoint = overrides?.oculomotor?.showGazepoint
    ?? GetSetting('oculomotorShowGazepoint');

  const trial = {
    type: PixiOculomotorTrainingPlugin,
    mode,
    pattern,
    duration_ms: Math.round(durationSec * 1000),
    speed_px_per_sec: PixelFromDegree(speedDegPerSec),
    target_radius_px: Math.max(6, PixelFromMillimeter(targetSizeMm) / 2),
    distractor_count: distractorCount,
    target_color: targetColor,
    background_color: backgroundColor,
    target_shape: targetShape,
    custom_target_image: customTargetImage,
    opacity,
    background_image: backgroundImage,
    audio,
    bounce_jitter: bounceJitter,
    enable_webgazer: enableWebGazer,
    show_gaze_point: enableWebGazer && showGazepoint,
    round_number: 1,
    total_rounds: 1,
    extensions: enableWebGazer
      ? [{
          type: WebGazerExtension,
          params: { targets: ['.oculomotor-training-trial'] },
        }]
      : undefined,
    on_finish: enableWebGazer ? ConsumeOfficialWebGazerTrialData : undefined,
  };

  if (!enableWebGazer) return [trial];
  if (!overrides?.jsPsych) {
    throw new Error('The jsPsych instance is required for the official WebGazer flow.');
  }

  return CreateWebGazerExperimentTimeline(
    overrides.jsPsych,
    overrides.oculomotor?.webGazerCalibration ?? {
      beginInstructions: 'Eye tracking is ready. The moving-target trial is next.',
      beginPrompt: 'Press Enter or Space to begin.',
      beginTitle: 'Begin eye-movement practice',
      buttonText: 'Start calibration',
      calibrationDoneText: 'Calibration and validation are complete.',
      cameraInstructions: 'The next screen will request camera access and help position your face.',
      cameraPermissionButtonText: 'Got it',
      cameraTitle: 'Camera access',
      continueButtonText: 'Continue',
      instruction1: 'Center your face in the camera view and look directly at the camera. Continue becomes available when the feedback box turns green.',
      instruction2: 'Look at each point, then click or tap its center twice.',
      instruction3: 'Keep your head steady until all points are complete.',
      recalibrateInstructions: 'The first validation was below the accuracy threshold. Please calibrate once more.',
      recalibrateTitle: 'Repeat calibration',
      showDataMissing: 'No valid gaze samples were captured during this trial.',
      showDataPrompt: 'Press Enter or Space to view the practice result.',
      showDataSummary: 'The eye-movement trial captured {count} native WebGazer samples.',
      showDataTitle: 'Eye-tracking data captured',
      title: 'WebGazer calibration',
      validationInstructions: 'Look at each point while calibration accuracy is measured.',
      validationNoClick: 'Do not click the points during validation.',
      validationTitle: 'Validate calibration',
    },
    trial,
    {
      images: [customTargetImage, backgroundImage],
      audio: [audio],
    },
  );
}

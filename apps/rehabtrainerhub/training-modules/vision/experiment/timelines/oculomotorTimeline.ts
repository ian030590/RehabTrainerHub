// Timeline local to the Hub-owned oculomotor module.
import WebGazerExtension from '@jspsych/extension-webgazer';
import PixiOculomotorTrainingPlugin from '../plugins/pixi-oculomotor-training';
import { GetSetting } from '../../utils/settings';
import {
  ConsumeOfficialWebGazerTrialData,
  CreateWebGazerExperimentTimeline,
} from '../../utils/webgazerCalibration';
import type { BuildTimelineOverrides } from './types';

export function BuildOculomotorTimeline(overrides?: BuildTimelineOverrides): object[] {
  const mode = overrides?.oculomotor?.mode ?? GetSetting('oculomotorMode');
  const pattern = overrides?.oculomotor?.pattern ?? GetSetting('oculomotorPattern');
  const durationSec = overrides?.oculomotor?.durationSec ?? GetSetting('oculomotorDurationSec');
  const behavior = overrides?.oculomotor?.behavior ?? GetSetting('oculomotorBehavior');
  const speedUnit = overrides?.oculomotor?.speedUnit ?? GetSetting('oculomotorSpeedUnit');
  const speedValue = overrides?.oculomotor?.speedValue ?? GetSetting('oculomotorSpeedValue');
  const targetRadiusPx = overrides?.oculomotor?.targetRadiusPx ?? GetSetting('oculomotorTargetRadiusPx');
  const targetCount = overrides?.oculomotor?.targetCount ?? GetSetting('oculomotorTargetCount');
  const distractorCount = overrides?.oculomotor?.distractorCount ?? GetSetting('oculomotorDistractorCount');
  const distractorBrightness = overrides?.oculomotor?.distractorBrightness
    ?? GetSetting('oculomotorDistractorBrightness');
  const targetColor = overrides?.oculomotor?.targetColor ?? GetSetting('oculomotorTargetColor');
  const backgroundColor = overrides?.oculomotor?.backgroundColor ?? GetSetting('oculomotorBackgroundColor');
  const targetShape = overrides?.oculomotor?.targetShape ?? GetSetting('oculomotorTargetShape');
  const customTargetImage = overrides?.oculomotor?.customTargetImage ?? GetSetting('oculomotorCustomTargetImage');
  const opacity = overrides?.oculomotor?.opacity ?? GetSetting('oculomotorTargetOpacity');
  const backgroundImage = overrides?.oculomotor?.backgroundImage ?? GetSetting('oculomotorBackgroundImage');
  const audio = overrides?.oculomotor?.audio ?? GetSetting('oculomotorAudio');
  const bounceJitter = overrides?.oculomotor?.bounceJitter ?? GetSetting('oculomotorBounceJitter');
  const motionDirection = overrides?.oculomotor?.motionDirection ?? GetSetting('oculomotorMotionDirection');
  const showTrail = overrides?.oculomotor?.showTrail ?? GetSetting('oculomotorShowTrail');
  const letterEnabled = overrides?.oculomotor?.letterEnabled ?? GetSetting('oculomotorLetterEnabled');
  const letterColor = overrides?.oculomotor?.letterColor ?? GetSetting('oculomotorLetterColor');
  const letterWeight = overrides?.oculomotor?.letterWeight ?? GetSetting('oculomotorLetterWeight');
  const letterScale = overrides?.oculomotor?.letterScale ?? GetSetting('oculomotorLetterScale');
  const lilacChaserScale = overrides?.oculomotor?.lilacChaserScale
    ?? GetSetting('oculomotorLilacChaserScale');
  const lilacChaserColor = overrides?.oculomotor?.lilacChaserColor
    ?? GetSetting('oculomotorLilacChaserColor');
  const viewingDistanceCm = overrides?.oculomotor?.viewingDistanceCm
    ?? GetSetting('oculomotorViewingDistanceCm');
  const cssPxPerCm = overrides?.oculomotor?.cssPxPerCm ?? GetSetting('oculomotorCssPxPerCm');
  const enableWebGazer = GetSetting('oculomotorEnableWebgazer');
  const showGazepoint = overrides?.oculomotor?.showGazepoint
    ?? GetSetting('oculomotorShowGazepoint');

  const trial = {
    type: PixiOculomotorTrainingPlugin,
    mode,
    pattern,
    behavior,
    duration_ms: Math.round(durationSec * 1000),
    speed_value: speedValue,
    speed_unit: speedUnit,
    viewing_distance_cm: viewingDistanceCm,
    css_px_per_cm: cssPxPerCm,
    target_radius_px: targetRadiusPx,
    target_count: targetCount,
    distractor_count: distractorCount,
    distractor_brightness: distractorBrightness,
    target_color: targetColor,
    background_color: backgroundColor,
    target_shape: targetShape,
    custom_target_image: customTargetImage,
    opacity,
    background_image: backgroundImage,
    audio,
    bounce_jitter: bounceJitter,
    motion_direction: motionDirection,
    show_trail: showTrail,
    letter_enabled: letterEnabled,
    letter_color: letterColor,
    letter_weight: letterWeight,
    letter_scale: letterScale,
    lilac_chaser_scale: lilacChaserScale,
    lilac_chaser_color: lilacChaserColor,
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
      cameraPreviewLabel: 'Live camera preview with face-position feedback',
      cameraTitle: 'Camera access',
      continueButtonText: 'Continue',
      instruction1: 'Center your face in the camera view and look directly at the camera. Continue becomes available when the feedback box turns green.',
      instruction2: 'Look at each point, then click or tap its center twice.',
      instruction3: 'Keep your head steady until all points are complete.',
      signalCheckCalibration: 'Before calibration starts, keep looking at the center of the screen.',
      signalCheckInstructions: 'Use the live camera preview to confirm that your full face is visible and is not too close to or too far from the camera.',
      signalCheckTitle: 'Checking eye-tracking signal',
      signalCheckValidation: 'Before validation starts, keep looking at the center of the screen.',
      signalMissingInstructions: 'No eye-tracking signal was detected in the first 3 seconds. Move closer to or farther from the camera until your full face is visible, then retry.',
      signalMissingTitle: 'Eye-tracking signal not detected',
      signalRetryButtonText: 'Check again',
      signalSkipButtonText: 'Do not record eye-tracking results this time',
      signalSkippedText: 'Eye-tracking recording was skipped for this session. The practice will continue without eye-tracking scores.',
      signalSkippedTitle: 'Eye-tracking recording skipped',
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

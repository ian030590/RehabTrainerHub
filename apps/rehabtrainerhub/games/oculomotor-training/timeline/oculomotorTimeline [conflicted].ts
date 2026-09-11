import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned oculomotor module.
import WebGazerExtension from '@jspsych/extension-webgazer';
import { GetSetting } from '@rehab-trainer/ui/settings';
import PixiOculomotorTrainingPlugin from '../pixi-oculomotor-training';
import type { JsPsych } from 'jspsych';
import {
ConsumeOfficialWebGazerTrialData,
CreateWebGazerExperimentTimeline,
} from '../webgazer/webgazerCalibration';

export function BuildOculomotorTimeline(jsPsych: JsPsych, t: (key: string) => string): object[] {
  const mode = (GetHostedGameSetting<'pursuit' | 'reaction-jumps' | 'multi-object' | 'lilac-chaser'>('mode'));
  const pattern = (GetHostedGameSetting<string>('movementPath'));
  const durationSec = (GetHostedGameSetting<number>('durationSec'));
  const behavior = (GetHostedGameSetting<string>('behavior'));
  const speedUnit = (GetHostedGameSetting<'deg/s' | 'cm/s' | 'screen/s'>('speedUnit'));
  const speedValue = (GetHostedGameSetting<number>('speedValue'));
  const targetRadiusPx = (GetHostedGameSetting<number>('targetSizePx') / 2);
  const targetCount = (GetHostedGameSetting<number>('targetCount'));
  const distractorCount = (GetHostedGameSetting<number>('distractorCount'));
  const distractorBrightness = (GetHostedGameSetting<number>('distractorBrightness'));
  const targetColor = (GetHostedGameSetting<string>('targetColor'));
  const backgroundColor = '#000000';
  const targetShape = (GetHostedGameSetting<string>('targetShape'));
  const customTargetImage = '';
  const opacity = (GetHostedGameSetting<number>('targetOpacity'));
  const backgroundImage = '';
  const audio = '';
  const bounceJitter = 0;
  const motionDirection = (GetHostedGameSetting<number>('motionDirection'));
  const showTrail = (GetHostedGameSetting<boolean>('showTrail'));
  const letterEnabled = (GetHostedGameSetting<boolean>('letterEnabled'));
  const letterColor = (GetHostedGameSetting<string>('letterColor'));
  const letterWeight = (GetHostedGameSetting<number>('letterWeight'));
  const letterScale = (GetHostedGameSetting<number>('letterScale'));
  const lilacChaserScale = (GetHostedGameSetting<number>('lilacChaserScale'));
  const lilacChaserColor = (GetHostedGameSetting<string>('lilacChaserBallColor'));
  const viewingDistanceCm = (GetHostedGameSetting<number>('viewingDistanceCm'));
  const cssPxPerCm = (GetHostedGameSetting<number>('cssPxPerCm'));
  const enableWebGazer = (GetHostedGameSetting<boolean>('webgazerEnabled'));
  const showGazepoint = (GetHostedGameSetting<boolean>('gazePointVisible'));
  const targetAxes = Array.from({ length: 8 }, (_, axis) => axis).filter((axis) => GetHostedGameSetting<boolean>(`axis${axis}Enabled`));

  const trial = {
    type: PixiOculomotorTrainingPlugin,
    mode,
    pattern,
    behavior,
    duration_ms: Math.round(durationSec * 1000),
    target_axes: targetAxes,
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
  if (!jsPsych) {
    throw new Error('The jsPsych instance is required for the official WebGazer flow.');
  }

  return CreateWebGazerExperimentTimeline(
    jsPsych,
    {
      beginInstructions: t('settings.wg.beginInstructions'),
      beginPrompt: t('settings.wg.beginPrompt'),
      beginTitle: t('settings.wg.beginTitle'),
      buttonText: 'Start calibration',
      calibrationDoneText: 'Calibration and validation are complete.',
      cameraInstructions: t('settings.wg.cameraInstructions'),
      cameraPermissionButtonText: 'Got it',
      cameraPreviewLabel: t('settings.wg.cameraPreviewLabel'),
      cameraTitle: t('settings.wg.cameraTitle'),
      continueButtonText: 'Continue',
      instruction1: 'Center your face in the camera view and look directly at the camera. Continue becomes available when the feedback box turns green.',
      instruction2: 'Look at each point, then click or tap its center twice.',
      instruction3: 'Keep your head steady until all points are complete.',
      signalCheckCalibration: t('settings.wg.signalCheckCalibration'),
      signalCheckInstructions: t('settings.wg.signalCheckInstructions'),
      signalCheckTitle: t('settings.wg.signalCheckTitle'),
      signalCheckValidation: t('settings.wg.signalCheckValidation'),
      signalMissingInstructions: t('settings.wg.signalMissingInstructions'),
      signalMissingTitle: t('settings.wg.signalMissingTitle'),
      signalRetryButtonText: t('settings.wg.signalRetryButton'),
      signalSkipButtonText: t('settings.wg.signalSkipButton'),
      signalSkippedText: t('settings.wg.signalSkippedText'),
      signalSkippedTitle: t('settings.wg.signalSkippedTitle'),
      recalibrateInstructions: t('settings.wg.recalibrateInstructions'),
      recalibrateTitle: t('settings.wg.recalibrateTitle'),
      showDataMissing: t('settings.wg.showDataMissing'),
      showDataPrompt: t('settings.wg.showDataPrompt'),
      showDataSummary: t('settings.wg.showDataSummary'),
      showDataTitle: t('settings.wg.showDataTitle'),
      title: t('settings.wg.title'),
      validationInstructions: t('settings.wg.validationInstructions'),
      validationNoClick: t('settings.wg.validationNoClick'),
      validationTitle: t('settings.wg.validationTitle'),
    },
    trial,
    {
      images: [customTargetImage, backgroundImage],
      audio: [audio],
    },
  );
}

import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned oculomotor module.
import WebGazerExtension from '@jspsych/extension-webgazer';
import { CreateTobiiValidationFlow } from '../gaze/tobiiHost';
import PixiOculomotorTrainingPlugin from '../pixi-oculomotor-training';
import type { JsPsych } from 'jspsych';
import {
ConsumeOfficialWebGazerTrialData,
CreateWebGazerExperimentTimeline,
} from '../webgazer/webgazerCalibration';

export function BuildOculomotorTimeline(jsPsych: JsPsych, t: (key: string) => string): object[] {
  const mode = (GetHostedGameSetting<'vor' | 'pursuit' | 'saccade' | 'fixation' | 'reaction-jumps' | 'multi-object' | 'lilac-chaser'>('mode'));
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
  const screenWidthCm = GetHostedGameSetting<number>('screenWidthCm');
  const screenHeightCm = GetHostedGameSetting<number>('screenHeightCm');
  const cssPxPerCm = innerWidth / screenWidthCm;
  const cssPxPerCmY = innerHeight / screenHeightCm;
  const referenceSettings = {
    run_mode: GetHostedGameSetting<'evaluation' | 'predictable' | 'random'>('runMode'),
    stimulus_type: GetHostedGameSetting<'white_dot' | 'red_in_white' | 'numbers_dot'>('stimulusType'),
    target_size_arcmin: GetHostedGameSetting<number>('targetSizeArcmin'),
    speed_arcmin_sec: GetHostedGameSetting<number>('speedArcminSec'),
    dwell_ms: GetHostedGameSetting<number>('dwellMs'),
    hold_ms: GetHostedGameSetting<number>('holdSec') * 1000,
    vor_change_ms: GetHostedGameSetting<number>('vorChangeMs'),
  };
  const eyeTrackingSource = GetHostedGameSetting<'off' | 'webgazer' | 'tobii'>('eyeTrackingSource');
  const enableWebGazer = eyeTrackingSource === 'webgazer';
  const enableTobii = eyeTrackingSource === 'tobii';
  const fallbackThresholdDeg = GetHostedGameSetting<number>('gazeThresholdArcmin') / 60;
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
    ...referenceSettings,
    viewing_distance_cm: viewingDistanceCm,
    screen_width_cm: screenWidthCm,
    screen_height_cm: screenHeightCm,
    css_px_per_cm: cssPxPerCm,
    css_px_per_cm_y: cssPxPerCmY,
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
    eye_tracking_source: eyeTrackingSource,
    gaze_threshold_deg: fallbackThresholdDeg,
    show_gaze_point: eyeTrackingSource !== 'off' && showGazepoint,
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

  if (enableTobii) {
    const validation = CreateTobiiValidationFlow(cssPxPerCm, viewingDistanceCm, cssPxPerCmY);
    const trackedTrial = {
      ...trial,
      gaze_threshold_deg: () => validation.getThresholdDeg() ?? fallbackThresholdDeg,
      validation_error_deg: () => validation.getMeanErrorDeg() ?? -1,
    };
    return [validation.timeline,
      { timeline: [trackedTrial], conditional_function: validation.isRecording },
      { timeline: [{ ...trial, eye_tracking_source: 'off', show_gaze_point: false }],
        conditional_function: () => !validation.isRecording() },
    ];
  }
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
      buttonText: t('settings.wg.startCalibration'),
      calibrationDoneText: t('settings.wg.calibrationComplete'),
      cameraInstructions: t('settings.wg.cameraInstructions'),
      cameraPermissionButtonText: t('settings.wg.cameraContinue'),
      cameraPreviewLabel: t('settings.wg.cameraPreviewLabel'),
      cameraTitle: t('settings.wg.cameraTitle'),
      continueButtonText: t('settings.wg.continue'),
      instruction1: t('settings.wg.positionInstruction'),
      instruction2: t('settings.wg.clickInstruction'),
      instruction3: t('settings.wg.steadyInstruction'),
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
      viewportChangedText: t('settings.wg.viewportChanged'),
    },
    trial,
    {
      images: [customTargetImage, backgroundImage],
      audio: [audio],
    },
    cssPxPerCm,
    viewingDistanceCm,
    cssPxPerCmY,
  );
}

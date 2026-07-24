import WebgazerInitCameraPlugin from '@jspsych/plugin-webgazer-init-camera';
import WebgazerCalibratePlugin from '@jspsych/plugin-webgazer-calibrate';
import PixiOculomotorTrainingPlugin from '../plugins/pixi-oculomotor-training';
import { GetSetting } from '../../utils/settings';
import { PixelFromDegree, PixelFromMillimeter } from '../../utils/spatialUtils';
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

  const timeline: object[] = [];

  if (enableWebGazer) {
    timeline.push({
      type: WebgazerInitCameraPlugin,
    });

    if (!GetSetting('webGazerCalibrationAt')) {
      timeline.push({
        type: WebgazerCalibratePlugin,
        calibration_points: [
          [10, 10], [10, 50], [10, 90],
          [50, 10], [50, 50], [50, 90],
          [90, 10], [90, 50], [90, 90],
        ],
        repetitions_per_point: 2,
        randomize_calibration_order: true,
      });
    }
  }

  timeline.push({
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
    round_number: 1,
    total_rounds: 1,
  });

  return timeline;
}

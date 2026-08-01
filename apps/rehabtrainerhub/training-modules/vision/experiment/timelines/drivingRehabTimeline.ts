// Timeline local to the Hub-owned driving module.
import { GetSetting } from '../../utils/settings';
import { ParseDrivingWheelCalibration } from '../plugins/driving/driving-input';
import type { BuildTimelineOverrides } from './types';

export async function BuildDrivingRehabTimeline(overrides?: BuildTimelineOverrides): Promise<object[]> {
  const { default: ThreeDrivingRehabPlugin } = await import('../plugins/three-driving-rehab');

  const redFlashEnabled = overrides?.driving?.redFlashEnabled ?? GetSetting('drivingRedFlashEnabled');
  const drivingDifficulty = overrides?.driving?.difficulty ?? GetSetting('drivingDifficulty');
  const drivingControlMode = overrides?.driving?.controlMode ?? GetSetting('drivingControlMode');
  const wheelCalibration = overrides?.driving?.wheelCalibration
    ?? ParseDrivingWheelCalibration(GetSetting('drivingWheelCalibration'));
  const drivingRenderQuality = overrides?.driving?.renderQuality ?? GetSetting('drivingRenderQuality');
  const language = overrides?.driving?.language ?? 'zh';

  return [
    {
      type: ThreeDrivingRehabPlugin,
      red_flash_enabled: redFlashEnabled,
      driving_difficulty: drivingDifficulty,
      control_mode: drivingControlMode,
      wheel_calibration: wheelCalibration,
      render_quality: drivingRenderQuality,
      language,
    },
  ];
}

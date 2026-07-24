import { GetSetting } from '../../utils/settings';
import type { BuildTimelineOverrides } from './types';

export async function BuildDrivingRehabTimeline(overrides?: BuildTimelineOverrides): Promise<object[]> {
  const { default: ThreeDrivingRehabPlugin } = await import('../plugins/three-driving-rehab');

  const redFlashEnabled = overrides?.driving?.redFlashEnabled ?? GetSetting('drivingRedFlashEnabled');
  const drivingDifficulty = overrides?.driving?.difficulty ?? GetSetting('drivingDifficulty');
  const drivingControlMode = overrides?.driving?.controlMode ?? GetSetting('drivingControlMode');
  const language = overrides?.driving?.language ?? 'zh';

  return [
    {
      type: ThreeDrivingRehabPlugin,
      red_flash_enabled: redFlashEnabled,
      driving_difficulty: drivingDifficulty,
      control_mode: drivingControlMode,
      language,
    },
  ];
}

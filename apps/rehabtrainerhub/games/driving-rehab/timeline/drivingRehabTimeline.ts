import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned driving module.
import { GetSetting } from '@rehab-trainer/ui/settings';
import { ParseDrivingWheelCalibration } from '../input/driving-input';
type BuildTimelineOverrides = { driving?: { redFlashEnabled?: boolean; difficulty?: string; controlMode?: string; wheelCalibration?: ReturnType<typeof ParseDrivingWheelCalibration>; renderQuality?: string; language?: 'zh' | 'en' } };

export async function BuildDrivingRehabTimeline(overrides?: BuildTimelineOverrides): Promise<object[]> {
  const { default: ThreeDrivingRehabPlugin } = await import('../three-driving-rehab');

  const redFlashEnabled = overrides?.driving?.redFlashEnabled ?? (GetHostedGameSetting<boolean>('redFlashEnabled'));
  const drivingDifficulty = overrides?.driving?.difficulty ?? ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const drivingControlMode = overrides?.driving?.controlMode ?? (GetHostedGameSetting<'arrow' | 'wasd' | 'wheel' | 'touch'>('controlMode'));
  const wheelCalibration = overrides?.driving?.wheelCalibration
    ?? ParseDrivingWheelCalibration(localStorage.getItem('rehab_driving-rehab_wheelCalibration') ?? '');
  const drivingRenderQuality = overrides?.driving?.renderQuality ?? (GetHostedGameSetting<'low' | 'medium' | 'high'>('renderQuality'));
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

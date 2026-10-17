import ThreeDrivingRehabPlugin from '../three-driving-rehab';
import type { DrivingSettings } from '../settings';
import type { DrivingWheelCalibration } from '../input/driving-input';

export function BuildDrivingRehabTimeline(settings: DrivingSettings, language: 'zh' | 'en', wheelCalibration: DrivingWheelCalibration | null) {
  return [{ type: ThreeDrivingRehabPlugin, red_flash_enabled: settings.redFlashEnabled,
    driving_difficulty: ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[settings.difficulty],
    control_mode: settings.controlMode, wheel_calibration: wheelCalibration, render_quality: settings.renderQuality, language }];
}

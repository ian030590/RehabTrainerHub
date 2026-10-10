import { GenerateRandomLetters } from '../gameUtils';
import { ValidateSettings, type MovingCardSettings } from '../settings';
import PixiMovingCardPlugin from '../pixi-moving-card';

export function BuildMovingCardTimeline(settings: MovingCardSettings, language: 'zh' | 'en'): object[] {
  if (!ValidateSettings(settings)) throw new Error('Invalid moving-card settings.');
  return Array.from({ length: settings.rounds }, (_, index) => ({
    type: PixiMovingCardPlugin, target_letters: GenerateRandomLetters(2), option_count: settings.optionCount,
    difficulty: ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[settings.difficulty],
    move_interval_ms: settings.optionMoveIntervalMs, target_size_mm: settings.targetPhysicalSizeMm,
    option_size_mm: settings.optionPhysicalSizeMm, calibration_length_mm: settings.calibrationLengthMm,
    language, round_number: index + 1, total_rounds: settings.rounds,
  }));
}

import { ValidateSettings, type GaborSettings } from '../settings';
import PixiGaborPatchingPlugin from '../pixi-gabor-patching';

export function BuildGaborPatchingTimeline(settings: GaborSettings, language: 'zh' | 'en'): object[] {
  if (!ValidateSettings(settings)) throw new Error('Invalid Gabor settings.');
  const difficulty = ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[settings.difficulty];

  return [
    {
      type: PixiGaborPatchingPlugin,
      duration_ms: Math.round(settings.durationSec * 1000),
      max_spots: settings.maxSpots,
      difficulty,
      language,
    },
  ];
}

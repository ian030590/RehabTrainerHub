import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned Gabor module.
type BuildTimelineOverrides = { difficulty?: string; gabor?: { durationSec?: number; maxSpots?: number } };
import { GetSetting } from '@rehab-trainer/ui/settings';
import PixiGaborPatchingPlugin from '../pixi-gabor-patching';

export function BuildGaborPatchingTimeline(overrides?: BuildTimelineOverrides): object[] {
  const durationSec = overrides?.gabor?.durationSec ?? GetHostedGameSetting<number>('durationSec');
  const maxSpots = overrides?.gabor?.maxSpots ?? GetHostedGameSetting<number>('maxSpots');
  const difficulty = overrides?.difficulty ?? ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];

  return [
    {
      type: PixiGaborPatchingPlugin,
      duration_ms: Math.round(durationSec * 1000),
      max_spots: maxSpots,
      difficulty,
    },
  ];
}

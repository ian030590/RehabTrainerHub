// Timeline local to the Hub-owned Gabor module.
import PixiGaborPatchingPlugin from '../pixi-gabor-patching';
import { GetSetting } from '@rehab-trainer/ui/settings';
import type { BuildTimelineOverrides } from '@rehab-trainer/ui';

export function BuildGaborPatchingTimeline(overrides?: BuildTimelineOverrides): object[] {
  const durationSec = overrides?.gabor?.durationSec ?? GetSetting('oculomotorDurationSec');
  const maxSpots = overrides?.gabor?.maxSpots ?? 10;
  const difficulty = overrides?.difficulty ?? GetSetting('difficulty');

  return [
    {
      type: PixiGaborPatchingPlugin,
      duration_ms: Math.round(durationSec * 1000),
      max_spots: maxSpots,
      difficulty,
    },
  ];
}

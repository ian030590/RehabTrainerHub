import PixiGaborPatchingPlugin from '../plugins/pixi-gabor-patching';
import { GetSetting } from '../../utils/settings';
import type { BuildTimelineOverrides } from './types';

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

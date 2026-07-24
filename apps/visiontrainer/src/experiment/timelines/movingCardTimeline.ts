import PixiMovingCardPlugin from '../plugins/pixi-moving-card';
import { GetSetting } from '../../utils/settings';
import { GenerateRandomLetters } from '../../utils/mathUtils';
import type { BuildTimelineOverrides } from './types';

export function BuildMovingCardTimeline(overrides?: BuildTimelineOverrides): object[] {
  const totalRounds = overrides?.totalRounds ?? GetSetting('totalRounds');
  const difficulty = overrides?.difficulty ?? GetSetting('difficulty');
  const optionCount = GetSetting('optionCount');
  const moveInterval = GetSetting('optionMoveIntervalMs');
  const targetSizeMm = GetSetting('targetPhysicalSizeMm');
  const optionSizeMm = GetSetting('optionPhysicalSizeMm');

  const timeline: object[] = [];

  for (let i = 0; i < totalRounds; i++) {
    timeline.push({
      type: PixiMovingCardPlugin,
      target_letters: GenerateRandomLetters(2),
      option_count: optionCount,
      difficulty,
      move_interval_ms: moveInterval,
      target_size_mm: targetSizeMm,
      option_size_mm: optionSizeMm,
      round_number: i + 1,
      total_rounds: totalRounds,
    });
  }

  return timeline;
}

import { GetHostedGameSetting } from '@rehab-trainer/ui/embeddedTraining';
// Timeline local to the Hub-owned moving-card module.
type BuildTimelineOverrides = { totalRounds?: number; difficulty?: string };
import { GenerateRandomLetters } from '@rehab-trainer/ui/mathUtils';
import { GetSetting } from '@rehab-trainer/ui/settings';
import PixiMovingCardPlugin from '../pixi-moving-card';

export function BuildMovingCardTimeline(overrides?: BuildTimelineOverrides): object[] {
  const totalRounds = overrides?.totalRounds ?? (GetHostedGameSetting<number>('rounds'));
  const difficulty = overrides?.difficulty ?? ({ easy: 'beginner', medium: 'intermediate', hard: 'advanced' } as const)[GetHostedGameSetting<'easy' | 'medium' | 'hard'>('difficulty')];
  const optionCount = GetHostedGameSetting<number>('optionCount');
  const moveInterval = GetHostedGameSetting<number>('optionMoveIntervalMs');
  const targetSizeMm = GetHostedGameSetting<number>('targetPhysicalSizeMm');
  const optionSizeMm = GetHostedGameSetting<number>('optionPhysicalSizeMm');

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

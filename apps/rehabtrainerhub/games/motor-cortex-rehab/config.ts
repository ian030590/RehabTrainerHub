import type { DifficultyDefinition, DrillId, DifficultyId, HandChoice } from './types';

export interface MotorConfig {
  drill: DrillId;
  difficulty: DifficultyId;
  durationSec: number;
  handChoice: HandChoice;
  targetSizePercent: number;
  speedPercent: number;
  raiseLinePercent: number;
}
export const defaultConfig: MotorConfig = { drill: 'bounce', difficulty: 'intermediate', durationSec: 60, handChoice: 'any', targetSizePercent: 100, speedPercent: 100, raiseLinePercent: 65 };
export const difficulties: readonly DifficultyDefinition[] = [
  { id: 'beginner', radius: 82, speed: 120, holdMs: 1500 },
  { id: 'intermediate', radius: 66, speed: 165, holdMs: 2000 },
  { id: 'advanced', radius: 54, speed: 220, holdMs: 2500 },
];
export function IsMotorConfig(config: MotorConfig) {
  return ['bounce', 'vertical', 'horizontal', 'random'].includes(config.drill)
    && ['beginner', 'intermediate', 'advanced'].includes(config.difficulty)
    && [45, 60, 90].includes(config.durationSec) && ['any', 'left', 'right'].includes(config.handChoice)
    && Number.isInteger(config.targetSizePercent) && config.targetSizePercent >= 75 && config.targetSizePercent <= 130 && config.targetSizePercent % 5 === 0
    && Number.isInteger(config.speedPercent) && config.speedPercent >= 70 && config.speedPercent <= 140 && config.speedPercent % 5 === 0
    && Number.isInteger(config.raiseLinePercent) && [50, 65, 80].includes(config.raiseLinePercent);
}

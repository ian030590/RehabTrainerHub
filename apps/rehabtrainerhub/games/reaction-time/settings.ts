import { foreperiods, type Difficulty } from './logic/reactionTrials';

export interface ReactionSettings { difficulty: Difficulty; rounds: number; timeLimitSec: number; soundEnabled: boolean }

export const defaultSettings: ReactionSettings = { difficulty: 'medium', rounds: 10, timeLimitSec: 0, soundEnabled: true };
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
export const timeLimits = [0, 60, 180, 300];
export const roundsRange = { min: 5, max: 50, step: 5 };

export function ValidateSettings(settings: ReactionSettings): boolean {
  const rounds = settings?.rounds;
  return difficulties.includes(settings.difficulty) && typeof rounds === 'number' && Number.isInteger(rounds)
    && rounds >= roundsRange.min && rounds <= roundsRange.max && rounds % roundsRange.step === 0
    && typeof settings.timeLimitSec === 'number' && timeLimits.includes(settings.timeLimitSec) && typeof settings.soundEnabled === 'boolean';
}

// Each success takes the mean wait plus about 1 s to respond and start the next one; false starts add more.
export function EstimatedSeconds(settings: ReactionSettings): number {
  const [low, high] = foreperiods[settings.difficulty];
  const seconds = Math.round(settings.rounds * ((low + high) / 2 + 1000) / 1000);
  return settings.timeLimitSec ? Math.min(settings.timeLimitSec, seconds) : seconds;
}

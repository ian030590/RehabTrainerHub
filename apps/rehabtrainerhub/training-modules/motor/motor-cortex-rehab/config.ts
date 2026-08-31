export type MotorCortexDrill = 'bounce' | 'vertical' | 'horizontal' | 'random';
export type MotorCortexDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type MotorCortexHandChoice = 'any' | 'left' | 'right';

export interface MotorCortexRehabConfig extends Record<string, unknown> {
  drill: MotorCortexDrill;
  difficulty: MotorCortexDifficulty;
  durationSec: number;
  handChoice: MotorCortexHandChoice;
  targetSizeScale: number;
  speedScale: number;
}

export const motorCortexRehabDefaults: Readonly<MotorCortexRehabConfig> = Object.freeze({
  drill: 'bounce',
  difficulty: 'beginner',
  durationSec: 60,
  handChoice: 'any',
  targetSizeScale: 1,
  speedScale: 1,
});

export const motorCortexDrillOptions: ReadonlyArray<MotorCortexDrill> = Object.freeze([
  'bounce', 'vertical', 'horizontal', 'random',
]);
export const motorCortexDifficultyOptions: ReadonlyArray<MotorCortexDifficulty> = Object.freeze([
  'beginner', 'intermediate', 'advanced',
]);
export const motorCortexHandChoiceOptions: ReadonlyArray<MotorCortexHandChoice> = Object.freeze([
  'any', 'left', 'right',
]);

export const motorCortexRehabConfigBounds = Object.freeze({
  durationSec: Object.freeze({ min: 15, max: 600 }),
  targetSizeScale: Object.freeze({ min: 0.5, max: 1.5 }),
  speedScale: Object.freeze({ min: 0.5, max: 1.5 }),
});

export function ValidateMotorCortexRehabConfig(input: unknown):
  | { ok: true; value: MotorCortexRehabConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!motorCortexDrillOptions.includes(source.drill as MotorCortexDrill)) issues.push(Issue('drill', 'enum'));
  if (!motorCortexDifficultyOptions.includes(source.difficulty as MotorCortexDifficulty)) issues.push(Issue('difficulty', 'enum'));
  if (!motorCortexHandChoiceOptions.includes(source.handChoice as MotorCortexHandChoice)) issues.push(Issue('handChoice', 'enum'));
  for (const key of ['durationSec', 'targetSizeScale', 'speedScale'] as const) {
    const range = motorCortexRehabConfigBounds[key];
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < range.min || value > range.max
      || (key === 'durationSec' && !Number.isInteger(value))) issues.push(Issue(key, 'range'));
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      drill: source.drill as MotorCortexDrill,
      difficulty: source.difficulty as MotorCortexDifficulty,
      durationSec: source.durationSec as number,
      handChoice: source.handChoice as MotorCortexHandChoice,
      targetSizeScale: source.targetSizeScale as number,
      speedScale: source.speedScale as number,
    }),
  };
}

function Issue(path: string, code: string) {
  return { path, code, messageKey: `training.motorCortexRehab.config.${path}` };
}

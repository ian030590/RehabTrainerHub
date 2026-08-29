export type AsteroidShieldDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type AsteroidShieldControlMode = 'mouse' | 'mediapipe';
export type AsteroidShieldHandChoice = 'any' | 'left' | 'right';

export interface AsteroidShieldConfig extends Record<string, unknown> {
  difficulty: AsteroidShieldDifficulty;
  durationSec: number;
  maxHp: number;
  shieldSizePercent: number;
  controlMode: AsteroidShieldControlMode;
  handChoice: AsteroidShieldHandChoice;
}

export const asteroidShieldDefaults: Readonly<AsteroidShieldConfig> = Object.freeze({
  difficulty: 'beginner',
  durationSec: 60,
  maxHp: 10,
  shieldSizePercent: 135,
  controlMode: 'mouse',
  handChoice: 'any',
});

export const asteroidShieldDifficultyOptions: ReadonlyArray<AsteroidShieldDifficulty> = Object.freeze([
  'beginner',
  'intermediate',
  'advanced',
]);

export const asteroidShieldControlModeOptions: ReadonlyArray<AsteroidShieldControlMode> = Object.freeze([
  'mouse',
  'mediapipe',
]);

export const asteroidShieldHandChoiceOptions: ReadonlyArray<AsteroidShieldHandChoice> = Object.freeze([
  'any',
  'left',
  'right',
]);

export const asteroidShieldDurationOptions = Object.freeze([45, 60, 90]);
export const asteroidShieldHpOptions = Object.freeze([6, 10, 14]);
export const asteroidShieldSizeOptions = Object.freeze([115, 135, 155]);

export const asteroidShieldConfigBounds = Object.freeze({
  durationSec: Object.freeze({ min: 15, max: 600 }),
  maxHp: Object.freeze({ min: 1, max: 30 }),
  shieldSizePercent: Object.freeze({ min: 80, max: 220 }),
});

export function ValidateAsteroidShieldConfig(input: unknown):
  | { ok: true; value: AsteroidShieldConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!asteroidShieldDifficultyOptions.includes(source.difficulty as AsteroidShieldDifficulty)) {
    issues.push(Issue('difficulty', 'enum'));
  }
  if (!asteroidShieldControlModeOptions.includes(source.controlMode as AsteroidShieldControlMode)) {
    issues.push(Issue('controlMode', 'enum'));
  }
  if (!asteroidShieldHandChoiceOptions.includes(source.handChoice as AsteroidShieldHandChoice)) {
    issues.push(Issue('handChoice', 'enum'));
  }
  for (const key of ['durationSec', 'maxHp', 'shieldSizePercent'] as const) {
    const range = asteroidShieldConfigBounds[key];
    const value = source[key];
    if (typeof value !== 'number' || !Number.isInteger(value)
      || value < range.min || value > range.max) {
      issues.push(Issue(key, 'range'));
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      difficulty: source.difficulty as AsteroidShieldDifficulty,
      durationSec: source.durationSec as number,
      maxHp: source.maxHp as number,
      shieldSizePercent: source.shieldSizePercent as number,
      controlMode: source.controlMode as AsteroidShieldControlMode,
      handChoice: source.handChoice as AsteroidShieldHandChoice,
    }),
  };
}

function Issue(path: string, code: string) {
  return { path, code, messageKey: `training.asteroidShield.config.${path}` };
}

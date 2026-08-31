export type DrawingDefenseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type DrawingDefenseGameDurationSeconds = number | null;

export interface DrawingDefenseConfig extends Record<string, unknown> {
  difficulty: DrawingDefenseDifficulty;
  gameDurationSec: DrawingDefenseGameDurationSeconds;
  maxHp: number;
  speed: number;
  strictness: number;
  strokeWaitMs: number;
}

export const drawingDefenseDefaults: Readonly<DrawingDefenseConfig> = Object.freeze({
  difficulty: 'Beginner',
  gameDurationSec: 30,
  maxHp: 3,
  speed: 5,
  strictness: 20,
  strokeWaitMs: 300,
});

export const drawingDefenseDifficultyOptions: ReadonlyArray<DrawingDefenseDifficulty> = Object.freeze([
  'Beginner',
  'Intermediate',
  'Advanced',
]);

export const drawingDefenseConfigBounds = Object.freeze({
  gameDurationSec: Object.freeze({ min: 1, max: 1_800 }),
  maxHp: Object.freeze({ min: 1, max: 20 }),
  speed: Object.freeze({ min: 1, max: 170 }),
  strictness: Object.freeze({ min: 10, max: 90 }),
  strokeWaitMs: Object.freeze({ min: 180, max: 600 }),
});

export function ValidateDrawingDefenseConfig(input: unknown):
  | { ok: true; value: DrawingDefenseConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!drawingDefenseDifficultyOptions.includes(source.difficulty as DrawingDefenseDifficulty)) {
    issues.push(Issue('difficulty', 'enum'));
  }
  if (!IsDuration(source.gameDurationSec)) issues.push(Issue('gameDurationSec', 'range'));
  for (const key of ['maxHp', 'speed', 'strictness', 'strokeWaitMs'] as const) {
    const range = drawingDefenseConfigBounds[key];
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
      difficulty: source.difficulty as DrawingDefenseDifficulty,
      gameDurationSec: source.gameDurationSec as DrawingDefenseGameDurationSeconds,
      maxHp: source.maxHp as number,
      speed: source.speed as number,
      strictness: source.strictness as number,
      strokeWaitMs: source.strokeWaitMs as number,
    }),
  };
}

function IsDuration(value: unknown): value is DrawingDefenseGameDurationSeconds {
  return value === null
    || (typeof value === 'number'
      && Number.isInteger(value)
      && value >= drawingDefenseConfigBounds.gameDurationSec.min
      && value <= drawingDefenseConfigBounds.gameDurationSec.max);
}

function Issue(path: string, code: string) {
  return {
    path,
    code,
    messageKey: `training.drawing.config.${path}`,
  };
}

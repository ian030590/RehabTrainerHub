export type GestureBattlerTargetMode = 'free' | 'directed';

export interface GestureBattlerConfig extends Record<string, unknown> {
  enemyMaxHp: number;
  holdDuration: number;
  strictnessThreshold: number;
  targetMode: GestureBattlerTargetMode;
}

export const gestureBattlerDefaults: Readonly<GestureBattlerConfig> = Object.freeze({
  enemyMaxHp: 10,
  holdDuration: 2,
  strictnessThreshold: 0.7,
  targetMode: 'free',
});

export const gestureBattlerTargetModeOptions: ReadonlyArray<GestureBattlerTargetMode> = Object.freeze([
  'free',
  'directed',
]);

export const gestureBattlerConfigBounds = Object.freeze({
  enemyMaxHp: Object.freeze({ min: 1, max: 30 }),
  holdDuration: Object.freeze({ min: 0.5, max: 10 }),
  strictnessThreshold: Object.freeze({ min: 0.4, max: 0.95 }),
});

export function ValidateGestureBattlerConfig(input: unknown):
  | { ok: true; value: GestureBattlerConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!gestureBattlerTargetModeOptions.includes(source.targetMode as GestureBattlerTargetMode)) {
    issues.push(Issue('targetMode', 'enum'));
  }
  if (!IsBoundedNumber(source.enemyMaxHp, gestureBattlerConfigBounds.enemyMaxHp.min, gestureBattlerConfigBounds.enemyMaxHp.max, true)) {
    issues.push(Issue('enemyMaxHp', 'range'));
  }
  if (!IsBoundedNumber(source.holdDuration, gestureBattlerConfigBounds.holdDuration.min, gestureBattlerConfigBounds.holdDuration.max, false)) {
    issues.push(Issue('holdDuration', 'range'));
  }
  if (!IsBoundedNumber(source.strictnessThreshold, gestureBattlerConfigBounds.strictnessThreshold.min, gestureBattlerConfigBounds.strictnessThreshold.max, false)) {
    issues.push(Issue('strictnessThreshold', 'range'));
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      enemyMaxHp: source.enemyMaxHp as number,
      holdDuration: source.holdDuration as number,
      strictnessThreshold: source.strictnessThreshold as number,
      targetMode: source.targetMode as GestureBattlerTargetMode,
    }),
  };
}

function IsBoundedNumber(value: unknown, min: number, max: number, integer: boolean): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && (!integer || Number.isInteger(value))
    && value >= min
    && value <= max;
}

function Issue(path: string, code: string) {
  return { path, code, messageKey: `training.gestureBattler.config.${path}` };
}

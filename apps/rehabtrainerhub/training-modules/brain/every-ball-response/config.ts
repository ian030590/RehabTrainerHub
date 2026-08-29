export type EveryBallLevelId = 1 | 2 | 3;
export type EveryBallInputMode = 'camera' | 'microphone';
export type EveryBallFixationStyle = 'cross' | 'blank';

export interface EveryBallResponseConfig extends Record<string, unknown> {
  levelId: EveryBallLevelId;
  inputMode: EveryBallInputMode;
  fixationStyle: EveryBallFixationStyle;
  trialCount: number;
  microphoneSensitivity: number;
}

export const everyBallResponseDefaults: Readonly<EveryBallResponseConfig> = Object.freeze({
  levelId: 1,
  inputMode: 'camera',
  fixationStyle: 'cross',
  trialCount: 8,
  microphoneSensitivity: 0.65,
});

export const everyBallResponseLevelOptions: ReadonlyArray<EveryBallLevelId> = Object.freeze([1, 2, 3]);
export const everyBallResponseInputModeOptions: ReadonlyArray<EveryBallInputMode> = Object.freeze(['camera', 'microphone']);
export const everyBallResponseFixationStyleOptions: ReadonlyArray<EveryBallFixationStyle> = Object.freeze(['cross', 'blank']);
export const everyBallResponseLevelTrialCounts: Readonly<Record<EveryBallLevelId, number>> = Object.freeze({ 1: 8, 2: 16, 3: 20 });
export const everyBallResponseConfigBounds = Object.freeze({
  trialCount: Object.freeze({ min: 1, max: 240 }),
  microphoneSensitivity: Object.freeze({ min: 0.1, max: 1 }),
});

export function ValidateEveryBallResponseConfig(input: unknown):
  | { ok: true; value: EveryBallResponseConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  if (!everyBallResponseLevelOptions.includes(source.levelId as EveryBallLevelId)) issues.push(Issue('levelId', 'enum'));
  if (!everyBallResponseInputModeOptions.includes(source.inputMode as EveryBallInputMode)) issues.push(Issue('inputMode', 'enum'));
  if (!everyBallResponseFixationStyleOptions.includes(source.fixationStyle as EveryBallFixationStyle)) issues.push(Issue('fixationStyle', 'enum'));
  if (!IsBoundedInteger(source.trialCount, everyBallResponseConfigBounds.trialCount.min, everyBallResponseConfigBounds.trialCount.max)) issues.push(Issue('trialCount', 'range'));
  if (!IsBoundedNumber(source.microphoneSensitivity, everyBallResponseConfigBounds.microphoneSensitivity.min, everyBallResponseConfigBounds.microphoneSensitivity.max)) issues.push(Issue('microphoneSensitivity', 'range'));
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: Object.freeze({
    levelId: source.levelId as EveryBallLevelId,
    inputMode: source.inputMode as EveryBallInputMode,
    fixationStyle: source.fixationStyle as EveryBallFixationStyle,
    trialCount: source.trialCount as number,
    microphoneSensitivity: source.microphoneSensitivity as number,
  }) };
}

function IsBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function IsBoundedNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function Issue(path: string, code: string) {
  return { path, code, messageKey: `training.everyBallResponse.config.${path}` };
}

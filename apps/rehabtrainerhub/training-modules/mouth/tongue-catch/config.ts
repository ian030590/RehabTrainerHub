export interface TongueCatchConfig extends Record<string, unknown> {
  sensitivity: number;
  growthRate: number;
  durationSec: number;
  appleSpeed: number;
  spawnIntervalSec: number;
  edgeChance: number;
  cameraOpacity: number;
}

export const tongueCatchDefaults: Readonly<TongueCatchConfig> = Object.freeze({
  sensitivity: 0.65,
  growthRate: 240,
  durationSec: 60,
  appleSpeed: 90,
  spawnIntervalSec: 2.2,
  edgeChance: 0.4,
  cameraOpacity: 0.78,
});

export const tongueCatchConfigBounds = Object.freeze({
  sensitivity: Object.freeze({ min: 0.45, max: 0.95 }),
  growthRate: Object.freeze({ min: 80, max: 360 }),
  durationSec: Object.freeze({ min: 30, max: 300 }),
  appleSpeed: Object.freeze({ min: 60, max: 260 }),
  spawnIntervalSec: Object.freeze({ min: 0.6, max: 3.5 }),
  edgeChance: Object.freeze({ min: 0, max: 0.9 }),
  cameraOpacity: Object.freeze({ min: 0.25, max: 1 }),
});

export function ValidateTongueCatchConfig(input: unknown):
  | { ok: true; value: TongueCatchConfig }
  | { ok: false; issues: readonly { path: string; code: string; messageKey: string }[] } {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const issues: { path: string; code: string; messageKey: string }[] = [];
  for (const key of Object.keys(tongueCatchConfigBounds) as Array<keyof typeof tongueCatchConfigBounds>) {
    const value = source[key];
    const range = tongueCatchConfigBounds[key];
    if (typeof value !== 'number' || !Number.isFinite(value)
      || value < range.min || value > range.max) {
      issues.push(Issue(key));
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: Object.freeze({
      sensitivity: source.sensitivity as number,
      growthRate: source.growthRate as number,
      durationSec: source.durationSec as number,
      appleSpeed: source.appleSpeed as number,
      spawnIntervalSec: source.spawnIntervalSec as number,
      edgeChance: source.edgeChance as number,
      cameraOpacity: source.cameraOpacity as number,
    }),
  };
}

function Issue(path: string) {
  return {
    path,
    code: 'range',
    messageKey: `training.tongue.config.${path}`,
  };
}

export const inputModes = ['head', 'keyboard'] as const;
export type InputMode = typeof inputModes[number];

export interface SeagullSettings {
  inputMode: InputMode;
  durationSec: number;
  turnRangeDeg: number;
  nodRangeDeg: number;
  glideSec: number;
  ringIntervalSec: number;
}

// turnRangeDeg is the head turn that reaches the farthest ring; nodRangeDeg is how far up and down one nod goes.
export const defaultSettings: SeagullSettings = {
  inputMode: 'head', durationSec: 180, turnRangeDeg: 20, nodRangeDeg: 10, glideSec: 10, ringIntervalSec: 4.5,
};
export const rangeSettings = [
  { key: 'durationSec', min: 60, max: 600, step: 30 },
  { key: 'turnRangeDeg', min: 10, max: 45, step: 5 },
  { key: 'nodRangeDeg', min: 5, max: 25, step: 1 },
  { key: 'glideSec', min: 4, max: 20, step: 1 },
  { key: 'ringIntervalSec', min: 3, max: 8, step: 0.5 },
] as const;
export type RangeKey = typeof rangeSettings[number]['key'];

export function ValidateSettings(settings: SeagullSettings) {
  if (!inputModes.includes(settings.inputMode)) return false;
  return rangeSettings.every(({ key, min, max, step }) => {
    const value = settings[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min - 1e-9 || value > max + 1e-9) return false;
    const steps = (value - min) / step;
    return Math.abs(steps - Math.round(steps)) < 1e-6;
  });
}

export function ToPlayConfig(settings: SeagullSettings) {
  return {
    headControl: settings.inputMode === 'head', durationSec: settings.durationSec, turnRangeDeg: settings.turnRangeDeg,
    nodRangeDeg: settings.nodRangeDeg, glideSec: settings.glideSec, ringIntervalSec: settings.ringIntervalSec,
  };
}
export type PlayConfig = ReturnType<typeof ToPlayConfig>;

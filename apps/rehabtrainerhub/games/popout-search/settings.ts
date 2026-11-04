export interface SearchSettings {
  level: number;
  timeLimitMs: number;
  trialsPerBlock: number;
  symbolSizeDeg: number;
  screenWidthCm: number;
}

export const defaultSettings: SearchSettings = { level: 1, timeLimitMs: 1500, trialsPerBlock: 200, symbolSizeDeg: 1.4, screenWidthCm: 30 };

function OnStep(value: number, min: number, max: number, step: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min - 1e-9 && value <= max + 1e-9
    && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8;
}

export function ValidateSettings(settings: SearchSettings) {
  return [1, 2, 3, 4].includes(settings.level) && [1500, 2000, 0].includes(settings.timeLimitMs)
    && [20, 50, 100, 200].includes(settings.trialsPerBlock)
    && OnStep(settings.symbolSizeDeg, 1.4, 1.8, .1) && OnStep(settings.screenWidthCm, 15, 80, .5);
}

export function SymbolPx(screenWidthPx: number, symbolSizeDeg: number) {
  return Math.max(16, Math.round(screenWidthPx * Math.tan(symbolSizeDeg * Math.PI / 360) / Math.tan(20 * Math.PI / 180)));
}

export function ViewingDistanceCm(screenWidthCm: number) {
  return Math.round(screenWidthCm / 2 / Math.tan(20 * Math.PI / 180));
}

export function EstimatedSeconds(settings: SearchSettings): number | null {
  return settings.timeLimitMs === 0 ? null : Math.ceil(3 * settings.trialsPerBlock * (1300 + settings.timeLimitMs) / 1000);
}

export function NextSettings(settings: SearchSettings, passed: boolean): SearchSettings {
  return { ...settings, level: passed ? Math.min(4, settings.level + 1) : settings.level,
    timeLimitMs: passed ? 1500 : settings.timeLimitMs === 1500 ? 2000 : 0 };
}

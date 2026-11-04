export interface SaccadeSettings {
  practiceMinutes: number;
  itemsPerScreen: number;
  targetsPerScreen: number;
  distractors: 'mixed' | 'letters';
  symbolSizeDeg: number;
  screenTimeLimitSec: number;
  screenWidthCm: number;
}

export const defaultSettings: SaccadeSettings = { practiceMinutes: 15, itemsPerScreen: 40, targetsPerScreen: 6,
  distractors: 'mixed', symbolSizeDeg: 1.5, screenTimeLimitSec: 60, screenWidthCm: 30 };

export const numericSettings = [
  { key: 'practiceMinutes', zh: '搜尋時間（分）', en: 'Search time (min)', min: 5, max: 30, step: 5 },
  { key: 'itemsPerScreen', zh: '每個畫面的符號數', en: 'Symbols per screen', min: 20, max: 60, step: 10 },
  { key: 'targetsPerScreen', zh: '每個畫面的目標數', en: 'Targets per screen', min: 3, max: 8, step: 1 },
  { key: 'symbolSizeDeg', zh: '符號大小（視角度數）', en: 'Symbol size (degrees of visual angle)', min: 1, max: 3, step: .5 },
  { key: 'screenWidthCm', zh: '螢幕可見寬度（公分）', en: 'Visible screen width (cm)', min: 15, max: 80, step: .5 },
] as const;

export function ValidateSettings(settings: SaccadeSettings): boolean {
  if (!settings || typeof settings !== 'object') return false;
  return numericSettings.every(({ key, min, max, step }) => {
    const value = settings[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8;
  }) && settings.targetsPerScreen < settings.itemsPerScreen && ['mixed', 'letters'].includes(settings.distractors)
    && [0, 30, 60, 90, 120].includes(settings.screenTimeLimitSec);
}

export function ViewingDistanceCm(screenWidthCm: number): number {
  return Math.round(screenWidthCm / 2 / Math.tan(24 * Math.PI / 180));
}

export function SymbolPx(screenWidth: number, symbolSizeDeg: number): number {
  return Math.max(16, Math.round(screenWidth * Math.tan(symbolSizeDeg * Math.PI / 360) / Math.tan(24 * Math.PI / 180)));
}

export interface ReadingSettings {
  passage: number;
  wordsPerMinute: number;
  crowding: number;
  contrast: number;
}

export const defaultSettings: ReadingSettings = { passage: 0, wordsPerMinute: 240, crowding: 100, contrast: 100 };

export const numericSettings = [
  { key: 'passage', zh: '文章材料', en: 'Passage material', min: 0, max: 3, step: 1, unitZh: '', unitEn: '' },
  { key: 'wordsPerMinute', zh: '呈現速度', en: 'Presentation speed', min: 60, max: 600, step: 20, unitZh: '片段／分', unitEn: 'segments/min' },
  { key: 'crowding', zh: '每批呈現文字片段數', en: 'Segments per display', min: 100, max: 500, step: 100, unitZh: '%', unitEn: '%' },
  { key: 'contrast', zh: '文字對比', en: 'Text contrast', min: 20, max: 100, step: 10, unitZh: '%', unitEn: '%' },
] as const;

// 0 picks a passage at random; 1–3 are fixed passages in each language.
export const passageOptions = [0, 1, 2, 3] as const;
export const rangeSettings = numericSettings.filter(field => field.key !== 'passage' && field.key !== 'crowding');
// Batch size is shown as 1–5 segments; the saved value keeps the original 100–500 percent scale.
export const segmentsPerDisplay = (crowding: number) => crowding / 100;
export const crowdingFromSegments = (segments: number) => segments * 100;

export function ValidateSettings(settings: ReadingSettings): boolean {
  return numericSettings.every(field => {
    const value = settings?.[field.key];
    return typeof value === 'number' && Number.isFinite(value) && value >= field.min && value <= field.max
      && (value - field.min) % field.step === 0;
  });
}

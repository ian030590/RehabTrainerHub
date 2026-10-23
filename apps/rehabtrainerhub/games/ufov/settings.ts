export type Activity = 1 | 2 | 3;
export type UfovMode = 'formal' | 'practice';
export type StopCondition = 'adaptive_80' | 'fixed_trials';

export const axisKeys = ['axis0Enabled', 'axis1Enabled', 'axis2Enabled', 'axis3Enabled',
  'axis4Enabled', 'axis5Enabled', 'axis6Enabled', 'axis7Enabled'] as const;
export type AxisKey = typeof axisKeys[number];

export interface UfovSettings extends Record<AxisKey, boolean> {
  subtestId: number;
  mode: string;
  stopCondition: string;
  trialCount: number;
  contrastPercent: number;
  targetVisualAngleDeg: number;
  vehicleVisualAngleDeg: number;
  screenWidthCm: number;
  screenHeightCm: number;
  viewingDistanceCm: number;
}

// Key order, defaults and ranges are the ones the legacy settings form used.
export const defaultSettings: UfovSettings = {
  subtestId: 1, mode: 'formal', stopCondition: 'adaptive_80', trialCount: 48,
  contrastPercent: 100, targetVisualAngleDeg: 15, vehicleVisualAngleDeg: 2.5,
  screenWidthCm: 53.1, screenHeightCm: 29.9, viewingDistanceCm: 50,
  axis0Enabled: true, axis1Enabled: true, axis2Enabled: true, axis3Enabled: true,
  axis4Enabled: true, axis5Enabled: true, axis6Enabled: true, axis7Enabled: true,
};

export const listSettings = [
  { key: 'subtestId', zh: '活動項目', en: 'Activity', options: [
    { value: 1, zh: '活動 1：處理速度', en: 'Activity 1: Processing speed',
      hintZh: '只看中央，選出是汽車還是卡車。', hintEn: 'Watch the center and choose car or truck.' },
    { value: 2, zh: '活動 2：分散注意力', en: 'Activity 2: Divided attention',
      hintZh: '選出中央車輛，再選外圈汽車出現的方向。', hintEn: 'Choose the center vehicle, then the direction of the outer car.' },
    { value: 3, zh: '活動 3：選擇性注意力', en: 'Activity 3: Selective attention',
      hintZh: '和活動 2 相同，但外圈汽車混在三角形之間。', hintEn: 'Same as activity 2, with the outer car hidden among triangles.' },
  ] },
  { key: 'mode', zh: '活動模式', en: 'Mode', options: [
    { value: 'formal', zh: '正式模式', en: 'Recorded session',
      hintZh: '答對會縮短呈現時間，答錯會拉長，並保存當次紀錄。', hintEn: 'Correct answers shorten the display time and misses lengthen it. The session is saved.' },
    { value: 'practice', zh: '練習模式', en: 'Practice',
      hintZh: '5 題，每題呈現 250 毫秒，作答後立即顯示對錯。', hintEn: 'Five trials at 250 ms each, with right or wrong shown after every answer.' },
  ] },
  { key: 'stopCondition', zh: '結束方式', en: 'When the session ends', options: [
    { value: 'adaptive_80', zh: '呈現時間穩定後結束（建議）', en: 'When the display time settles (recommended)',
      hintZh: '答對與答錯交替後，呈現時間會收斂；最多 60 題。', hintEn: 'The display time narrows as right and wrong answers alternate. At most 60 trials.' },
    { value: 'fixed_trials', zh: '固定題數', en: 'Fixed number of trials',
      hintZh: '完成下方設定的題數後結束。', hintEn: 'Ends after the number of trials set below.' },
  ] },
] as const;

export const rangeSettings = [
  { key: 'trialCount', section: 'core', zh: '題數', en: 'Trials', unitZh: '題', unitEn: '', min: 10, max: 240, step: 1,
    hintZh: '只在「固定題數」時使用。', hintEn: 'Used only with a fixed number of trials.' },
  { key: 'contrastPercent', section: 'stimulus', zh: '刺激對比度', en: 'Contrast', unitZh: '%', unitEn: '%', min: 5, max: 100, step: 1,
    hintZh: '數值越低，背景越亮；車輛與三角形保持白色。', hintEn: 'Lower values brighten the background. Vehicles and triangles stay white.' },
  { key: 'targetVisualAngleDeg', section: 'stimulus', zh: '外圈距離（視角）', en: 'Outer ring distance (visual angle)', unitZh: '°', unitEn: '°', min: 5, max: 35, step: .5,
    hintZh: '外圈離中央多遠，以眼睛看出去的角度表示。', hintEn: 'How far the outer ring sits from the center, as an angle from your eye.' },
  { key: 'vehicleVisualAngleDeg', section: 'stimulus', zh: '車輛大小（視角）', en: 'Vehicle size (visual angle)', unitZh: '°', unitEn: '°', min: .8, max: 5, step: .1,
    hintZh: '車輛圖案的大小，以視角表示。', hintEn: 'Vehicle size, as a visual angle.' },
  { key: 'screenWidthCm', section: 'screen', zh: '螢幕顯示寬度', en: 'Display width', unitZh: 'cm', unitEn: 'cm', min: 10, max: 250, step: .1,
    hintZh: '用尺量畫面可顯示的寬度。', hintEn: 'Measure the visible width of the display with a ruler.' },
  { key: 'screenHeightCm', section: 'screen', zh: '螢幕顯示高度', en: 'Display height', unitZh: 'cm', unitEn: 'cm', min: 10, max: 200, step: .1,
    hintZh: '用尺量畫面可顯示的高度。', hintEn: 'Measure the visible height of the display.' },
  { key: 'viewingDistanceCm', section: 'screen', zh: '觀看距離', en: 'Viewing distance', unitZh: 'cm', unitEn: 'cm', min: 20, max: 300, step: 1,
    hintZh: '眼睛到螢幕的距離。', hintEn: 'Distance from your eyes to the screen.' },
] as const;

export type RangeKey = typeof rangeSettings[number]['key'];

function InRange(value: unknown, min: number, max: number, step: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return false;
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

export function ValidateSettings(settings: UfovSettings): boolean {
  if (!settings || typeof settings !== 'object') return false;
  return listSettings.every(field => (field.options as readonly { value: string | number }[]).some(option => option.value === settings[field.key]))
    && rangeSettings.every(field => InRange(settings[field.key], field.min, field.max, field.step))
    && axisKeys.every(key => typeof settings[key] === 'boolean')
    && axisKeys.some(key => settings[key]);
}

export function EnabledAxes(settings: UfovSettings) {
  return axisKeys.flatMap((key, axis) => settings[key] ? [axis] : []);
}

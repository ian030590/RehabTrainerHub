export type HartCharacterSet = 'english' | 'chinese';
export interface HartSettings { rounds: number; chartSize: 'small' | 'medium' | 'large'; characterSet: HartCharacterSet }
export const defaultSettings: HartSettings = { rounds: 10, chartSize: 'medium', characterSet: 'english' };
export function ValidateSettings(settings: HartSettings): boolean {
  return typeof settings?.rounds === 'number' && Number.isInteger(settings.rounds)
    && settings.rounds >= 5 && settings.rounds <= 30 && settings.rounds % 5 === 0
    && ['small', 'medium', 'large'].includes(settings.chartSize)
    && ['english', 'chinese'].includes(settings.characterSet);
}
export function ChartScale(size: HartSettings['chartSize']): number {
  return { small: .75, medium: 1, large: 1.25 }[size];
}

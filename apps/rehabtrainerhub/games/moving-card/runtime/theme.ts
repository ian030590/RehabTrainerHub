/**
 * Moving Card renderer colors and typography.
 * Owned by this game; no platform theme dependency.
 */
const colorTokens = {
  bg: '#F2F4F3',
  correctBackground: '#1A3D2B',
  wrongBackground: '#3D1A1A',
  bgPanel: '#F9F9FC',
  bgCard: '#FFFFFF',
  bgCardHover: '#F9F9FC',
  accent: '#005EB8',
  accentDark: '#00478D',
  accentHover: '#005DB6',
  success: '#005EB8',
  error: '#BA1A1A',
  warning: '#D29922',
  textPrimary: '#1A1C1E',
  textSecondary: '#424752',
  textMuted: '#727783',
  border: '#C2C6D4',
  borderHover: '#727783',
  calibrationBox: '#005EB8',
} as const;

export const cssColors = colorTokens;

export const pixiColors = Object.fromEntries(
  Object.entries(colorTokens).map(([key, value]) => [key, CssHexToNumber(value)]),
) as { readonly [K in keyof typeof colorTokens]: number };

export const typography = {
  fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', 'Microsoft JhengHei UI', Arial, sans-serif",
  fontSizeXS: 12,
  fontSizeS: 14,
  fontSizeM: 16,
  fontSizeL: 18,
  fontSizeXL: 24,
  fontSize2XL: 32,
  fontSize3XL: 48,
} as const;


function CssHexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

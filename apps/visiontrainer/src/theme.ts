/**
 * Canonical design tokens shared by CSS, React, and PixiJS.
 * Keep visual values here instead of duplicating them in global styles.
 */
const colorTokens = {
  bg: '#F2F4F3',
  bgPanel: '#F9F9FC',
  bgCard: '#FFFFFF',
  bgCardHover: '#F9F9FC',
  accent: '#005EB8',
  accentDark: '#00478D',
  accentHover: '#005DB6',
  success: '#8BA88E',
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
  Object.entries(colorTokens).map(([key, value]) => [key, cssHexToNumber(value)]),
) as { readonly [K in keyof typeof colorTokens]: number };

export const typography = {
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSizeXS: 12,
  fontSizeS:  14,
  fontSizeM:  16,
  fontSizeL:  18, // New base body size
  fontSizeXL: 24,
  fontSize2XL:32,
  fontSize3XL:48,
} as const;

export const spacing = {
  paddingS:  8,
  paddingM:  16,
  paddingL:  24,
  paddingXL: 48, // stack-lg
} as const;

export const radii = {
  radiusS:  8,
  radiusM:  8,
  radiusL:  16,
  radiusXL: 24,
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '300ms ease',
  slow: '500ms ease',
} as const;

export const shadows = {
  ambient: '0 4px 20px rgba(0, 94, 184, 0.08)',
} as const;

const cssVariables = {
  '--bg': cssColors.bg,
  '--bg-panel': cssColors.bgPanel,
  '--bg-card': cssColors.bgCard,
  '--bg-card-hover': cssColors.bgCardHover,
  '--accent': cssColors.accent,
  '--accent-dark': cssColors.accentDark,
  '--accent-hover': cssColors.accentHover,
  '--success': cssColors.success,
  '--error': cssColors.error,
  '--warning': cssColors.warning,
  '--text-primary': cssColors.textPrimary,
  '--text-secondary': cssColors.textSecondary,
  '--text-muted': cssColors.textMuted,
  '--border': cssColors.border,
  '--border-hover': cssColors.borderHover,
  '--font-family': typography.fontFamily,
  '--radius-s': `${radii.radiusS}px`,
  '--radius-m': `${radii.radiusM}px`,
  '--radius-l': `${radii.radiusL}px`,
  '--radius-xl': `${radii.radiusXL}px`,
  '--transition-fast': transitions.fast,
  '--transition-normal': transitions.normal,
  '--transition-slow': transitions.slow,
  '--shadow-ambient': shadows.ambient,
} as const;

export function applyThemeTokens(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value);
  }
}

function cssHexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

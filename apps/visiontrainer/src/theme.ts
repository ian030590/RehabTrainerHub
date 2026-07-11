import {
  radii,
  spacing,
  transitions,
  typography,
} from '@rehab-trainer/ui/trainerTheme';

const colorTokens = {
  bg: '#F2F4F3',
  bgPanel: '#F9F9FC',
  bgCard: '#FFFFFF',
  bgCardHover: '#F9F9FC',
  accent: '#006C47',
  accentDark: '#005235',
  accentHover: '#00714B',
  success: '#8BA88E',
  error: '#BA1A1A',
  warning: '#D29922',
  textPrimary: '#1A1C1E',
  textSecondary: '#424752',
  textMuted: '#727783',
  border: '#C2C6D4',
  borderHover: '#727783',
  calibrationBox: '#006C47',
} as const;

export const cssColors = colorTokens;

export const pixiColors = Object.fromEntries(
  Object.entries(colorTokens).map(([key, value]) => [key, cssHexToNumber(value)]),
) as { readonly [K in keyof typeof colorTokens]: number };

export { radii, spacing, transitions, typography };

export const shadows = {
  ambient: '0 4px 20px rgba(0, 108, 71, 0.10)',
  card: '0 2px 8px rgba(0, 0, 0, 0.02)',
  floating: '0 8px 24px rgba(15, 23, 42, 0.12)',
  elevated: '0 20px 48px rgba(26, 28, 30, 0.18)',
  modal: '0 24px 60px rgba(15, 23, 42, 0.3)',
} as const;

const cssVariables = {
  '--bg': cssColors.bg,
  '--bg-panel': cssColors.bgPanel,
  '--bg-card': cssColors.bgCard,
  '--bg-card-hover': cssColors.bgCardHover,
  '--accent': cssColors.accent,
  '--accent-dark': cssColors.accentDark,
  '--accent-hover': cssColors.accentHover,
  '--text-on-accent': '#FFFFFF',
  '--success': cssColors.success,
  '--error': cssColors.error,
  '--error-hover': '#93000A',
  '--warning': cssColors.warning,
  '--text-primary': cssColors.textPrimary,
  '--text-secondary': cssColors.textSecondary,
  '--text-muted': cssColors.textMuted,
  '--border': cssColors.border,
  '--border-hover': cssColors.borderHover,
  '--bg-elevated': 'rgba(255, 255, 255, 0.96)',
  '--bg-overlay': 'rgba(242, 244, 243, 0.85)',
  '--bg-overlay-dark': 'rgba(15, 23, 42, 0.58)',
  '--bg-accent-soft': 'rgba(0, 108, 71, 0.08)',
  '--bg-accent-soft-hover': 'rgba(0, 108, 71, 0.12)',
  '--font-family': typography.fontFamily,
  '--ui-font-size': '18px',
  '--ui-font-scale': '1',
  '--ui-font-weight': '500',
  '--ui-font-medium-weight': '700',
  '--ui-font-heading-weight': '800',
  '--fw-regular': '500',
  '--fw-medium': '600',
  '--fw-bold': '700',
  '--radius-s': `${radii.radiusS}px`,
  '--radius-m': `${radii.radiusM}px`,
  '--radius-l': `${radii.radiusL}px`,
  '--radius-xl': `${radii.radiusXL}px`,
  '--transition-fast': transitions.fast,
  '--transition-normal': transitions.normal,
  '--transition-slow': transitions.slow,
  '--shadow-ambient': shadows.ambient,
  '--shadow-card': shadows.card,
  '--shadow-floating': shadows.floating,
  '--shadow-elevated': shadows.elevated,
  '--shadow-modal': shadows.modal,
} as const;

export function applyThemeTokens(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(cssVariables)) {
    root.style.setProperty(name, value);
  }
}

function cssHexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

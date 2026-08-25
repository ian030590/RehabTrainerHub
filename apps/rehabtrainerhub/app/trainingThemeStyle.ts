import type { CSSProperties } from 'react';
import type { TrainingVisualTheme } from '@rehab-trainer/hub-modules/catalog';

export type TrainingThemeStyle = CSSProperties & Readonly<{
  '--trainer-color': string;
  '--trainer-color-dark': string;
  '--trainer-surface': string;
}>;

export function BuildTrainingThemeStyle(theme: TrainingVisualTheme): TrainingThemeStyle {
  const requestedMixRatio = theme.colors.surfaceMixRatio ?? 8;
  const surfaceMixRatio = Number.isFinite(requestedMixRatio)
    ? Math.min(100, Math.max(0, requestedMixRatio))
    : 8;
  return {
    '--trainer-color': theme.colors.primary,
    '--trainer-color-dark': theme.colors.dark ?? theme.colors.primary,
    '--trainer-surface': `color-mix(in srgb, ${theme.colors.primary} ${surfaceMixRatio}%, var(--surface))`,
  };
}

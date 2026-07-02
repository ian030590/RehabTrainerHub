import type { ReactNode } from 'react';
import type { TranslationKey } from '../../i18n';

export type TrainingModuleId =
  | 'moving-card'
  | 'oculomotor-training'
  | 'gabor-patching'
  | 'reading-training'
  | 'driving-rehab'
  | 'hart-chart';

export interface TrainingModuleDefinition {
  id: TrainingModuleId;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: ReactNode;
}

export const TRAINING_MODULES: readonly TrainingModuleDefinition[] = [
  {
    id: 'moving-card',
    titleKey: 'home.module.movingCard.title',
    descKey: 'home.module.movingCard.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 'oculomotor-training',
    titleKey: 'home.module.oculomotor.title',
    descKey: 'home.module.oculomotor.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3a9 9 0 0 1 9 9" />
        <path d="M21 12a9 9 0 0 1-9 9" />
        <path d="M12 21a9 9 0 0 1-9-9" />
        <path d="M3 12a9 9 0 0 1 9-9" />
        <path d="M12 7v2" />
        <path d="M17 12h-2" />
        <path d="M12 17v-2" />
        <path d="M7 12h2" />
      </svg>
    ),
  },
  {
    id: 'gabor-patching',
    titleKey: 'home.module.gaborPatching.title',
    descKey: 'home.module.gaborPatching.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12a4 4 0 0 1 8 0" />
        <path d="M12 8v8" />
      </svg>
    ),
  },
  {
    id: 'reading-training',
    titleKey: 'home.module.reading.title',
    descKey: 'home.module.reading.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    id: 'driving-rehab',
    titleKey: 'home.module.driving.title',
    descKey: 'home.module.driving.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13h18l-2 6H5l-2-6Z" />
        <path d="M6 13l2-5h8l2 5" />
        <circle cx="7.5" cy="19" r="1.5" />
        <circle cx="16.5" cy="19" r="1.5" />
        <path d="M10 4h4" />
      </svg>
    ),
  },
  {
    id: 'hart-chart',
    titleKey: 'home.module.hartChart.title',
    descKey: 'home.module.hartChart.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
        <path d="m6 7 1-2 1 2M11 13h2M17 17h2" />
      </svg>
    ),
  },
];

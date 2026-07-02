import type { ReactNode } from 'react';
import type { TranslationKey } from '../../i18n';
import type { TestType } from './logic/optotypeRenderer';

export interface AssessmentDefinition {
  id: TestType;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: ReactNode;
  optionCount: number;
  defaultTrialCount: number;
}

export const ASSESSMENTS: readonly AssessmentDefinition[] = [
  {
    id: 'landolt',
    titleKey: 'assess.landolt.title',
    descriptionKey: 'assess.landolt.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.65 17.65A8 8 0 1 1 17.65 6.35" />
      </svg>
    ),
    optionCount: 8,
    defaultTrialCount: 18,
  },
  {
    id: 'tumblingE',
    titleKey: 'assess.tumblingE.title',
    descriptionKey: 'assess.tumblingE.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 5h9 M8 12h7 M8 19h9 M8 5v14" />
      </svg>
    ),
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'letters',
    titleKey: 'assess.sloan.title',
    descriptionKey: 'assess.sloan.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" x2="15" y1="20" y2="20" />
        <line x1="12" x2="12" y1="4" y2="20" />
      </svg>
    ),
    optionCount: 10,
    defaultTrialCount: 18,
  },
  {
    id: 'pictures',
    titleKey: 'assess.shapes.title',
    descriptionKey: 'assess.shapes.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'gratings',
    titleKey: 'assess.pl.title',
    descriptionKey: 'assess.pl.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="8" y1="4.5" x2="8" y2="19.5" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="16" y1="4.5" x2="16" y2="19.5" />
      </svg>
    ),
    optionCount: 2,
    defaultTrialCount: 36,
  },
  {
    id: 'contrast',
    titleKey: 'assess.contrast.title',
    descriptionKey: 'assess.contrast.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18A9 9 0 0 0 12 3z" fill="currentColor" />
      </svg>
    ),
    optionCount: 8,
    defaultTrialCount: 18,
  },
];

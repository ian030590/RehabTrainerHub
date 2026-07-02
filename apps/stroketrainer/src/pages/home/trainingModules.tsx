import type { ReactNode } from 'react';
import type { TranslationKey } from '../../i18n';

export type TrainingModuleId =
  | 'motor-training'
  | 'cognitive-training'
  | 'speech-training';

export interface TrainingModuleCardData {
  id: TrainingModuleId;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: ReactNode;
}

export const TRAINING_MODULES: readonly TrainingModuleCardData[] = [
  {
    id: 'motor-training',
    titleKey: 'home.module.motor.title',
    descKey: 'home.module.motor.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'cognitive-training',
    titleKey: 'home.module.cognitive.title',
    descKey: 'home.module.cognitive.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2-9 5 18 3-10h6" />
      </svg>
    ),
  },
  {
    id: 'speech-training',
    titleKey: 'home.module.speech.title',
    descKey: 'home.module.speech.desc',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
];

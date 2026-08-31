import { en as motorEn } from '../../motor/i18n/en';
import type { TranslationKey } from './zh';

export const en: Record<TranslationKey, string> = {
  ...motorEn,
  'app.loading': 'Loading oral practice...',
  'nav.brand': 'Oral Practice',
  'nav.logoAlt': 'Oral practice icon',
  'nav.comprehension': 'Comprehension',
  'nav.oral': 'Oral',
  'nav.downloadScores': 'Download Records',
  'nav.noScores': 'No training records are available yet.',
  'nav.scoresDownloadError': 'Unable to read training records. Please try again.',
  'mouth.oral.title': 'Oral Training',
  'mouth.oral.subtitle': 'Complete face and tongue calibration, then practise with tongue direction.',
  'mouth.comprehension.title': 'Comprehension Training',
  'mouth.comprehension.subtitle': 'Comprehension modules are being prepared.',
  'mouth.comprehension.body': 'This section is ready for upcoming listening, word comprehension, and everyday-situation exercises.',
};

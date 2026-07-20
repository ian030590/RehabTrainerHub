import { createLanguageProvider, type SupportedLanguage } from '@rehab-trainer/ui/i18n/createLanguageProvider';
import { en } from './en';
import { zh } from './zh';
import { STORAGE_PREFIX } from '../utils/settings';
import type { TranslationKey } from './zh';

export type Language = SupportedLanguage;

const language = createLanguageProvider<TranslationKey>({
  dictionaries: { zh, en },
  storageKey: `${STORAGE_PREFIX}language`,
});

export const { LanguageProvider, useT } = language;

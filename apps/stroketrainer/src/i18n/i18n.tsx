import { CreateLanguageProvider, type SupportedLanguage } from '@rehab-trainer/ui/i18n/createLanguageProvider';
import { en } from './en';
import { zh } from './zh';
import { storagePrefix } from '../utils/settings';
import type { TranslationKey } from './zh';

export type Language = SupportedLanguage;

const language = CreateLanguageProvider<TranslationKey>({
  dictionaries: { zh, en },
  storageKey: `${storagePrefix}language`,
});

export const { LanguageProvider, useT } = language;

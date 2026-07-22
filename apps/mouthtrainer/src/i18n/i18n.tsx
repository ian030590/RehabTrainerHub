import { CreateLanguageProvider, type SupportedLanguage } from '@rehab-trainer/ui/i18n/createLanguageProvider';
import { storagePrefix } from '../utils/settings';
import { en } from './en';
import { zh, type TranslationKey } from './zh';

export type Language = SupportedLanguage;

const language = CreateLanguageProvider<TranslationKey>({
  dictionaries: { zh, en },
  storageKey: `${storagePrefix}language`,
});

export const { LanguageProvider, useT } = language;

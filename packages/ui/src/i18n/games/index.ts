import { CreateLanguageProvider, type SupportedLanguage } from '../createLanguageProvider';

export type Language = SupportedLanguage;
export type TranslationKey = string;
export const { LanguageProvider, useT } = CreateLanguageProvider<TranslationKey>({
  dictionaries: { zh: {}, en: {} },
  storageKey: 'rehab_game_language',
});

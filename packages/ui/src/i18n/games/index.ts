import { CreateLanguageProvider, type SupportedLanguage } from '../createLanguageProvider';
import { en as brainEn } from './brain/en';
import { zh as brainZh } from './brain/zh';
import { en as motorEn } from './motor/en';
import { zh as motorZh } from './motor/zh';
import { en as mouthEn } from './mouth/en';
import { zh as mouthZh } from './mouth/zh';
import { en as visionEn } from './vision/en';
import { zh as visionZh } from './vision/zh';

export type Language = SupportedLanguage;

export const gameZh = {
  ...brainZh,
  ...motorZh,
  ...mouthZh,
  ...visionZh,
};

export const gameEn = {
  ...brainEn,
  ...motorEn,
  ...mouthEn,
  ...visionEn,
};

export type TranslationKey = string;

const language = CreateLanguageProvider<TranslationKey>({
  dictionaries: { zh: gameZh, en: gameEn },
  storageKey: 'rehab_game_language',
});

export const { LanguageProvider, useT } = language;

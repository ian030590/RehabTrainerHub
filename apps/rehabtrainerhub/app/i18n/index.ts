import { en } from './en';
import { zhTW } from './zh-TW';

export { zhTW } from './zh-TW';
export { en } from './en';
export type { HubLocale } from './types';

export function GetHubUiCopy(language: 'zh' | 'en') {
  return language === 'en' ? en.hubUi : zhTW.hubUi;
}

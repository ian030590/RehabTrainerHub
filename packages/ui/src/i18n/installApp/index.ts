import { installAppEn } from './en';
import { installAppZh } from './zh';

export { installAppEn } from './en';
export { installAppZh } from './zh';
export type { InstallAppCopy } from './types';

export function GetInstallAppCopy(language: 'zh' | 'en') {
  return language === 'en' ? installAppEn : installAppZh;
}

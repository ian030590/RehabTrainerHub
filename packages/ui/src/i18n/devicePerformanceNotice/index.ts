import { devicePerformanceNoticeEn } from './en';
import { devicePerformanceNoticeZh } from './zh';
import type { DevicePerformanceNoticeCopy, DevicePerformanceNoticeLocale } from './types';

export { devicePerformanceNoticeEn } from './en';
export { devicePerformanceNoticeZh } from './zh';
export type { DevicePerformanceNoticeCopy, DevicePerformanceNoticeLocale } from './types';

export function GetDevicePerformanceNoticeCopy(locale: DevicePerformanceNoticeLocale = 'zh-TW'): DevicePerformanceNoticeCopy {
  return locale === 'en' ? devicePerformanceNoticeEn : devicePerformanceNoticeZh;
}

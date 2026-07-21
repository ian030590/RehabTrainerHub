export const storagePrefix = 'brain_trainer_';
export const settingsChangedEvent = 'brain-trainer-settings-changed';

export const defaultUiFontSizePx = 18;
export const minUiFontSizePx = 14;
export const maxUiFontSizePx = 30;

export type UiTheme = 'light' | 'dark' | 'contrast';

export interface AppSettings {
  uiFontSizePx: number;
  uiFontBold: boolean;
  uiTheme: UiTheme;
  auditoryFeedbackEnabled: boolean;
}

interface SettingMeta<T> {
  dflt: T;
  min?: number;
  max?: number;
}

const appSettingsMeta: { [K in keyof AppSettings]: SettingMeta<AppSettings[K]> } = {
  uiFontSizePx: { dflt: defaultUiFontSizePx, min: minUiFontSizePx, max: maxUiFontSizePx },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
  auditoryFeedbackEnabled: { dflt: true },
};

function StorageKey(name: string) {
  return storagePrefix + name;
}

function IsTheme(value: string): value is UiTheme {
  return value === 'light' || value === 'dark' || value === 'contrast';
}

export function GetSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settingMeta = appSettingsMeta[key];
  const raw = localStorage.getItem(StorageKey(key));
  if (raw === null) return settingMeta.dflt;

  if (typeof settingMeta.dflt === 'boolean') {
    return (raw === 'true') as AppSettings[K];
  }

  if (typeof settingMeta.dflt === 'number') {
    const num = Number(raw);
    if (!Number.isFinite(num)) return settingMeta.dflt;
    if (settingMeta.min !== undefined && num < settingMeta.min) return settingMeta.dflt;
    if (settingMeta.max !== undefined && num > settingMeta.max) return settingMeta.dflt;
    return num as AppSettings[K];
  }

  if (key === 'uiTheme') {
    return (IsTheme(raw) ? raw : settingMeta.dflt) as AppSettings[K];
  }

  return raw as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  localStorage.setItem(StorageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, { detail: { key } }));
}

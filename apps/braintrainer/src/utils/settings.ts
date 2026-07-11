export const STORAGE_PREFIX = 'brain_trainer_';
export const SETTINGS_CHANGED_EVENT = 'brain-trainer-settings-changed';

export const DEFAULT_UI_FONT_SIZE_PX = 18;
export const MIN_UI_FONT_SIZE_PX = 14;
export const MAX_UI_FONT_SIZE_PX = 30;

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

const META: { [K in keyof AppSettings]: SettingMeta<AppSettings[K]> } = {
  uiFontSizePx: { dflt: DEFAULT_UI_FONT_SIZE_PX, min: MIN_UI_FONT_SIZE_PX, max: MAX_UI_FONT_SIZE_PX },
  uiFontBold: { dflt: false },
  uiTheme: { dflt: 'light' },
  auditoryFeedbackEnabled: { dflt: true },
};

function storageKey(name: string) {
  return STORAGE_PREFIX + name;
}

function isTheme(value: string): value is UiTheme {
  return value === 'light' || value === 'dark' || value === 'contrast';
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const meta = META[key];
  const raw = localStorage.getItem(storageKey(key));
  if (raw === null) return meta.dflt;

  if (typeof meta.dflt === 'boolean') {
    return (raw === 'true') as AppSettings[K];
  }

  if (typeof meta.dflt === 'number') {
    const num = Number(raw);
    if (!Number.isFinite(num)) return meta.dflt;
    if (meta.min !== undefined && num < meta.min) return meta.dflt;
    if (meta.max !== undefined && num > meta.max) return meta.dflt;
    return num as AppSettings[K];
  }

  if (key === 'uiTheme') {
    return (isTheme(raw) ? raw : meta.dflt) as AppSettings[K];
  }

  return raw as AppSettings[K];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  localStorage.setItem(storageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key } }));
}

import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import { CreateUserStore } from '@rehab-trainer/ui/storage/userStore';

export const storagePrefix = 'mouth_trainer_';
export const settingsChangedEvent = 'mouth-trainer-settings-changed';
export const defaultUiFontSizePx = 18;
export const minUiFontSizePx = 14;
export const maxUiFontSizePx = 30;

export type UiTheme = 'light' | 'dark' | 'contrast';

interface AppSettings {
  uiFontSizePx: number;
  uiFontBold: boolean;
  uiTheme: UiTheme;
  auditoryFeedbackEnabled: boolean;
  soundVolume: number;
  downloadDirectory: string;
}

const defaults: AppSettings = {
  uiFontSizePx: defaultUiFontSizePx,
  uiFontBold: false,
  uiTheme: 'light',
  auditoryFeedbackEnabled: true,
  soundVolume: 50,
  downloadDirectory: '',
};

export function GetSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const raw = localStorage.getItem(`${storagePrefix}${key}`);
  if (raw === null) return defaults[key];
  if (typeof defaults[key] === 'boolean') return (raw === 'true') as AppSettings[K];
  if (typeof defaults[key] === 'number') {
    const value = Number(raw);
    return (Number.isFinite(value) ? value : defaults[key]) as AppSettings[K];
  }
  if (key === 'uiTheme') return (raw === 'light' || raw === 'dark' || raw === 'contrast' ? raw : defaults[key]) as AppSettings[K];
  return raw as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  localStorage.setItem(`${storagePrefix}${key}`, String(value));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, { detail: { key, value } }));
}

const userStore = CreateUserStore({
  activeUserChangedEvent: 'mouth-trainer-active-user-changed',
  storagePrefix,
});

export const getActiveUser = () => GetAuthUserNameFromToken() || userStore.getActiveUser();

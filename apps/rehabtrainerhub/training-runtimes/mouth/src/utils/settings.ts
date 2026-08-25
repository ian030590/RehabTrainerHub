import { GetAuthUserNameFromToken } from '@rehab-trainer/ui/auth/authClient';
import {
  defaultUiFontSizePx,
  IsUiTheme,
  maxUiFontSizePx,
  minUiFontSizePx,
} from '@rehab-trainer/ui/settings/displaySettings';
import type { UiTheme } from '@rehab-trainer/ui/settings/displaySettings';
import { CreateUserStore } from '@rehab-trainer/ui/storage/userStore';
import {
  CreateRuntimeStorageNamespace,
  MigrateLegacyLocalStorageNamespace,
} from '@rehab-trainer/ui/storage/runtimeNamespace';

export { defaultUiFontSizePx, maxUiFontSizePx, minUiFontSizePx };
export type { UiTheme };

const runtimeStorageNamespace = CreateRuntimeStorageNamespace('mouth');
export const storagePrefix = runtimeStorageNamespace.storagePrefix;
export const settingsChangedEvent = runtimeStorageNamespace.settingsChangedEvent;

const legacyMouthStoragePrefixes = ['mouth_trainer_', 'mouth-trainer-'] as const;
MigrateLegacyLocalStorageNamespace({
  canonicalPrefix: storagePrefix,
  legacyPrefixes: legacyMouthStoragePrefixes,
  mergeJsonArraySuffixes: ['users', 'training_records_v1'],
});

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
  if (key === 'uiTheme') return (IsUiTheme(raw) ? raw : defaults[key]) as AppSettings[K];
  return raw as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  localStorage.setItem(`${storagePrefix}${key}`, String(value));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, { detail: { key, value } }));
}

const userStore = CreateUserStore({
  activeUserChangedEvent: runtimeStorageNamespace.activeUserChangedEvent,
  storagePrefix,
});

export const getActiveUser = () => GetAuthUserNameFromToken() || userStore.getActiveUser();

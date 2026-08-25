import {
  defaultUiFontSizePx,
  IsUiTheme,
  maxUiFontSizePx,
  minUiFontSizePx,
} from '@rehab-trainer/ui/settings/displaySettings';
import type { UiTheme } from '@rehab-trainer/ui/settings/displaySettings';
import {
  CreateRuntimeStorageNamespace,
  MigrateLegacyLocalStorageNamespace,
} from '@rehab-trainer/ui/storage/runtimeNamespace';

export { defaultUiFontSizePx, maxUiFontSizePx, minUiFontSizePx };
export type { UiTheme };

const runtimeStorageNamespace = CreateRuntimeStorageNamespace('brain');
export const storagePrefix = runtimeStorageNamespace.storagePrefix;
export const settingsChangedEvent = runtimeStorageNamespace.settingsChangedEvent;

const legacyBrainStoragePrefixes = ['brain_trainer_', 'brain-trainer-'] as const;
MigrateLegacyLocalStorageNamespace({
  canonicalPrefix: storagePrefix,
  legacyPrefixes: legacyBrainStoragePrefixes,
  mergeJsonArraySuffixes: ['training_records_v1'],
});

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
    return (IsUiTheme(raw) ? raw : settingMeta.dflt) as AppSettings[K];
  }

  return raw as AppSettings[K];
}

export function SetSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  localStorage.setItem(StorageKey(key), String(value));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, { detail: { key } }));
}

import { useCallback, useSyncExternalStore } from 'react';
import {
  appSettingsChangedEvent,
  storagePrefix,
  GetSetting,
  SetSetting,
} from './settings';
import type { AppSettings } from './settings';

type SettingChangeEvent = CustomEvent<{ key: keyof AppSettings | null }>;

export function useAppSetting<K extends keyof AppSettings>(key: K) {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const handleSettingChange = (event: Event) => {
      const changedKey = (event as SettingChangeEvent).detail?.key;
      if (changedKey === null || changedKey === key) {
        onStoreChange();
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === null || event.key === `${storagePrefix}${key}`) {
        onStoreChange();
      }
    };

    window.addEventListener(appSettingsChangedEvent, handleSettingChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(appSettingsChangedEvent, handleSettingChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  const getSnapshot = useCallback(() => GetSetting(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const updateValue = useCallback((nextValue: AppSettings[K]) => {
    SetSetting(key, nextValue);
  }, [key]);

  return [value, updateValue] as const;
}

import { useCallback, useSyncExternalStore } from 'react';
import {
  APP_SETTINGS_CHANGED_EVENT,
  STORAGE_PREFIX,
  getSetting,
  setSetting,
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
      if (event.key === null || event.key === `${STORAGE_PREFIX}${key}`) {
        onStoreChange();
      }
    };

    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, handleSettingChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, handleSettingChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  const getSnapshot = useCallback(() => getSetting(key), [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const updateValue = useCallback((nextValue: AppSettings[K]) => {
    setSetting(key, nextValue);
  }, [key]);

  return [value, updateValue] as const;
}

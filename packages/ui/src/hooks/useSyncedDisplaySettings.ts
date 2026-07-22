import { useLayoutEffect } from 'react';
import { ApplyDisplaySettings } from '../settings/displaySettings';

export interface SyncedDisplaySettings {
  defaultFontSizePx: number;
  fontBold: boolean;
  fontSizePx: number;
  uiTheme: 'light' | 'dark' | 'contrast';
}

export function useSyncedDisplaySettings(
  readSettings: () => SyncedDisplaySettings,
  settingsChangedEvent: string,
) {
  useLayoutEffect(() => {
    const applySettings = () => {
      const settings = readSettings();
      ApplyDisplaySettings({
        fontSizePx: settings.fontSizePx,
        defaultFontSizePx: settings.defaultFontSizePx,
        fontBold: settings.fontBold,
        uiTheme: settings.uiTheme,
      });
    };

    applySettings();
    window.addEventListener(settingsChangedEvent, applySettings);
    window.addEventListener('storage', applySettings);
    return () => {
      window.removeEventListener(settingsChangedEvent, applySettings);
      window.removeEventListener('storage', applySettings);
    };
  }, [readSettings, settingsChangedEvent]);
}

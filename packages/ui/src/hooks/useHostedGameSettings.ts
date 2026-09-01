import { useEffect, useState } from 'react';
import {
  GetHostedGameSettings,
  InstallHostedGameSettingsReceiver,
} from '../embeddedTraining';

export type HostedGameSettings = Readonly<Record<string, string | number | boolean>>;

export function useHostedGameSettings(): HostedGameSettings | null {
  const [settings, setSettings] = useState<HostedGameSettings | null>(() => GetHostedGameSettings());

  useEffect(() => {
    InstallHostedGameSettingsReceiver();
    const current = GetHostedGameSettings();
    if (current) setSettings(current);
    const handleSettings = (event: Event) => {
      const detail = (event as CustomEvent<HostedGameSettings>).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener('rehab-trainer:game-settings-ready', handleSettings);
    return () => window.removeEventListener('rehab-trainer:game-settings-ready', handleSettings);
  }, []);

  return settings;
}

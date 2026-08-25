'use client';

import { InstallAppPage } from '@rehab-trainer/ui/components/InstallAppPage';
import { useHubLanguage } from '../i18n/HubLanguage';

export function DownloadContent() {
  const { language } = useHubLanguage();
  return (
    <InstallAppPage
      appName="Rehab Trainer Hub"
      guideAssetBaseUrl="/assets/pwa-install"
      locale={language}
    />
  );
}

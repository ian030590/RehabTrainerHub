'use client';

import { InstallAppPage } from '@rehab-trainer/ui/components/InstallAppPage';
import { useHubLanguage } from '../i18n/HubLanguage';

export function DownloadContent() {
  const { language } = useHubLanguage();
  return (
    <InstallAppPage
      appName="居家訓練網"
      guideAssetBaseUrl="/assets/pwa-install"
      locale={language}
    />
  );
}

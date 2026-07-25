import type { Metadata } from 'next';
import { InstallAppPage } from '@rehab-trainer/ui/components/InstallAppPage';
import { CreateSeoMetadata } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '下載程式',
  description: '將居家訓練網安裝到電腦、iPhone 或 Android 裝置。',
  path: '/download',
});

export default function DownloadPage() {
  return (
    <InstallAppPage
      appName="Rehab Trainer Hub"
      guideAssetBaseUrl="/assets/pwa-install"
    />
  );
}

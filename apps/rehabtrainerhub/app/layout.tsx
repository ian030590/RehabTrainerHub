import type { Metadata, Viewport } from 'next';
import { CloudflareWebAnalytics } from '@rehab-trainer/ui/components/CloudflareWebAnalytics';
import { HubShell } from './HubNavigation';
import { hubLocalName, hubSeoTitle } from './hubBrand';
import { siteDescription } from './seo';
import { siteUrls } from './siteUrls';
import './globals.css';
import '@rehab-trainer/ui/components/AuthPanel.css';
import '@rehab-trainer/ui/components/InstallAppPage.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrls.hub),
  title: {
    default: hubSeoTitle,
    template: `%s | ${hubLocalName}`,
  },
  description: siteDescription,
  applicationName: hubLocalName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: hubLocalName,
  },
  keywords: [
    '居家訓練網',
    '居家訓練工具',
    '居家訓練平台',
    '居家練習',
    '衛教資訊',
    '動作練習',
    '視覺練習',
    '認知練習',
    '口腔動作練習',
    'Rehab Trainer Hub',
  ],
  icons: {
    icon: '/rehabtrainerhub.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  verification: {
    google: '_ZdVR2kZ9xg_TnPtv5tLda3-fJWHLArBNDMpgE5NkZA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#146c5b',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" data-locale="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100..900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0"
          rel="stylesheet"
        />
      </head>
      <body>
        <HubShell>{children}</HubShell>
        <CloudflareWebAnalytics token={process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN} />
      </body>
    </html>
  );
}

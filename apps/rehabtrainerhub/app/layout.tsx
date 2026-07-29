import type { Metadata, Viewport } from 'next';
import { CloudflareWebAnalytics } from '@rehab-trainer/ui/components/CloudflareWebAnalytics';
import { HubShell } from './HubNavigation';
import { hubFullName, hubLocalName } from './hubBrand';
import { CreateSeoMetadata, organizationJsonLd, siteDescription, websiteJsonLd } from './seo';
import { siteUrls } from './siteUrls';
import './globals.css';
import '@rehab-trainer/ui/components/AuthPanel.css';
import '@rehab-trainer/ui/components/InstallAppPage.css';

const rootMetadata = CreateSeoMetadata({
  title: hubFullName,
  description: siteDescription,
  path: '/',
  absoluteTitle: true,
});

export const metadata: Metadata = {
  ...rootMetadata,
  metadataBase: new URL(siteUrls.hub),
  title: {
    default: hubFullName,
    template: `%s | ${hubLocalName}`,
  },
  applicationName: hubFullName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: hubLocalName,
  },
  keywords: [
    '居家訓練網',
    '居家復健訓練',
    '訓練大廳',
    '復健進度',
    '動作訓練',
    '視覺訓練',
    '認知訓練',
    '口腔訓練',
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
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body>
        <HubShell>{children}</HubShell>
        <CloudflareWebAnalytics token={process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN} />
      </body>
    </html>
  );
}

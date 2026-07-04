import type { Metadata } from 'next';
import { HubShell } from './HubNavigation';
import { HUB_NAME } from './hubBrand';
import { siteUrls } from './siteUrls';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrls.hub),
  title: {
    default: HUB_NAME,
    template: `%s | ${HUB_NAME}`,
  },
  description: 'Rehab Trainer Hub 是整合中風復健與視覺訓練的居家復健入口，提供清楚導覽、使用限制與相關衛教資源。',
  applicationName: HUB_NAME,
  verification: {
    google: '_ZdVR2kZ9xg_TnPtv5tLda3-fJWHLArBNDMpgE5NkZA',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: HUB_NAME,
    description: '整合中風復健與視覺訓練的居家復健入口，提供清楚導覽、使用限制與衛教資源。',
    url: '/',
    siteName: HUB_NAME,
    locale: 'zh_TW',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" data-locale="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=M+PLUS+Rounded+1c:wght@400;500;700;800;900&family=Manrope:wght@600;700;800&family=Noto+Sans+TC:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <HubShell>{children}</HubShell>
      </body>
    </html>
  );
}

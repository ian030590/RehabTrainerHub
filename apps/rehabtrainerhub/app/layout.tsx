import type { Metadata } from 'next';
import { HubShell } from './HubNavigation';
import { HUB_FULL_NAME, HUB_LOCAL_NAME } from './hubBrand';
import { createSeoMetadata, organizationJsonLd, siteDescription, websiteJsonLd } from './seo';
import { siteUrls } from './siteUrls';
import './globals.css';

const rootMetadata = createSeoMetadata({
  title: HUB_FULL_NAME,
  description: siteDescription,
  path: '/',
  absoluteTitle: true,
});

export const metadata: Metadata = {
  ...rootMetadata,
  metadataBase: new URL(siteUrls.hub),
  title: {
    default: HUB_FULL_NAME,
    template: `%s | ${HUB_LOCAL_NAME}`,
  },
  applicationName: HUB_FULL_NAME,
  keywords: ['居家訓練網', '居家訓練', '居家復健', '中風復健', '視覺訓練', '認知訓練', 'BrainTrainer', 'brain trainer', '職能治療', '衛教影片', 'Rehab Trainer Hub', 'rehab trainer hub'],
  icons: {
    icon: '/rehabtrainerhub.svg',
    apple: '/rehabtrainerhub.svg',
  },
  verification: {
    google: '_ZdVR2kZ9xg_TnPtv5tLda3-fJWHLArBNDMpgE5NkZA',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" data-locale="zh-TW">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
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

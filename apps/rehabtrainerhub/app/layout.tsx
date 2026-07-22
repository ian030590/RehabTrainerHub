import type { Metadata } from 'next';
import { HubShell } from './HubNavigation';
import { hubFullName, hubLocalName } from './hubBrand';
import { CreateSeoMetadata, organizationJsonLd, siteDescription, websiteJsonLd } from './seo';
import { siteUrls } from './siteUrls';
import './globals.css';
import '@rehab-trainer/ui/components/AuthPanel.css';
import '@rehab-trainer/ui/components/GridPageLayout.css';
import '@rehab-trainer/ui/components/ReferenceListPage.css';

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
  keywords: ['居家訓練網', '居家訓練', '居家復健', '中風復健', '動作訓練', '視覺訓練', '認知訓練', '口說訓練', '口腔訓練', 'MotorTrainer', 'MouthTrainer', 'BrainTrainer', 'brain trainer', '職能治療', '衛教影片', 'Rehab Trainer Hub', 'rehab trainer hub'],
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
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
      </head>
      <body>
        <HubShell>{children}</HubShell>
      </body>
    </html>
  );
}

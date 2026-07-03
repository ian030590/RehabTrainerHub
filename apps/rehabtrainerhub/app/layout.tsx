import type { Metadata } from 'next';
import { RehabFooter } from '@rehab-trainer/ui/components/RehabFooter';
import { siteUrls } from './siteUrls';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrls.hub),
  title: {
    default: 'RehabTrainerHub',
    template: '%s | RehabTrainerHub',
  },
  description: 'RehabTrainerHub 是整合中風復健與視覺訓練的居家復健入口，提供清楚導覽、使用限制與相關衛教資源。',
  applicationName: 'RehabTrainerHub',
  verification: {
    google: '_ZdVR2kZ9xg_TnPtv5tLda3-fJWHLArBNDMpgE5NkZA',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'RehabTrainerHub',
    description: '整合中風復健與視覺訓練的居家復健入口，提供清楚導覽、使用限制與衛教資源。',
    url: '/',
    siteName: 'RehabTrainerHub',
    locale: 'zh_TW',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=LXGW+WenKai+TC:wght@400;700&family=Manrope:wght@600;700;800&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <RehabFooter
          appName="RehabTrainerHub"
          hubHref={siteUrls.hub}
          privacyHref={`${siteUrls.hub}/privacy/`}
          labels={{
            disclaimer: '本平台用於居家復健練習與流程原型展示，不提供醫療診斷或治療建議。使用前請諮詢醫師或治療師。',
            hub: '首頁',
            privacy: '隱私權政策',
            repo: 'GitHub',
            rights: '保留所有權利',
          }}
        />
      </body>
    </html>
  );
}

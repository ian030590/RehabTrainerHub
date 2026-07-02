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
  description: '居家中風復健與視覺復健小遊戲入口平台，整合 StrokeTrainer 與 VisionTrainer。',
  applicationName: 'RehabTrainerHub',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'RehabTrainerHub',
    description: '整合中風復健、視覺復健與衛教資訊的居家復健入口平台。',
    url: '/',
    siteName: 'RehabTrainerHub',
    locale: 'zh_TW',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <RehabFooter
          appName="RehabTrainerHub"
          hubHref={siteUrls.hub}
          labels={{
            disclaimer: '本平台作為居家復健練習與流程原型使用，不能取代醫療診斷或治療建議。',
            hub: '首頁',
            repo: 'GitHub',
            rights: '保留所有權利。',
          }}
        />
      </body>
    </html>
  );
}

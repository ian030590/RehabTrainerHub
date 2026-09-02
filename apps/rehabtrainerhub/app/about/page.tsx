import type { Metadata } from 'next';
import { CreatePageJsonLd, CreateSeoMetadata, SerializeJsonLd } from '../seo';
import { AboutContent } from './AboutContent';

const pageName = '關於居家訓練網';
const pageDescription = '了解居家訓練網提供的居家練習工具、平台安全設計、非醫療服務界線、內容責任與公開聯絡方式。';

export const metadata: Metadata = CreateSeoMetadata({
  title: '關於本站：網站定位、內容責任與聯絡方式',
  description: pageDescription,
  path: '/about',
});

export default function AboutPage() {
  return (
    <>
      <script
        id="about-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: SerializeJsonLd(CreatePageJsonLd({
            name: pageName,
            description: pageDescription,
            path: '/about',
            type: 'AboutPage',
          })),
        }}
      />
      <AboutContent />
    </>
  );
}

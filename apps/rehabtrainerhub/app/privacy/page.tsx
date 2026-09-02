import type { Metadata } from 'next';
import { CreatePageJsonLd, CreateSeoMetadata, SerializeJsonLd } from '../seo';
import { PrivacyContent } from './PrivacyContent';

const pageName = '隱私權政策';
const pageDescription = '了解居家訓練網對登入、基本資料問卷、醫療史問卷、訓練紀錄、攝影機與本機資料的使用方式。';

export const metadata: Metadata = CreateSeoMetadata({
  title: pageName,
  description: pageDescription,
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <>
      <script
        id="privacy-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: SerializeJsonLd(CreatePageJsonLd({
            name: pageName,
            description: pageDescription,
            path: '/privacy',
          })),
        }}
      />
      <PrivacyContent />
    </>
  );
}

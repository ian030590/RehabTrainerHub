import type { Metadata } from 'next';
import { PrivacyContent } from '../LocalizedPages';
import { createSeoMetadata } from '../seo';

export const metadata: Metadata = createSeoMetadata({
  title: '隱私權政策 / Privacy Policy',
  description: '了解居家復健網對登入、匿名基本資料、訓練紀錄、攝影機與本機 IndexedDB 資料的使用方式。',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main>
      <PrivacyContent />
    </main>
  );
}

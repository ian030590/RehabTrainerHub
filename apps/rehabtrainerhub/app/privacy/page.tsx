import type { Metadata } from 'next';
import { PrivacyContent } from '../LocalizedPages';
import { CreateSeoMetadata } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '隱私權政策 / Privacy Policy',
  description: '了解居家訓練網對登入、基本資料問卷、醫療史問卷、訓練紀錄、攝影機與本機資料的使用方式。',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main>
      <PrivacyContent />
    </main>
  );
}

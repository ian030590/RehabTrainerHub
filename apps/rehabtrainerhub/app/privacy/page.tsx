import type { Metadata } from 'next';
import { PrivacyContent } from '../LocalizedPages';

export const metadata: Metadata = {
  title: '隱私權政策 Privacy Policy',
  description: 'Rehab Trainer Hub 登入、匿名基本資料、訓練紀錄與本機 IndexedDB 儲存說明。 Usage instructions for login, anonymous data, and training records.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main>
      <PrivacyContent />
    </main>
  );
}

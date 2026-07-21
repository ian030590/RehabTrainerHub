import type { Metadata } from 'next';
import { ReferencesContent } from '../LocalizedPages';
import { CreateSeoMetadata } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '參考資料 / References',
  description: '整理 Rehab Trainer Hub 各訓練活動使用的 GitHub 專案與文獻參考資料。',
  path: '/references',
});

export default function ReferencesPage() {
  return <ReferencesContent />;
}

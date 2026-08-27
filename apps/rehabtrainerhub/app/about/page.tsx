import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { AboutContent } from './AboutContent';

export const metadata: Metadata = CreateSeoMetadata({
  title: '關於居家訓練網：網站定位、內容責任與聯絡方式',
  description: '了解居家訓練網提供的居家練習工具、平台安全設計、非醫療服務界線、內容責任與公開聯絡方式。',
  path: '/about',
});

export default function AboutPage() {
  return <AboutContent />;
}

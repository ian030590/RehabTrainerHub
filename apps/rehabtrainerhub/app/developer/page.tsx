import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { DeveloperPortal } from './DeveloperPortal';

export const metadata: Metadata = CreateSeoMetadata({
  title: '開發者遊戲投稿',
  description: '登入後上傳 HTML 或 ZIP 遊戲包，查看自動掃描與人工審核狀態。',
  path: '/developer',
  noIndex: true,
});

export default function DeveloperPage() {
  return <DeveloperPortal />;
}

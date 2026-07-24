import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { AdminDashboard } from './AdminDashboard';

export const metadata: Metadata = CreateSeoMetadata({
  title: '治療師後台',
  description: '治療師查看與下載訓練資料，以及維護衛教文章的管理介面。',
  path: '/admin',
  noIndex: true,
});

export default function AdminPage() {
  return <AdminDashboard />;
}

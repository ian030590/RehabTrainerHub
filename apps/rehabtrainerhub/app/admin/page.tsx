import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { AdminDashboard } from './AdminDashboard';

export const metadata: Metadata = CreateSeoMetadata({
  title: '管理後台',
  description: '已授權人員查看與下載訓練資料，以及維護衛教文章的管理介面。',
  path: '/admin',
  noIndex: true,
});

export default function AdminPage() {
  return <AdminDashboard />;
}

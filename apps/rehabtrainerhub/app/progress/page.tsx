import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { ProgressDashboard } from './ProgressDashboard';

export const metadata: Metadata = CreateSeoMetadata({
  title: '進度追蹤',
  description: '查看每日訓練任務、連續訓練天數與成就進度。',
  path: '/progress',
  noIndex: true,
});

export default function ProgressPage() {
  return <ProgressDashboard />;
}

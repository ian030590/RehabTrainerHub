import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { ProgressDashboard } from './ProgressDashboard';

export const metadata: Metadata = CreateSeoMetadata({
  title: '進度追蹤',
  description: '查看每日復健任務、連續復健天數與成就進度。',
  path: '/progress',
});

export default function ProgressPage() {
  return <ProgressDashboard />;
}

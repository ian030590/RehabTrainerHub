import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';

export const metadata: Metadata = CreateSeoMetadata({
  title: '問答中心',
  description: 'Rehab Trainer Hub 問答中心。',
  path: '/qa',
  noIndex: true,
});

export default function QuestionsPage() {
  return (
    <main className="empty-page" id="main-content">
      <h1>問答中心</h1>
    </main>
  );
}

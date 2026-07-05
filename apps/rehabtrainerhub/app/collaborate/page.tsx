import type { Metadata } from 'next';
import { CollaborateContent } from '../LocalizedPages';
import { createSeoMetadata } from '../seo';

export const metadata: Metadata = createSeoMetadata({
  title: '合作投稿 / Collaboration',
  description: '投稿治療活動想法或單一 HTML demo，分享可用於居家復健與訓練流程的活動設計。',
  path: '/collaborate',
});

export default function CollaboratePage() {
  return (
    <main>
      <CollaborateContent />
    </main>
  );
}

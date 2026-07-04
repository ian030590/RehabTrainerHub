import type { Metadata } from 'next';
import { CollaborateContent } from '../LocalizedPages';

export const metadata: Metadata = {
  title: '合作投稿 Collaboration',
  description: '投稿治療活動想法或單一 HTML demo。 Submit a therapy activity idea or a single HTML demo.',
  alternates: {
    canonical: '/collaborate',
  },
};

export default function CollaboratePage() {
  return (
    <main>
      <CollaborateContent />
    </main>
  );
}

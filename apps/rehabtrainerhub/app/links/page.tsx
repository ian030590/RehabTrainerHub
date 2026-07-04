import type { Metadata } from 'next';
import { LinksContent } from '../LocalizedPages';

export const metadata: Metadata = {
  title: '相關網站 Related Websites',
  description: 'StrokeTrainer 與 VisionTrainer 入口。 Entry points for StrokeTrainer and VisionTrainer.',
  alternates: {
    canonical: '/links',
  },
};

export default function LinksPage() {
  return (
    <main>
      <LinksContent />
    </main>
  );
}

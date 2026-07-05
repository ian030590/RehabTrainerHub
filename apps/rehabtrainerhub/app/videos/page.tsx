import type { Metadata } from 'next';
import { VideosContent } from '../LocalizedPages';
import { createSeoMetadata } from '../seo';

export const metadata: Metadata = createSeoMetadata({
  title: '衛教影片 / Education Videos',
  description: '觀看復健與居家練習衛教影片，從 YouTube 頻道整理中風復健、視覺訓練與居家練習內容。',
  path: '/videos',
});

export default function VideosPage() {
  return (
    <main>
      <VideosContent />
    </main>
  );
}

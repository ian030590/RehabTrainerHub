import type { Metadata } from 'next';
import { VideosContent } from '../LocalizedPages';

export const metadata: Metadata = {
  title: '衛教影片 Education Videos',
  description: '從 YouTube 頻道載入復健與居家練習衛教影片。 Load rehabilitation and home practice education videos from YouTube.',
  alternates: {
    canonical: '/videos',
  },
};

export default function VideosPage() {
  return (
    <main>
      <VideosContent />
    </main>
  );
}

import type { Metadata } from 'next';
import { EducationContent } from '../LocalizedPages';
import { createSeoMetadata } from '../seo';

export const metadata: Metadata = createSeoMetadata({
  title: '衛教與使用說明 / Education',
  description: '了解居家復健工具的使用方式、安全提醒，以及中風復健與視覺訓練的練習目的。',
  path: '/education',
});

export default function EducationPage() {
  return (
    <main>
      <EducationContent />
    </main>
  );
}

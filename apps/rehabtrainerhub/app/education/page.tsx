import type { Metadata } from 'next';
import { EducationContent } from '../LocalizedPages';

export const metadata: Metadata = {
  title: '衛教與使用說明 Education',
  description: '了解居家復健工具的用途與安全提醒。 Learn the purpose and safety notes for home rehabilitation tools.',
};

export default function EducationPage() {
  return (
    <main>
      <EducationContent />
    </main>
  );
}

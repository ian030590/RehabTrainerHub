import type { Metadata } from 'next';
import { CreateSeoMetadata } from '../seo';
import { QuestionsContent } from './QuestionsContent';

export const metadata: Metadata = CreateSeoMetadata({
  title: '問答中心與衛教文章',
  description: '閱讀治療師撰寫的復健衛教文章，並了解 Rehab Trainer Hub 的訓練服務。',
  path: '/qa',
});

export default function QuestionsPage() {
  return <QuestionsContent />;
}

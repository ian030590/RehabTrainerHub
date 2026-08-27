import type { Metadata } from 'next';
import {
  CreateSeoMetadata,
  maintainerPageJsonLd,
  SerializeJsonLd,
} from '../seo';
import { QuestionsContent } from './QuestionsContent';

export const metadata: Metadata = CreateSeoMetadata({
  title: '居家訓練衛教、常見問答與作者背景',
  description: '閱讀居家練習衛教與常見問答，了解作者背景、內容責任及網站使用界線。',
  path: '/qa',
});

export default function QuestionsPage() {
  return (
    <>
      <script
        id="maintainer-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: SerializeJsonLd(maintainerPageJsonLd) }}
      />
      <QuestionsContent />
    </>
  );
}

import type { Metadata } from 'next';
import {
  CreatePageJsonLd,
  CreateSeoMetadata,
  maintainerPageJsonLd,
  SerializeJsonLd,
} from '../seo';
import { QuestionsContent } from './QuestionsContent';

const metadataTitle = '居家訓練衛教、常見問答與作者背景';
const pageName = '常見問答';
const pageDescription = '閱讀居家練習衛教與常見問答，了解作者背景、內容責任及網站使用界線。';

export const metadata: Metadata = CreateSeoMetadata({
  title: metadataTitle,
  description: pageDescription,
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
      <script
        id="qa-page-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: SerializeJsonLd(CreatePageJsonLd({
            name: pageName,
            description: pageDescription,
            path: '/qa',
          })),
        }}
      />
      <QuestionsContent />
    </>
  );
}

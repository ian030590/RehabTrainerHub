import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CreateSeoMetadata } from '../seo';
import { EmbeddedTraining } from './EmbeddedTraining';
import { TrainingLoading } from './TrainingLoading';

export const metadata: Metadata = CreateSeoMetadata({
  title: '進行訓練',
  description: '在居家訓練網設定練習參數並即刻開始訓練，提供流暢的獨立訓練流程。',
  path: '/train',
  noIndex: true,
});

export default function TrainingPage() {
  return (
    <Suspense fallback={<TrainingLoading />}>
      <EmbeddedTraining />
    </Suspense>
  );
}

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CreateSeoMetadata } from '../seo';
import { EmbeddedTraining } from './EmbeddedTraining';
import { TrainingLoading } from './TrainingLoading';

export const metadata: Metadata = CreateSeoMetadata({
  title: '進行訓練',
  description: '在居家訓練網內設定並開始訓練。',
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

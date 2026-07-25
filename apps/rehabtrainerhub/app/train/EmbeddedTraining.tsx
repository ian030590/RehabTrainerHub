'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  BuildTrainingModuleHref,
  GetTrainingModuleCopy,
  trainingCatalog,
} from '@rehab-trainer/ui/trainingCatalog';

export function EmbeddedTraining() {
  const searchParams = useSearchParams();
  const [isLoaded, setIsLoaded] = useState(false);
  const module = trainingCatalog.find(
    (candidate) => candidate.catalogId === searchParams.get('module'),
  );
  const sourceUrl = useMemo(() => {
    if (!module) return '';
    const url = new URL(BuildTrainingModuleHref(module));
    url.searchParams.set('embed', 'hub');
    return url.toString();
  }, [module]);

  if (!module) {
    return (
      <main className="embedded-training-error" id="main-content">
        <h1>找不到訓練模組</h1>
        <p>這個訓練連結不存在或已經更新。</p>
        <Link href="/">返回訓練大廳</Link>
      </main>
    );
  }

  const copy = GetTrainingModuleCopy(module, 'zh-TW');

  return (
    <main className="embedded-training-page" id="main-content">
      <header className="embedded-training-bar">
        <Link aria-label="返回訓練大廳" href="/">
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          <span>訓練大廳</span>
        </Link>
        <strong>{copy.title}</strong>
      </header>
      <div className="embedded-training-frame">
        {!isLoaded && <p aria-live="polite">正在載入訓練設定…</p>}
        <iframe
          allow="autoplay; camera; microphone; fullscreen"
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
          src={sourceUrl}
          title={`${copy.title} 訓練設定與遊戲`}
        />
      </div>
    </main>
  );
}

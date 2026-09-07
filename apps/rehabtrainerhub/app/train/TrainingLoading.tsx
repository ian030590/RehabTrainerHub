'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function TrainingLoading() {
  const { language } = useHubLanguage();
  const label = GetHubUiCopy(language).embeddedTraining.loadingPage;

  return (
    <main className="embedded-training-loading" id="main-content">
      <h1 className="sr-only">進行訓練</h1>
      <div
        aria-label={label}
        aria-live="polite"
        className="training-loading-stage"
        role="status"
      >
        <span className="training-loading-spinner" aria-hidden="true" />
      </div>
      <nav className="sr-only">
        <a href="/">返回訓練大廳</a>
      </nav>
    </main>
  );
}

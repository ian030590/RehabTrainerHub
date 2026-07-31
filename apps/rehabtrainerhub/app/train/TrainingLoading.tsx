'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function TrainingLoading() {
  const { language } = useHubLanguage();
  const label = GetHubUiCopy(language).embeddedTraining.loadingPage;

  return (
    <main className="embedded-training-loading">
      <div
        aria-label={label}
        aria-live="polite"
        className="training-loading-stage"
        role="status"
      >
        <span className="training-loading-spinner" aria-hidden="true" />
      </div>
    </main>
  );
}

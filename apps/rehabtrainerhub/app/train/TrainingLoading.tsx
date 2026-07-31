'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function TrainingLoading() {
  const { language } = useHubLanguage();
  return (
    <main className="embedded-training-loading">
      <div className="training-loading-stage" role="status" aria-live="polite">
        <span className="training-loading-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <strong>{GetHubUiCopy(language).embeddedTraining.loadingPage}</strong>
        <span className="training-loading-progress" aria-hidden="true" />
      </div>
    </main>
  );
}

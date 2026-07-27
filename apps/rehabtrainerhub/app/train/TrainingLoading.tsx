'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function TrainingLoading() {
  const { language } = useHubLanguage();
  return (
    <main className="embedded-training-loading">
      {GetHubUiCopy(language).embeddedTraining.loadingPage}
    </main>
  );
}

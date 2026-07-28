'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { trainingCatalog } from '@rehab-trainer/ui/trainingCatalog';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { TrainingOverlay } from './TrainingOverlay';

export function EmbeddedTraining() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;
  const module = trainingCatalog.find(
    (candidate) => candidate.catalogId === searchParams.get('module'),
  );

  const handleClose = useCallback(() => {
    router.push('/');
  }, [router]);

  if (!module) {
    return (
      <main className="embedded-training-error" id="main-content">
        <h1>{copy.notFoundTitle}</h1>
        <p>{copy.notFoundBody}</p>
        <Link href="/">{copy.returnToLobby}</Link>
      </main>
    );
  }

  return <TrainingOverlay module={module} onClose={handleClose} />;
}

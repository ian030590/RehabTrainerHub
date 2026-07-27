'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IsHubTrainingActiveMessage,
  IsHubTrainingCompleteMessage,
} from '@rehab-trainer/ui/embeddedTraining';
import {
  BuildTrainingModuleHref,
  GetTrainingModuleCopy,
  trainingCatalog,
} from '@rehab-trainer/ui/trainingCatalog';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function EmbeddedTraining() {
  const searchParams = useSearchParams();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;
  const module = trainingCatalog.find(
    (candidate) => candidate.catalogId === searchParams.get('module'),
  );
  const sourceUrl = useMemo(() => {
    if (!module) return '';
    const url = new URL(BuildTrainingModuleHref(module));
    url.searchParams.set('embed', 'hub');
    return url.toString();
  }, [module]);

  useEffect(() => {
    setIsTrainingActive(false);
    setIsTrainingComplete(false);
  }, [sourceUrl]);

  useEffect(() => {
    if (!sourceUrl) return;

    const trainerOrigin = new URL(sourceUrl).origin;
    const handleTrainingMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== trainerOrigin
        || event.source !== frameRef.current?.contentWindow) {
        return;
      }

      if (IsHubTrainingActiveMessage(event.data)) {
        setIsTrainingActive(event.data.active);
      } else if (IsHubTrainingCompleteMessage(event.data)) {
        setIsTrainingActive(false);
        setIsTrainingComplete(true);
      }
    };

    window.addEventListener('message', handleTrainingMessage);
    return () => window.removeEventListener('message', handleTrainingMessage);
  }, [sourceUrl]);

  if (!module) {
    return (
      <main className="embedded-training-error" id="main-content">
        <h1>{copy.notFoundTitle}</h1>
        <p>{copy.notFoundBody}</p>
        <Link href="/">{copy.returnToLobby}</Link>
      </main>
    );
  }

  const moduleCopy = GetTrainingModuleCopy(module, locale);

  return (
    <main className="embedded-training-page" id="main-content">
      {!isTrainingActive && !isTrainingComplete && (
        <header className="embedded-training-bar">
          <Link aria-label={copy.returnToLobby} href="/">
            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
            <span>{copy.returnToLobby}</span>
          </Link>
          <strong>{moduleCopy.title}</strong>
        </header>
      )}
      <div className="embedded-training-frame">
        {!isLoaded && <p aria-live="polite">{copy.loading}</p>}
        <iframe
          allow="autoplay; camera; microphone; fullscreen"
          allowFullScreen
          onLoad={() => setIsLoaded(true)}
          referrerPolicy="strict-origin-when-cross-origin"
          ref={frameRef}
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts"
          src={sourceUrl}
          title={t('embeddedTraining.frameTitle', { title: moduleCopy.title })}
        />
      </div>
    </main>
  );
}

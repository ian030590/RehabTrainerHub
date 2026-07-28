'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BuildTrainingModuleHref,
  GetTrainingModuleCopy,
  type TrainingCatalogModule,
} from '@rehab-trainer/ui/trainingCatalog';
import {
  IsHubTrainingActiveMessage,
  IsHubTrainingCompleteMessage,
  IsHubTrainingExitMessage,
} from '@rehab-trainer/ui/embeddedTraining';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

interface TrainingOverlayProps {
  module: TrainingCatalogModule;
  onClose: () => void;
}

export function TrainingOverlay({ module, onClose }: TrainingOverlayProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;

  const sourceUrl = useMemo(() => {
    const url = new URL(BuildTrainingModuleHref(module));
    url.searchParams.set('embed', 'hub');
    return url.toString();
  }, [module]);

  // Open the native dialog when mounted
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Reset state when module/sourceUrl changes
  useEffect(() => {
    setIsTrainingActive(false);
    setIsTrainingComplete(false);
    setIsLoaded(false);
  }, [sourceUrl]);

  // Listen for training postMessages from the iframe
  useEffect(() => {
    if (!sourceUrl) return;
    const trainerOrigin = new URL(sourceUrl).origin;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== trainerOrigin
        || event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }

      if (IsHubTrainingActiveMessage(event.data)) {
        setIsTrainingActive(event.data.active);
      } else if (IsHubTrainingCompleteMessage(event.data)) {
        setIsTrainingActive(false);
        setIsTrainingComplete(true);
      } else if (IsHubTrainingExitMessage(event.data)) {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose, sourceUrl]);

  // Close dialog on Escape — sync React state by calling onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const moduleCopy = GetTrainingModuleCopy(module, locale);

  return (
    <dialog
      aria-label={moduleCopy.title}
      className={`training-overlay ${isTrainingActive || isTrainingComplete
        ? 'training-overlay-runtime'
        : 'training-overlay-config'}`}
      ref={dialogRef}
    >
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
    </dialog>
  );
}

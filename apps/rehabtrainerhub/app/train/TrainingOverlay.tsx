'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BuildTrainingModuleHref,
  GetTrainingModuleCopy,
  type TrainingCatalogModule,
} from '@rehab-trainer/hub-modules/catalog';
import {
  IsHubTrainingActiveMessage,
  IsHubTrainingCompleteMessage,
  IsHubTrainingExitMessage,
  IsHubTrainingReadyMessage,
  IsTrustedTrainingFrameMessage,
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
  const [isReady, setIsReady] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;

  const closeOverlay = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  }, [onClose]);

  const sourceUrl = useMemo(() => {
    const url = new URL(BuildTrainingModuleHref(module));
    url.searchParams.set('embed', 'hub');
    url.searchParams.set('lang', language);
    return url.toString();
  }, [language, module]);

  // Open the native dialog when mounted
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  // Reset state when module/sourceUrl changes
  useEffect(() => {
    setIsTrainingActive(false);
    setIsTrainingComplete(false);
    setIsLoaded(false);
    setIsReady(false);
  }, [sourceUrl]);

  // Listen for training postMessages from the iframe
  useEffect(() => {
    if (!sourceUrl) return;
    const trainerOrigin = new URL(sourceUrl).origin;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!IsTrustedTrainingFrameMessage(
        event,
        trainerOrigin,
        frameRef.current?.contentWindow ?? null,
      )) {
        return;
      }

      if (IsHubTrainingActiveMessage(event.data)) {
        setIsTrainingActive(event.data.active);
      } else if (IsHubTrainingCompleteMessage(event.data)) {
        setIsTrainingActive(false);
        setIsTrainingComplete(true);
      } else if (IsHubTrainingReadyMessage(event.data)) {
        setIsReady(true);
      } else if (IsHubTrainingExitMessage(event.data)) {
        closeOverlay();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [closeOverlay, sourceUrl]);

  // A trainer normally removes the loading stage with the ready message. If
  // its bootstrap fails before React mounts, expose the iframe after a short
  // grace period instead of leaving an endless loading animation.
  useEffect(() => {
    if (!isLoaded || isReady) return;
    const timeoutId = window.setTimeout(() => setIsReady(true), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, isReady]);

  // Close dialog on Escape — sync React state by calling onClose
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      closeOverlay();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [closeOverlay]);

  const moduleCopy = GetTrainingModuleCopy(module, locale);

  return (
    <dialog
      aria-label={moduleCopy.title}
      className={`training-overlay ${isTrainingActive || isTrainingComplete
        ? 'training-overlay-runtime'
        : 'training-overlay-config'}`}
      ref={dialogRef}
    >
      <div className={`embedded-training-frame ${isReady ? 'is-ready' : ''}`}>
        <div
          aria-label={copy.loading}
          aria-hidden={isReady || undefined}
          aria-live={isReady ? undefined : 'polite'}
          className="training-loading-stage"
          role={isReady ? undefined : 'status'}
        >
          <span className="training-loading-spinner" aria-hidden="true" />
        </div>
        <iframe
          allow="autoplay; camera; microphone; fullscreen"
          allowFullScreen
          className={isLoaded ? 'is-loaded' : undefined}
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GetTrainingModuleCopy,
  type TrainingCatalogModule,
} from '@rehab-trainer/hub-modules/catalog';
import { CreateOfficialHostIframePolicy } from '@rehab-trainer/ui/officialTrainingHostPolicy';
import {
  CreateOfficialHostAllowAttribute,
  IsTrustedReadyEvent,
  OfficialTrainingHostSession,
} from '@rehab-trainer/ui/officialTrainingHostProtocol';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

interface TrainingOverlayProps {
  module: TrainingCatalogModule;
  onClose: () => void;
}

export function TrainingOverlay({ module, onClose }: TrainingOverlayProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hostSessionRef = useRef<OfficialTrainingHostSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;
  const hostOrigin = typeof window === 'undefined' ? undefined : window.location.origin;

  const closeOverlay = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  }, [onClose]);

  const sourceUrl = useMemo(() => {
    const url = new URL(CreateOfficialHostIframePolicy(module.manifest, { origin: hostOrigin }).src);
    url.searchParams.set('lang', language);
    return url.toString();
  }, [hostOrigin, language, module.manifest]);

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
      const frame = frameRef.current;
      if (!frame || !IsTrustedReadyEvent(event, trainerOrigin, frame, module.manifest.id)) return;

      const session = new OfficialTrainingHostSession({
        iframe: frame,
        manifest: module.manifest,
        origin: trainerOrigin,
        onEvent: (hostEvent) => {
          if (hostEvent.type === 'prepared') {
            setIsReady(true);
          } else if (hostEvent.type === 'started') {
            setIsTrainingActive(true);
          } else if (hostEvent.type === 'completed') {
            setIsTrainingActive(false);
            setIsTrainingComplete(true);
          } else if (hostEvent.type === 'aborted' || hostEvent.type === 'disposed') {
            closeOverlay();
          } else if (hostEvent.type === 'failed') {
            setIsReady(true);
          }
        },
      });
      if (!session.connect(event)) {
        session.dispose();
        return;
      }
      hostSessionRef.current?.dispose();
      hostSessionRef.current = session;
      void session.send({ type: 'prepare', config: {} }).catch(() => setIsReady(true));
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      hostSessionRef.current?.dispose();
      hostSessionRef.current = null;
    };
  }, [closeOverlay, module.manifest, sourceUrl]);

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
  const iframePolicy = useMemo(
    () => CreateOfficialHostIframePolicy(module.manifest, { origin: hostOrigin }),
    [hostOrigin, module.manifest],
  );
  const delegatedFeatures = useMemo(
    () => CreateOfficialHostAllowAttribute(module.manifest),
    [module.manifest],
  );

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
          allow={delegatedFeatures}
          allowFullScreen={iframePolicy.allowFullscreen}
          className={isLoaded ? 'is-loaded' : undefined}
          onLoad={() => setIsLoaded(true)}
          referrerPolicy={iframePolicy.referrerPolicy}
          ref={frameRef}
          sandbox={iframePolicy.sandboxTokens.join(' ')}
          src={sourceUrl}
          title={t('embeddedTraining.frameTitle', { title: moduleCopy.title })}
        />
      </div>
    </dialog>
  );
}

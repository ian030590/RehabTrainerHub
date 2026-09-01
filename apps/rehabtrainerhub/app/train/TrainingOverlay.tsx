'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ParseGameSettingsDefinition,
  type GameSettingsDefinition,
  type GameSettingsValues,
} from '@rehab-trainer/game-settings';
import {
  BuildTrainingModuleHref,
  BuildTrainingModuleSettingsHref,
  GetTrainingModuleCopy,
  type TrainingCatalogModule,
} from '@rehab-trainer/hub-modules/catalog';
import {
  CreateHubGameSettingsMessage,
  IsHubTrainingActiveMessage,
  IsHubTrainingCompleteMessage,
  IsHubTrainingExitMessage,
  IsHubTrainingReadyMessage,
  IsTrustedTrainingFrameMessage,
} from '@rehab-trainer/ui/embeddedTraining';
import { Button } from '../components/ui/button';
import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { GameSettingsForm } from './GameSettingsForm';

interface TrainingOverlayProps {
  module: TrainingCatalogModule;
  onClose: () => void;
}

export function TrainingOverlay({ module, onClose }: TrainingOverlayProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [definition, setDefinition] = useState<GameSettingsDefinition | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsRequestKey, setSettingsRequestKey] = useState(0);
  const [configuredSettings, setConfiguredSettings] = useState<GameSettingsValues | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isTrainingActive, setIsTrainingActive] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const [sessionNonce] = useState(CreateSessionNonce);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).embeddedTraining;

  const closeOverlay = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  }, [onClose]);

  const sourceUrl = useMemo(() => {
    const url = new URL(BuildTrainingModuleHref(module), window.location.origin);
    url.searchParams.set('embed', 'hub');
    url.searchParams.set('lang', language);
    return url.toString();
  }, [language, module]);
  const sourceOrigin = useMemo(() => new URL(sourceUrl).origin, [sourceUrl]);

  const sendSettingsToFrame = useCallback(() => {
    const frameWindow = frameRef.current?.contentWindow;
    if (!frameWindow || !configuredSettings) return;
    frameWindow.postMessage(
      CreateHubGameSettingsMessage(module.runtimeId, sessionNonce, configuredSettings),
      sourceOrigin,
    );
  }, [configuredSettings, module.runtimeId, sessionNonce, sourceOrigin]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDefinition(null);
    setSettingsError(false);
    void fetch(BuildTrainingModuleSettingsHref(module), {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Unable to load settings.json (${response.status}).`);
        return ParseGameSettingsDefinition(await response.json(), module.runtimeId);
      })
      .then(setDefinition)
      .catch(() => {
        if (!controller.signal.aborted) setSettingsError(true);
      });
    return () => controller.abort();
  }, [module, settingsRequestKey]);

  useEffect(() => {
    setIsTrainingActive(false);
    setIsTrainingComplete(false);
    setIsLoaded(false);
    setIsReady(false);
  }, [sourceUrl]);

  useEffect(() => {
    if (!configuredSettings) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (!IsTrustedTrainingFrameMessage(
        event,
        sourceOrigin,
        frameRef.current?.contentWindow ?? null,
      )) return;

      if (IsHubTrainingActiveMessage(event.data)) {
        setIsTrainingActive(event.data.active);
      } else if (IsHubTrainingCompleteMessage(event.data)) {
        setIsTrainingActive(false);
        setIsTrainingComplete(true);
      } else if (IsHubTrainingReadyMessage(event.data)) {
        setIsReady(true);
        sendSettingsToFrame();
      } else if (IsHubTrainingExitMessage(event.data)) {
        closeOverlay();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [closeOverlay, configuredSettings, sendSettingsToFrame, sourceOrigin]);

  useEffect(() => {
    if (!isLoaded || isReady || !configuredSettings) return;
    const timeoutId = window.setTimeout(() => setIsReady(true), 8_000);
    return () => window.clearTimeout(timeoutId);
  }, [configuredSettings, isLoaded, isReady]);

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
  const delegatedFeatures = module.mediaPermission === 'camera-or-microphone'
    ? 'autoplay; camera; microphone; fullscreen'
    : module.mediaPermission === 'camera' || module.mediaPermission === 'camera-optional'
      ? 'autoplay; camera; fullscreen'
      : 'autoplay; fullscreen';

  return (
    <dialog
      aria-label={moduleCopy.title}
      className={`training-overlay ${configuredSettings || isTrainingActive || isTrainingComplete
        ? 'training-overlay-runtime'
        : 'training-overlay-config'}`}
      ref={dialogRef}
    >
      {!configuredSettings && definition && (
        <GameSettingsForm
          definition={definition}
          language={language}
          onCancel={closeOverlay}
          onSubmit={setConfiguredSettings}
          title={moduleCopy.title}
        />
      )}

      {!configuredSettings && !definition && (
        <div className="grid h-full place-items-center bg-[var(--background)] p-6 text-center">
          {!settingsError ? (
            <div className="grid justify-items-center gap-3" role="status">
              <span className="training-loading-spinner" aria-hidden="true" />
              <p className="m-0 font-bold text-[var(--text-muted)]">
                {language === 'en' ? 'Loading training settings…' : '正在載入訓練設定…'}
              </p>
            </div>
          ) : (
            <div className="grid max-w-md justify-items-center gap-4" role="alert">
              <span aria-hidden="true" className="material-symbols-outlined text-4xl text-[var(--error)]">error</span>
              <div>
                <h2 className="m-0 text-xl font-black text-[var(--heading)]">
                  {language === 'en' ? 'Settings could not be loaded' : '無法載入訓練設定'}
                </h2>
                <p className="mt-2 mb-0 text-[var(--text-muted)]">
                  {language === 'en'
                    ? 'The game settings file is missing or invalid.'
                    : '遊戲的 settings.json 不存在或格式不正確。'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={closeOverlay} type="button" variant="outline">
                  {language === 'en' ? 'Back to lobby' : '返回大廳'}
                </Button>
                <Button onClick={() => setSettingsRequestKey((key) => key + 1)} type="button">
                  {language === 'en' ? 'Try again' : '重新載入'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {configuredSettings && (
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
            allowFullScreen
            className={isLoaded ? 'is-loaded' : undefined}
            onLoad={() => {
              setIsLoaded(true);
              sendSettingsToFrame();
            }}
            referrerPolicy="strict-origin-when-cross-origin"
            ref={frameRef}
            sandbox="allow-downloads allow-modals allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
            src={sourceUrl}
            title={t('embeddedTraining.frameTitle', { title: moduleCopy.title })}
          />
        </div>
      )}
    </dialog>
  );
}

function CreateSessionNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ParseGameSettingsDefinition,
  type GameSettingsDefinition,
  type GameSettingsValues,
} from '@rehab-trainer/game-settings';
import {
  CreateGamePlatformRunnerCommandMessage,
  CreateGamePlatformRunnerSettingsMessage,
  gamePlatformLifecycleMessageType,
  gamePlatformResultMessageType,
  IsTrustedGamePlatformFrameMessage,
  IsTrustedGamePlatformRunnerReadyMessage,
  type GamePlatformResultPayload,
} from '@rehab-trainer/ui/gamePlatform';
import {
  BuildApiUrl,
  GetAuthToken,
} from '@rehab-trainer/ui/auth/authClient';
import type { PublishedGame } from '../publishedGames';
import { useHubLanguage } from '../i18n/HubLanguage';
import { Button } from '../components/ui/button';
import { GetTrainerCategoryTheme } from '@rehab-trainer/hub-modules/catalog';
import { BuildTrainingThemeStyle } from '../trainingThemeStyle';
import { GameSettingsForm } from './GameSettingsForm';

interface PackageGameOverlayProps {
  game: PublishedGame;
  onClose: () => void;
}

export function PackageGameOverlay({ game, onClose }: PackageGameOverlayProps) {
  const { language } = useHubLanguage();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastSequenceRef = useRef(-1);
  const resultSavedRef = useRef(false);
  const pendingResultRef = useRef<GamePlatformResultPayload | null>(null);
  const saveInFlightRef = useRef(false);
  const runSessionRequestRef = useRef<{
    key: string;
    request: Promise<string | null>;
  } | null>(null);
  const runnerSessionIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const fallbackReadyTimerRef = useRef<number | null>(null);
  const [definition, setDefinition] = useState<GameSettingsDefinition | null>(null);
  const [settingsError, setSettingsError] = useState(false);
  const [settingsRequestKey, setSettingsRequestKey] = useState(0);
  const [configuredSettings, setConfiguredSettings] = useState<GameSettingsValues | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'guest' | 'error'>('idle');
  const sessionNonce = useMemo(CreateSessionNonce, [game.release.id]);
  const sourceUrl = useMemo(() => {
    const url = new URL(game.release.launchUrl);
    url.searchParams.set('embed', 'hub');
    url.searchParams.set('session', sessionNonce);
    return url.toString();
  }, [game.release.launchUrl, sessionNonce]);

  const sendSettingsToRunner = useCallback((runnerSessionId?: string) => {
    const frameWindow = frameRef.current?.contentWindow;
    const currentRunnerSessionId = runnerSessionId ?? runnerSessionIdRef.current;
    if (!frameWindow || !currentRunnerSessionId || !configuredSettings) return;
    frameWindow.postMessage(
      CreateGamePlatformRunnerSettingsMessage(
        currentRunnerSessionId,
        sessionNonce,
        configuredSettings,
      ),
      '*',
    );
  }, [configuredSettings, sessionNonce]);

  const ensureRunSession = useCallback(() => {
    const key = `${game.release.id}:${sessionNonce}`;
    if (!runSessionRequestRef.current || runSessionRequestRef.current.key !== key) {
      const request = CreateGameRunSession(game.release.id, sessionNonce);
      runSessionRequestRef.current = {
        key,
        request,
      };
      void request.catch(() => {
        if (runSessionRequestRef.current?.request === request) {
          runSessionRequestRef.current = null;
        }
      });
    }
    return runSessionRequestRef.current.request;
  }, [game.release.id, sessionNonce]);

  const finishClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    const frameWindow = frameRef.current?.contentWindow;
    const runnerSessionId = runnerSessionIdRef.current;
    if (!frameWindow || !runnerSessionId) {
      finishClose();
      return;
    }
    frameWindow.postMessage(
      CreateGamePlatformRunnerCommandMessage(runnerSessionId, sessionNonce, 'exit'),
      '*',
    );
    closeTimerRef.current = window.setTimeout(finishClose, 750);
  }, [finishClose, sessionNonce]);

  const persistResult = useCallback(async (result: GamePlatformResultPayload) => {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    pendingResultRef.current = result;
    setSaveState('saving');
    try {
      const runSessionToken = await ensureRunSession();
      if (!runSessionToken) {
        setSaveState('guest');
        return;
      }
      setSaveState(await SaveGameResult(
        game.release.id,
        sessionNonce,
        runSessionToken,
        result,
      ));
    } catch {
      setSaveState('error');
    } finally {
      saveInFlightRef.current = false;
    }
  }, [ensureRunSession, game.release.id, sessionNonce]);

  useEffect(() => {
    dialogRef.current?.showModal();
    void ensureRunSession().catch(() => {
      // Saving reports the actionable error if the game later returns a result.
    });
    return () => {
      if (fallbackReadyTimerRef.current !== null) {
        window.clearTimeout(fallbackReadyTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (dialogRef.current?.open) dialogRef.current.close();
    };
  }, [ensureRunSession]);

  useEffect(() => {
    const controller = new AbortController();
    setDefinition(null);
    setSettingsError(false);
    void fetch(game.release.settingsUrl, {
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Unable to load settings.json (${response.status}).`);
        return ParseGameSettingsDefinition(await response.json(), game.slug);
      })
      .then(setDefinition)
      .catch(() => {
        if (!controller.signal.aborted) setSettingsError(true);
      });
    return () => controller.abort();
  }, [game.release.settingsUrl, game.slug, settingsRequestKey]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (IsTrustedGamePlatformRunnerReadyMessage(
        event,
        frameRef.current?.contentWindow ?? null,
        sessionNonce,
        game.slug,
        game.release.version,
      )) {
        runnerSessionIdRef.current = event.data.sessionId;
        setIsReady(true);
        sendSettingsToRunner(event.data.sessionId);
        return;
      }
      if (!IsTrustedGamePlatformFrameMessage(
        event,
        frameRef.current?.contentWindow ?? null,
        sessionNonce,
        lastSequenceRef.current,
      )) return;
      lastSequenceRef.current = event.data.sequence;
      if (event.data.type === gamePlatformLifecycleMessageType) {
        const { phase } = event.data.payload;
        setIsReady(true);
        setIsActive(['started', 'resumed'].includes(phase));
        if (phase === 'completed' || phase === 'aborted') setIsComplete(true);
        return;
      }
      if (event.data.type === gamePlatformResultMessageType && !resultSavedRef.current) {
        resultSavedRef.current = true;
        pendingResultRef.current = event.data.payload;
        setIsReady(true);
        setIsActive(false);
        setIsComplete(true);
        void persistResult(event.data.payload).finally(() => {
          if (closingRef.current) finishClose();
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [finishClose, game.release.version, game.slug, persistResult, sendSettingsToRunner, sessionNonce]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    dialog.addEventListener('cancel', cancel);
    return () => dialog.removeEventListener('cancel', cancel);
  }, [requestClose]);

  return (
    <dialog
      aria-label={`${game.title} 遊戲視窗`}
      className={`package-game-overlay ${configuredSettings
        ? 'package-game-overlay-runtime'
        : 'package-game-overlay-config'}${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
      ref={dialogRef}
      style={BuildTrainingThemeStyle(GetTrainerCategoryTheme(game.trainer))}
    >
      {!configuredSettings && definition && (
        <GameSettingsForm
          definition={definition}
          language={language}
          onCancel={requestClose}
          onSubmit={setConfiguredSettings}
          title={game.title}
        />
      )}

      {!configuredSettings && !definition && (
        <div className="grid h-full place-items-center bg-[var(--background)] p-6 text-center">
          {!settingsError ? (
            <div className="grid justify-items-center gap-3" role="status">
              <span className="training-loading-spinner" aria-hidden="true" />
              <p className="m-0 font-bold text-[var(--text-muted)]">
                {language === 'en' ? 'Loading game settings…' : '正在載入遊戲設定…'}
              </p>
            </div>
          ) : (
            <div className="grid max-w-md justify-items-center gap-4" role="alert">
              <span aria-hidden="true" className="material-symbols-outlined text-4xl text-[var(--error)]">error</span>
              <div>
                <h2 className="m-0 text-xl font-black text-[var(--heading)]">
                  {language === 'en' ? 'Settings could not be loaded' : '無法載入遊戲設定'}
                </h2>
                <p className="mt-2 mb-0 text-[var(--text-muted)]">
                  {language === 'en'
                    ? 'This release does not contain a valid settings.json file.'
                    : '這個發布版本未包含有效的 settings.json。'}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={requestClose} type="button" variant="outline">
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

      {configuredSettings && <><header className="package-game-toolbar">
        <div>
          <small>{game.developerName} · v{game.release.version}</small>
          <strong>{game.title}</strong>
        </div>
        <p className="package-game-privacy-warning" role="note">
          {language === 'en'
            ? 'Third-party content: do not enter names, passwords, account details, or contact information.'
            : '第三方內容：請勿輸入姓名、密碼、帳號資料或聯絡方式。'}
        </p>
        <div className="package-game-toolbar-actions">
          {saveState === 'saved' && <span role="status">當次紀錄已儲存</span>}
          {saveState === 'guest' && <span role="status">登入後可儲存當次紀錄</span>}
          {saveState === 'saving' && <span role="status">正在儲存當次紀錄…</span>}
          {saveState === 'error' && <span role="alert">當次紀錄未能儲存</span>}
          {saveState === 'error' && pendingResultRef.current && (
            <button
              onClick={() => void persistResult(pendingResultRef.current as GamePlatformResultPayload)}
              type="button"
            >
              {language === 'en' ? 'Retry save' : '重試儲存'}
            </button>
          )}
          <a href={game.release.installUrl} rel="noopener noreferrer" target="_blank">
            安裝此遊戲
          </a>
          <button disabled={isClosing} onClick={requestClose} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
            關閉
          </button>
        </div>
      </header>
      <div className={`package-game-frame${isReady ? ' is-ready' : ''}`}>
        {!isReady && (
          <div className="training-loading-stage" role="status">
            <span className="training-loading-spinner" aria-hidden="true" />
            <p>正在啟動隔離遊戲…</p>
          </div>
        )}
        <iframe
          onLoad={() => {
            if (fallbackReadyTimerRef.current !== null) {
              window.clearTimeout(fallbackReadyTimerRef.current);
            }
            fallbackReadyTimerRef.current = window.setTimeout(() => setIsReady(true), 8000);
          }}
          ref={frameRef}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          src={sourceUrl}
          title={`${game.title}（隔離執行）`}
        />
      </div></>}
    </dialog>
  );
}

function CreateSessionNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function SaveGameResult(
  releaseId: string,
  clientRunId: string,
  runSessionToken: string,
  result: GamePlatformResultPayload,
): Promise<'saved' | 'guest'> {
  const token = GetAuthToken();
  if (!token) return 'guest';
  const response = await fetch(BuildApiUrl(undefined, '/api/game-runs'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ releaseId, clientRunId, runSessionToken, result }),
  });
  if (!response.ok) throw new Error(`Unable to save game result. Status ${response.status}`);
  return 'saved';
}

async function CreateGameRunSession(
  releaseId: string,
  clientRunId: string,
): Promise<string | null> {
  const token = GetAuthToken();
  if (!token) return null;
  const response = await fetch(BuildApiUrl(undefined, '/api/game-run-sessions'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ releaseId, clientRunId }),
  });
  if (!response.ok) throw new Error(`Unable to create game run session. Status ${response.status}`);
  const payload: unknown = await response.json();
  if (!IsGameRunSessionResponse(payload)) {
    throw new Error('Invalid game run session response.');
  }
  return payload.runSession.token;
}

function IsGameRunSessionResponse(value: unknown): value is {
  runSession: { token: string; expiresAt: string };
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const runSession = (value as { runSession?: unknown }).runSession;
  if (!runSession || typeof runSession !== 'object' || Array.isArray(runSession)) return false;
  const { token, expiresAt } = runSession as { token?: unknown; expiresAt?: unknown };
  return typeof token === 'string'
    && /^[a-f0-9]{64}$/.test(token)
    && typeof expiresAt === 'string'
    && Number.isFinite(Date.parse(expiresAt));
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  authChangedEvent,
  ConfigureRemoteTrainingRecordVerification,
  type AuthLocale,
  type AuthUser,
  FetchCurrentAuthUser,
  FetchSharedAuthSession,
  GetAuthToken,
  SetAuthToken,
} from '../auth/authClient';
import { trainingConfigReadyEvent } from '../hooks/useTrainingConfigReady';
import { AuthPanel } from './AuthPanel';

interface TrainingLoginReminderProps {
  active: boolean;
  apiBase?: string;
  appName: string;
  locale?: AuthLocale;
  privacyHref?: string;
  turnstileAuthRequired?: boolean;
  turnstileRecordsRequired?: boolean;
  turnstileSiteKey?: string;
}

const text = {
  zhTW: {
    title: '建議登入以保存訓練紀錄',
    checking: '正在確認登入狀態…',
    intro: '你可以不用登入繼續訓練。登入後，訓練紀錄可跨裝置保存與查看。',
    profilePending: '完成基本資料與醫療史問卷後，紀錄可用於分組分析與網站改善；本站不提供個別評估、診斷或治療。',
    dismiss: '稍後再說',
  },
  en: {
    title: 'Sign in to save training records',
    checking: 'Checking sign-in status…',
    intro: 'You can keep training without signing in. After sign-in, training records can be saved and viewed across devices.',
    profilePending: 'Completing the basic profile and medical history questionnaires supports grouped analysis and website improvement; this site does not provide individualized assessment, diagnosis, or treatment.',
    dismiss: 'Later',
  },
} as const;

const sessionCheckTimeoutMs = 5_000;

function ToTextKey(locale: AuthLocale | undefined): keyof typeof text {
  return locale === 'en' ? 'en' : 'zhTW';
}

function StoreLeftPage(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Local storage can be unavailable in strict private modes.
  }
}

function ConsumeLeftPage(key: string): boolean {
  try {
    const hadLeftPage = window.localStorage.getItem(key) === '1';
    if (hadLeftPage) window.localStorage.removeItem(key);
    return hadLeftPage;
  } catch {
    return false;
  }
}

export function TrainingLoginReminder({
  active,
  apiBase,
  appName,
  locale,
  privacyHref,
  turnstileAuthRequired,
  turnstileRecordsRequired,
  turnstileSiteKey,
}: TrainingLoginReminderProps) {
  const labels = text[ToTextKey(locale)];
  const reminderStorageKey = `rehabtrainerhub.training-login-reminder.${appName}`;
  const hasLeftPageRef = useRef(false);
  const sessionCheckGenerationRef = useRef(0);
  const sessionCheckAbortRef = useRef<AbortController | null>(null);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  useEffect(() => {
    ConfigureRemoteTrainingRecordVerification({
      enabled: turnstileRecordsRequired === true,
      locale,
      siteKey: turnstileSiteKey,
    });
    return () => ConfigureRemoteTrainingRecordVerification({ enabled: false });
  }, [locale, turnstileRecordsRequired, turnstileSiteKey]);

  const checkSession = useCallback(async (openForGuest = false): Promise<AuthUser | null> => {
    sessionCheckGenerationRef.current += 1;
    const generation = sessionCheckGenerationRef.current;
    sessionCheckAbortRef.current?.abort();
    sessionCheckAbortRef.current = null;
    if (!active) {
      setIsReminderOpen(false);
      setIsSignedIn(false);
      setIsCheckingSession(false);
      return null;
    }
    if (openForGuest) {
      setIsReminderOpen(true);
      setIsCheckingSession(Boolean(GetAuthToken()));
    }

    const controller = new AbortController();
    sessionCheckAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, sessionCheckTimeoutMs);

    let user: AuthUser | null = null;
    try {
      user = await FetchCurrentAuthUser(apiBase, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('Unable to check auth token before training.', error);
      }
    }

    if (!user && !controller.signal.aborted) {
      try {
        const sharedSession = await FetchSharedAuthSession(apiBase, controller.signal);
        if (sharedSession) {
          SetAuthToken(sharedSession.token, false);
          user = sharedSession.user;
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Unable to check shared auth session before training.', error);
        }
      }
    }

    window.clearTimeout(timeoutId);
    if (sessionCheckAbortRef.current === controller) {
      sessionCheckAbortRef.current = null;
    }
    if (generation !== sessionCheckGenerationRef.current) return null;
    if (controller.signal.aborted) {
      if (timedOut && openForGuest) {
        setIsSignedIn(false);
        setIsCheckingSession(false);
        setIsReminderOpen(true);
      }
      return null;
    }

    setIsSignedIn(Boolean(user));
    setIsCheckingSession(false);
    if (user) setIsReminderOpen(false);
    else if (openForGuest) setIsReminderOpen(true);
    return user;
  }, [active, apiBase]);

  useEffect(() => {
    const handleAuthChange = () => void checkSession(false);

    void checkSession(false);
    window.addEventListener(authChangedEvent, handleAuthChange);
    return () => {
      window.removeEventListener(authChangedEvent, handleAuthChange);
      sessionCheckGenerationRef.current += 1;
      sessionCheckAbortRef.current?.abort();
      sessionCheckAbortRef.current = null;
    };
  }, [checkSession]);

  useEffect(() => {
    if (!active) return;
    const handleTrainingConfigReady = () => {
      void checkSession(true);
    };
    window.addEventListener(trainingConfigReadyEvent, handleTrainingConfigReady);
    return () => window.removeEventListener(trainingConfigReadyEvent, handleTrainingConfigReady);
  }, [active, checkSession]);

  useEffect(() => {
    if (!active) {
      hasLeftPageRef.current = false;
      return;
    }

    const markLeftPage = () => {
      hasLeftPageRef.current = true;
      StoreLeftPage(reminderStorageKey);
    };
    const remindIfGuest = () => {
      if (!hasLeftPageRef.current && !ConsumeLeftPage(reminderStorageKey)) return;
      hasLeftPageRef.current = false;
      void checkSession(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markLeftPage();
      if (document.visibilityState === 'visible') remindIfGuest();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', markLeftPage);
    window.addEventListener('pageshow', remindIfGuest);
    remindIfGuest();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', markLeftPage);
      window.removeEventListener('pageshow', remindIfGuest);
    };
  }, [active, checkSession, reminderStorageKey]);

  const handleAuthChange = (user: AuthUser | null) => {
    sessionCheckGenerationRef.current += 1;
    sessionCheckAbortRef.current?.abort();
    sessionCheckAbortRef.current = null;
    setIsSignedIn(Boolean(user));
    setIsCheckingSession(false);
    if (user) setIsReminderOpen(false);
  };

  const handleDismiss = () => {
    sessionCheckGenerationRef.current += 1;
    sessionCheckAbortRef.current?.abort();
    sessionCheckAbortRef.current = null;
    setIsCheckingSession(false);
    setIsReminderOpen(false);
  };

  if (!active || !isReminderOpen || (isSignedIn && !isCheckingSession)) return null;

  return (
    <div className="auth-dialog-backdrop">
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="training-login-reminder-title">
        <h2 id="training-login-reminder-title">{labels.title}</h2>
        <p>{labels.intro}</p>
        <p className="auth-sensitive-warning">{labels.profilePending}</p>
        {isCheckingSession && <p role="status">{labels.checking}</p>}
        <AuthPanel
          apiBase={apiBase}
          appName={appName}
          locale={locale}
          privacyHref={privacyHref}
          onAuthChange={handleAuthChange}
          turnstileSiteKey={turnstileAuthRequired ? turnstileSiteKey : undefined}
        />
        <div className="auth-dialog-actions">
          <button className="auth-button auth-button-secondary" type="button" onClick={handleDismiss}>
            {labels.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}

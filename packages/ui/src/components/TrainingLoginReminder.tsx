import { useCallback, useEffect, useRef, useState } from 'react';
import {
  authChangedEvent,
  ConfigureRemoteTrainingRecordVerification,
  type AuthLocale,
  type AuthUser,
  FetchCurrentAuthUser,
  FetchSharedAuthSession,
  SetAuthToken,
} from '../auth/authClient';
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
    intro: '你可以不用登入繼續訓練。登入後，訓練紀錄可跨裝置保存與查看。',
    profilePending: '完成基本資料與醫療史問卷後，紀錄可用於分組分析與網站改善；本站不提供個別評估、診斷或治療。',
    dismiss: '稍後再說',
  },
  en: {
    title: 'Sign in to save training records',
    intro: 'You can keep training without signing in. After sign-in, training records can be saved and viewed across devices.',
    profilePending: 'Completing the basic profile and medical history questionnaires supports grouped analysis and website improvement; this site does not provide individualized assessment, diagnosis, or treatment.',
    dismiss: 'Later',
  },
} as const;

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
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    ConfigureRemoteTrainingRecordVerification({
      enabled: turnstileRecordsRequired === true,
      locale,
      siteKey: turnstileSiteKey,
    });
    return () => ConfigureRemoteTrainingRecordVerification({ enabled: false });
  }, [locale, turnstileRecordsRequired, turnstileSiteKey]);

  const checkSession = useCallback(async (): Promise<AuthUser | null> => {
    if (!active) {
      setIsReminderOpen(false);
      setIsSignedIn(false);
      return null;
    }

    let user: AuthUser | null = null;
    try {
      user = await FetchCurrentAuthUser(apiBase);
    } catch (error) {
      console.warn('Unable to check auth token before training.', error);
    }

    if (!user) {
      try {
        const sharedSession = await FetchSharedAuthSession(apiBase);
        if (sharedSession) {
          SetAuthToken(sharedSession.token, false);
          user = sharedSession.user;
        }
      } catch (error) {
        console.warn('Unable to check shared auth session before training.', error);
      }
    }

    setIsSignedIn(Boolean(user));
    if (user) setIsReminderOpen(false);
    return user;
  }, [active, apiBase]);

  useEffect(() => {
    const handleAuthChange = () => void checkSession();

    void checkSession();
    window.addEventListener(authChangedEvent, handleAuthChange);
    return () => {
      window.removeEventListener(authChangedEvent, handleAuthChange);
    };
  }, [checkSession]);

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
      void checkSession().then((user) => {
        if (!user) setIsReminderOpen(true);
      });
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
    setIsSignedIn(Boolean(user));
    if (user) setIsReminderOpen(false);
  };

  if (!active || isSignedIn || !isReminderOpen) return null;

  return (
    <div className="auth-dialog-backdrop">
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="training-login-reminder-title">
        <h2 id="training-login-reminder-title">{labels.title}</h2>
        <p>{labels.intro}</p>
        <p className="auth-sensitive-warning">{labels.profilePending}</p>
        <AuthPanel
          apiBase={apiBase}
          appName={appName}
          locale={locale}
          privacyHref={privacyHref}
          onAuthChange={handleAuthChange}
          turnstileSiteKey={turnstileAuthRequired ? turnstileSiteKey : undefined}
        />
        <div className="auth-dialog-actions">
          <button className="auth-button auth-button-secondary" type="button" onClick={() => setIsReminderOpen(false)}>
            {labels.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}

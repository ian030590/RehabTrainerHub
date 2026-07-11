import { useEffect, useMemo, useState } from 'react';
import {
  type AuthLocale,
  type AuthUser,
  fetchCurrentAuthUser,
  fetchSharedAuthSession,
  getAuthToken,
  setAuthToken,
} from '../auth/authClient';
import { AuthPanel } from './AuthPanel';

interface TrainingLoginReminderProps {
  active: boolean;
  apiBase?: string;
  appName: string;
  locale?: AuthLocale;
  privacyHref?: string;
}

const text = {
  zhTW: {
    title: '登入提醒',
    intro: '開始訓練前建議先登入。登入後訓練紀錄會儲存在 D1 database；未登入仍可使用，紀錄只會儲存在這台裝置的 IndexedDB。',
    continue: '稍後再說',
  },
  en: {
    title: 'Sign-in reminder',
    intro: 'Before training, sign in to save records to D1. You can continue without sign-in, but records stay in IndexedDB on this device.',
    continue: 'Continue for now',
  },
} as const;

function toTextKey(locale: AuthLocale | undefined): keyof typeof text {
  return locale === 'en' ? 'en' : 'zhTW';
}

export function TrainingLoginReminder({
  active,
  apiBase,
  appName,
  locale,
  privacyHref,
}: TrainingLoginReminderProps) {
  const labels = text[toTextKey(locale)];
  const [isOpen, setIsOpen] = useState(false);
  const storageKey = useMemo(() => `rehabtrainerhub.auth.trainingReminderSeen.${appName}`, [appName]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (!active) {
        setIsOpen(false);
        return;
      }
      if (typeof window === 'undefined' || window.localStorage.getItem(storageKey) === '1') return;
      if (getAuthToken()) {
        try {
          if (await fetchCurrentAuthUser(apiBase)) return;
        } catch (error) {
          console.warn('Unable to check auth token before training.', error);
        }
      }

      try {
        const sharedSession = await fetchSharedAuthSession(apiBase);
        if (sharedSession) {
          setAuthToken(sharedSession.token);
          return;
        }
      } catch (error) {
        console.warn('Unable to check shared auth session before training.', error);
      }

      if (!cancelled) setIsOpen(true);
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [active, apiBase, storageKey]);

  const dismiss = () => {
    window.localStorage.setItem(storageKey, '1');
    setIsOpen(false);
  };

  const handleAuthChange = (user: AuthUser | null) => {
    if (!user) return;
    window.localStorage.setItem(storageKey, '1');
    if (user.profileCompleted) setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="auth-dialog-backdrop">
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="training-login-reminder-title">
        <h2 id="training-login-reminder-title">{labels.title}</h2>
        <p>{labels.intro}</p>
        <AuthPanel
          apiBase={apiBase}
          appName={appName}
          locale={locale}
          privacyHref={privacyHref}
          onAuthChange={handleAuthChange}
        />
        <div className="auth-dialog-actions">
          <button className="auth-button auth-button-secondary" type="button" onClick={dismiss}>
            {labels.continue}
          </button>
        </div>
      </div>
    </div>
  );
}

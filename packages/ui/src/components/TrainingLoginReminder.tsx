import { useCallback, useEffect, useState } from 'react';
import {
  authChangedEvent,
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
}

const text = {
  zhTW: {
    title: '請先登入並完成問卷',
    intro: '開始訓練前必須登入，並完成基本資料與醫療史問卷。資料只用於登入辨識、訓練紀錄同步與服務改善；本平台不提供診斷或個別醫療建議。',
    profilePending: '登入後若尚未完成問卷，系統會立即開啟問卷；完成前無法開始訓練。',
  },
  en: {
    title: 'Sign in and complete the questionnaires',
    intro: 'Training requires sign-in and completion of the basic profile and medical history questionnaires. Data is used only for account identification, training record sync, and service improvement; this platform does not provide diagnosis or individual medical advice.',
    profilePending: 'If your questionnaires are incomplete after sign-in, they will open immediately. Training stays blocked until they are complete.',
  },
} as const;

function ToTextKey(locale: AuthLocale | undefined): keyof typeof text {
  return locale === 'en' ? 'en' : 'zhTW';
}

export function TrainingLoginReminder({
  active,
  apiBase,
  appName,
  locale,
  privacyHref,
}: TrainingLoginReminderProps) {
  const labels = text[ToTextKey(locale)];
  const [isCleared, setIsCleared] = useState(false);

  const checkSession = useCallback(async () => {
    if (!active) {
      setIsCleared(false);
      return;
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

    setIsCleared(Boolean(user?.profileCompleted));
  }, [active, apiBase]);

  useEffect(() => {
    const handleAuthChange = () => void checkSession();

    void checkSession();
    window.addEventListener(authChangedEvent, handleAuthChange);
    return () => {
      window.removeEventListener(authChangedEvent, handleAuthChange);
    };
  }, [checkSession]);

  const handleAuthChange = (user: AuthUser | null) => {
    setIsCleared(Boolean(user?.profileCompleted));
  };

  if (!active || isCleared) return null;

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
        />
      </div>
    </div>
  );
}

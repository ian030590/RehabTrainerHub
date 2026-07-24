import { useEffect, useRef } from 'react';
import { LoadTurnstileScript } from '../turnstileClient';

interface TurnstileWidgetProps {
  action: string;
  language?: 'zh-TW' | 'en';
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
  siteKey?: string;
}

export function TurnstileWidget({
  action,
  language = 'zh-TW',
  onTokenChange,
  resetKey = 0,
  siteKey,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onTokenChange);
  const widgetIdRef = useRef<string | null>(null);

  callbackRef.current = onTokenChange;

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      callbackRef.current(null);
      return;
    }

    let cancelled = false;
    void LoadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only',
          language,
          theme: 'auto',
          callback: (token) => callbackRef.current(token),
          'error-callback': () => callbackRef.current(null),
          'expired-callback': () => callbackRef.current(null),
        });
      })
      .catch((error) => {
        console.warn('Unable to load Cloudflare Turnstile.', error);
        callbackRef.current(null);
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      widgetIdRef.current = null;
      callbackRef.current(null);
    };
  }, [action, language, siteKey]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    callbackRef.current(null);
    window.turnstile.reset(widgetId);
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div
      aria-label={language === 'en' ? 'Human verification' : '真人驗證'}
      className="turnstile-widget"
      ref={containerRef}
    />
  );
}

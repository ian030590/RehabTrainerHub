export interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  appearance: 'always' | 'execute' | 'interaction-only';
  execution?: 'render' | 'execute';
  language: string;
  theme: 'auto';
  callback: (token: string) => void;
  'error-callback': (errorCode?: string) => boolean | void;
  'expired-callback': () => void;
  'timeout-callback'?: () => void;
}

export interface TurnstileApi {
  execute: (widget: string | HTMLElement) => void;
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

export function LoadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-rehab-turnstile]',
    );
    const script = existingScript ?? document.createElement('script');
    const handleLoad = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        script.remove();
        turnstileScriptPromise = null;
        reject(new Error('Turnstile API did not initialize.'));
      }
    };
    const handleError = () => {
      script.remove();
      turnstileScriptPromise = null;
      reject(new Error('Turnstile script failed to load.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existingScript) {
      script.async = true;
      script.defer = true;
      script.dataset.rehabTurnstile = 'true';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}

export async function ExecuteTurnstileChallenge(options: {
  action: string;
  language?: 'zh-TW' | 'en';
  siteKey: string;
  timeoutMs?: number;
}): Promise<string> {
  const turnstile = await LoadTurnstileScript();
  const container = document.createElement('div');
  container.className = 'turnstile-execution-container';
  Object.assign(container.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    zIndex: '2147483647',
    maxWidth: 'calc(100vw - 32px)',
  });
  document.body.appendChild(container);

  return new Promise((resolve, reject) => {
    let settled = false;
    let widgetId = '';
    let timeoutId: number | undefined;
    const finish = (token?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (widgetId) turnstile.remove(widgetId);
      container.remove();
      if (token) resolve(token);
      else reject(error ?? new Error('Turnstile verification failed.'));
    };
    timeoutId = window.setTimeout(
      () => finish(undefined, new Error('Turnstile verification timed out.')),
      options.timeoutMs ?? 2 * 60 * 1000,
    );

    try {
      widgetId = turnstile.render(container, {
        sitekey: options.siteKey,
        action: options.action,
        appearance: 'interaction-only',
        execution: 'execute',
        language: options.language === 'en' ? 'en' : 'zh-TW',
        theme: 'auto',
        callback: (token) => finish(token),
        'error-callback': () => {
          finish(undefined, new Error('Turnstile verification failed.'));
          return true;
        },
        'expired-callback': () => finish(undefined, new Error('Turnstile token expired.')),
        'timeout-callback': () => finish(undefined, new Error('Turnstile interaction timed out.')),
      });
      turnstile.execute(widgetId);
    } catch (error) {
      finish(
        undefined,
        error instanceof Error ? error : new Error('Turnstile verification failed.'),
      );
    }
  });
}

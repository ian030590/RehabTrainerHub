type WebGazerWindow = Window & { webgazer?: unknown };

let loadPromise: Promise<void> | null = null;

export function EnsureWebGazerLoaded(): Promise<void> {
  if ((window as WebGazerWindow).webgazer) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = LoadFirstAvailableScript(GetWebGazerScriptUrls())
    .catch((error) => {
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}

function GetWebGazerScriptUrls(): string[] {
  const urls: string[] = [];
  const assetBaseUrl = NormalizeHttpsUrl(import.meta.env.VITE_AI_ASSET_BASE_URL);
  if (assetBaseUrl) {
    urls.push(`${assetBaseUrl}/ai/webgazer/local-v1/webgazer.js`);
  }
  urls.push(new URL(`${import.meta.env.BASE_URL}webgazer.js`, window.location.origin).href);
  return [...new Set(urls)];
}

async function LoadFirstAvailableScript(urls: readonly string[]): Promise<void> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      await LoadScript(url);
      if ((window as WebGazerWindow).webgazer) return;
      throw new Error(`WebGazer did not initialize after loading ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to load WebGazer.');
}

function LoadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.webgazerRuntime = 'true';
    script.src = url;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error(`Unable to load WebGazer from ${url}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function NormalizeHttpsUrl(value?: string): string {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.href.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

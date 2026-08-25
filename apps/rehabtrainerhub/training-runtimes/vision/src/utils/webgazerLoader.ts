export const webGazerRuntimeVersion = '3.5.3';

type WebGazerWindow = Window & {
  webgazer?: {
    params?: { faceMeshSolutionPath?: string };
    getCurrentPrediction?: (...args: unknown[]) => Promise<unknown>;
    __rehabPredictionTimestampPatched?: boolean;
  };
};

let loadPromise: Promise<void> | null = null;

export function EnsureWebGazerLoaded(): Promise<void> {
  const loadedWebGazer = (window as WebGazerWindow).webgazer;
  if (loadedWebGazer) {
    EnsurePredictionTimestamp(loadedWebGazer);
    return Promise.resolve();
  }
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
    urls.push(`${assetBaseUrl}/ai/webgazer/${webGazerRuntimeVersion}/webgazer.js`);
  }
  urls.push(new URL(`${import.meta.env.BASE_URL}assets/webgazer/${webGazerRuntimeVersion}/webgazer.js`, window.location.origin).href);
  return [...new Set(urls)];
}

async function LoadFirstAvailableScript(urls: readonly string[]): Promise<void> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      await LoadScript(url);
      const webgazer = (window as WebGazerWindow).webgazer;
      if (webgazer) {
        ConfigureWebGazerAssetPath(webgazer, url);
        EnsurePredictionTimestamp(webgazer);
        return;
      }
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
    const timeoutId = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading WebGazer from ${url}`));
    }, 15000);
    script.addEventListener('load', () => {
      window.clearTimeout(timeoutId);
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeoutId);
      script.remove();
      reject(new Error(`Unable to load WebGazer from ${url}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function ConfigureWebGazerAssetPath(webgazer: NonNullable<WebGazerWindow['webgazer']>, scriptUrl: string) {
  if (!webgazer.params) return;
  webgazer.params.faceMeshSolutionPath = new URL('./mediapipe/face_mesh/', scriptUrl).href;
}

/**
 * WebGazer 3.5.x does not include a timestamp on getCurrentPrediction(), while
 * jsPsych's native WebGazer extension and validation plugin use prediction.t
 * to calculate trial-relative timing and sample rate.
 */
function EnsurePredictionTimestamp(webgazer: NonNullable<WebGazerWindow['webgazer']>) {
  if (webgazer.__rehabPredictionTimestampPatched || !webgazer.getCurrentPrediction) return;
  const getCurrentPrediction = webgazer.getCurrentPrediction.bind(webgazer);
  webgazer.getCurrentPrediction = async (...args: unknown[]) => {
    const prediction = await getCurrentPrediction(...args);
    if (!prediction || typeof prediction !== 'object') return prediction;
    const candidate = prediction as Record<string, unknown>;
    return typeof candidate.t === 'number' && Number.isFinite(candidate.t)
      ? prediction
      : { ...candidate, t: performance.now() };
  };
  webgazer.__rehabPredictionTimestampPatched = true;
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

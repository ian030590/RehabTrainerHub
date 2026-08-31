export const webGazerRuntimeVersion = '3.5.3';

type WebGazerWindow = Window & {
  webgazer?: {
    params?: { faceMeshSolutionPath?: string };
    getCurrentPrediction?: (...args: unknown[]) => Promise<unknown>;
    __rehabPredictionTimestampPatched?: boolean;
  };
};

let loadPromise: Promise<void> | null = null;

export function EnsureWebGazerLoaded(signal?: AbortSignal): Promise<void> {
  ThrowIfAborted(signal);
  const loadedWebGazer = (window as WebGazerWindow).webgazer;
  if (loadedWebGazer) {
    EnsurePredictionTimestamp(loadedWebGazer);
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = LoadFirstAvailableScript(GetWebGazerScriptUrls(), signal)
    .catch((error) => {
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}

function GetWebGazerScriptUrls(): string[] {
  const platformAssetUrl = new URL(
    `/runtime-assets/ai/webgazer/${webGazerRuntimeVersion}/webgazer.js`,
    window.location.origin,
  ).href;
  const localAssetUrl = new URL(
    `${import.meta.env.BASE_URL}assets/webgazer/${webGazerRuntimeVersion}/webgazer.js`,
    window.location.origin,
  ).href;
  // Do not accept an arbitrary environment-provided asset base here. A
  // third-party model/CDN origin would bypass the platform's same-origin PWA and CSP
  // guarantees; the platform route is authoritative and the local path is
  // retained only for the compatibility runtime build.
  return [...new Set([platformAssetUrl, localAssetUrl])];
}

async function LoadFirstAvailableScript(urls: readonly string[], signal?: AbortSignal): Promise<void> {
  let lastError: unknown;
  for (const url of urls) {
    ThrowIfAborted(signal);
    try {
      await LoadScript(url, signal);
      const webgazer = (window as WebGazerWindow).webgazer;
      if (webgazer) {
        ConfigureWebGazerAssetPath(webgazer, url);
        EnsurePredictionTimestamp(webgazer);
        return;
      }
      throw new Error(`WebGazer did not initialize after loading ${url}`);
    } catch (error) {
      if (IsAbortError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unable to load WebGazer.');
}

function LoadScript(url: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.webgazerRuntime = 'true';
    script.src = url;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      Fail(new Error(`Timed out loading WebGazer from ${url}`));
    }, 15000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    };
    const Succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const Fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(error);
    };
    const onAbort = () => Fail(CreateAbortError(signal?.reason));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    script.addEventListener('load', Succeed, { once: true });
    script.addEventListener('error', () => {
      Fail(new Error(`Unable to load WebGazer from ${url}`));
    }, { once: true });
    document.head.appendChild(script);
  });
}

function ThrowIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw CreateAbortError(signal.reason);
}

function IsAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function CreateAbortError(reason: unknown): Error {
  const error = new Error(reason ? `WebGazer load aborted: ${String(reason)}` : 'WebGazer load aborted.');
  error.name = 'AbortError';
  return error;
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

export const mediaPipeTasksVisionVersion = '0.10.35';

export interface MediaPipeAssetUrls {
  wasmUrl: string;
  handLandmarkerModelUrl: string;
  poseLandmarkerLiteModelUrl: string;
  faceLandmarkerModelUrl: string;
}

export interface RuntimeAssetCandidateOptions {
  /**
   * Keep the legacy Vite asset as an explicit opt-in for local development.
   * Production callers must use the platform-owned immutable URL only.
   */
  allowLocalFallback?: boolean;
}

const platformAssetBasePath = '/runtime-assets';

export function CreateRuntimeAssetUrlCandidates(
  objectKey: string,
  fallbackUrl: string,
  options?: RuntimeAssetCandidateOptions,
): string[];
/**
 * @deprecated Pass only the object key and same-origin fallback. The legacy
 * asset-base argument is accepted for source compatibility but ignored.
 */
export function CreateRuntimeAssetUrlCandidates(
  _assetBaseUrl: string | undefined,
  objectKey: string,
  fallbackUrl: string,
  options?: RuntimeAssetCandidateOptions,
): string[];
export function CreateRuntimeAssetUrlCandidates(
  objectKeyOrAssetBaseUrl: string | undefined,
  fallbackOrObjectKey: string,
  legacyFallbackOrOptions?: string | RuntimeAssetCandidateOptions,
  options: RuntimeAssetCandidateOptions = {},
): string[] {
  const isNewSignature = typeof legacyFallbackOrOptions === 'object'
    && legacyFallbackOrOptions !== null;
  const objectKey = legacyFallbackOrOptions === undefined || isNewSignature
    ? objectKeyOrAssetBaseUrl
    : fallbackOrObjectKey;
  const fallbackUrl = legacyFallbackOrOptions === undefined || isNewSignature
    ? fallbackOrObjectKey
    : legacyFallbackOrOptions;
  const candidateOptions = isNewSignature ? legacyFallbackOrOptions : options;
  const normalizedObjectKey = String(objectKey || '').trim().replace(/^\/+/, '');
  const normalizedFallbackUrl = String(fallbackUrl || '').trim();
  if (!IsSafeRuntimeAssetKey(normalizedObjectKey) || !normalizedFallbackUrl) return [];
  const platformUrl = `${platformAssetBasePath}/${normalizedObjectKey}`;
  // Runtime assets are deliberately same-origin. An environment-provided
  // absolute URL is not a security boundary: accepting it here would let a
  // deployment silently reintroduce cross-origin model/CDN requests and
  // break the PWA's no-egress contract. Keep a relative fallback only for
  // local, same-origin build output.
  return (candidateOptions.allowLocalFallback ?? IsLocalDevelopmentOrigin())
    && IsSameOriginRelativeUrl(normalizedFallbackUrl)
    ? [platformUrl, normalizedFallbackUrl]
    : [platformUrl];
}

export function CreateMediaPipeAssetUrls(_assetBaseUrl?: string): MediaPipeAssetUrls {
  const baseUrl = platformAssetBasePath;

  return {
    wasmUrl:
      `${baseUrl}/ai/mediapipe/tasks-vision/${mediaPipeTasksVisionVersion}/wasm`,
    handLandmarkerModelUrl:
      `${baseUrl}/ai/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
    poseLandmarkerLiteModelUrl:
      `${baseUrl}/ai/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    faceLandmarkerModelUrl:
      `${baseUrl}/ai/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  };
}

export function CreateMediaPipeAssetUrlCandidates(
  assetBaseUrl?: string,
): MediaPipeAssetUrls[] {
  return [CreateMediaPipeAssetUrls(assetBaseUrl)];
}

export async function LoadMediaPipeWithFallback<T>(
  candidates: readonly MediaPipeAssetUrls[],
  load: (urls: MediaPipeAssetUrls) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (const [index, urls] of candidates.entries()) {
    try {
      return await load(urls);
    } catch (error) {
      lastError = error;
      if (index < candidates.length - 1) {
        console.warn('Unable to load MediaPipe assets from the configured platform source.', error);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to load MediaPipe assets.');
}

function IsSameOriginRelativeUrl(value: string): boolean {
  if (!value
    || value.startsWith('//')
    || value.includes('\\')
    || value.includes('%')
    || /^[a-z][a-z\d+.-]*:/i.test(value)
    || value.split(/[?#]/, 1)[0].split('/').some((segment) => segment === '.' || segment === '..')) {
    return false;
  }
  try {
    const url = new URL(value, 'https://runtime.invalid');
    return url.origin === 'https://runtime.invalid'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function IsSafeRuntimeAssetKey(value: string): boolean {
  return value.length > 0
    && value.length <= 512
    && !value.includes('\\')
    && !value.includes('%')
    && !value.split('/').some((segment) => (
      segment.length === 0 || segment === '.' || segment === '..'
    ))
    && /^[A-Za-z0-9._/-]+$/.test(value);
}

function IsLocalDevelopmentOrigin(): boolean {
  const location = (globalThis as {
    location?: { protocol?: string; hostname?: string };
  }).location;
  if (!location || location.protocol !== 'http:') return false;
  return location.hostname === 'localhost'
    || location.hostname === '127.0.0.1'
    || location.hostname === '[::1]'
    || location.hostname === '::1';
}

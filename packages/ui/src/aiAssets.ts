export const mediaPipeTasksVisionVersion = '0.10.35';

export interface MediaPipeAssetUrls {
  wasmUrl: string;
  handLandmarkerModelUrl: string;
  poseLandmarkerLiteModelUrl: string;
  faceLandmarkerModelUrl: string;
}

const platformAssetBasePath = '/runtime-assets';

export function CreateRuntimeAssetUrlCandidates(
  assetBaseUrl: string | undefined,
  objectKey: string,
  fallbackUrl: string,
): string[] {
  const normalizedBaseUrl = NormalizeAssetBaseUrl(assetBaseUrl);
  const normalizedObjectKey = String(objectKey || '').trim().replace(/^\/+/, '');
  const normalizedFallbackUrl = String(fallbackUrl || '').trim();
  if (!normalizedObjectKey || !normalizedFallbackUrl) return [];
  const platformUrl = `${platformAssetBasePath}/${normalizedObjectKey}`;
  return normalizedBaseUrl
    ? [platformUrl, `${normalizedBaseUrl}/${normalizedObjectKey}`, normalizedFallbackUrl]
    : [platformUrl, normalizedFallbackUrl];
}

export function CreateMediaPipeAssetUrls(assetBaseUrl?: string): MediaPipeAssetUrls {
  const normalizedBaseUrl = NormalizeAssetBaseUrl(assetBaseUrl);
  const baseUrl = normalizedBaseUrl || platformAssetBasePath;

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

function NormalizeAssetBaseUrl(value?: string) {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.href.replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

const CACHE_NAME = 'stroke-trainer-vosk-models-v1';
const CACHE_KEY_PREFIX = '__vosk_model_cache__';
const SOURCE_URL_HEADER = 'X-Stroke-Trainer-Model-Source';
const COMPLETE_HEADER = 'X-Stroke-Trainer-Model-Complete';
const SIZE_HEADER = 'X-Stroke-Trainer-Model-Size';
const DEFAULT_MIN_MODEL_BYTES = 34_603_008;

export type VoskModelLoadStage = 'checking-cache' | 'loading-cache' | 'downloading' | 'saving-cache';

export interface CachedModelUrl {
  url: string;
  revoke: () => void;
}

export interface VoskBackgroundDownloadSnapshot {
  attempt: number;
  stage: VoskModelLoadStage;
  progress: number;
  status: 'downloading' | 'retrying' | 'ready';
  error: string;
}

interface BackgroundDownloadJob {
  listeners: Set<(snapshot: VoskBackgroundDownloadSnapshot) => void>;
  snapshot: VoskBackgroundDownloadSnapshot;
}

const backgroundDownloadJobs = new Map<string, BackgroundDownloadJob>();
const inFlightModelDownloads = new Map<string, Promise<Blob>>();

export async function getCachedModelUrl(
  cacheKey: string,
  sourceUrl: string,
  onProgress: (progress: number) => void,
  onStage?: (stage: VoskModelLoadStage) => void,
  downloadTimeoutMs = 90_000,
  minModelBytes = DEFAULT_MIN_MODEL_BYTES,
  expectedModelBytes = 0,
): Promise<CachedModelUrl> {
  onStage?.('checking-cache');
  onProgress(0);

  const cacheRequest = createCacheRequest(cacheKey);
  const cachedBlob = await readCachedModel(
    cacheRequest,
    sourceUrl,
    minModelBytes,
    expectedModelBytes,
    onStage,
  );
  if (cachedBlob) {
    onProgress(100);
    return createObjectUrl(cachedBlob);
  }

  onStage?.('downloading');
  const downloadKey = `${cacheRequest.url}\n${sourceUrl}`;
  let download = inFlightModelDownloads.get(downloadKey);
  if (!download) {
    download = downloadModelBlob(
      cacheRequest,
      sourceUrl,
      onProgress,
      onStage,
      downloadTimeoutMs,
      minModelBytes,
      expectedModelBytes,
    ).finally(() => {
      inFlightModelDownloads.delete(downloadKey);
    });
    inFlightModelDownloads.set(downloadKey, download);
  }
  const blob = await download;
  onProgress(100);
  return createObjectUrl(blob);
}

async function downloadModelBlob(
  cacheRequest: Request,
  sourceUrl: string,
  onProgress: (progress: number) => void,
  onStage: ((stage: VoskModelLoadStage) => void) | undefined,
  downloadTimeoutMs: number,
  minModelBytes: number,
  expectedModelBytes: number,
): Promise<Blob> {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), downloadTimeoutMs);
  try {
    const response = await fetch(sourceUrl, {
      cache: 'no-store',
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`Unable to download Vosk model (${response.status}).`);
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    if (
      expectedModelBytes > 0
      && totalBytes > 0
      && totalBytes !== expectedModelBytes
    ) {
      throw new Error(
        `Unexpected Vosk model size (${totalBytes}/${expectedModelBytes} bytes).`,
      );
    }
    const blob = response.body
      ? await readResponseBlob(response, totalBytes, onProgress)
      : await response.blob();
    await validateModelBlob(
      blob,
      expectedModelBytes || totalBytes,
      minModelBytes,
      true,
    );

    onProgress(100);
    onStage?.('saving-cache');
    await writeCachedModel(cacheRequest, sourceUrl, blob).catch((error) => {
      console.warn('Unable to cache Vosk model with the Cache API.', error);
    });
    return blob;
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`Vosk model download timed out after ${Math.max(1, Math.round(downloadTimeoutMs / 1000))} seconds.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function startVoskModelBackgroundDownload(
  cacheKey: string,
  sourceUrl: string,
  listener: (snapshot: VoskBackgroundDownloadSnapshot) => void,
  downloadTimeoutMs = 90_000,
  retryDelayMs = 10_000,
  minModelBytes = DEFAULT_MIN_MODEL_BYTES,
  expectedModelBytes = 0,
): () => void {
  const jobKey = `${cacheKey}\n${sourceUrl}`;
  let job = backgroundDownloadJobs.get(jobKey);
  if (!job) {
    job = {
      listeners: new Set(),
      snapshot: {
        attempt: 0,
        stage: 'checking-cache',
        progress: 0,
        status: 'downloading',
        error: '',
      },
    };
    backgroundDownloadJobs.set(jobKey, job);
    void runBackgroundDownload(
      jobKey,
      job,
      cacheKey,
      sourceUrl,
      downloadTimeoutMs,
      retryDelayMs,
      minModelBytes,
      expectedModelBytes,
    );
  }

  job.listeners.add(listener);
  listener(job.snapshot);
  return () => {
    job?.listeners.delete(listener);
  };
}

export async function deleteCachedModel(cacheKey: string): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(createCacheRequest(cacheKey));
  } catch (error) {
    console.warn('Unable to delete cached Vosk model.', error);
  }
}

async function readCachedModel(
  request: Request,
  sourceUrl: string,
  minModelBytes: number,
  expectedModelBytes: number,
  onStage?: (stage: VoskModelLoadStage) => void,
): Promise<Blob | null> {
  if (!('caches' in window)) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(request);
    if (!response) return null;
    const expectedSize = Number(response.headers.get(SIZE_HEADER));
    if (
      !response.ok
      || response.headers.get(SOURCE_URL_HEADER) !== sourceUrl
      || response.headers.get(COMPLETE_HEADER) !== '1'
      || !Number.isSafeInteger(expectedSize)
      || expectedSize < minModelBytes
      || (expectedModelBytes > 0 && expectedSize !== expectedModelBytes)
    ) {
      await cache.delete(request);
      return null;
    }

    onStage?.('loading-cache');
    const blob = await response.blob();
    try {
      await validateModelBlob(
        blob,
        expectedModelBytes || expectedSize,
        minModelBytes,
      );
    } catch (error) {
      console.warn('Cached Vosk model is incomplete; downloading it again.', error);
      await cache.delete(request);
      return null;
    }
    return blob;
  } catch (error) {
    console.warn('Cache API model lookup failed; using network download.', error);
    return null;
  }
}

async function writeCachedModel(request: Request, sourceUrl: string, blob: Blob): Promise<void> {
  if (!('caches' in window)) return;
  const cache = await caches.open(CACHE_NAME);
  const headers = new Headers({
    'Content-Type': blob.type || 'application/gzip',
    [SOURCE_URL_HEADER]: sourceUrl,
    [COMPLETE_HEADER]: '1',
    [SIZE_HEADER]: String(blob.size),
  });
  await cache.put(request, new Response(blob, { status: 200, headers }));
}

async function readResponseBlob(
  response: Response,
  totalBytes: number,
  onProgress: (progress: number) => void,
): Promise<Blob> {
  const reader = response.body?.getReader();
  if (!reader) return response.blob();

  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loadedBytes += value.byteLength;
    if (totalBytes > 0) {
      onProgress(Math.min(99, Math.round((loadedBytes / totalBytes) * 100)));
    }
  }

  return new Blob(chunks as BlobPart[], {
    type: response.headers.get('content-type') || 'application/gzip',
  });
}

async function validateModelBlob(
  blob: Blob,
  expectedSize: number,
  minModelBytes: number,
  verifyGzipStream = false,
): Promise<void> {
  if (blob.size < minModelBytes) {
    throw new Error(`Vosk model is incomplete (${blob.size} bytes).`);
  }
  if (expectedSize > 0 && blob.size !== expectedSize) {
    throw new Error(`Vosk model size mismatch (${blob.size}/${expectedSize} bytes).`);
  }

  const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (signature[0] !== 0x1f || signature[1] !== 0x8b) {
    throw new Error('Vosk model is not a valid gzip archive.');
  }
  if (verifyGzipStream && 'DecompressionStream' in window) {
    try {
      const reader = blob.stream()
        .pipeThrough(new DecompressionStream('gzip'))
        .getReader();
      let decompressedBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        decompressedBytes += value.byteLength;
      }
      if (decompressedBytes === 0) {
        throw new Error('The gzip archive is empty.');
      }
    } catch (error) {
      throw new Error('Vosk model gzip validation failed.', { cause: error });
    }
  }
}

async function runBackgroundDownload(
  jobKey: string,
  job: BackgroundDownloadJob,
  cacheKey: string,
  sourceUrl: string,
  downloadTimeoutMs: number,
  retryDelayMs: number,
  minModelBytes: number,
  expectedModelBytes: number,
): Promise<void> {
  while (true) {
    job.snapshot = {
      attempt: job.snapshot.attempt + 1,
      stage: 'checking-cache',
      progress: 0,
      status: 'downloading',
      error: '',
    };
    notifyBackgroundDownload(job);

    try {
      const cachedUrl = await getCachedModelUrl(
        cacheKey,
        sourceUrl,
        (progress) => {
          job.snapshot = { ...job.snapshot, progress };
          notifyBackgroundDownload(job);
        },
        (stage) => {
          job.snapshot = { ...job.snapshot, stage };
          notifyBackgroundDownload(job);
        },
        downloadTimeoutMs,
        minModelBytes,
        expectedModelBytes,
      );
      cachedUrl.revoke();
      job.snapshot = {
        ...job.snapshot,
        progress: 100,
        status: 'ready',
        error: '',
      };
      notifyBackgroundDownload(job);
      backgroundDownloadJobs.delete(jobKey);
      return;
    } catch (error) {
      job.snapshot = {
        ...job.snapshot,
        status: 'retrying',
        error: error instanceof Error ? error.message : String(error),
      };
      notifyBackgroundDownload(job);
      await delay(retryDelayMs);
    }
  }
}

function notifyBackgroundDownload(job: BackgroundDownloadJob): void {
  job.listeners.forEach((listener) => listener(job.snapshot));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createCacheRequest(cacheKey: string): Request {
  const cacheUrl = new URL(`${CACHE_KEY_PREFIX}/${encodeURIComponent(cacheKey)}`, window.location.href);
  cacheUrl.search = '';
  cacheUrl.hash = '';
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function createObjectUrl(blob: Blob): CachedModelUrl {
  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => URL.revokeObjectURL(url),
  };
}

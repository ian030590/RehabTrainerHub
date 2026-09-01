import { useCallback, useEffect, useState } from 'react';
import { RequestHubTrainingConfiguration } from '../embeddedTraining';

export type MediaPermissionPreflightStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface UseMediaPermissionPreflightOptions {
  active?: boolean;
  audio?: boolean;
  video?: boolean;
}

export interface MediaPermissionPreflightResult {
  error: unknown;
  retry: () => void;
  status: MediaPermissionPreflightStatus;
}

interface CachedPermissionRequest {
  error: unknown;
  promise: Promise<void>;
  status: Exclude<MediaPermissionPreflightStatus, 'idle'>;
}

const permissionRequests = new Map<string, CachedPermissionRequest>();

export function CanRetryMediaPermission(status: MediaPermissionPreflightStatus) {
  return status === 'denied' || status === 'error';
}

export function GetMediaPermissionRetryLabel(language: 'zh' | 'en') {
  return language === 'zh' ? '重新要求權限' : 'Request Permission Again';
}

function GetRequestKey(audio: boolean, video: boolean) {
  return `${audio ? 'audio' : ''}:${video ? 'video' : ''}`;
}

function IsPermissionDenied(error: unknown) {
  return error instanceof DOMException
    && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
}

function RequestMediaPermission(audio: boolean, video: boolean, force: boolean): Promise<void> {
  const key = GetRequestKey(audio, video);
  const cached = permissionRequests.get(key);
  if (cached && !force) return cached.promise;

  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error('Media device access is not supported by this browser.');
    RequestHubTrainingConfiguration();
    const promise = Promise.reject(error);
    promise.catch(() => undefined);
    return promise;
  }

  const entry: CachedPermissionRequest = {
    error: null,
    promise: Promise.resolve(),
    status: 'requesting',
  };

  entry.promise = navigator.mediaDevices.getUserMedia({
    audio,
    video: video ? { facingMode: 'user' } : false,
  }).then((stream) => {
    stream.getTracks().forEach((track) => track.stop());
    entry.status = 'granted';
  }).catch((error: unknown) => {
    entry.error = error;
    entry.status = IsPermissionDenied(error) ? 'denied' : 'error';
    if (permissionRequests.get(key) === entry) permissionRequests.delete(key);
    // This request can finish after a hosted runtime has already advanced from
    // config to rules. Notify the Hub here, before React effect cancellation can
    // discard the result, so a denied device never exposes the retired runtime
    // config screen.
    RequestHubTrainingConfiguration();
    throw error;
  });
  entry.promise.catch(() => undefined);
  permissionRequests.set(key, entry);
  return entry.promise;
}

export function useMediaPermissionPreflight({
  active = true,
  audio = false,
  video = false,
}: UseMediaPermissionPreflightOptions): MediaPermissionPreflightResult {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<MediaPermissionPreflightStatus>('idle');
  const [error, setError] = useState<unknown>(null);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    if (!active || (!audio && !video)) {
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    const force = attempt > 0;
    const key = GetRequestKey(audio, video);
    const cached = permissionRequests.get(key);
    setStatus(cached && !force ? cached.status : 'requesting');
    setError(cached && !force ? cached.error : null);

    void RequestMediaPermission(audio, video, force).then(() => {
      if (cancelled) return;
      setStatus('granted');
      setError(null);
    }).catch((requestError: unknown) => {
      if (cancelled) return;
      setStatus(!navigator.mediaDevices?.getUserMedia
        ? 'unsupported'
        : IsPermissionDenied(requestError)
          ? 'denied'
          : 'error');
      setError(requestError);
    });

    return () => {
      cancelled = true;
    };
  }, [active, attempt, audio, video]);

  return { error, retry, status };
}

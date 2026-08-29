'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  GetOfflinePackManager,
  GetOfflinePackTotalBytes,
  ParseOfflinePackManifest,
  type OfflinePackDescriptor,
  type OfflinePackProgress,
} from '../offlinePackManager';

export interface OfflinePackControlLabels {
  download: string;
  update: string;
  remove: string;
  checking: string;
  installing: string;
  ready: string;
  unavailable: string;
  capacity: string;
  integrity: string;
  progress(completed: number, total: number): string;
  size(bytes: number): string;
  quota(bytes: number): string;
  error: string;
}

export interface OfflinePackControlProps {
  manifestUrl: string;
  expectedPackId?: string;
  expectedModuleId?: string;
  labels: OfflinePackControlLabels;
  className?: string;
  icon?: ReactNode;
}

type ControlState = 'idle' | 'checking' | 'installing' | 'ready' | 'update' | 'error';

interface StorageCapacity {
  required: number;
  available: number | null;
  quota: number | null;
}

/**
 * Explicit user-triggered offline installation for one immutable game pack.
 * The component does not fetch the manifest while a card is merely visible,
 * so browsing the lobby cannot start runtime/model work or background IO.
 */
export function OfflinePackControl({
  manifestUrl,
  expectedPackId,
  expectedModuleId,
  labels,
  className,
  icon,
}: OfflinePackControlProps) {
  const [state, setState] = useState<ControlState>('idle');
  const [pack, setPack] = useState<OfflinePackDescriptor | null>(null);
  const [capacity, setCapacity] = useState<StorageCapacity | null>(null);
  const [progress, setProgress] = useState<OfflinePackProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const operationControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    operationControllerRef.current?.abort();
    operationControllerRef.current = null;
  }, []);

  const readManifest = useCallback(async (signal: AbortSignal): Promise<OfflinePackDescriptor> => {
    const response = await fetch(manifestUrl, {
      cache: 'no-store',
      credentials: 'omit',
      signal,
    });
    if (!response.ok) throw new Error(labels.unavailable);
    const payload: unknown = await response.json();
    return ParseOfflinePackManifest(payload, {
      packId: expectedPackId,
      moduleId: expectedModuleId,
    });
  }, [expectedModuleId, expectedPackId, labels.unavailable, manifestUrl]);

  const readCapacity = useCallback(async (required: number): Promise<StorageCapacity> => {
    const estimate = await navigator.storage?.estimate();
    const quota = Number.isFinite(estimate?.quota) ? Number(estimate?.quota) : null;
    const usage = Number.isFinite(estimate?.usage) ? Number(estimate?.usage) : null;
    const available = quota === null ? null : Math.max(0, quota - (usage ?? 0));
    return { required, available, quota };
  }, []);

  const assertCapacity = useCallback((value: StorageCapacity): void => {
    if (value.available !== null && value.required > value.available) {
      throw new Error(labels.capacity);
    }
  }, [labels.capacity]);

  const loadPack = useCallback(async (signal: AbortSignal): Promise<OfflinePackDescriptor> => {
    const descriptor = await readManifest(signal);
    const nextCapacity = await readCapacity(GetOfflinePackTotalBytes(descriptor));
    if (!mountedRef.current || signal.aborted) throw CreateAbortError();
    setPack(descriptor);
    setCapacity(nextCapacity);
    return descriptor;
  }, [readCapacity, readManifest]);

  const startInstall = useCallback(async () => {
    if (state === 'checking' || state === 'installing') return;
    const isUpdateRequest = state === 'update';
    operationControllerRef.current?.abort();
    const controller = new AbortController();
    operationControllerRef.current = controller;
    setState('checking');
    setProgress(null);
    setErrorMessage(null);
    try {
      const descriptor = await loadPack(controller.signal);
      const manager = GetOfflinePackManager();
      const verification = await manager.verify(descriptor);
      if (verification === 'ready') {
        if (mountedRef.current) setState('ready');
        return;
      }
      if (verification === 'corrupt' && !isUpdateRequest) {
        if (mountedRef.current) setState('update');
        return;
      }
      const currentCapacity = capacity?.required === GetOfflinePackTotalBytes(descriptor)
        ? capacity
        : await readCapacity(GetOfflinePackTotalBytes(descriptor));
      assertCapacity(currentCapacity);
      if (mountedRef.current) setState('installing');
      await manager.install(descriptor, {
        signal: controller.signal,
        onProgress: (nextProgress) => {
          if (mountedRef.current) setProgress(nextProgress);
        },
      });
      if (mountedRef.current) {
        setProgress({
          completed: descriptor.resources.length,
          total: descriptor.resources.length,
          url: descriptor.resources.at(-1)?.url ?? '',
        });
        setState('ready');
      }
    } catch (error) {
      if (controller.signal.aborted || IsAbortError(error)) return;
      if (mountedRef.current) {
        setState('error');
        setErrorMessage(error instanceof Error ? error.message : labels.error);
      }
    } finally {
      if (operationControllerRef.current === controller) operationControllerRef.current = null;
    }
  }, [assertCapacity, capacity, labels.error, loadPack, readCapacity, state]);

  const removePack = useCallback(async () => {
    if (!pack || state === 'installing' || state === 'checking') return;
    const controller = new AbortController();
    operationControllerRef.current?.abort();
    operationControllerRef.current = controller;
    setState('checking');
    setErrorMessage(null);
    try {
      await GetOfflinePackManager().remove({ id: pack.id, version: pack.version });
      if (mountedRef.current) {
        setProgress(null);
        setState('idle');
      }
    } catch (error) {
      if (controller.signal.aborted || IsAbortError(error)) return;
      if (mountedRef.current) {
        setState('error');
        setErrorMessage(error instanceof Error ? error.message : labels.error);
      }
    } finally {
      if (operationControllerRef.current === controller) operationControllerRef.current = null;
    }
  }, [labels.error, pack, state]);

  const buttonLabel = state === 'idle' || state === 'error'
    ? labels.download
    : state === 'checking'
      ? labels.checking
      : state === 'installing'
        ? labels.installing
        : state === 'ready'
          ? labels.ready
          : labels.update;
  const totalBytes = capacity?.required ?? (pack ? GetOfflinePackTotalBytes(pack) : null);
  const isBusy = state === 'checking' || state === 'installing';
  const rootClassName = ['offline-pack-control', className].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} data-offline-state={state}>
      <button
        aria-busy={isBusy || undefined}
        className="offline-pack-control-button"
        disabled={isBusy}
        onClick={() => void startInstall()}
        type="button"
      >
        {icon}
        <span>{buttonLabel}</span>
      </button>
      {state === 'ready' && (
        <button
          className="offline-pack-control-remove"
          onClick={() => void removePack()}
          type="button"
        >
          {labels.remove}
        </button>
      )}
      {totalBytes !== null && (
        <small className="offline-pack-control-meta">
          {labels.size(totalBytes)}
          {capacity?.quota !== null && capacity?.quota !== undefined
            ? ` · ${labels.quota(capacity.quota)}`
            : ''}
        </small>
      )}
      {progress && state === 'installing' && (
        <progress
          aria-label={labels.progress(progress.completed, progress.total)}
          className="offline-pack-control-progress"
          max={progress.total}
          value={progress.completed}
        />
      )}
      {state === 'error' && errorMessage && (
        <small className="offline-pack-control-error" role="alert">
          {errorMessage}
        </small>
      )}
      {state === 'update' && (
        <small className="offline-pack-control-meta">{labels.integrity}</small>
      )}
    </div>
  );
}

function CreateAbortError(): Error {
  const error = new Error('Offline pack operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function IsAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

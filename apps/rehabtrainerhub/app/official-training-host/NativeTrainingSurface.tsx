'use client';

import {
  createElement,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  PreparedTrainingEngine,
  TrainingSetupLoader,
  TrainingSetupModule,
} from '@rehab-trainer/ui/trainingHostContract';
import {
  CreateTrainingRunResult,
  type TrainingModuleManifest,
  type TrainingRunHandle,
  type TrainingRunResult,
} from '@rehab-trainer/training-contracts';

export interface NativeTrainingSurfaceHandle {
  prepare(config: unknown): Promise<void>;
  start(commandId: string): Promise<void>;
  pause(commandId: string): Promise<void>;
  resume(commandId: string): Promise<void>;
  abort(reason: 'back' | 'exit' | 'unmount'): Promise<TrainingRunResult>;
  dispose(reason: 'back' | 'exit' | 'complete' | 'error'): Promise<void>;
}

interface NativeTrainingSurfaceProps {
  loader: TrainingSetupLoader;
  manifest: TrainingModuleManifest;
  sessionNonce: string;
  language: 'zh' | 'en';
  onStarted(commandId: string): void;
  onPaused(commandId: string): void;
  onResumed(commandId: string): void;
  onCompleted(result: TrainingRunResult): void;
  onAborted(result: TrainingRunResult): void;
  onExit(): void;
  onProgress(progress: number): void;
  onError(error: unknown): void;
}

type SetupModule = TrainingSetupModule<Record<string, unknown>>;

const surfaceCopy = {
  zh: {
    preparing: '正在準備活動…',
    continueToRules: '繼續查看玩法',
    loading: '正在載入活動…',
    start: '開始',
    running: '活動進行中。',
    complete: '活動完成。',
    returnToLobby: '返回訓練大廳',
  },
  en: {
    preparing: 'Preparing this activity…',
    continueToRules: 'Continue to rules',
    loading: 'Loading activity…',
    start: 'Start',
    running: 'Activity in progress.',
    complete: 'Activity complete.',
    returnToLobby: 'Return to training lobby',
  },
} as const;

/**
 * Thin host-side adapter for a module-owned setup/engine pair. It owns no
 * renderer state: only the setup module, an AbortController for the current
 * run, and the disposable engine handle are retained. Heavy dependencies are
 * reached exclusively through `loadEngine` after the rules become visible.
 */
export const NativeTrainingSurface = forwardRef<
  NativeTrainingSurfaceHandle,
  NativeTrainingSurfaceProps
>(function NativeTrainingSurface({
  loader,
  manifest,
  sessionNonce,
  language,
  onStarted,
  onPaused,
  onResumed,
  onCompleted,
  onAborted,
  onExit,
  onProgress,
  onError,
}, ref) {
  const [setupModule, setSetupModule] = useState<SetupModule | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [phase, setPhase] = useState<'idle' | 'config' | 'rules' | 'loading' | 'running' | 'results'>('idle');
  const setupRef = useRef<SetupModule | null>(null);
  const configRef = useRef<Record<string, unknown>>({});
  const engineRef = useRef<PreparedTrainingEngine<Record<string, unknown>> | null>(null);
  const enginePromiseRef = useRef<Promise<PreparedTrainingEngine<Record<string, unknown>>> | null>(null);
  const engineLoadAbortRef = useRef<AbortController | null>(null);
  const engineLoadGenerationRef = useRef(0);
  const runRef = useRef<TrainingRunHandle | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  const runGenerationRef = useRef(0);
  const disposeGenerationRef = useRef(0);
  const mountRef = useRef<HTMLDivElement>(null);
  const prepareGenerationRef = useRef(0);

  const setValidatedConfig = (value: Record<string, unknown>) => {
    configRef.current = value;
    setConfig(value);
  };

  const disposeResources = async (reason: 'back' | 'exit' | 'complete' | 'error') => {
    const disposeGeneration = ++disposeGenerationRef.current;
    // Invalidate every pending continuation before aborting it. Some module
    // loaders resolve after AbortController.abort(), so an identity check is
    // still required in their fulfilment handlers.
    engineLoadGenerationRef.current += 1;
    runGenerationRef.current += 1;
    runAbortRef.current?.abort(reason);
    const run = runRef.current;
    runRef.current = null;
    const engine = engineRef.current;
    engineRef.current = null;
    engineLoadGenerationRef.current += 1;
    engineLoadAbortRef.current?.abort(reason);
    engineLoadAbortRef.current = null;
    enginePromiseRef.current = null;
    let cleanupError: unknown = null;
    try {
      if (run) await run.dispose();
    } catch (error) {
      cleanupError = error;
    }
    try {
      if (engine) await engine.dispose(reason);
    } catch (error) {
      cleanupError ??= error;
    }
    // A newer prepare/dispose may finish while an older engine's async
    // dispose is still pending. Do not let that stale continuation clear the
    // newer setup or mount.
    if (disposeGeneration !== disposeGenerationRef.current) return;
    mountRef.current?.replaceChildren();
    setupRef.current = null;
    setSetupModule(null);
    setPhase('idle');
    if (cleanupError) throw cleanupError;
  };

  const prepare = async (input: unknown) => {
    // A reconnect or a repeated prepare must not retain the previous module's
    // renderer, jsPsych instance, or abort controller.
    const generation = ++prepareGenerationRef.current;
    await disposeResources('back');
    if (generation !== prepareGenerationRef.current) return;
    const setup = await loader() as SetupModule;
    if (generation !== prepareGenerationRef.current) return;
    // Keep host locale out of module-owned configuration. A module may use a
    // field named `language` for its own content (for example, story locale),
    // while the host locale is passed separately as run context.
    const preparedInput = input && typeof input === 'object'
      ? input
      : {};
    const validation = setup.validateConfig(preparedInput);
    const nextConfig = validation.ok
      ? validation.value
      : setup.defaultConfig;
    setupRef.current = setup;
    setSetupModule(setup);
    setValidatedConfig(nextConfig);
    setPhase('config');
  };

  const ensureEngine = async (): Promise<PreparedTrainingEngine<Record<string, unknown>>> => {
    const setup = setupRef.current;
    if (!setup) throw new Error('Training setup has not been prepared.');
    if (engineRef.current) return engineRef.current;
    if (!enginePromiseRef.current) {
      setPhase('loading');
      const signalController = new AbortController();
      const generation = ++engineLoadGenerationRef.current;
      engineLoadAbortRef.current = signalController;
      const loadPromise = setup.loadEngine({
        trigger: 'rules-visible',
        signal: signalController.signal,
        assets: {
          resolve: ({ id, version }) => {
            const asset = manifest.assets.find((candidate) => (
              candidate.id === id && candidate.version === version
            ));
            return asset?.path ?? '';
          },
        },
        reportProgress: onProgress,
      }).then((engine) => {
        if (signalController.signal.aborted
          || generation !== engineLoadGenerationRef.current
          || engineLoadAbortRef.current !== signalController) {
          // A late loader result must be disposed even though the host has
          // already moved to another module/session.
          void engine.dispose('back');
          const error = new Error('Training engine preload was superseded.');
          error.name = 'AbortError';
          throw error;
        }
        engineLoadAbortRef.current = null;
        engineRef.current = engine;
        return engine;
      }).catch((error) => {
        if (generation === engineLoadGenerationRef.current) {
          engineLoadAbortRef.current = null;
          enginePromiseRef.current = null;
          setPhase('rules');
        }
        throw error;
      });
      enginePromiseRef.current = loadPromise;
    }
    return enginePromiseRef.current;
  };

  const start = async (commandId: string) => {
    // Allocate the run generation and abort signal before waiting for the
    // engine. An abort can arrive while the rules-visible preload or timeline
    // builder is still pending; the late handle must then be discarded rather
    // than attached to a newer session.
    const generation = ++runGenerationRef.current;
    const runAbortController = new AbortController();
    runAbortRef.current = runAbortController;
    let attached = false;
    try {
      const engine = await ensureEngine();
      if (generation !== runGenerationRef.current || runAbortController.signal.aborted) {
        throw CreateAbortError('Training run start was superseded.');
      }
      if (!mountRef.current) throw new Error('Training mount element is unavailable.');
      const run = await engine.startRun({
        config: configRef.current,
        mountElement: mountRef.current,
        signal: runAbortController.signal,
        sessionNonce,
        language,
      });
      if (generation !== runGenerationRef.current || engineRef.current !== engine) {
        // A dispose/prepare can race a late startRun() resolution. Dispose
        // that orphaned handle immediately instead of attaching it to the
        // next session's UI.
        await run.dispose();
        const error = new Error('Training run was superseded.');
        error.name = 'AbortError';
        throw error;
      }
      runRef.current = run;
      attached = true;
      setPhase('running');
      onStarted(commandId);
      void run.result.then((result) => {
        if (generation !== runGenerationRef.current || runRef.current !== run) return;
        runRef.current = null;
        runAbortRef.current = null;
        setPhase('results');
        if (result.status === 'completed') onCompleted(result);
        else onAborted(result);
      }).catch(onError);
    } catch (error) {
      if (!IsAbortError(error)) onError(error);
      throw error;
    } finally {
      if (!attached && runAbortRef.current === runAbortController) {
        runAbortRef.current = null;
      }
    }
  };

  const pause = async (commandId: string) => {
    if (!runRef.current) throw new Error('Training run is not active.');
    await runRef.current.pause();
    onPaused(commandId);
  };

  const resume = async (commandId: string) => {
    if (!runRef.current) throw new Error('Training run is not active.');
    await runRef.current.resume();
    onResumed(commandId);
  };

  const abort = async (reason: 'back' | 'exit' | 'unmount') => {
    const generation = ++runGenerationRef.current;
    const run = runRef.current;
    const runAbortController = runAbortRef.current;
    runAbortController?.abort(reason);
    // A rules-visible preload may still be resolving when the user leaves.
    // Cancelling it avoids downloading an engine for a run that no longer
    // exists; the generation check above also handles loaders that ignore
    // AbortController cancellation.
    // Invalidate the loader generation and promise as well as aborting the
    // controller. Some dynamic imports resolve after abort(), and must be
    // disposed rather than installed into this host after the run is gone.
    engineLoadGenerationRef.current += 1;
    engineLoadAbortRef.current?.abort(reason);
    engineLoadAbortRef.current = null;
    enginePromiseRef.current = null;
    if (run) {
      await run.abort(reason);
      const result = await run.result;
      if (runRef.current === run && generation === runGenerationRef.current) {
        runRef.current = null;
        if (runAbortRef.current === runAbortController) runAbortRef.current = null;
        setPhase('results');
      }
      return result;
    }
    if (generation === runGenerationRef.current) setPhase('results');
    return CreateEmptyResult(manifest, 'aborted');
  };

  const dispose = async (reason: 'back' | 'exit' | 'complete' | 'error') => {
    prepareGenerationRef.current += 1;
    await disposeResources(reason);
  };

  useImperativeHandle(ref, () => ({ prepare, start, pause, resume, abort, dispose }));

  const renderSetup = (): ReactNode => {
    const labels = surfaceCopy[language];
    if (!setupModule) return <p role="status">{labels.preparing}</p>;
    if (phase === 'config' || phase === 'idle') {
      const configPanel = setupModule.ConfigPanel;
      return (
        <>
          {createElement(configPanel, {
            language,
            value: config,
            onChange: (nextValue) => setValidatedConfig(nextValue),
            onValidityChange: () => undefined,
          })}
          <button type="button" onClick={() => {
            setPhase('rules');
            void ensureEngine().catch((error) => {
              if (!IsAbortError(error)) onError(error);
            });
          }}>
            {labels.continueToRules}
          </button>
        </>
      );
    }
    if (phase === 'rules' || phase === 'loading') {
      const rulesPanel = setupModule.RulesPanel;
      return (
        <>
          {createElement(rulesPanel, { language })}
          <button
            disabled={phase === 'loading'}
            onClick={() => { void start(`${manifest.id}:native-start`).catch(() => undefined); }}
            type="button"
          >
            {phase === 'loading' ? labels.loading : labels.start}
          </button>
        </>
      );
    }
    if (phase === 'running') return <p role="status">{labels.running}</p>;
    return (
      <section aria-live="polite">
        <p role="status">{labels.complete}</p>
        <button type="button" onClick={() => {
          void dispose('complete').then(onExit).catch(onError);
        }}>
          {labels.returnToLobby}
        </button>
      </section>
    );
  };

  return (
    <main className="native-training-surface" data-module-id={manifest.id}>
      <section className="native-training-setup">{renderSetup()}</section>
      <div
        aria-hidden={phase !== 'running' || undefined}
        className="native-training-mount"
        ref={mountRef}
      />
    </main>
  );
});

function CreateEmptyResult(
  manifest: TrainingModuleManifest,
  status: TrainingRunResult['status'],
): TrainingRunResult {
  return CreateTrainingRunResult({
    moduleId: manifest.id,
    moduleVersion: manifest.implementationVersion,
    status,
    startedAt: new Date().toISOString(),
    durationMs: 0,
    trialCount: 0,
    metrics: {},
  });
}

function IsAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function CreateAbortError(message: string): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

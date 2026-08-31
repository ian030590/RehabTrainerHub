import { createElement, type ComponentType } from 'react';
import type {
  EnginePreloadContext,
  PreparedTrainingEngine,
  TrainingConfigProps,
  TrainingRulesProps,
  TrainingRunContext,
  TrainingSetupModule,
} from '@rehab-trainer/ui/trainingHostContract';
import type { TrainingModuleManifest, TrainingRunHandle, TrainingRunResult } from '@rehab-trainer/training-contracts';

export interface ComponentRunControls {
  pause(): void | Promise<void>;
  resume(): void | Promise<void>;
}

export interface ComponentTrainingControlSet<TResult> {
  signal: AbortSignal;
  onStarted(): void;
  onCompleted(result: TResult): void;
  onAborted(): void;
  registerControls(controls: ComponentRunControls | null): void;
}

export interface ComponentTrainingSetupOptions<
  TConfig extends Record<string, unknown>,
  TResult,
  TComponentProps extends object = Record<string, unknown>,
> {
  manifest: TrainingModuleManifest;
  defaultConfig: Readonly<TConfig>;
  validateConfig: TrainingSetupModule<TConfig>['validateConfig'];
  ConfigPanel: ComponentType<TrainingConfigProps<TConfig>>;
  RulesPanel: ComponentType<TrainingRulesProps>;
  loadComponent(): Promise<ComponentType<TComponentProps>>;
  buildComponentProps(input: {
    config: Readonly<TConfig>;
    context: TrainingRunContext<TConfig>;
    controls: ComponentTrainingControlSet<TResult>;
  }): TComponentProps;
  summarize(input: {
    status: TrainingRunResult['status'];
    startedAt: number;
    endedAt: number;
    result: TResult | null;
  }): TrainingRunResult;
}

/**
 * Build a setup/engine pair around a module-owned React training surface.
 *
 * The setup remains dependency-light: the component (and therefore Pixi,
 * MediaPipe, TensorFlow, jsPsych, or camera code) is loaded only after the
 * rules transition. The engine retains only a React root and lifecycle
 * callbacks; renderer and experiment state stay inside the component.
 */
export function CreateComponentTrainingSetup<
  TConfig extends Record<string, unknown>,
  TResult,
  TComponentProps extends object = Record<string, unknown>,
>(options: ComponentTrainingSetupOptions<TConfig, TResult, TComponentProps>): TrainingSetupModule<TConfig> {
  return Object.freeze({
    manifest: options.manifest,
    defaultConfig: options.defaultConfig,
    validateConfig: options.validateConfig,
    ConfigPanel: options.ConfigPanel,
    RulesPanel: options.RulesPanel,
    async loadEngine(context: EnginePreloadContext): Promise<PreparedTrainingEngine<TConfig>> {
      if (context.trigger !== 'rules-visible') {
        throw new Error(`The ${options.manifest.id} engine may only load when rules are visible.`);
      }
      ThrowIfAborted(context.signal);
      context.reportProgress(0);
      const [componentModule, reactDom, reactDomClient] = await Promise.all([
        options.loadComponent(),
        import('react-dom'),
        import('react-dom/client'),
      ]);
      ThrowIfAborted(context.signal);
      context.reportProgress(1);
      return CreateComponentTrainingEngine({
        options,
        Component: componentModule,
        createRoot: reactDomClient.createRoot,
        flushSync: reactDom.flushSync,
      });
    },
  });
}

function CreateComponentTrainingEngine<
  TConfig extends Record<string, unknown>,
  TResult,
  TComponentProps extends object,
>({
  options,
  Component,
  createRoot,
  flushSync,
}: {
  options: ComponentTrainingSetupOptions<TConfig, TResult, TComponentProps>;
  Component: ComponentType<TComponentProps>;
  createRoot: (container: Element | DocumentFragment) => {
    render(children: unknown): void;
    unmount(): void;
  };
  flushSync(callback: () => void): void;
}): PreparedTrainingEngine<TConfig> {
  let activeRun: {
    handle: TrainingRunHandle;
    unmount(): void;
  } | null = null;
  let disposed = false;

  const startRun = async (context: TrainingRunContext<TConfig>): Promise<TrainingRunHandle> => {
    if (disposed) throw new Error(`Training engine ${options.manifest.id} has been disposed.`);
    if (activeRun) throw new Error(`Training engine ${options.manifest.id} already has an active run.`);
    ThrowIfAborted(context.signal);

    const startedAt = Date.now();
    let endedAt = startedAt;
    let completedResult: TResult | null = null;
    let settled = false;
    let root: ReturnType<typeof createRoot> | null = null;
    let resolveResult!: (result: TrainingRunResult) => void;
    const result = new Promise<TrainingRunResult>((resolve) => {
      resolveResult = resolve;
    });
    const settle = (status: TrainingRunResult['status']) => {
      if (settled) return;
      settled = true;
      endedAt = Date.now();
      resolveResult(options.summarize({
        status,
        startedAt,
        endedAt,
        result: completedResult,
      }));
    };
    const unmount = () => {
      if (!root) return;
      root.unmount();
      root = null;
    };
    const controlsRef: { current: ComponentRunControls | null } = { current: null };
    const controls: ComponentTrainingControlSet<TResult> = {
      signal: context.signal,
      onStarted: () => undefined,
      onCompleted: (value) => {
        completedResult = value;
        settle('completed');
      },
      onAborted: () => settle('aborted'),
      registerControls: (nextControls) => {
        controlsRef.current = nextControls;
      },
    };
    const abort = () => {
      unmount();
      settle('aborted');
    };
    const abortListener = () => abort();
    context.signal.addEventListener('abort', abortListener, { once: true });

    try {
      root = createRoot(context.mountElement);
      // The host switches its own surface to `running` immediately after this
      // method resolves. Commit this nested module root first, otherwise that
      // host update can reconcile the empty mount element before the component
      // root gets a chance to attach its renderer.
      flushSync(() => {
        root?.render(createElement(Component, options.buildComponentProps({
          config: context.config,
          context,
          controls,
        })));
      });
    } catch (error) {
      context.signal.removeEventListener('abort', abortListener);
      unmount();
      settle('aborted');
      throw error;
    }

    const handle: TrainingRunHandle = {
      result,
      pause: async () => {
        if (!controlsRef.current) throw new Error('Training surface is not ready to pause.');
        await controlsRef.current.pause();
      },
      resume: async () => {
        if (!controlsRef.current) throw new Error('Training surface is not ready to resume.');
        await controlsRef.current.resume();
      },
      abort: async () => abort(),
      dispose: async () => abort(),
    };
    activeRun = { handle, unmount };
    void result.finally(() => {
      context.signal.removeEventListener('abort', abortListener);
      unmount();
      if (activeRun?.handle === handle) activeRun = null;
    });
    return handle;
  };

  return {
    startRun,
    async dispose() {
      if (disposed) return;
      disposed = true;
      const run = activeRun;
      activeRun = null;
      await run?.handle.abort('error');
      run?.unmount();
    },
  };
}

function ThrowIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('Training component preload was aborted.');
  error.name = 'AbortError';
  throw error;
}

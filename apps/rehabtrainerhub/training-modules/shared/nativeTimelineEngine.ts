import type {
  PreparedTrainingEngine,
  TrainingRunContext,
} from '@rehab-trainer/ui/trainingHostContract';
import {
  CreateTrainingRunResult,
  type TrainingRunHandle,
  type TrainingRunResult,
} from '@rehab-trainer/training-contracts';

/**
 * The smallest jsPsych surface required by a native timeline owner.
 *
 * Keeping this interface renderer-independent is intentional: setup modules
 * can share lifecycle mechanics without sharing Pixi, Three, camera, or
 * model state between training experiences.
 */
export interface NativeJsPsychLike {
  run(timeline: unknown[]): unknown;
  pauseExperiment(): void;
  resumeExperiment(): void;
  abortExperiment(message?: string, data?: Record<string, unknown>): void;
  data: { get(): { values(): unknown[] } };
}

export interface NativeTimelineEngineOptions<TConfig> {
  moduleId: string;
  moduleVersion: string;
  initJsPsych(options: Record<string, unknown>): NativeJsPsychLike;
  buildTimeline(input: {
    config: Readonly<TConfig>;
    jsPsych: NativeJsPsychLike;
    context: TrainingRunContext<TConfig>;
  }): unknown[] | Promise<unknown[]>;
  summarize(input: {
    status: TrainingRunResult['status'];
    startedAt: number;
    endedAt: number;
    values: readonly unknown[];
  }): TrainingRunResult;
  onDispose?(): void | Promise<void>;
}

interface ActiveRun {
  handle: TrainingRunHandle;
  jsPsych: NativeJsPsychLike;
  mountElement: HTMLElement;
}

/**
 * Renderer-independent lifecycle wrapper for a module-owned jsPsych timeline.
 * It owns only the active jsPsych instance and the disposable run handle;
 * renderer and input state remain inside the module's timeline/plugin graph.
 */
export function CreateNativeTimelineEngine<TConfig>(
  options: NativeTimelineEngineOptions<TConfig>,
): PreparedTrainingEngine<TConfig> {
  let activeRun: ActiveRun | null = null;
  let startingRun: Promise<TrainingRunHandle> | null = null;
  let retainedMountElement: HTMLElement | null = null;
  let disposed = false;

  const startRun = async (context: TrainingRunContext<TConfig>): Promise<TrainingRunHandle> => {
    if (disposed) throw new Error(`Training engine ${options.moduleId} has been disposed.`);
    if (activeRun || startingRun) throw new Error(`Training engine ${options.moduleId} already has an active run.`);
    const pending = StartRun(context);
    startingRun = pending;
    try {
      return await pending;
    } finally {
      if (startingRun === pending) startingRun = null;
    }
  };

  async function StartRun(context: TrainingRunContext<TConfig>): Promise<TrainingRunHandle> {
    if (disposed) throw new Error(`Training engine ${options.moduleId} has been disposed.`);
    ThrowIfAborted(context.signal);

    const startedAt = Date.now();
    let jsPsych: NativeJsPsychLike;
    let requestedStatus: TrainingRunResult['status'] = 'completed';
    let settled = false;
    let resolveResult!: (result: TrainingRunResult) => void;
    const result = new Promise<TrainingRunResult>((resolve) => {
      resolveResult = resolve;
    });
    const settle = (status: TrainingRunResult['status']) => {
      if (settled) return;
      settled = true;
      const endedAt = Date.now();
      const values = jsPsych?.data.get().values() ?? [];
      resolveResult(options.summarize({ status, startedAt, endedAt, values }));
    };

    jsPsych = options.initJsPsych({
      display_element: context.mountElement,
      on_finish: () => settle(requestedStatus),
    });
    let timeline: unknown[];
    try {
      timeline = await options.buildTimeline({
        config: context.config,
        jsPsych,
        context,
      });
      if (disposed) {
        requestedStatus = 'aborted';
        jsPsych.abortExperiment('Training engine was disposed while preparing the run.');
        settle('aborted');
        context.mountElement.replaceChildren();
        throw new Error(`Training engine ${options.moduleId} has been disposed.`);
      }
      ThrowIfAborted(context.signal);
    } catch (error) {
      requestedStatus = 'aborted';
      jsPsych.abortExperiment('Training timeline setup failed.');
      settle('aborted');
      context.mountElement.replaceChildren();
      throw error;
    }

    const abortRun = () => {
      requestedStatus = 'aborted';
      try {
        jsPsych.abortExperiment('Training run aborted.');
      } finally {
        // Some jsPsych plugins finish asynchronously after abort; settling
        // here makes the run handle deterministic even if a plugin never
        // reaches its normal on_finish callback.
        settle('aborted');
      }
    };
    const abortListener = () => abortRun();
    ThrowIfAborted(context.signal);
    context.signal.addEventListener('abort', abortListener, { once: true });
    // Abort can be delivered between the pre-listener check and the listener
    // registration. Re-check after registration so a run can never start
    // without an abort handler attached.
    if (context.signal.aborted) {
      abortRun();
      context.signal.removeEventListener('abort', abortListener);
      context.mountElement.replaceChildren();
      throw CreateAbortError();
    }
    const handle: TrainingRunHandle = {
      result,
      pause: async () => { jsPsych.pauseExperiment(); },
      resume: async () => { jsPsych.resumeExperiment(); },
      abort: async () => { abortRun(); },
      dispose: async () => { abortRun(); },
    };
    retainedMountElement = context.mountElement;
    activeRun = { handle, jsPsych, mountElement: context.mountElement };
    try {
      jsPsych.run(timeline);
    } catch (error) {
      context.signal.removeEventListener('abort', abortListener);
      requestedStatus = 'aborted';
      settle('aborted');
      activeRun = null;
      context.mountElement.replaceChildren();
      throw error;
    }
    void result.finally(() => {
      context.signal.removeEventListener('abort', abortListener);
      if (activeRun?.handle === handle) activeRun = null;
    });
    return handle;
  };

  return {
    startRun,
    async dispose() {
      if (disposed) return;
      disposed = true;
      const current = activeRun;
      activeRun = null;
      let cleanupError: unknown = null;
      try {
        if (current) await current.handle.dispose();
      } catch (error) {
        cleanupError = error;
      }
      try {
        await options.onDispose?.();
      } catch (error) {
        cleanupError ??= error;
      } finally {
        retainedMountElement?.replaceChildren();
        retainedMountElement = null;
      }
      if (cleanupError) throw cleanupError;
    },
  };
}

export function CreateDefaultNativeTimelineResult(input: {
  moduleId: string;
  moduleVersion: string;
  status: TrainingRunResult['status'];
  startedAt: number;
  endedAt: number;
  values: readonly unknown[];
}): TrainingRunResult {
  return CreateTrainingRunResult({
    moduleId: input.moduleId as `${'motor' | 'vision' | 'brain' | 'mouth'}:${string}`,
    moduleVersion: input.moduleVersion,
    status: input.status,
    startedAt: new Date(input.startedAt).toISOString(),
    durationMs: Math.max(0, Math.round(input.endedAt - input.startedAt)),
    trialCount: input.values.length,
    metrics: {},
  });
}

export function ThrowIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw CreateAbortError();
}

function CreateAbortError(): Error {
  const error = new Error('Training engine preload was aborted.');
  error.name = 'AbortError';
  return error;
}

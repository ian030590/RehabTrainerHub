import {
  ParameterType,
  type JsPsych,
  type JsPsychPlugin,
  type TrialType,
} from 'jspsych';

const externalRuntimeTrialInfo = {
  name: 'trainerhub-external-runtime',
  version: '1.0.0',
  parameters: {
    module_id: {
      type: ParameterType.STRING,
      default: undefined,
    },
    run_token: {
      type: ParameterType.STRING,
      default: undefined,
    },
    on_runtime_start: {
      type: ParameterType.FUNCTION,
      default: undefined,
    },
  },
  data: {
    lifecycle_status: {
      type: ParameterType.STRING,
    },
    module_id: {
      type: ParameterType.STRING,
    },
    run_token: {
      type: ParameterType.STRING,
    },
  },
} as const;

type ExternalRuntimeTrialInfo = typeof externalRuntimeTrialInfo;
type ExternalRuntimeTrial = TrialType<ExternalRuntimeTrialInfo>;

/**
 * A renderer-independent jsPsych trial for React-owned games.
 *
 * The plugin deliberately owns no canvas, renderer, input, media stream, or
 * game state. A trainer starts its own runtime from `on_runtime_start`, then
 * explicitly completes or aborts this trial through `JsPsychExternalLifecycle`.
 */
export class TrainerHubExternalRuntimePlugin
implements JsPsychPlugin<ExternalRuntimeTrialInfo> {
  static info = externalRuntimeTrialInfo;

  constructor(private readonly jsPsych: JsPsych) {}

  trial(displayElement: HTMLElement, trial: ExternalRuntimeTrial): void {
    displayElement.replaceChildren();

    try {
      const startResult = trial.on_runtime_start();
      if (startResult instanceof Promise) {
        void startResult.catch(() => {
          this.finishStartError(trial);
        });
      }
    } catch {
      this.finishStartError(trial);
    }
  }

  private finishStartError(trial: ExternalRuntimeTrial): void {
    const currentTrial = this.jsPsych.getCurrentTrial();
    if (
      currentTrial?.type !== TrainerHubExternalRuntimePlugin
      || currentTrial.run_token !== trial.run_token
    ) {
      return;
    }

    this.jsPsych.finishTrial({
      lifecycle_status: 'start-error',
      module_id: trial.module_id,
      run_token: trial.run_token,
    });
  }
}

export type JsPsychExternalLifecycleData = Record<string, unknown>;

export interface JsPsychExternalLifecycleStartOptions {
  moduleId: string;
  onStart: () => void | Promise<void>;
  onFinish?: (data: JsPsychExternalLifecycleData) => void | Promise<void>;
}

/**
 * Coordinates one externally rendered training trial at a time.
 *
 * Each training component owns this adapter and its jsPsych instance. The
 * adapter only serializes jsPsych runs and never retains renderer state.
 */
export class JsPsychExternalLifecycle {
  private active = false;
  private disposed = false;
  private runPromise: Promise<void> | null = null;
  private queuedEnd: JsPsychExternalLifecycleData | null = null;
  private runSequence = 0;

  constructor(private readonly jsPsych: JsPsych) {}

  async start(options: JsPsychExternalLifecycleStartOptions): Promise<boolean> {
    if (this.disposed || (this.active && !this.queuedEnd)) return false;
    if (this.runPromise) await this.runPromise;
    if (this.disposed || this.active) return false;

    this.active = true;
    this.queuedEnd = null;
    this.runSequence += 1;
    const runToken = `${options.moduleId}:${this.runSequence}`;

    const runPromise = this.jsPsych.run([{
      type: TrainerHubExternalRuntimePlugin,
      module_id: options.moduleId,
      run_token: runToken,
      data: {
        module_id: options.moduleId,
        run_token: runToken,
      },
      on_runtime_start: () => {
        if (this.queuedEnd) {
          this.endActiveTrial(this.queuedEnd);
          return;
        }
        return options.onStart();
      },
      on_finish: (data: JsPsychExternalLifecycleData) => options.onFinish?.(data),
    }]);

    const trackedRunPromise = runPromise.catch(() => undefined).finally(() => {
      if (this.runPromise === trackedRunPromise) this.runPromise = null;
      this.active = false;
      this.queuedEnd = null;
    });
    this.runPromise = trackedRunPromise;
    return true;
  }

  finish(data: JsPsychExternalLifecycleData = {}): boolean {
    return this.requestEnd({ ...data, lifecycle_status: 'completed' });
  }

  abort(data: JsPsychExternalLifecycleData = {}): boolean {
    return this.requestEnd({ ...data, lifecycle_status: 'aborted' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requestEnd({ lifecycle_status: 'disposed' });
    this.jsPsych.pluginAPI.clearAllTimeouts();
  }

  isActive(): boolean {
    return this.active;
  }

  private requestEnd(data: JsPsychExternalLifecycleData): boolean {
    if (!this.active || this.queuedEnd) return false;
    this.queuedEnd = data;

    if (this.isExternalTrialRunning()) {
      this.endActiveTrial(data);
    }
    return true;
  }

  private endActiveTrial(data: JsPsychExternalLifecycleData): void {
    if (data.lifecycle_status === 'completed') {
      this.jsPsych.finishTrial(data);
      return;
    }
    this.jsPsych.abortExperiment(undefined, data);
  }

  private isExternalTrialRunning(): boolean {
    return this.jsPsych.getCurrentTrial()?.type === TrainerHubExternalRuntimePlugin;
  }
}

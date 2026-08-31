import type {
  EnginePreloadContext,
  PreparedTrainingEngine,
  TrainingConfigProps,
  TrainingRulesProps,
  TrainingRunContext,
  TrainingSetupModule,
} from '@rehab-trainer/ui/trainingHostContract';
import type { TrainingModuleManifest, TrainingRunResult } from '@rehab-trainer/training-contracts';
import {
  CreateNativeTimelineEngine,
  ThrowIfAborted,
  type NativeJsPsychLike,
} from './nativeTimelineEngine';

export interface TimelineSetupOptions<TConfig extends Record<string, unknown>> {
  manifest: TrainingModuleManifest;
  defaultConfig: Readonly<TConfig>;
  validateConfig(input: unknown): ReturnType<TrainingSetupModule<TConfig>['validateConfig']>;
  ConfigPanel: TrainingSetupModule<TConfig>['ConfigPanel'];
  RulesPanel: TrainingSetupModule<TConfig>['RulesPanel'];
  buildTimeline(input: {
    config: Readonly<TConfig>;
    jsPsych: NativeJsPsychLike;
    context: TrainingRunContext<TConfig>;
  }): unknown[] | Promise<unknown[]>;
  /** Import the module's engine graph without creating a renderer/instance. */
  preload?(context: EnginePreloadContext): void | Promise<void>;
  summarize(input: {
    status: TrainingRunResult['status'];
    startedAt: number;
    endedAt: number;
    values: readonly unknown[];
  }): TrainingRunResult;
  onDispose?(): void | Promise<void>;
}

/**
 * Creates a light setup module. jsPsych and the module engine graph are
 * imported only after the host has made the rules step visible.
 */
export function CreateTimelineSetup<TConfig extends Record<string, unknown>>(
  options: TimelineSetupOptions<TConfig>,
): TrainingSetupModule<TConfig> {
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
      const jsPsychModule = await import('jspsych');
      ThrowIfAborted(context.signal);
      context.reportProgress(0.5);
      await options.preload?.(context);
      ThrowIfAborted(context.signal);
      const engine = CreateNativeTimelineEngine<TConfig>({
        moduleId: options.manifest.id,
        moduleVersion: options.manifest.implementationVersion,
        initJsPsych: jsPsychModule.initJsPsych as unknown as (
          initOptions: Record<string, unknown>
        ) => NativeJsPsychLike,
        buildTimeline: ({ config, jsPsych, context: runContext }) => options.buildTimeline({
          config,
          jsPsych,
          context: runContext,
        }),
        summarize: options.summarize,
        onDispose: options.onDispose,
      });
      context.reportProgress(1);
      return engine;
    },
  });
}

export type TimelineConfigPanel<TConfig> = TrainingConfigProps<TConfig>;
export type TimelineRulesPanel = TrainingRulesProps;

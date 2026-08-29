import type { ComponentType } from 'react';
import type {
  TrainingAssetDescriptor,
  TrainingModuleManifest,
  TrainingRunHandle,
  TrainingRunResult,
  ValidationIssue,
} from '@rehab-trainer/training-contracts';

export interface TrainingAssetResolver {
  resolve(asset: Pick<TrainingAssetDescriptor, 'id' | 'version'>): string;
}

export interface EnginePreloadContext {
  trigger: 'rules-visible';
  signal: AbortSignal;
  assets: TrainingAssetResolver;
  reportProgress(progress: number): void;
}

export interface TrainingRunContext<TConfig> {
  config: Readonly<TConfig>;
  mountElement: HTMLElement;
  signal: AbortSignal;
  sessionNonce: string;
  /** Host locale is presentation context, not part of module configuration. */
  language?: 'zh' | 'en';
}

export interface TrainingConfigProps<TConfig> {
  value: Readonly<TConfig>;
  onChange(value: TConfig): void;
  onValidityChange?(valid: boolean): void;
  language?: 'zh' | 'en';
}

export interface TrainingRulesProps {
  onReady?(): void;
  language?: 'zh' | 'en';
}

export interface PreparedTrainingEngine<TConfig> {
  startRun(context: TrainingRunContext<TConfig>): Promise<TrainingRunHandle>;
  dispose(reason: 'back' | 'exit' | 'complete' | 'error'): Promise<void>;
}

export interface TrainingSetupModule<TConfig> {
  manifest: TrainingModuleManifest;
  defaultConfig: Readonly<TConfig>;
  validateConfig(input: unknown):
    | { ok: true; value: TConfig }
    | { ok: false; issues: readonly ValidationIssue[] };
  ConfigPanel: ComponentType<TrainingConfigProps<TConfig>>;
  RulesPanel: ComponentType<TrainingRulesProps>;
  loadEngine(context: EnginePreloadContext): Promise<PreparedTrainingEngine<TConfig>>;
}

export interface TrainingResultPresenterProps {
  result: TrainingRunResult;
}

/**
 * Setup modules may be imported by the lightweight host. This contract keeps
 * jsPsych/renderer values behind loadEngine and startRun, so the host cannot
 * accidentally retain a module's global runtime state.
 */
export type TrainingSetupLoader<TConfig = unknown> = () => Promise<TrainingSetupModule<TConfig>>;

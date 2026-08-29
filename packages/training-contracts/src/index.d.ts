export type TrainingDomain = 'motor' | 'vision' | 'brain' | 'mouth';
export type TrainingModuleId = `${TrainingDomain}:${string}`;
export type TrainingCapability =
  | 'audio'
  | 'camera'
  | 'microphone'
  | 'fullscreen'
  | 'gamepad'
  | 'pointer'
  | 'keyboard'
  | 'touch';
export type TrainingFlowStep = 'card' | 'config' | 'rules' | 'training' | 'results';
export type TrainingLifecycleMode = 'native-timeline' | 'legacy-adapter-exempt';
export type TrainingOfflinePolicy = 'required' | 'optional' | 'never';
export type GamePlatformCapability = 'audio' | 'fullscreen' | 'gamepad' | 'keyboard' | 'pointer' | 'touch';
export interface GamePlatformRuntimeContract {
  readonly jsPsychVersion: '8.2.3';
  readonly jsPsychUrl: '/runtime/jspsych-8.2.3.js';
  readonly jsPsychCssUrl: '/runtime/jspsych-8.2.3.css';
  readonly gameSdkVersion: '0.1.0';
  readonly gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js';
}
export interface GamePlatformPackageLimits {
  readonly maximumCompressedBytes: number;
  readonly maximumFileBytes: number;
  readonly maximumFileCount: number;
  readonly maximumFindingCount: number;
  readonly maximumTextLineLength: number;
  readonly maximumTotalBytes: number;
  readonly maximumTotalTextBytes: number;
  readonly maximumZipRatio: number;
}
export type TrainingHostCommandType = 'prepare' | 'start' | 'pause' | 'resume' | 'abort' | 'dispose';
export type TrainingHostState =
  | 'card'
  | 'configuring'
  | 'iframe-booting'
  | 'rules-loading'
  | 'rules-ready'
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'completed'
  | 'aborting'
  | 'failed'
  | 'disposing'
  | 'disposed';

export interface ValidationIssue {
  path: string;
  code: string;
  messageKey: string;
}

export interface TrainingAssetDescriptor {
  id: string;
  version: string;
  path: string;
  byteSize: number;
  sha256: string;
  contentType: string;
  offline: TrainingOfflinePolicy;
}

export interface TrainingModuleManifest {
  schemaVersion: 1;
  id: TrainingModuleId;
  implementationVersion: string;
  purposeId: string;
  catalogOrder: number;
  titleKey: string;
  descriptionKey: string;
  themeToken: string;
  capabilities: readonly TrainingCapability[];
  flow: readonly [
    'card',
    'config',
    'rules',
    'training',
    'results',
  ];
  lifecycle: {
    owner: 'jspsych';
    mode: TrainingLifecycleMode;
  };
  pwa: {
    installable: boolean;
    shortNameKey: string;
    orientation: 'any' | 'landscape' | 'portrait';
    iconAssetIds: readonly string[];
  };
  assets: readonly TrainingAssetDescriptor[];
}

export interface TrainingRunResult {
  schemaVersion: 1;
  moduleId: TrainingModuleId;
  moduleVersion: string;
  status: 'completed' | 'aborted';
  startedAt: string;
  durationMs: number;
  trialCount: number;
  score?: number;
  metrics: Readonly<Record<string, number | boolean | null>>;
}

export interface TrainingRunHandle {
  readonly result: Promise<TrainingRunResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  abort(reason: 'exit' | 'back' | 'unmount' | 'error'): Promise<void>;
  dispose(): Promise<void>;
}

export interface TrainingLifecycleEnvelope<TPayload = unknown> {
  schema: 'trainerhub.training/v1';
  sessionNonce: string;
  sequence: number;
  moduleId: TrainingModuleId;
  payload: TPayload;
}

export interface TrainingHostConnect {
  schema: 'trainerhub.training/connect/v1';
  type: 'connect';
  runId: string;
  sessionNonce: string;
  moduleId: TrainingModuleId;
  protocolVersion: 1;
}

export interface TrainingHostReadyMessage {
  schema: 'trainerhub.training/host/v1';
  type: 'iframe-ready';
  moduleId: TrainingModuleId;
  protocolVersion: 1;
  hostVersion: string;
}

export interface TrainingCommandMeta {
  runId: string;
  commandId: string;
}

export type TrainingHostCommand =
  | (TrainingCommandMeta & { type: 'prepare'; config: unknown })
  | (TrainingCommandMeta & { type: 'start' })
  | (TrainingCommandMeta & { type: 'pause' })
  | (TrainingCommandMeta & { type: 'resume' })
  | (TrainingCommandMeta & { type: 'abort'; reason: 'back' | 'exit' | 'unmount' })
  | (TrainingCommandMeta & { type: 'dispose' });

export type TrainingHostEvent =
  | (TrainingCommandMeta & { type: 'preload-progress'; progress: number })
  | (TrainingCommandMeta & { type: 'prepared' })
  | (TrainingCommandMeta & { type: 'started' })
  | (TrainingCommandMeta & { type: 'paused' })
  | (TrainingCommandMeta & { type: 'resumed' })
  | (TrainingCommandMeta & { type: 'command-rejected'; errorCode: string; recoverable: boolean })
  | { type: 'completed'; runId: string; result: TrainingRunResult }
  | (TrainingCommandMeta & { type: 'aborted'; result: TrainingRunResult })
  | { type: 'failed'; runId: string; commandId?: string; errorCode: string }
  | (TrainingCommandMeta & { type: 'disposed' });

export interface EnvelopeValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface EnvelopeValidationFailure {
  ok: false;
  code: 'type' | 'schema' | 'nonce' | 'module' | 'sequence';
}

export interface ValidationSuccess<T> {
  ok: true;
  value: T;
}

export interface ValidationFailure {
  ok: false;
  issues: readonly ValidationIssue[];
}

export const trainingHostConnectSchema: 'trainerhub.training/connect/v1';
export const trainingHostMessageSchema: 'trainerhub.training/host/v1';
export const trainingHostProtocolVersion: 1;

export const standardTrainingFlow: readonly ['card', 'config', 'rules', 'training', 'results'];
export const trainingDomains: readonly TrainingDomain[];
export const trainingCapabilities: readonly TrainingCapability[];
export const gamePlatformCapabilities: readonly GamePlatformCapability[];
export const gamePlatformRuntimeContract: GamePlatformRuntimeContract;
export const gamePlatformMaxUploadBytes: 12582912;
export const gamePlatformPackageLimits: GamePlatformPackageLimits;
export const trainingProtocolSchema: 'trainerhub.training/v1';
export function IsTrainingModuleId(value: unknown): value is TrainingModuleId;
export function CreateTrainingModuleId(domain: TrainingDomain, slug: string): TrainingModuleId;
export function ValidateTrainingModuleManifest(input: unknown): ValidationSuccess<TrainingModuleManifest> | ValidationFailure;
export function AssertTrainingModuleManifest(input: unknown): TrainingModuleManifest;
export function SanitizeTrainingMetrics(metrics: unknown): Readonly<Record<string, number | boolean | null>>;
export function CreateTrainingEnvelope<TPayload>(input: {
  sessionNonce: string;
  moduleId: TrainingModuleId;
  sequence: number;
  payload: TPayload;
}): TrainingLifecycleEnvelope<TPayload>;
export function ValidateTrainingEnvelope(input: unknown): EnvelopeValidationSuccess<TrainingLifecycleEnvelope> | EnvelopeValidationFailure;
export function IsTrainingHostCommand(input: unknown): input is TrainingHostCommand;
export function CreateTrainingHostConnect(input: {
  runId: string;
  sessionNonce: string;
  moduleId: TrainingModuleId;
}): TrainingHostConnect;
export function IsTrainingHostConnect(input: unknown): input is TrainingHostConnect;
export function IsTrainingHostReady(input: unknown): input is TrainingHostReadyMessage;
export function IsTrainingHostEvent(
  input: unknown,
  expected?: { sessionNonce?: string; moduleId?: TrainingModuleId; runId?: string },
): input is TrainingLifecycleEnvelope<TrainingHostEvent>;
export function CreateTrainingHostEnvelope(input: {
  sessionNonce: string;
  moduleId: TrainingModuleId;
  sequence: number;
  payload: TrainingHostEvent;
}): TrainingLifecycleEnvelope<TrainingHostEvent>;
export function CanTransitionTrainingHostState(
  state: TrainingHostState,
  event: string,
): boolean;
export function TransitionTrainingHostState(
  state: TrainingHostState,
  event: string,
): TrainingHostState;

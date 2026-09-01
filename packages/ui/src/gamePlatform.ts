export const gamePlatformManifestSchemaVersion = 1 as const;
export const gamePlatformMessageSchema = 'trainerhub.game-platform/v1' as const;
export const gamePlatformLifecycleMessageType = 'trainerhub.game:lifecycle' as const;
export const gamePlatformResultMessageType = 'trainerhub.game:result' as const;
export const gamePlatformRunnerReadyMessageType = 'trainerhub.runner:ready' as const;
export const gamePlatformRunnerCommandMessageType = 'trainerhub.runner:command' as const;
export const gamePlatformRunnerSettingsMessageType = 'trainerhub.runner:settings' as const;
export const gamePlatformHostSettingsMessageType = 'trainerhub.host:settings' as const;
export const gamePlatformOpaqueOrigin = 'null' as const;
export const gamePlatformSupportedJsPsychMajorVersion = 8 as const;
const gamePlatformGameRunRequestMaxBytes = 16 * 1024;
const gamePlatformGameRunIdentifierMaxLength = 128;
export const gamePlatformRunSessionTokenLength = 64;
// JSON.stringify({ releaseId, clientRunId, runSessionToken, result }) adds
// 64 syntax/key bytes plus the three bounded string values around `result`.
const gamePlatformGameRunJsonEnvelopeBytes = 64
  + (2 * gamePlatformGameRunIdentifierMaxLength)
  + gamePlatformRunSessionTokenLength;
export const gamePlatformMaxPayloadBytes = gamePlatformGameRunRequestMaxBytes
  - gamePlatformGameRunJsonEnvelopeBytes;
export const gamePlatformMaxFiles = 192;
export const gamePlatformMaxResultMetrics = 512;
export const gamePlatformMaxResultDurationMs = 24 * 60 * 60 * 1000;
export const gamePlatformMaxResultTrialCount = 100_000;
export const gamePlatformSessionNonceMinLength = 32;
export const gamePlatformSessionNonceMaxLength = 128;

export const gamePlatformCapabilities = [
  'audio',
  'fullscreen',
  'gamepad',
  'keyboard',
  'pointer',
  'touch',
] as const;

export type GamePlatformCapability = (typeof gamePlatformCapabilities)[number];

export interface GamePlatformManifestV1 {
  schemaVersion: typeof gamePlatformManifestSchemaVersion;
  id: string;
  version: string;
  title: string;
  entry: string;
  files: string[];
  capabilities: GamePlatformCapability[];
  jsPsychVersion: string;
}

export type GamePlatformManifest = GamePlatformManifestV1;

export type GamePlatformLifecyclePhase =
  | 'ready'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'aborted';

export interface GamePlatformLifecyclePayload {
  phase: GamePlatformLifecyclePhase;
  progress?: number;
}

export type GamePlatformResultStatus = 'completed' | 'aborted';
export type GamePlatformRunnerCommand = 'pause' | 'resume' | 'exit';
export type GamePlatformSettingsValues = Record<string, string | number | boolean>;
export type GamePlatformMetricValue = number | boolean | null;
export type GamePlatformResultMetrics = Record<string, GamePlatformMetricValue>;

/**
 * Deliberately limited to aggregate, non-identifying values. Authentication
 * material, user identifiers, free text, and raw trial records do not belong
 * in the sandbox bridge.
 */
export interface GamePlatformResultPayload {
  status: GamePlatformResultStatus;
  score?: number;
  durationMs?: number;
  trialCount?: number;
  metrics?: GamePlatformResultMetrics;
}

interface GamePlatformMessageEnvelope {
  schema: typeof gamePlatformMessageSchema;
  sessionNonce: string;
  sequence: number;
}

export interface GamePlatformLifecycleMessageV1 extends GamePlatformMessageEnvelope {
  type: typeof gamePlatformLifecycleMessageType;
  payload: GamePlatformLifecyclePayload;
}

export interface GamePlatformResultMessageV1 extends GamePlatformMessageEnvelope {
  type: typeof gamePlatformResultMessageType;
  payload: GamePlatformResultPayload;
}

export type GamePlatformLifecycleMessage = GamePlatformLifecycleMessageV1;
export type GamePlatformResultMessage = GamePlatformResultMessageV1;
export type GamePlatformMessageV1 = GamePlatformLifecycleMessageV1 | GamePlatformResultMessageV1;
export type GamePlatformMessage = GamePlatformMessageV1;

export interface GamePlatformRunnerReadyMessageV1 {
  schema: typeof gamePlatformMessageSchema;
  type: typeof gamePlatformRunnerReadyMessageType;
  gameId: string;
  gameVersion: string;
  sessionId: string;
  sessionNonce: string;
}

export interface GamePlatformRunnerCommandMessageV1 {
  schema: typeof gamePlatformMessageSchema;
  type: typeof gamePlatformRunnerCommandMessageType;
  sessionId: string;
  sessionNonce: string;
  command: GamePlatformRunnerCommand;
}

export interface GamePlatformRunnerSettingsMessageV1 {
  schema: typeof gamePlatformMessageSchema;
  type: typeof gamePlatformRunnerSettingsMessageType;
  sessionId: string;
  sessionNonce: string;
  settings: GamePlatformSettingsValues;
}

export type GamePlatformMessageEvent = Pick<
  MessageEvent<GamePlatformMessage>,
  'data' | 'origin' | 'source'
>;

const manifestRequiredKeys = [
  'schemaVersion',
  'id',
  'version',
  'title',
  'entry',
  'files',
  'capabilities',
  'jsPsychVersion',
] as const;
const messageRequiredKeys = ['schema', 'type', 'sessionNonce', 'sequence', 'payload'] as const;
const lifecyclePayloadRequiredKeys = ['phase'] as const;
const lifecyclePayloadOptionalKeys = ['progress'] as const;
const resultPayloadRequiredKeys = ['status'] as const;
const resultPayloadOptionalKeys = ['score', 'durationMs', 'trialCount', 'metrics'] as const;
const runnerReadyRequiredKeys = [
  'schema',
  'type',
  'gameId',
  'gameVersion',
  'sessionId',
  'sessionNonce',
] as const;
const runnerSettingsRequiredKeys = [
  'schema',
  'type',
  'sessionId',
  'sessionNonce',
  'settings',
] as const;
const runnerCommandSet: ReadonlySet<string> = new Set<GamePlatformRunnerCommand>([
  'pause',
  'resume',
  'exit',
]);
const capabilitySet: ReadonlySet<string> = new Set(gamePlatformCapabilities);
const lifecyclePhaseSet: ReadonlySet<string> = new Set<GamePlatformLifecyclePhase>([
  'ready',
  'started',
  'paused',
  'resumed',
  'completed',
  'aborted',
]);
const resultStatusSet: ReadonlySet<string> = new Set<GamePlatformResultStatus>([
  'completed',
  'aborted',
]);
const sensitiveMetricKeyPattern = /(auth|authorization|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i;

export function IsGamePlatformManifest(value: unknown): value is GamePlatformManifest {
  try {
    if (!IsExactPlainObject(value, manifestRequiredKeys)) return false;
    if (value.schemaVersion !== gamePlatformManifestSchemaVersion) return false;
    if (!IsBoundedString(value.id, 1, 64) || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.id)) return false;
    if (!IsSemanticVersion(value.version)) return false;
    if (!IsBoundedString(value.title, 1, 120) || value.title.trim() !== value.title || /[\u0000-\u001f\u007f]/.test(value.title)) return false;
    if (!IsSafeGamePath(value.entry) || !/\.html?$/i.test(value.entry)) return false;
    if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > gamePlatformMaxFiles) return false;
    if (!value.files.every(IsSafeGamePath) || new Set(value.files).size !== value.files.length) return false;
    if (!value.files.includes(value.entry)) return false;
    if (!Array.isArray(value.capabilities) || value.capabilities.length > gamePlatformCapabilities.length) return false;
    if (!value.capabilities.every((capability) => typeof capability === 'string' && capabilitySet.has(capability))) return false;
    if (new Set(value.capabilities).size !== value.capabilities.length) return false;
    return IsSupportedJsPsychVersion(value.jsPsychVersion);
  } catch {
    return false;
  }
}

export function IsGamePlatformLifecycleMessage(
  value: unknown,
  expectedSessionNonce?: string,
  lastAcceptedSequence: number = -1,
): value is GamePlatformLifecycleMessage {
  try {
    if (!IsMessageEnvelope(value, gamePlatformLifecycleMessageType, expectedSessionNonce, lastAcceptedSequence)) return false;
    if (!IsExactPlainObject(value.payload, lifecyclePayloadRequiredKeys, lifecyclePayloadOptionalKeys)) return false;
    if (typeof value.payload.phase !== 'string' || !lifecyclePhaseSet.has(value.payload.phase)) return false;
    if ('progress' in value.payload
      && (!IsFiniteNumber(value.payload.progress) || value.payload.progress < 0 || value.payload.progress > 1)) return false;
    return IsPayloadSizeAllowed(value.payload);
  } catch {
    return false;
  }
}

export function IsGamePlatformResultMessage(
  value: unknown,
  expectedSessionNonce?: string,
  lastAcceptedSequence: number = -1,
): value is GamePlatformResultMessage {
  try {
    if (!IsMessageEnvelope(value, gamePlatformResultMessageType, expectedSessionNonce, lastAcceptedSequence)) return false;
    if (!IsExactPlainObject(value.payload, resultPayloadRequiredKeys, resultPayloadOptionalKeys)) return false;
    if (typeof value.payload.status !== 'string' || !resultStatusSet.has(value.payload.status)) return false;
    if ('score' in value.payload && !IsFiniteNumber(value.payload.score)) return false;
    if ('durationMs' in value.payload
      && (typeof value.payload.durationMs !== 'number'
        || !Number.isSafeInteger(value.payload.durationMs)
        || value.payload.durationMs < 0
        || value.payload.durationMs > gamePlatformMaxResultDurationMs)) return false;
    if ('trialCount' in value.payload
      && (typeof value.payload.trialCount !== 'number'
        || !Number.isSafeInteger(value.payload.trialCount)
        || value.payload.trialCount < 0
        || value.payload.trialCount > gamePlatformMaxResultTrialCount)) return false;
    if ('metrics' in value.payload && !IsGamePlatformResultMetrics(value.payload.metrics)) return false;
    return IsPayloadSizeAllowed(value.payload);
  } catch {
    return false;
  }
}

export function IsGamePlatformMessage(
  value: unknown,
  expectedSessionNonce?: string,
  lastAcceptedSequence: number = -1,
): value is GamePlatformMessage {
  return IsGamePlatformLifecycleMessage(value, expectedSessionNonce, lastAcceptedSequence)
    || IsGamePlatformResultMessage(value, expectedSessionNonce, lastAcceptedSequence);
}

/**
 * A sandbox without `allow-same-origin` has the opaque serialized origin
 * `"null"`. Accept a bridge message only from that origin, the exact iframe
 * contentWindow, the current nonce/schema, and a strictly newer sequence.
 */
export function IsTrustedGamePlatformFrameMessage(
  event: Pick<MessageEvent<unknown>, 'data' | 'origin' | 'source'>,
  expectedContentWindow: MessageEventSource | null,
  expectedSessionNonce: string,
  lastAcceptedSequence: number,
): event is GamePlatformMessageEvent {
  return event.origin === gamePlatformOpaqueOrigin
    && expectedContentWindow !== null
    && event.source === expectedContentWindow
    && IsValidSessionNonce(expectedSessionNonce)
    && IsGamePlatformMessage(event.data, expectedSessionNonce, lastAcceptedSequence);
}

export function IsGamePlatformRunnerReadyMessage(
  value: unknown,
  expectedSessionNonce: string,
  expectedGameId: string,
  expectedGameVersion: string,
): value is GamePlatformRunnerReadyMessageV1 {
  try {
    return IsExactPlainObject(value, runnerReadyRequiredKeys)
      && value.schema === gamePlatformMessageSchema
      && value.type === gamePlatformRunnerReadyMessageType
      && value.gameId === expectedGameId
      && value.gameVersion === expectedGameVersion
      && IsBoundedString(value.gameId, 1, 64)
      && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.gameId)
      && IsSemanticVersion(value.gameVersion)
      && IsValidSessionIdentifier(value.sessionId)
      && value.sessionNonce === expectedSessionNonce
      && IsValidSessionNonce(value.sessionNonce);
  } catch {
    return false;
  }
}

export function IsTrustedGamePlatformRunnerReadyMessage(
  event: Pick<MessageEvent<unknown>, 'data' | 'origin' | 'source'>,
  expectedContentWindow: MessageEventSource | null,
  expectedSessionNonce: string,
  expectedGameId: string,
  expectedGameVersion: string,
): event is Pick<MessageEvent<GamePlatformRunnerReadyMessageV1>, 'data' | 'origin' | 'source'> {
  return event.origin === gamePlatformOpaqueOrigin
    && expectedContentWindow !== null
    && event.source === expectedContentWindow
    && IsGamePlatformRunnerReadyMessage(
      event.data,
      expectedSessionNonce,
      expectedGameId,
      expectedGameVersion,
    );
}

export function CreateGamePlatformRunnerCommandMessage(
  sessionId: string,
  sessionNonce: string,
  command: GamePlatformRunnerCommand,
): GamePlatformRunnerCommandMessageV1 {
  if (!IsValidSessionIdentifier(sessionId)
    || !IsValidSessionNonce(sessionNonce)
    || !runnerCommandSet.has(command)) {
    throw new TypeError('Invalid game runner command.');
  }
  return {
    schema: gamePlatformMessageSchema,
    type: gamePlatformRunnerCommandMessageType,
    sessionId,
    sessionNonce,
    command,
  };
}

export function CreateGamePlatformRunnerSettingsMessage(
  sessionId: string,
  sessionNonce: string,
  settings: GamePlatformSettingsValues,
): GamePlatformRunnerSettingsMessageV1 {
  if (!IsValidSessionIdentifier(sessionId)
    || !IsValidSessionNonce(sessionNonce)
    || !IsGamePlatformSettingsValues(settings)) {
    throw new TypeError('Invalid game runner settings.');
  }
  return {
    schema: gamePlatformMessageSchema,
    type: gamePlatformRunnerSettingsMessageType,
    sessionId,
    sessionNonce,
    settings: { ...settings },
  };
}

export function IsGamePlatformRunnerSettingsMessage(
  value: unknown,
  expectedSessionId?: string,
  expectedSessionNonce?: string,
): value is GamePlatformRunnerSettingsMessageV1 {
  try {
    return IsExactPlainObject(value, runnerSettingsRequiredKeys)
      && value.schema === gamePlatformMessageSchema
      && value.type === gamePlatformRunnerSettingsMessageType
      && IsValidSessionIdentifier(value.sessionId)
      && IsValidSessionNonce(value.sessionNonce)
      && (!expectedSessionId || value.sessionId === expectedSessionId)
      && (!expectedSessionNonce || value.sessionNonce === expectedSessionNonce)
      && IsGamePlatformSettingsValues(value.settings);
  } catch {
    return false;
  }
}

function IsMessageEnvelope(
  value: unknown,
  expectedType: typeof gamePlatformLifecycleMessageType | typeof gamePlatformResultMessageType,
  expectedSessionNonce: string | undefined,
  lastAcceptedSequence: number,
): value is Record<string, unknown> & GamePlatformMessageEnvelope & { payload: unknown; type: string } {
  if (!IsExactPlainObject(value, messageRequiredKeys)) return false;
  if (value.schema !== gamePlatformMessageSchema || value.type !== expectedType) return false;
  if (!IsValidSessionNonce(value.sessionNonce)) return false;
  if (expectedSessionNonce !== undefined && value.sessionNonce !== expectedSessionNonce) return false;
  if (typeof value.sequence !== 'number'
    || !Number.isSafeInteger(value.sequence)
    || value.sequence < 0) return false;
  return Number.isSafeInteger(lastAcceptedSequence)
    && lastAcceptedSequence >= -1
    && value.sequence > lastAcceptedSequence;
}

function IsGamePlatformResultMetrics(value: unknown): value is GamePlatformResultMetrics {
  if (!IsPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length > gamePlatformMaxResultMetrics) return false;
  return keys.every((key) => typeof key === 'string'
    && Object.prototype.propertyIsEnumerable.call(value, key)
    && /^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
    && !sensitiveMetricKeyPattern.test(key)
    && (value[key] === null || typeof value[key] === 'boolean' || IsFiniteNumber(value[key])));
}

function IsGamePlatformSettingsValues(value: unknown): value is GamePlatformSettingsValues {
  if (!IsPlainObject(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length <= 64 && keys.every((key) => {
    if (typeof key !== 'string'
      || !Object.prototype.propertyIsEnumerable.call(value, key)
      || !/^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
      || sensitiveMetricKeyPattern.test(key)) return false;
    const setting = value[key];
    return typeof setting === 'boolean'
      || (typeof setting === 'string' && setting.length <= 80)
      || IsFiniteNumber(setting);
  });
}

function IsSupportedJsPsychVersion(value: unknown): value is string {
  if (!IsSemanticVersion(value)) return false;
  return Number(value.split('.')[0]) === gamePlatformSupportedJsPsychMajorVersion;
}

function IsSemanticVersion(value: unknown): value is string {
  return IsBoundedString(value, 5, 64)
    && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
}

function IsSafeGamePath(value: unknown): value is string {
  if (!IsBoundedString(value, 1, 256)
    || value.startsWith('/')
    || value.includes('\\')
    || value.includes('?')
    || value.includes('#')
    || value.includes('%')
    || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function IsValidSessionNonce(value: unknown): value is string {
  return IsBoundedString(value, gamePlatformSessionNonceMinLength, gamePlatformSessionNonceMaxLength)
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function IsValidSessionIdentifier(value: unknown): value is string {
  return IsBoundedString(value, gamePlatformSessionNonceMinLength, gamePlatformSessionNonceMaxLength)
    && /^[A-Za-z0-9._-]+$/.test(value);
}

function IsPayloadSizeAllowed(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return typeof serialized === 'string'
    && new TextEncoder().encode(serialized).byteLength <= gamePlatformMaxPayloadBytes;
}

function IsFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function IsBoundedString(value: unknown, minimumLength: number, maximumLength: number): value is string {
  return typeof value === 'string'
    && value.length >= minimumLength
    && value.length <= maximumLength;
}

function IsExactPlainObject(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is Record<string, unknown> {
  if (!IsPlainObject(value)) return false;
  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string'
      || !Object.prototype.propertyIsEnumerable.call(value, key)
      || !allowedKeys.has(key)) return false;
  }
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function IsPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

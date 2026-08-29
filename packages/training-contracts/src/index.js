const flowSteps = Object.freeze([
  'card',
  'config',
  'rules',
  'training',
  'results',
]);

const trainingDomainValues = Object.freeze(['motor', 'vision', 'brain', 'mouth']);
const trainingCapabilityValues = Object.freeze([
  'audio',
  'camera',
  'microphone',
  'fullscreen',
  'gamepad',
  'pointer',
  'keyboard',
  'touch',
]);
// The uploaded-game runner, Hub scanner, and client bridge must make the same
// capability decision. Keep this list renderer-independent so Cloudflare
// Functions can consume it without importing React or browser code.
const gamePlatformCapabilityValues = Object.freeze([
  'audio',
  'fullscreen',
  'gamepad',
  'keyboard',
  'pointer',
  'touch',
]);
const gamePlatformRuntimeContractValue = Object.freeze({
  jsPsychVersion: '8.2.3',
  jsPsychUrl: '/runtime/jspsych-8.2.3.js',
  jsPsychCssUrl: '/runtime/jspsych-8.2.3.css',
  gameSdkVersion: '0.1.0',
  gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js',
});
const gamePlatformMaxUploadBytesValue = 12 * 1024 * 1024;
const gamePlatformPackageLimitsValue = Object.freeze({
  maximumCompressedBytes: gamePlatformMaxUploadBytesValue,
  maximumFileBytes: 8 * 1024 * 1024,
  maximumFileCount: 192,
  maximumFindingCount: 200,
  maximumTextLineLength: 5000,
  maximumTotalBytes: 24 * 1024 * 1024,
  maximumTotalTextBytes: 4 * 1024 * 1024,
  maximumZipRatio: 100,
});
const lifecycleModes = Object.freeze(['native-timeline', 'legacy-adapter-exempt']);
const offlinePolicies = Object.freeze(['required', 'optional', 'never']);
const trainingHostConnectSchemaValue = 'trainerhub.training/connect/v1';
const trainingHostMessageSchemaValue = 'trainerhub.training/host/v1';
const trainingHostProtocolVersionValue = 1;
const trainingHostCommands = Object.freeze([
  'prepare',
  'start',
  'pause',
  'resume',
  'abort',
  'dispose',
]);
const trainingHostEventTypes = Object.freeze([
  'iframe-ready',
  'preload-progress',
  'prepared',
  'started',
  'paused',
  'resumed',
  'command-rejected',
  'completed',
  'aborted',
  'failed',
  'disposed',
]);
const trainingHostStateTransitions = Object.freeze({
  card: Object.freeze({ open: 'configuring', dispose: 'disposing' }),
  configuring: Object.freeze({ rules: 'iframe-booting', back: 'disposing', abort: 'aborting' }),
  'iframe-booting': Object.freeze({ ready: 'rules-loading', back: 'aborting', abort: 'aborting', error: 'failed' }),
  'rules-loading': Object.freeze({ prepared: 'rules-ready', back: 'configuring', abort: 'aborting', error: 'failed' }),
  'rules-ready': Object.freeze({ start: 'starting', back: 'configuring', abort: 'aborting' }),
  starting: Object.freeze({ started: 'running', complete: 'completed', abort: 'aborting', error: 'failed' }),
  running: Object.freeze({ pause: 'pausing', complete: 'completed', abort: 'aborting', error: 'failed' }),
  pausing: Object.freeze({ paused: 'paused', abort: 'aborting', error: 'failed' }),
  paused: Object.freeze({ resume: 'resuming', abort: 'aborting' }),
  resuming: Object.freeze({ resumed: 'running', abort: 'aborting', error: 'failed' }),
  completed: Object.freeze({ dispose: 'disposing' }),
  aborting: Object.freeze({ disposed: 'disposed', dispose: 'disposing', error: 'failed' }),
  failed: Object.freeze({ dispose: 'disposing' }),
  disposing: Object.freeze({ disposed: 'disposed' }),
  disposed: Object.freeze({}),
});

export const standardTrainingFlow = flowSteps;
export const trainingDomains = trainingDomainValues;
export const trainingCapabilities = trainingCapabilityValues;
export const gamePlatformCapabilities = gamePlatformCapabilityValues;
export const gamePlatformRuntimeContract = gamePlatformRuntimeContractValue;
export const gamePlatformMaxUploadBytes = gamePlatformMaxUploadBytesValue;
export const gamePlatformPackageLimits = gamePlatformPackageLimitsValue;
export const trainingProtocolSchema = 'trainerhub.training/v1';
export const trainingHostConnectSchema = trainingHostConnectSchemaValue;
export const trainingHostMessageSchema = trainingHostMessageSchemaValue;
export const trainingHostProtocolVersion = trainingHostProtocolVersionValue;

export function IsTrainingModuleId(value) {
  if (typeof value !== 'string') return false;
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) return false;
  const domain = value.slice(0, separator);
  const slug = value.slice(separator + 1);
  return trainingDomainValues.includes(domain)
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function CreateTrainingModuleId(domain, slug) {
  const value = `${String(domain || '').trim()}:${String(slug || '').trim()}`;
  if (!IsTrainingModuleId(value)) {
    throw new TypeError(`Invalid training module id: ${value}`);
  }
  return value;
}

export function ValidateTrainingModuleManifest(input) {
  const issues = [];
  const addIssue = (path, code, messageKey) => issues.push({ path, code, messageKey });
  if (!IsRecord(input)) {
    return { ok: false, issues: [{ path: '', code: 'type', messageKey: 'training.manifest.object' }] };
  }

  if (input.schemaVersion !== 1) addIssue('schemaVersion', 'unsupported', 'training.manifest.schemaVersion');
  if (!IsTrainingModuleId(input.id)) addIssue('id', 'invalid', 'training.manifest.id');
  if (!IsNonEmptyString(input.implementationVersion)) {
    addIssue('implementationVersion', 'required', 'training.manifest.implementationVersion');
  }
  if (!IsNonEmptyString(input.purposeId)) addIssue('purposeId', 'required', 'training.manifest.purposeId');
  if (!IsFiniteInteger(input.catalogOrder) || input.catalogOrder < 0) {
    addIssue('catalogOrder', 'invalid', 'training.manifest.catalogOrder');
  }
  for (const field of ['titleKey', 'descriptionKey', 'themeToken']) {
    if (!IsNonEmptyString(input[field])) addIssue(field, 'required', `training.manifest.${field}`);
  }

  if (!Array.isArray(input.capabilities)) {
    addIssue('capabilities', 'type', 'training.manifest.capabilities');
  } else {
    const seen = new Set();
    input.capabilities.forEach((capability, index) => {
      if (!trainingCapabilityValues.includes(capability)) {
        addIssue(`capabilities[${index}]`, 'enum', 'training.manifest.capability');
      } else if (seen.has(capability)) {
        addIssue(`capabilities[${index}]`, 'duplicate', 'training.manifest.capabilityDuplicate');
      }
      seen.add(capability);
    });
  }

  if (!Array.isArray(input.flow) || !AreSameSequence(input.flow, flowSteps)) {
    addIssue('flow', 'invalid', 'training.manifest.flow');
  }

  if (!IsRecord(input.lifecycle)) {
    addIssue('lifecycle', 'type', 'training.manifest.lifecycle');
  } else {
    if (input.lifecycle.owner !== 'jspsych') addIssue('lifecycle.owner', 'enum', 'training.manifest.lifecycleOwner');
    if (!lifecycleModes.includes(input.lifecycle.mode)) {
      addIssue('lifecycle.mode', 'enum', 'training.manifest.lifecycleMode');
    }
  }

  if (!IsRecord(input.pwa)) {
    addIssue('pwa', 'type', 'training.manifest.pwa');
  } else {
    if (typeof input.pwa.installable !== 'boolean') addIssue('pwa.installable', 'type', 'training.manifest.pwaInstallable');
    if (!IsNonEmptyString(input.pwa.shortNameKey)) addIssue('pwa.shortNameKey', 'required', 'training.manifest.pwaShortNameKey');
    if (!['any', 'landscape', 'portrait'].includes(input.pwa.orientation)) {
      addIssue('pwa.orientation', 'enum', 'training.manifest.pwaOrientation');
    }
    if (!Array.isArray(input.pwa.iconAssetIds) || input.pwa.iconAssetIds.some((value) => !IsNonEmptyString(value))) {
      addIssue('pwa.iconAssetIds', 'type', 'training.manifest.pwaIcons');
    }
  }

  if (!Array.isArray(input.assets)) {
    addIssue('assets', 'type', 'training.manifest.assets');
  } else {
    const assetIds = new Set();
    input.assets.forEach((asset, index) => {
      const path = `assets[${index}]`;
      if (!IsRecord(asset)) {
        addIssue(path, 'type', 'training.manifest.asset');
        return;
      }
      for (const field of ['id', 'version', 'path', 'sha256', 'contentType']) {
        if (!IsNonEmptyString(asset[field])) addIssue(`${path}.${field}`, 'required', 'training.manifest.assetField');
      }
      if (!IsFiniteInteger(asset.byteSize) || asset.byteSize < 0) addIssue(`${path}.byteSize`, 'invalid', 'training.manifest.assetByteSize');
    if (!offlinePolicies.includes(asset.offline)) addIssue(`${path}.offline`, 'enum', 'training.manifest.assetOffline');
      if (assetIds.has(asset.id)) addIssue(`${path}.id`, 'duplicate', 'training.manifest.assetIdDuplicate');
      assetIds.add(asset.id);
      if (typeof asset.path === 'string' && !IsPlatformAssetPath(asset.path)) {
        addIssue(`${path}.path`, 'scope', 'training.manifest.assetPath');
      }
    });
  }

  return issues.length === 0 ? { ok: true, value: FreezeManifest(input) } : { ok: false, issues };
}

export function AssertTrainingModuleManifest(input) {
  const result = ValidateTrainingModuleManifest(input);
  if (!result.ok) {
    const summary = result.issues.map((issue) => `${issue.path || '<root>'}:${issue.code}`).join(', ');
    throw new TypeError(`Invalid training module manifest (${summary}).`);
  }
  return result.value;
}

export function SanitizeTrainingMetrics(metrics) {
  if (!IsRecord(metrics)) return {};
  const output = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (Object.keys(output).length >= 128) break;
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key)) continue;
    if (/auth|email|jwt|name|password|token|user/i.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean' || value === null) output[key] = value;
  }
  return Object.freeze(output);
}

export function CreateTrainingEnvelope({ sessionNonce, moduleId, sequence, payload }) {
  if (!IsNonEmptyString(sessionNonce) || !IsTrainingModuleId(moduleId)) {
    throw new TypeError('A valid session nonce and module id are required.');
  }
  if (!IsFiniteInteger(sequence) || sequence < 1) {
    throw new TypeError('Envelope sequence must be a positive integer.');
  }
  return Object.freeze({
    schema: trainingProtocolSchema,
    sessionNonce,
    sequence,
    moduleId,
    payload,
  });
}

export function ValidateTrainingEnvelope(input) {
  if (!IsRecord(input)) return { ok: false, code: 'type' };
  if (input.schema !== trainingProtocolSchema) return { ok: false, code: 'schema' };
  if (!IsNonEmptyString(input.sessionNonce)) return { ok: false, code: 'nonce' };
  if (!IsTrainingModuleId(input.moduleId)) return { ok: false, code: 'module' };
  if (!IsFiniteInteger(input.sequence) || input.sequence < 1) return { ok: false, code: 'sequence' };
  return { ok: true, value: input };
}

export function IsTrainingHostCommand(input) {
  if (!IsRecord(input) || !IsOpaqueIdentifier(input.runId) || !IsOpaqueIdentifier(input.commandId)) return false;
  if (!trainingHostCommands.includes(input.type)) return false;
  if (input.type === 'abort' && !['back', 'exit', 'unmount'].includes(input.reason)) return false;
  return input.type !== 'prepare' || Object.hasOwn(input, 'config');
}

export function CreateTrainingHostConnect({ runId, sessionNonce, moduleId }) {
  if (!IsOpaqueIdentifier(runId)
    || !IsValidSessionNonce(sessionNonce)
    || !IsTrainingModuleId(moduleId)) {
    throw new TypeError('A valid run id, session nonce, and module id are required.');
  }
  return Object.freeze({
    schema: trainingHostConnectSchemaValue,
    type: 'connect',
    runId,
    sessionNonce,
    moduleId,
    protocolVersion: trainingHostProtocolVersionValue,
  });
}

export function IsTrainingHostConnect(input) {
  return IsRecord(input)
    && input.schema === trainingHostConnectSchemaValue
    && input.type === 'connect'
    && IsOpaqueIdentifier(input.runId)
    && IsValidSessionNonce(input.sessionNonce)
    && IsTrainingModuleId(input.moduleId)
    && input.protocolVersion === trainingHostProtocolVersionValue;
}

export function IsTrainingHostReady(input) {
  return IsRecord(input)
    && input.schema === trainingHostMessageSchemaValue
    && input.type === 'iframe-ready'
    && input.protocolVersion === trainingHostProtocolVersionValue
    && IsTrainingModuleId(input.moduleId)
    && IsNonEmptyString(input.hostVersion);
}

export function IsTrainingHostEvent(input, expected = {}) {
  if (!IsRecord(input)
    || input.schema !== trainingProtocolSchema
    || !IsValidSessionNonce(input.sessionNonce)
    || !IsTrainingModuleId(input.moduleId)
    || !IsFiniteInteger(input.sequence)
    || input.sequence < 1
    || !IsTrainingHostEventPayload(input.payload, input.moduleId)) {
    return false;
  }
  if (expected.sessionNonce !== undefined && input.sessionNonce !== expected.sessionNonce) return false;
  if (expected.moduleId !== undefined && input.moduleId !== expected.moduleId) return false;

  const event = input.payload;
  if (expected.runId !== undefined && event.runId !== expected.runId) return false;
  if (event.type === 'preload-progress') {
    return IsOpaqueIdentifier(event.runId)
      && IsOpaqueIdentifier(event.commandId)
      && Number.isFinite(event.progress) && event.progress >= 0 && event.progress <= 1;
  }
  if (event.type === 'completed' || event.type === 'aborted') {
    return IsTrainingRunResult(event.result)
      && event.result.moduleId === input.moduleId
      && IsOpaqueIdentifier(event.runId);
  }
  if (event.type === 'failed') {
    return IsOpaqueIdentifier(event.runId) && IsNonEmptyString(event.errorCode);
  }
  if (event.type === 'iframe-ready') return false;
  return IsOpaqueIdentifier(event.runId)
    && IsNonEmptyString(event.commandId);
}

export function CreateTrainingHostEnvelope({ sessionNonce, moduleId, sequence, payload }) {
  if (!IsValidSessionNonce(sessionNonce)
    || !IsTrainingModuleId(moduleId)
    || !IsTrainingHostEventPayload(payload, moduleId)) {
    throw new TypeError('A valid training host event payload is required.');
  }
  return CreateTrainingEnvelope({ sessionNonce, moduleId, sequence, payload });
}

export function CanTransitionTrainingHostState(state, event) {
  return IsTrainingHostState(state)
    && IsNonEmptyString(event)
    && Object.hasOwn(trainingHostStateTransitions[state], event);
}

export function TransitionTrainingHostState(state, event) {
  if (!CanTransitionTrainingHostState(state, event)) {
    throw new TypeError(`Invalid training host state transition: ${state} + ${event}.`);
  }
  return trainingHostStateTransitions[state][event];
}

function IsRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function IsNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function IsOpaqueIdentifier(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}

function IsTrainingHostState(value) {
  return typeof value === 'string' && Object.hasOwn(trainingHostStateTransitions, value);
}

function IsValidSessionNonce(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9._~-]{16,128}$/.test(value);
}

function IsFiniteInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function AreSameSequence(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function IsPlatformAssetPath(value) {
  return /^\/runtime-assets\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/[a-f0-9]{64}\/(?:[^/]+\/)*[^/]+$/i.test(value);
}

function IsTrainingRunResult(value) {
  return IsRecord(value)
    && value.schemaVersion === 1
    && IsTrainingModuleId(value.moduleId)
    && IsNonEmptyString(value.moduleVersion)
    && ['completed', 'aborted'].includes(value.status)
    && typeof value.startedAt === 'string'
    && !Number.isNaN(Date.parse(value.startedAt))
    && IsFiniteInteger(value.durationMs)
    && value.durationMs >= 0
    && IsFiniteInteger(value.trialCount)
    && value.trialCount >= 0
    && (value.score === undefined || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && IsSafeMetricRecord(value.metrics);
}

function IsTrainingHostEventPayload(payload, moduleId) {
  if (!IsRecord(payload) || !trainingHostEventTypes.includes(payload.type)) return false;
  if (payload.type === 'iframe-ready') return false;
  if (payload.type === 'completed' || payload.type === 'aborted') {
    return IsOpaqueIdentifier(payload.runId)
      && IsTrainingRunResult(payload.result)
      && payload.result.moduleId === moduleId;
  }
  if (payload.type === 'failed') {
    return IsOpaqueIdentifier(payload.runId) && IsNonEmptyString(payload.errorCode);
  }
  return IsOpaqueIdentifier(payload.runId)
    && IsOpaqueIdentifier(payload.commandId)
    && (payload.type !== 'preload-progress'
      || (Number.isFinite(payload.progress) && payload.progress >= 0 && payload.progress <= 1));
}

function IsSafeMetricRecord(value) {
  if (!IsRecord(value)) return false;
  const sanitized = SanitizeTrainingMetrics(value);
  const entries = Object.entries(value);
  const sanitizedEntries = Object.entries(sanitized);
  if (entries.length !== sanitizedEntries.length) return false;
  return entries.every(([key, metric]) => sanitized[key] === metric);
}

function FreezeManifest(input) {
  const manifest = {
    ...input,
    capabilities: Object.freeze([...input.capabilities]),
    flow: Object.freeze([...input.flow]),
    lifecycle: Object.freeze({ ...input.lifecycle }),
    pwa: Object.freeze({ ...input.pwa, iconAssetIds: Object.freeze([...input.pwa.iconAssetIds]) }),
    assets: Object.freeze(input.assets.map((asset) => Object.freeze({ ...asset }))),
  };
  return Object.freeze(manifest);
}

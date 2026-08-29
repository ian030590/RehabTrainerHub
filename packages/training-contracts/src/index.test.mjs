import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssertTrainingModuleManifest,
  gamePlatformCapabilities,
  gamePlatformMaxUploadBytes,
  gamePlatformPackageLimits,
  gamePlatformRuntimeContract,
  CanTransitionTrainingHostState,
  CreateTrainingEnvelope,
  CreateTrainingHostConnect,
  CreateTrainingHostEnvelope,
  CreateTrainingModuleId,
  IsTrainingHostConnect,
  IsTrainingHostEvent,
  IsTrainingHostCommand,
  IsTrainingModuleId,
  SanitizeTrainingMetrics,
  TransitionTrainingHostState,
  ValidateTrainingModuleManifest,
  ValidateTrainingEnvelope,
} from './index.js';

test('keeps the game capability and runtime contract renderer-independent', () => {
  assert.deepEqual(gamePlatformCapabilities, [
    'audio',
    'fullscreen',
    'gamepad',
    'keyboard',
    'pointer',
    'touch',
  ]);
  assert.deepEqual(gamePlatformRuntimeContract, {
    jsPsychVersion: '8.2.3',
    jsPsychUrl: '/runtime/jspsych-8.2.3.js',
    jsPsychCssUrl: '/runtime/jspsych-8.2.3.css',
    gameSdkVersion: '0.1.0',
    gameSdkUrl: '/runtime/trainerhub-game-sdk-0.1.0.js',
  });
  assert.equal(gamePlatformMaxUploadBytes, 12 * 1024 * 1024);
  assert.deepEqual(gamePlatformPackageLimits, {
    maximumCompressedBytes: 12 * 1024 * 1024,
    maximumFileBytes: 8 * 1024 * 1024,
    maximumFileCount: 192,
    maximumFindingCount: 200,
    maximumTextLineLength: 5000,
    maximumTotalBytes: 24 * 1024 * 1024,
    maximumTotalTextBytes: 4 * 1024 * 1024,
    maximumZipRatio: 100,
  });
});

const validManifest = {
  schemaVersion: 1,
  id: 'motor:drawing-defense',
  implementationVersion: '1.0.0',
  purposeId: 'upper-limb',
  catalogOrder: 0,
  titleKey: 'training.drawing.title',
  descriptionKey: 'training.drawing.desc',
  themeToken: 'upper-limb',
  capabilities: ['pointer', 'keyboard'],
  flow: ['card', 'config', 'rules', 'training', 'results'],
  lifecycle: { owner: 'jspsych', mode: 'native-timeline' },
  pwa: {
    installable: true,
    shortNameKey: 'training.drawing.shortName',
    orientation: 'any',
    iconAssetIds: ['brand-motor'],
  },
  assets: [{
    id: 'engine',
    version: '1.0.0',
    path: '/runtime-assets/motor/1.0.0/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/engine.js',
    byteSize: 12,
    sha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    contentType: 'text/javascript',
    offline: 'optional',
  }],
};

test('validates and freezes a complete module manifest', () => {
  const result = ValidateTrainingModuleManifest(validManifest);
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(result.value.assets[0]), true);
  assert.equal(AssertTrainingModuleManifest(validManifest).id, 'motor:drawing-defense');
});

test('rejects an unscoped asset URL and invalid lifecycle', () => {
  const result = ValidateTrainingModuleManifest({
    ...validManifest,
    lifecycle: { owner: 'host', mode: 'native-timeline' },
    assets: [{ ...validManifest.assets[0], path: 'https://example.test/engine.js' }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === 'lifecycle.owner'));
  assert.ok(result.issues.some((issue) => issue.path === 'assets[0].path'));
});

test('validates module ids and filters sensitive metrics', () => {
  assert.equal(IsTrainingModuleId(CreateTrainingModuleId('vision', 'moving-card')), true);
  assert.equal(IsTrainingModuleId('vision:Bad Slug'), false);
  assert.deepEqual(SanitizeTrainingMetrics({ score: 3, userId: 'secret', email: 'x', valid: true }), {
    score: 3,
    valid: true,
  });
});

test('rejects unsafe host identifiers and unfiltered result metrics', () => {
  assert.equal(IsTrainingHostCommand({ runId: 'run with spaces', commandId: 'cmd-1', type: 'start' }), false);
  assert.equal(IsTrainingHostCommand({ runId: 'run-1', commandId: 'cmd-1', type: 'start', extra: 'ignored' }), true);

  assert.throws(() => CreateTrainingHostEnvelope({
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
    sequence: 1,
    payload: {
      type: 'completed',
      runId: 'run-1',
      result: {
        schemaVersion: 1,
        moduleId: 'motor:drawing-defense',
        moduleVersion: '1.0.0',
        status: 'completed',
        startedAt: new Date(0).toISOString(),
        durationMs: 20,
        trialCount: 1,
        metrics: { email: 'should-not-cross-the-boundary' },
      },
    },
  }));

  const completed = CreateTrainingEnvelope({
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
    sequence: 1,
    payload: {
      type: 'completed',
      runId: 'run-1',
      result: {
        schemaVersion: 1,
        moduleId: 'motor:drawing-defense',
        moduleVersion: '1.0.0',
        status: 'completed',
        startedAt: new Date(0).toISOString(),
        durationMs: 20,
        trialCount: 1,
        metrics: { email: 'should-not-cross-the-boundary' },
      },
    },
  });
  assert.equal(IsTrainingHostEvent(completed, {
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
    runId: 'run-1',
  }), false);
});

test('enforces monotonic envelope fields and command correlation shape', () => {
  const envelope = CreateTrainingEnvelope({
    sessionNonce: 'nonce-1',
    moduleId: 'brain:ufov',
    sequence: 1,
    payload: { type: 'iframe-ready' },
  });
  assert.equal(ValidateTrainingEnvelope(envelope).ok, true);
  assert.equal(ValidateTrainingEnvelope({ ...envelope, sequence: 0 }).ok, false);
  assert.equal(IsTrainingHostCommand({ runId: 'run-1', commandId: 'cmd-1', type: 'start' }), true);
  assert.equal(IsTrainingHostCommand({ runId: 'run-1', commandId: 'cmd-1', type: 'abort', reason: 'error' }), false);
});

test('binds official host handshake and events to one run', () => {
  const connect = CreateTrainingHostConnect({
    runId: 'run-1',
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
  });
  assert.equal(IsTrainingHostConnect(connect), true);
  assert.equal(IsTrainingHostConnect({ ...connect, moduleId: 'brain:ufov' }), true);

  const completed = CreateTrainingHostEnvelope({
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
    sequence: 1,
    payload: {
      type: 'completed',
      runId: 'run-1',
      result: {
        schemaVersion: 1,
        moduleId: 'motor:drawing-defense',
        moduleVersion: '1.0.0',
        status: 'completed',
        startedAt: new Date(0).toISOString(),
        durationMs: 20,
        trialCount: 1,
        metrics: { score: 1 },
      },
    },
  });
  assert.equal(IsTrainingHostEvent(completed, {
    sessionNonce: 'nonce-1234567890123456',
    moduleId: 'motor:drawing-defense',
    runId: 'run-1',
  }), true);
  assert.equal(IsTrainingHostEvent({ ...completed, sequence: 1 }, {
    sessionNonce: 'other-1234567890123456',
    moduleId: 'motor:drawing-defense',
    runId: 'run-1',
  }), false);
});

test('keeps host lifecycle transitions explicit and terminal', () => {
  assert.equal(CanTransitionTrainingHostState('card', 'open'), true);
  assert.equal(TransitionTrainingHostState('card', 'open'), 'configuring');
  assert.equal(TransitionTrainingHostState('running', 'abort'), 'aborting');
  assert.equal(CanTransitionTrainingHostState('disposed', 'start'), false);
  assert.throws(() => TransitionTrainingHostState('disposed', 'start'));
});

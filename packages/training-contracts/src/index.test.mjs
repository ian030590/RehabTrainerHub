import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AssertTrainingModuleManifest,
  gamePlatformCapabilities,
  gamePlatformMaxUploadBytes,
  gamePlatformPackageLimits,
  gamePlatformRuntimeContract,
  gamePlatformLicenses,
  offlinePackLimits,
  GetGamePlatformLicense,
  IsPublishableGameLicense,
  CanTransitionTrainingHostState,
  CreateTrainingEnvelope,
  CreateTrainingHostConnect,
  CreateTrainingHostEnvelope,
  CreateTrainingModuleId,
  IsTrainingHostConnect,
  IsTrainingHostEvent,
  IsTrainingHostCommand,
  IsTrainingModuleId,
  CreateSingleFlightPreloadCache,
  SanitizeTrainingMetrics,
  CreateTrainingRunResult,
  IsTrainingRunResult,
  TransitionTrainingHostState,
  ValidateTrainingModuleManifest,
  ValidateTrainingEnvelope,
  CanonicalizeGameScanReport,
  CanApplyGameScanReport,
  CreateGameScanReport,
  CreateGameScanReportDigest,
  CreateGameValidationJob,
  CreateGameValidationJobKey,
  CreateGameValidationQueueMessage,
  CreateGameValidationResultMessage,
  IsGameScanReportForJob,
  IsGameValidationQueueMessage,
  IsSignedGameScanReport,
  ValidateUnsignedGameScanEvidence,
  VerifySignedGameScanReport,
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
  assert.equal(GetGamePlatformLicense('MIT'), gamePlatformLicenses[1]);
  assert.equal(GetGamePlatformLicense('unknown'), null);
  assert.equal(IsPublishableGameLicense('MIT'), true);
  assert.equal(IsPublishableGameLicense('not-declared'), false);
  assert.equal(Object.isFrozen(gamePlatformLicenses), true);
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
  assert.deepEqual(offlinePackLimits, {
    maximumResourceCount: 512,
    maximumTotalBytes: 256 * 1024 * 1024,
  });
  assert.equal(Object.isFrozen(offlinePackLimits), true);
});

test('keeps the training result record allowlist dependency-free and ordered', async () => {
  const contracts = await import('./index.js');
  assert.deepEqual([...contracts.trainingRunResultFields], [
    'schemaVersion',
    'moduleId',
    'moduleVersion',
    'status',
    'startedAt',
    'durationMs',
    'trialCount',
    'score',
    'metrics',
  ]);
  assert.equal(Object.isFrozen(contracts.trainingRunResultFields), true);
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

test('creates one normalized run-result envelope for every lifecycle owner', () => {
  const result = CreateTrainingRunResult({
    moduleId: 'vision:moving-card',
    moduleVersion: '1.0.0',
    status: 'completed',
    startedAt: new Date(0).toISOString(),
    durationMs: 123,
    trialCount: 5,
    score: 4,
    metrics: { accuracy: 0.8, userId: 'must-not-cross' },
  });
  assert.deepEqual(result, {
    schemaVersion: 1,
    moduleId: 'vision:moving-card',
    moduleVersion: '1.0.0',
    status: 'completed',
    startedAt: new Date(0).toISOString(),
    durationMs: 123,
    trialCount: 5,
    score: 4,
    metrics: { accuracy: 0.8 },
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(IsTrainingRunResult(result), true);
  assert.equal(IsTrainingRunResult({ ...result, metrics: { userId: 'secret' } }), false);
  assert.throws(
    () => CreateTrainingRunResult({
      moduleId: 'vision:moving-card',
      moduleVersion: '1.0.0',
      status: 'completed',
      durationMs: -1,
    }),
    /durationMs/,
  );
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

test('deduplicates rules-visible preloads and disposes a retained resource once', async () => {
  const cache = CreateSingleFlightPreloadCache();
  let loadCount = 0;
  let disposeCount = 0;
  const first = cache.load('vision:moving-card', async (signal) => {
    loadCount += 1;
    assert.equal(signal.aborted, false);
    return { engine: 'pixi' };
  }, { dispose: () => { disposeCount += 1; } });
  const second = cache.load('vision:moving-card', () => {
    loadCount += 1;
    return { engine: 'duplicate' };
  });

  assert.equal(first, second);
  assert.deepEqual(await first, { engine: 'pixi' });
  assert.equal(loadCount, 1);
  assert.equal(cache.has('vision:moving-card'), true);
  assert.equal(cache.clear('vision:moving-card'), true);
  assert.equal(disposeCount, 1);
  assert.equal(cache.has('vision:moving-card'), false);
});

test('aborts an in-flight preload and does not start a second loader', async () => {
  const cache = CreateSingleFlightPreloadCache();
  let loadCount = 0;
  let observedSignal;
  let resolveLoader;
  const first = cache.load('vision:oculomotor-training', (signal) => {
    loadCount += 1;
    observedSignal = signal;
    return new Promise((resolve) => { resolveLoader = resolve; });
  });
  const second = cache.load('vision:oculomotor-training', () => {
    loadCount += 1;
    return 'duplicate';
  });
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(loadCount, 1);
  assert.equal(cache.abort('vision:oculomotor-training', 'rules-closed'), true);
  assert.equal(observedSignal.aborted, true);
  resolveLoader('late-engine');
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(cache.has('vision:oculomotor-training'), false);
});

test('superseding a loaded preload disposes the previous module before replacement', async () => {
  const cache = CreateSingleFlightPreloadCache();
  const disposed = [];
  await cache.load('vision:moving-card', () => 'moving-card', {
    dispose: (value) => disposed.push(value),
  });
  await cache.load('vision:gabor-patching', () => 'gabor-patching', {
    dispose: (value) => disposed.push(value),
  });
  assert.deepEqual(disposed, ['moving-card']);
  assert.equal(cache.has('vision:gabor-patching'), true);
});

test('bounds validator evidence, binds reports to one attempt, and canonicalizes signing input', async () => {
  const job = {
    jobId: 'job-1',
    attempt: 2,
    jobNonce: 'nonce-1234567890123456',
    submissionId: 'submission-1',
    artifactSha256: 'a'.repeat(64),
    policyVersion: 'validator-v1',
    limitsProfile: 'uploaded-game-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T01:00:00.000Z',
  };
  const evidence = {
    schemaVersion: 1,
    jobId: job.jobId,
    attempt: job.attempt,
    jobNonce: job.jobNonce,
    artifactSha256: job.artifactSha256,
    observedNetworkAttempts: [{
      kind: 'fetch',
      targetClass: 'external-origin',
      targetSample: 'https://example.invalid',
      count: 1,
    }],
    findings: [{
      disposition: 'fix-or-manual-review',
      code: 'network-fetch',
      filePath: 'index.html',
      line: 4,
      column: 1,
      messageKey: 'game.validation.networkFetch',
    }],
    truncated: false,
  };
  assert.equal(ValidateUnsignedGameScanEvidence(evidence, job).ok, true);
  const report = CreateGameScanReport({
    job,
    evidence,
    toolVersions: { zeta: '2.0', alpha: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  assert.equal(report.verdict, 'manual-review-eligible');
  assert.deepEqual(report.observedNetworkAttempts, evidence.observedNetworkAttempts);
  assert.equal(Object.isFrozen(report.observedNetworkAttempts), true);
  assert.equal(IsGameScanReportForJob(report, job, Date.parse(job.issuedAt)), true);
  assert.equal(IsGameScanReportForJob(report, { ...job, attempt: 1 }, Date.parse(job.issuedAt)), false);
  assert.match(CanonicalizeGameScanReport(report), /"alpha":"1.0".*"zeta":"2.0"/);
  assert.match(await CreateGameScanReportDigest(report), /^[a-f0-9]{64}$/);
  assert.equal(IsSignedGameScanReport({
    report,
    reportSha256: 'b'.repeat(64),
    attestation: { keyId: 'controller-1', algorithm: 'Ed25519', value: 'A'.repeat(32) },
  }), true);
  assert.equal(CreateGameValidationJobKey(job.jobId, job.attempt), 'job-1:2');
});

test('truncated or malformed validator evidence can only produce a hard-block report', () => {
  const job = {
    jobId: 'job-2',
    attempt: 1,
    jobNonce: 'nonce-2234567890123456',
    submissionId: 'submission-2',
    artifactSha256: 'c'.repeat(64),
    policyVersion: 'validator-v1',
    limitsProfile: 'uploaded-game-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T01:00:00.000Z',
  };
  const report = CreateGameScanReport({
    job,
    evidence: {
      schemaVersion: 1,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      artifactSha256: job.artifactSha256,
      observedNetworkAttempts: [],
      findings: [],
      truncated: true,
    },
    toolVersions: { validator: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  assert.equal(report.verdict, 'hard-block');
  assert.equal(report.findings[0].code, 'validator-truncated');
});

test('queue messages are bounded, path-safe, and idempotent by job attempt', () => {
  const job = CreateGameValidationJob({
    jobId: 'job-queue-1',
    attempt: 3,
    jobNonce: 'nonce-queue-123456',
    submissionId: 'submission-queue-1',
    artifactSha256: 'd'.repeat(64),
    policyVersion: 'validator-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T00:15:00.000Z',
  });
  const message = CreateGameValidationQueueMessage({
    job,
    artifactKey: 'quarantine/developer-1/release-1/digest/artifact',
    fileKeys: ['quarantine/developer-1/release-1/digest/files/index.html'],
    enqueuedAt: '2026-08-29T00:00:01.000Z',
  });
  assert.equal(message.key, 'job-queue-1:3');
  assert.equal(IsGameValidationQueueMessage(message), true);
  assert.equal(Object.isFrozen(message), true);
  assert.equal(Object.isFrozen(message.fileKeys), true);
  assert.throws(() => CreateGameValidationQueueMessage({
    job,
    artifactKey: '../escape',
    fileKeys: ['quarantine/developer-1/release-1/digest/files/index.html'],
  }), /bounded contract/);
});

test('result envelopes are bounded and reuse the exact job/report identity', async () => {
  const job = CreateGameValidationJob({
    jobId: 'job-result-1',
    attempt: 1,
    jobNonce: 'nonce-result-123456',
    submissionId: 'submission-result-1',
    artifactSha256: '1'.repeat(64),
    policyVersion: 'validator-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T01:00:00.000Z',
  });
  const report = CreateGameScanReport({
    job,
    evidence: {
      schemaVersion: 1,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      artifactSha256: job.artifactSha256,
      observedNetworkAttempts: [],
      findings: [],
      truncated: false,
    },
    toolVersions: { controller: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  const message = CreateGameValidationResultMessage({
    job,
    signedReport: {
      report,
      reportSha256: await CreateGameScanReportDigest(report),
      attestation: { keyId: 'controller-1', algorithm: 'Ed25519', value: 'A'.repeat(32) },
    },
    receivedAt: '2026-08-29T00:10:01.000Z',
  });
  assert.equal(message.type, 'scan-result');
  assert.equal(IsSignedGameScanReport(message.signedReport), true);
  assert.equal(Object.isFrozen(message), true);
  assert.throws(() => CreateGameValidationResultMessage({
    job,
    signedReport: {
      ...message.signedReport,
      report: { ...report, jobId: 'different-job' },
    },
  }), /bounded contract/);
});

test('report application requires a live CAS row and matching nonce/hash', () => {
  const job = {
    jobId: 'job-cas-1',
    attempt: 1,
    jobNonce: 'nonce-cas-123456',
    submissionId: 'submission-cas-1',
    artifactSha256: 'e'.repeat(64),
    policyVersion: 'validator-v1',
    limitsProfile: 'uploaded-game-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T01:00:00.000Z',
  };
  const report = CreateGameScanReport({
    job,
    evidence: {
      schemaVersion: 1,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      artifactSha256: job.artifactSha256,
      observedNetworkAttempts: [],
      findings: [],
      truncated: false,
    },
    toolVersions: { validator: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  assert.equal(CanApplyGameScanReport({
    currentStatus: 'running',
    currentJobNonce: job.jobNonce,
    currentArtifactSha256: job.artifactSha256,
    job,
    report,
    now: Date.parse('2026-08-29T00:10:00.000Z'),
  }), true);
  assert.equal(CanApplyGameScanReport({
    currentStatus: 'passed',
    currentJobNonce: job.jobNonce,
    currentArtifactSha256: job.artifactSha256,
    job,
    report,
  }), false);
  assert.equal(CanApplyGameScanReport({
    currentStatus: 'running',
    currentJobNonce: 'stale-nonce',
    currentArtifactSha256: job.artifactSha256,
    job,
    report,
  }), false);
});

test('controller attestation verifies digest, signature, and key rotation boundaries', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const job = {
    jobId: 'job-sign-1',
    attempt: 1,
    jobNonce: 'nonce-sign-123456',
    submissionId: 'submission-sign-1',
    artifactSha256: 'f'.repeat(64),
    policyVersion: 'validator-v1',
    limitsProfile: 'uploaded-game-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T01:00:00.000Z',
  };
  const report = CreateGameScanReport({
    job,
    evidence: {
      schemaVersion: 1,
      jobId: job.jobId,
      attempt: job.attempt,
      jobNonce: job.jobNonce,
      artifactSha256: job.artifactSha256,
      observedNetworkAttempts: [],
      findings: [],
      truncated: false,
    },
    toolVersions: { controller: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    keyPair.privateKey,
    new TextEncoder().encode(CanonicalizeGameScanReport(report)),
  );
  const encodedSignature = Buffer.from(signature).toString('base64url');
  const signed = {
    report,
    reportSha256: await CreateGameScanReportDigest(report),
    attestation: { keyId: 'controller-1', algorithm: 'Ed25519', value: encodedSignature },
  };
  assert.deepEqual(await VerifySignedGameScanReport(signed, keyPair.publicKey), {
    ok: true,
    keyId: 'controller-1',
  });
  assert.deepEqual(await VerifySignedGameScanReport({
    ...signed,
    reportSha256: '0'.repeat(64),
  }, keyPair.publicKey), { ok: false, code: 'report-digest-mismatch' });
  assert.deepEqual(await VerifySignedGameScanReport(signed, {
    kty: 'OKP',
    crv: 'Ed25519',
    x: 'invalid-public-key',
  }), { ok: false, code: 'invalid-signature' });
});

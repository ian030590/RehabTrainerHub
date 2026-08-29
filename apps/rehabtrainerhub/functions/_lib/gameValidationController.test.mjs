import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CreateEd25519ReportSigner,
  CreateGameValidationController,
  CreateDisposableGameExecutor,
  gameValidationControllerPolicy,
} from './gameValidationController.js';
import {
  CreateGameScanReport,
  CreateGameScanReportDigest,
  CreateGameValidationJob,
  CreateGameValidationQueueMessage,
  IsGameValidationResultMessage,
} from '../../../../packages/training-contracts/src/index.js';

test('controller reads only bound quarantine keys and returns an attested result envelope', async () => {
  const artifactBytes = new TextEncoder().encode('<html>fixture</html>');
  const fileBytes = new TextEncoder().encode('body{}');
  const artifactSha256 = await Digest(artifactBytes);
  const job = CreateGameValidationJob({
    jobId: 'scan-controller-1',
    attempt: 2,
    jobNonce: 'nonce-controller-1',
    submissionId: 'submission-controller-1',
    artifactSha256,
    policyVersion: 'sync-intake-v1',
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const prefix = `quarantine/owner/release/${artifactSha256}`;
  const message = CreateGameValidationQueueMessage({
    job,
    artifactKey: `${prefix}/artifact`,
    fileKeys: [`${prefix}/files/index.html`],
  });
  const objects = new Map([
    [`${prefix}/artifact`, artifactBytes],
    [`${prefix}/files/index.html`, fileBytes],
  ]);
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const controller = CreateGameValidationController({
    quarantineBucket: {
      async get(key) {
        const bytes = objects.get(key);
        return bytes
          ? { size: bytes.byteLength, body: { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } }
          : null;
      },
    },
    execute: async ({ job: currentJob, policy }) => {
      assert.equal(policy.network, gameValidationControllerPolicy.network);
      return {
        schemaVersion: 1,
        jobId: currentJob.jobId,
        attempt: currentJob.attempt,
        jobNonce: currentJob.jobNonce,
        artifactSha256: currentJob.artifactSha256,
        observedNetworkAttempts: [],
        findings: [],
        truncated: false,
      };
    },
    signReport: CreateEd25519ReportSigner({ privateKey: keyPair.privateKey, keyId: 'controller-test' }),
    toolVersions: { static: 'test-1', dynamic: 'test-1' },
    now: () => Date.parse('2026-08-29T00:10:00.000Z'),
  });
  const result = await controller.process(message);
  assert.equal(result.ok, true);
  assert.equal(IsGameValidationResultMessage(result.message), true);
  assert.equal(result.message.signedReport.report.verdict, 'pass');
  assert.match(result.message.signedReport.reportSha256, /^[a-f0-9]{64}$/);
});

test('controller rejects mismatched hash/path and never asks the executor to run', async () => {
  const artifactBytes = new Uint8Array([1, 2, 3]);
  const hash = await Digest(artifactBytes);
  const job = CreateGameValidationJob({
    jobId: 'scan-controller-2',
    attempt: 1,
    jobNonce: 'nonce-controller-2',
    submissionId: 'submission-controller-2',
    artifactSha256: hash,
    policyVersion: 'validator-v1',
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const message = CreateGameValidationQueueMessage({
    job,
    artifactKey: `quarantine/owner/release/${hash}/artifact`,
    fileKeys: [`quarantine/owner/release/${hash}/files/index.html`],
  });
  let executed = false;
  const controller = CreateGameValidationController({
    quarantineBucket: { async get() { return { size: artifactBytes.byteLength, body: { arrayBuffer: async () => artifactBytes } }; } },
    execute: async () => { executed = true; return {}; },
    signReport: async () => ({}),
    toolVersions: { static: 'test-1' },
  });
  const unsafe = await controller.process({
    ...message,
    artifactKey: `quarantine/owner/release/${'f'.repeat(64)}/artifact`,
  });
  assert.deepEqual(unsafe, { ok: false, code: 'unsafe-artifact-key' });
  assert.equal(executed, false);
});

test('disposable executor fails closed to manual review when dynamic smoke is not deployed', async () => {
  const job = CreateGameValidationJob({
    jobId: 'scan-controller-3',
    attempt: 1,
    jobNonce: 'nonce-controller-3',
    submissionId: 'submission-controller-3',
    artifactSha256: 'a'.repeat(64),
    policyVersion: 'validator-v1',
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const execute = CreateDisposableGameExecutor({
    inspect: async () => ({ findings: [] }),
  });
  const evidence = await execute({ job, artifactBytes: new Uint8Array([1]), files: new Map() });
  assert.equal(evidence.findings.some((finding) => finding.code === 'dynamic-smoke-not-run'), true);
  const report = CreateGameScanReport({
    job,
    evidence,
    toolVersions: { static: 'test-1' },
  });
  assert.equal(report.verdict, 'manual-review-eligible');
  assert.match(await CreateGameScanReportDigest(report), /^[a-f0-9]{64}$/);
});

test('disposable executor turns observed external or opaque network attempts into hard blocks', async () => {
  const job = CreateGameValidationJob({
    jobId: 'scan-controller-4',
    attempt: 1,
    jobNonce: 'nonce-controller-4',
    submissionId: 'submission-controller-4',
    artifactSha256: 'b'.repeat(64),
    policyVersion: 'validator-v1',
    issuedAt: new Date(Date.now() - 1_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const execute = CreateDisposableGameExecutor({
    inspect: async () => ({ findings: [] }),
    dynamicSmoke: async () => ({
      observedNetworkAttempts: [{
        kind: 'fetch',
        targetClass: 'external-origin',
        targetSample: 'https://outside.invalid/collect',
        count: 1,
      }],
      findings: [],
      truncated: false,
    }),
  });
  const evidence = await execute({ job, artifactBytes: new Uint8Array([1]), files: new Map() });
  assert.equal(evidence.findings.some((finding) => finding.code === 'network-attempt-observed'), true);
  const report = CreateGameScanReport({ job, evidence, toolVersions: { dynamic: 'test-1' } });
  assert.equal(report.verdict, 'hard-block');
});

async function Digest(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

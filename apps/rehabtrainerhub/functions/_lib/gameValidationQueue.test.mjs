import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApplyGameScanReport,
  BuildGameValidationJob,
  BuildGameValidationQueueMessage,
  ClaimGameValidationScanRun,
  EnqueueGameValidationJob,
  IsGameValidationQueueConfigured,
  MarkGameValidationQueueFailure,
} from './gameValidationQueue.js';
import { CreateGameScanReport } from '../../../../packages/training-contracts/src/index.js';

test('builds an expiring queue message without credentials or unsafe paths', () => {
  const job = BuildGameValidationJob({
    scanRunId: 'scan-queue-1',
    attempt: 1,
    submissionId: 'submission-queue-1',
    artifactSha256: 'a'.repeat(64),
    policyVersion: 'sync-intake-v1',
    issuedAt: '2026-08-29T00:00:00.000Z',
    expiresAt: '2026-08-29T00:15:00.000Z',
  });
  const message = BuildGameValidationQueueMessage({
    job,
    artifactKey: 'quarantine/owner/release/digest/artifact',
    fileKeys: ['quarantine/owner/release/digest/files/index.html'],
    enqueuedAt: '2026-08-29T00:00:02.000Z',
  });
  assert.equal(message.key, 'scan-queue-1:1');
  assert.equal(Object.hasOwn(message, 'token'), false);
  assert.equal(Object.hasOwn(message, 'authorization'), false);
  assert.equal(IsGameValidationQueueConfigured({ GAME_VALIDATION_QUEUE: { send() {} } }), true);
  assert.equal(IsGameValidationQueueConfigured({}), false);
});

test('queue producer fails closed when the binding is absent', async () => {
  await assert.rejects(
    EnqueueGameValidationJob(null, { schema: 'invalid' }),
    (error) => error?.code === 'validation-queue-unavailable',
  );
});

test('claim and report application use nonce/hash/status compare-and-set', async () => {
  const job = BuildGameValidationJob({
    scanRunId: 'scan-cas-1',
    attempt: 1,
    submissionId: 'submission-cas-1',
    artifactSha256: 'b'.repeat(64),
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
    toolVersions: { executor: '1.0' },
    completedAt: '2026-08-29T00:10:00.000Z',
  });
  const db = CreateDb({ status: 'queued', job_nonce: job.jobNonce, artifact_sha256: job.artifactSha256 });
  assert.equal(await ClaimGameValidationScanRun(db, job, '2026-08-29T00:01:00.000Z'), true);
  assert.deepEqual(await ApplyGameScanReport(db, {
    job,
    report,
    reportSha256: await Digest(report),
  }, Date.parse('2026-08-29T00:10:00.000Z')), {
    ok: true,
    status: 'passed',
    reportSha256: await Digest(report),
  });

  const staleDb = CreateDb({ status: 'passed', job_nonce: job.jobNonce, artifact_sha256: job.artifactSha256 });
  assert.deepEqual(await ApplyGameScanReport(staleDb, {
    job,
    report,
    reportSha256: await Digest(report),
  }, Date.parse('2026-08-29T00:10:00.000Z')), { ok: false, code: 'stale-report' });
  assert.equal(await MarkGameValidationQueueFailure(staleDb, job.jobId, job.jobNonce, 'timeout'), false);
});

async function Digest(report) {
  const { CreateGameScanReportDigest } = await import('../../../../packages/training-contracts/src/index.js');
  return CreateGameScanReportDigest(report);
}

function CreateDb(current) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async first() {
              if (/SELECT game_scan_runs\.status/i.test(sql)) return current;
              return null;
            },
            async run() {
              return { success: true, meta: { changes: current.status === 'passed' ? 0 : 1 } };
            },
          };
        },
      };
    },
    async batch(statements) {
      return (statements || []).map((statement, index) => ({
        success: true,
        meta: { changes: index === 0 && current.status !== 'passed' ? 1 : 0 },
      }));
    },
  };
}

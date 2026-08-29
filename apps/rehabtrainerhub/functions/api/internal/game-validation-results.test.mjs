import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost } from './game-validation-results.js';
import {
  CanonicalizeGameScanReport,
  CreateGameScanReport,
  CreateGameScanReportDigest,
  CreateGameValidationJob,
} from '../../../../../packages/training-contracts/src/index.js';

test('controller result endpoint rejects unauthenticated and mismatched reports', async () => {
  const unsigned = await onRequestPost({
    request: new Request('https://trainerhub.cc/api/internal/game-validation-results', { method: 'POST', body: '{}' }),
    env: { GAME_VALIDATION_RESULT_TOKEN: 'controller-secret' },
  });
  assert.equal(unsigned.status, 401);

  const job = CreateJob();
  const report = CreateReport(job);
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const signedReport = await SignReport(report, keyPair.privateKey);
  const request = CreateRequest({
    job: { ...job, artifactSha256: 'b'.repeat(64) },
    signedReport,
  });
  const response = await onRequestPost({
    request,
    env: {
      GAME_VALIDATION_RESULT_TOKEN: 'controller-secret',
      GAME_VALIDATION_ATTESTATION_KEYS_JSON: JSON.stringify({ controller: await crypto.subtle.exportKey('jwk', keyPair.publicKey) }),
      REHAB_DB: CreateDb(job),
    },
  });
  assert.equal(response.status, 409);
});

test('controller result endpoint verifies attestation and applies one report', async () => {
  const job = CreateJob();
  const report = CreateReport(job);
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const signedReport = await SignReport(report, keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const db = CreateDb(job);
  const response = await onRequestPost({
    request: CreateRequest({ job, signedReport }),
    env: {
      GAME_VALIDATION_RESULT_TOKEN: 'controller-secret',
      GAME_VALIDATION_ATTESTATION_KEYS_JSON: JSON.stringify({ controller: publicJwk }),
      REHAB_DB: db,
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'passed');
  assert.ok(db.calls.some((call) => /INSERT INTO game_scan_reports/i.test(call.sql)));
});

function CreateJob() {
  const issuedAtMs = Date.now() - 60_000;
  return CreateGameValidationJob({
    jobId: 'scan-internal-1',
    attempt: 1,
    jobNonce: 'nonce-internal-123456',
    submissionId: 'submission-internal-1',
    artifactSha256: 'a'.repeat(64),
    policyVersion: 'validator-v1',
    issuedAt: new Date(issuedAtMs).toISOString(),
    expiresAt: new Date(issuedAtMs + 15 * 60_000).toISOString(),
  });
}

function CreateReport(job) {
  return CreateGameScanReport({
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
    completedAt: new Date().toISOString(),
  });
}

async function SignReport(report, privateKey) {
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(CanonicalizeGameScanReport(report)),
  );
  return {
    report,
    reportSha256: await CreateGameScanReportDigest(report),
    attestation: { keyId: 'controller', algorithm: 'Ed25519', value: Buffer.from(signature).toString('base64url') },
  };
}

function CreateRequest({ job, signedReport }) {
  return new Request('https://trainerhub.cc/api/internal/game-validation-results', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer controller-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schema: 'trainerhub.game-validation/v1',
      type: 'scan-result',
      job,
      signedReport,
      receivedAt: '2026-08-29T00:10:01.000Z',
    }),
  });
}

function CreateDb(job) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            async first() {
              if (/SELECT game_scan_runs\.status/i.test(sql)) {
                return { status: 'running', job_nonce: job.jobNonce, artifact_sha256: job.artifactSha256 };
              }
              if (/FROM game_scan_runs/i.test(sql)) {
                return {
                  id: job.jobId,
                  submission_id: job.submissionId,
                  attempt: job.attempt,
                  job_nonce: job.jobNonce,
                  artifact_sha256: job.artifactSha256,
                  policy_version: job.policyVersion,
                  queued_at: job.issuedAt,
                };
              }
              if (/FROM game_scan_reports/i.test(sql)) return null;
              return null;
            },
            async run() {
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
    async batch(statements) {
      return (statements || []).map((_, index) => ({
        success: true,
        meta: { changes: index === 0 ? 1 : 0 },
      }));
    },
  };
}

import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RequireDatabase,
} from '../../_lib/auth.js';
import { ReadJsonBody } from '../../_lib/request.js';
import {
  ApplyAttestedGameScanReport,
} from '../../_lib/gameValidationQueue.js';
import {
  CreateGameValidationJob,
  IsGameValidationResultMessage,
  gameValidationLimits,
  gameValidationJobTtlSeconds,
} from '../../../../../packages/training-contracts/src/index.js';

const maximumBodyBytes = gameValidationLimits.maximumTransportBytes;

/**
 * Internal controller callback. It is not a browser/API-auth route: callers
 * need the deployment-only ingest token and a valid Ed25519 attestation key.
 * The report is still bound to the exact D1 scan row before it can change
 * state, so possession of either credential alone is insufficient.
 */
export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  if (!(await IsControllerRequest(request, env))) {
    return ErrorResponse(request, env, 'Controller authentication failed.', 401);
  }
  const body = await ReadJsonBody(request, maximumBodyBytes);
  if (!body.ok || !IsGameValidationResultMessage(body.value)) {
    return ErrorResponse(request, env, 'Invalid validation result envelope.', 400);
  }

  try {
    const db = RequireDatabase(env);
    const stored = await ReadScanRow(db, body.value.job);
    if (!stored) return ErrorResponse(request, env, 'Validation job not found.', 404);
    const expectedJob = CreateGameValidationJob({
      jobId: stored.id,
      attempt: stored.attempt,
      jobNonce: stored.job_nonce,
      submissionId: stored.submission_id,
      artifactSha256: stored.artifact_sha256,
      policyVersion: stored.policy_version,
      issuedAt: stored.queued_at,
      expiresAt: new Date(Date.parse(stored.queued_at) + gameValidationJobTtlSeconds * 1000).toISOString(),
    });
    if (!IsMatchingJob(body.value.job, expectedJob)) {
      return ErrorResponse(request, env, 'Validation result does not match the stored job.', 409);
    }

    const existingReport = await ReadExistingScanReport(db, expectedJob.jobId);
    if (existingReport) {
      return existingReport.report_sha256.toLowerCase() === body.value.signedReport.reportSha256.toLowerCase()
        ? JsonResponse(request, env, { status: 'already-applied', reportSha256: existingReport.report_sha256 })
        : ErrorResponse(request, env, 'A different report is already recorded for this job.', 409);
    }

    const publicKey = ReadAttestationKey(env, body.value.signedReport.attestation.keyId);
    if (!publicKey) return ErrorResponse(request, env, 'Validation attestation key is unavailable.', 503);
    const result = await ApplyAttestedGameScanReport(db, {
      job: expectedJob,
      signedReport: body.value.signedReport,
      publicKey,
      reportLedger: {
        attestation: body.value.signedReport.attestation,
        attestationAlgorithm: body.value.signedReport.attestation.algorithm,
        attestationKeyId: body.value.signedReport.attestation.keyId,
        receivedAt: body.value.receivedAt,
      },
    });
    if (!result.ok) {
      return ErrorResponse(
        request,
        env,
        result.code === 'stale-report' ? 'Validation result is stale.' : 'Validation result was rejected.',
        result.code === 'stale-report' ? 409 : 400,
      );
    }

    return JsonResponse(request, env, {
      scanRunId: expectedJob.jobId,
      status: result.status,
      reportSha256: result.reportSha256,
    });
  } catch (error) {
    if (/UNIQUE|game_scan_reports/i.test(String(error))) {
      return JsonResponse(request, env, { status: 'already-applied' });
    }
    console.error('Unable to apply controller game validation result.', error);
    return ErrorResponse(request, env, 'Unable to apply validation result.', 500);
  }
}

async function ReadScanRow(db, job) {
  return db
    .prepare(`
      SELECT id, submission_id, attempt, job_nonce, artifact_sha256,
             policy_version, queued_at
      FROM game_scan_runs
      WHERE id = ? AND submission_id = ? AND attempt = ?
      LIMIT 1
    `)
    .bind(job.jobId, job.submissionId, job.attempt)
    .first();
}

async function ReadExistingScanReport(db, scanRunId) {
  return db
    .prepare('SELECT report_sha256 FROM game_scan_reports WHERE scan_run_id = ? LIMIT 1')
    .bind(scanRunId)
    .first();
}

function IsMatchingJob(actual, expected) {
  return actual.jobId === expected.jobId
    && actual.attempt === expected.attempt
    && actual.jobNonce === expected.jobNonce
    && actual.submissionId === expected.submissionId
    && actual.artifactSha256.toLowerCase() === expected.artifactSha256.toLowerCase()
    && actual.policyVersion === expected.policyVersion
    && actual.limitsProfile === expected.limitsProfile
    && actual.issuedAt === expected.issuedAt
    && actual.expiresAt === expected.expiresAt;
}

function ReadAttestationKey(env, keyId) {
  const raw = String(env?.GAME_VALIDATION_ATTESTATION_KEYS_JSON || '').trim();
  if (!raw) return null;
  try {
    const registry = JSON.parse(raw);
    const value = registry && typeof registry === 'object' ? registry[keyId] : null;
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

async function IsControllerRequest(request, env) {
  const configured = String(env?.GAME_VALIDATION_RESULT_TOKEN || '');
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!configured || !match) return false;
  const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(configured)));
  const provided = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(match[1])));
  let difference = expected.length === provided.length ? 0 : 1;
  for (let index = 0; index < Math.min(expected.length, provided.length); index += 1) difference |= expected[index] ^ provided[index];
  return difference === 0;
}

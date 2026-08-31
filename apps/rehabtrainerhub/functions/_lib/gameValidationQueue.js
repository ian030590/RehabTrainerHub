import {
  CanApplyGameScanReport,
  CreateGameScanReportDigest,
  CreateGameValidationJob,
  CreateGameValidationQueueMessage,
  IsGameScanReport,
  IsGameValidationQueueMessage,
  VerifySignedGameScanReport,
} from '../../../../packages/training-contracts/src/index.js';
import { CreateGamePlatformNotificationStatement } from './gameNotifications.js';

const queueFailureCode = 'validation-queue-unavailable';

/**
 * Build the controller job from the D1 scan row. This helper is deliberately
 * free of R2/HTTP access so the exact same envelope can be used by a queue
 * producer, a controller worker, and fixture tests.
 */
export function BuildGameValidationJob({
  scanRunId,
  attempt,
  submissionId,
  artifactSha256,
  policyVersion,
  jobNonce = undefined,
  issuedAt = undefined,
  expiresAt = undefined,
}) {
  return CreateGameValidationJob({
    jobId: scanRunId,
    attempt,
    jobNonce: jobNonce ?? crypto.randomUUID(),
    submissionId,
    artifactSha256,
    policyVersion,
    limitsProfile: 'uploaded-game-v1',
    issuedAt,
    expiresAt,
  });
}

export function BuildGameValidationQueueMessage({ job, artifactKey, fileKeys, enqueuedAt = undefined }) {
  return CreateGameValidationQueueMessage({ job, artifactKey, fileKeys, enqueuedAt });
}

/**
 * Cloudflare Queue is an optional deployment binding. The request path must
 * fail closed when an asynchronous validator is selected but the binding is
 * missing; silently pretending that a request was queued would leave an
 * unvalidated release visible to administrators.
 */
export async function EnqueueGameValidationJob(queue, message) {
  if (!queue || typeof queue.send !== 'function') {
    throw new GameValidationQueueError(queueFailureCode);
  }
  if (!IsGameValidationQueueMessage(message)) {
    throw new TypeError('Invalid game validation queue message.');
  }
  await queue.send(message);
  return { key: message.key };
}

export function IsGameValidationQueueConfigured(env) {
  return Boolean(env?.GAME_VALIDATION_QUEUE && typeof env.GAME_VALIDATION_QUEUE.send === 'function');
}

/**
 * Claim exactly one queued scan run. A stale/replayed queue message cannot
 * move a completed run back to running because the nonce, artifact hash and
 * current status are all part of the compare-and-set predicate.
 */
export async function ClaimGameValidationScanRun(db, job, now = new Date().toISOString()) {
  if (!db || !job) return false;
  const result = await db
    .prepare(`
      UPDATE game_scan_runs
      SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE id = ?
        AND submission_id = ?
        AND attempt = ?
        AND job_nonce = ?
        AND artifact_sha256 = ?
        AND status = 'queued'
    `)
    .bind(
      now,
      now,
      job.jobId,
      job.submissionId,
      job.attempt,
      job.jobNonce,
      job.artifactSha256,
    )
    .run();
  return ReadChangedRows(result) === 1;
}

/**
 * Apply an attested report with a second CAS. The caller is expected to verify
 * the controller signature before invoking this function; this function still
 * validates the bounded report, digest, expiry, nonce and artifact identity.
 */
export async function ApplyGameScanReport(db, {
  job,
  report,
  reportSha256,
  reportLedger = null,
}, now = Date.now()) {
  if (!IsGameScanReport(report)) return { ok: false, code: 'invalid-report' };
  const expectedDigest = await CreateGameScanReportDigest(report);
  if (typeof reportSha256 !== 'string' || reportSha256.toLowerCase() !== expectedDigest) {
    return { ok: false, code: 'report-digest-mismatch' };
  }

  const current = await db
    .prepare(`
      SELECT game_scan_runs.status,
             game_scan_runs.job_nonce,
             game_scan_runs.artifact_sha256,
             game_scan_runs.submission_id,
             submission.owner_user_id,
             submission.game_id,
             release.id AS release_id
      FROM game_scan_runs
      INNER JOIN game_submissions AS submission ON submission.id = game_scan_runs.submission_id
      LEFT JOIN game_releases AS release ON release.submission_id = submission.id
      WHERE game_scan_runs.id = ? AND game_scan_runs.submission_id = ? AND game_scan_runs.attempt = ?
      LIMIT 1
    `)
    .bind(job?.jobId, job?.submissionId, job?.attempt)
    .first();
  if (!current || !CanApplyGameScanReport({
    currentStatus: current.status,
    currentJobNonce: current.job_nonce,
    currentArtifactSha256: current.artifact_sha256,
    job,
    report,
    now,
  })) {
    return { ok: false, code: 'stale-report' };
  }

  const nextStatus = report.verdict === 'pass' ? 'passed' : 'flagged';
  const completedAt = report.completedAt;
  const update = db
    .prepare(`
      UPDATE game_scan_runs
      SET status = ?, report_sha256 = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
        AND submission_id = ?
        AND attempt = ?
        AND status IN ('queued', 'running')
        AND job_nonce = ?
        AND artifact_sha256 = ?
        AND report_sha256 IS NULL
    `)
    .bind(
      nextStatus,
      expectedDigest,
      completedAt,
      new Date().toISOString(),
      job.jobId,
      job.submissionId,
      job.attempt,
      job.jobNonce,
      job.artifactSha256,
    );

  const findingStatements = report.findings.map((finding) => db
    .prepare(`
      INSERT INTO game_validation_findings (
        id, scan_run_id, disposition, code, file_path,
        line_number, column_number, message_key, evidence_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      job.jobId,
      finding.disposition,
      finding.code,
      finding.filePath ?? null,
      finding.line ?? null,
      finding.column ?? null,
      finding.messageKey,
      JSON.stringify({ evidence: finding.evidence ?? null }),
      completedAt,
    ));
  const clearFindings = db
    .prepare('DELETE FROM game_validation_findings WHERE scan_run_id = ?')
    .bind(job.jobId);
  const notification = report.verdict === 'pass' || !current.owner_user_id
    ? null
    : CreateGamePlatformNotificationStatement(db, {
      recipientUserId: current.owner_user_id,
      gameId: current.game_id,
      releaseId: current.release_id || null,
      submissionId: job.submissionId,
      kind: 'validation-failed',
      payload: {
        attempt: job.attempt,
        findingCount: report.findings.length,
        scanRunId: job.jobId,
        verdict: report.verdict,
      },
      createdAt: completedAt,
    });
  const ledger = reportLedger
    ? db
      .prepare(`
        INSERT INTO game_scan_reports (
          id, scan_run_id, submission_id, artifact_sha256, report_sha256,
          attestation_key_id, attestation_algorithm, report_json,
          attestation_json, received_at, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        job.jobId,
        job.submissionId,
        job.artifactSha256,
        expectedDigest,
        reportLedger.attestationKeyId,
        reportLedger.attestationAlgorithm,
        JSON.stringify(report),
        JSON.stringify(reportLedger.attestation),
        reportLedger.receivedAt,
        reportLedger.verifiedAt || new Date().toISOString(),
      )
    : null;
  const batchResult = await db.batch([
    update,
    clearFindings,
    ...findingStatements,
    ...(notification ? [notification] : []),
    ...(ledger ? [ledger] : []),
  ]);
  if (ReadChangedRows(batchResult?.[0]) !== 1) return { ok: false, code: 'stale-report' };
  return { ok: true, status: nextStatus, reportSha256: expectedDigest };
}

export async function ApplyAttestedGameScanReport(db, {
  job,
  signedReport,
  publicKey,
  reportLedger = null,
}, now = Date.now()) {
  const verification = await VerifySignedGameScanReport(signedReport, publicKey);
  if (!verification.ok) return verification;
  return ApplyGameScanReport(db, {
    job,
    report: signedReport.report,
    reportSha256: signedReport.reportSha256,
    reportLedger,
  }, now);
}

export async function MarkGameValidationQueueFailure(db, scanRunId, jobNonce, errorCode, now = new Date().toISOString()) {
  if (!db || !scanRunId || !jobNonce) return false;
  const current = await db
    .prepare(`
      SELECT game_scan_runs.status,
             game_scan_runs.submission_id,
             submission.owner_user_id,
             submission.game_id,
             release.id AS release_id
      FROM game_scan_runs
      INNER JOIN game_submissions AS submission ON submission.id = game_scan_runs.submission_id
      LEFT JOIN game_releases AS release ON release.submission_id = submission.id
      WHERE game_scan_runs.id = ? AND game_scan_runs.job_nonce = ?
      LIMIT 1
    `)
    .bind(scanRunId, jobNonce)
    .first();
  if (!current || current.status !== 'queued') return false;
  const update = db
    .prepare(`
      UPDATE game_scan_runs
      SET status = 'failed', error_code = ?, updated_at = ?
      WHERE id = ? AND job_nonce = ? AND status = 'queued'
    `)
    .bind(errorCode, now, scanRunId, jobNonce);
  const notification = current.owner_user_id
    ? CreateGamePlatformNotificationStatement(db, {
      recipientUserId: current.owner_user_id,
      gameId: current.game_id,
      releaseId: current.release_id || null,
      submissionId: current.submission_id,
      kind: 'validation-failed',
      payload: { errorCode: String(errorCode || 'queue-failed').slice(0, 96), scanRunId },
      createdAt: now,
    })
    : null;
  const results = await db.batch([update, ...(notification ? [notification] : [])]);
  return ReadChangedRows(results?.[0]) === 1;
}

export class GameValidationQueueError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GameValidationQueueError';
    this.code = code;
  }
}

function ReadChangedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

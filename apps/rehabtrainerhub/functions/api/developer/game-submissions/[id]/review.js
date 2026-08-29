import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../../../_lib/auth.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
} from '../../../../_lib/authorization.js';
import {
  CanRequestGameManualReview,
  gameValidationFindingDispositions,
} from '../../../../_lib/gameValidationState.js';
import { ReadJsonBody } from '../../../../_lib/request.js';

const maximumBodyBytes = 16 * 1024;
const maximumReasonLength = 2_000;
const maximumFindingIds = 50;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Request a human review for findings that the scanner marked as potentially
 * recoverable. This endpoint never changes a hard-block into an approvable
 * state; an administrator still has to review the request separately.
 */
export async function onRequestPost({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);

    const body = await ReadJsonBody(request, maximumBodyBytes);
    if (!body.ok) return ErrorResponse(request, env, 'Invalid manual-review payload.', 400);
    const reason = NormalizeReason(body.value?.reason);
    const requestedFindingIds = NormalizeFindingIds(body.value?.findingIds);
    if (!reason || requestedFindingIds === null) {
      return ErrorResponse(request, env, 'A review reason and valid finding IDs are required.', 400);
    }

    const submissionId = NormalizeIdentifier(params?.id);
    if (!submissionId) return ErrorResponse(request, env, 'Invalid submission ID.', 400);
    const db = RequireDatabase(env);
    const submission = await ReadSubmissionForOwner(db, submissionId, user.id);
    if (!submission) return ErrorResponse(request, env, 'Game submission not found.', 404);

    const findings = await ReadFindings(db, submission.scan_run_id);
    const hardBlockCount = findings.filter((finding) => finding.disposition === 'hard-block').length;
    const eligibleFindings = findings.filter((finding) => (
      finding.disposition === 'fix-or-manual-review'
      || finding.disposition === 'manual-review'
    ));
    if (!CanRequestGameManualReview({
      scan: submission.scan_status,
      review: submission.review_status,
      eligibleFindingCount: eligibleFindings.length,
      hasHardBlock: hardBlockCount > 0,
    })) {
      return ErrorResponse(
        request,
        env,
        hardBlockCount > 0
          ? 'A confirmed hard-block cannot be sent for manual approval.'
          : 'This submission is not eligible for manual review.',
        409,
      );
    }

    const eligibleIds = new Set(eligibleFindings.map((finding) => finding.id));
    const findingIds = requestedFindingIds.length > 0
      ? requestedFindingIds
      : eligibleFindings.map((finding) => finding.id);
    if (findingIds.some((findingId) => !eligibleIds.has(findingId))) {
      return ErrorResponse(request, env, 'Only eligible scanner findings may be disputed.', 400);
    }

    const reviewRequestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      db
        .prepare(`
          INSERT INTO game_review_requests (
            id, submission_id, scan_run_id, requester_user_id, reason,
            status, requested_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?)
        `)
        .bind(
          reviewRequestId,
          submission.id,
          submission.scan_run_id,
          user.id,
          reason,
          now,
          now,
          now,
        ),
      CreateAdminAuditStatement(db, {
        actorUserId: user.id,
        action: 'developer_game.manual_review_requested',
        targetType: 'game_submission',
        targetId: submission.id,
        metadata: {
          findingIds,
          reviewRequestId,
          scanRunId: submission.scan_run_id,
        },
      }),
    ];
    await db.batch(statements);

    return JsonResponse(request, env, {
      reviewRequest: {
        id: reviewRequestId,
        submissionId: submission.id,
        scanRunId: submission.scan_run_id,
        findingIds,
        status: 'requested',
        requestedAt: now,
      },
    }, { status: 201 });
  } catch (error) {
    if (/UNIQUE|game_review_requests/i.test(String(error))) {
      return ErrorResponse(request, env, 'A review request is already active for this submission.', 409);
    }
    console.error('Unable to request game manual review.', error);
    return ErrorResponse(request, env, 'Unable to request game manual review.', 500);
  }
}

async function ReadSubmissionForOwner(db, submissionId, ownerUserId) {
  return db
    .prepare(`
      SELECT
        game_submissions.id,
        game_submissions.artifact_sha256,
        game_scan_runs.id AS scan_run_id,
        game_scan_runs.status AS scan_status,
        COALESCE((
          SELECT status
          FROM game_review_requests
          WHERE submission_id = game_submissions.id
          ORDER BY updated_at DESC
          LIMIT 1
        ), 'not_requested') AS review_status
      FROM game_submissions
      LEFT JOIN game_scan_runs
        ON game_scan_runs.submission_id = game_submissions.id
       AND game_scan_runs.attempt = (
         SELECT MAX(latest.attempt)
         FROM game_scan_runs AS latest
         WHERE latest.submission_id = game_submissions.id
       )
      WHERE game_submissions.id = ?
        AND game_submissions.owner_user_id = ?
      LIMIT 1
    `)
    .bind(submissionId, ownerUserId)
    .first();
}

async function ReadFindings(db, scanRunId) {
  if (!scanRunId) return [];
  const result = await db
    .prepare(`
      SELECT id, disposition, code, file_path, line_number, column_number, message_key
      FROM game_validation_findings
      WHERE scan_run_id = ?
      ORDER BY id
      LIMIT 200
    `)
    .bind(scanRunId)
    .all();
  return (result.results || []).filter((finding) => (
    gameValidationFindingDispositions.includes(finding.disposition)
  ));
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return identifierPattern.test(normalized) ? normalized : null;
}

function NormalizeReason(value) {
  const reason = String(value || '').trim();
  return reason.length >= 2
    && reason.length <= maximumReasonLength
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reason)
    ? reason
    : null;
}

function NormalizeFindingIds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumFindingIds) return null;
  const normalized = value.map(NormalizeIdentifier);
  return normalized.every(Boolean) ? [...new Set(normalized)] : null;
}

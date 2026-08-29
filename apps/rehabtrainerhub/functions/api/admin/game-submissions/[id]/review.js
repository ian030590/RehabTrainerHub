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
import { ReadJsonBody } from '../../../../_lib/request.js';

const maximumBodyBytes = 16 * 1024;
const maximumNoteLength = 2_000;
const decisions = Object.freeze(['approve', 'reject', 'request-changes']);

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Move a developer's manual-review request through the review axis. Approval
 * is deliberately narrower than rejection/request-changes: the latest scan
 * must pass and no hard-block finding may exist for that exact artifact.
 */
export async function onRequestPut({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);

    const body = await ReadJsonBody(request, maximumBodyBytes);
    if (!body.ok) return ErrorResponse(request, env, 'Invalid review payload.', 400);
    const decision = String(body.value?.decision || '').trim();
    const note = NormalizeNote(body.value?.note);
    const evidence = {
      sourceReviewed: body.value?.sourceReviewed === true,
      playTested: body.value?.playTested === true,
      metadataReviewed: body.value?.metadataReviewed === true,
    };
    if (!decisions.includes(decision) || note === null) {
      return ErrorResponse(request, env, 'Invalid review decision.', 400);
    }
    if (decision === 'approve' && !Object.values(evidence).every(Boolean)) {
      return ErrorResponse(request, env, 'Source review, isolated play test, and public metadata review are required.', 400);
    }

    const submissionId = NormalizeIdentifier(params?.id);
    if (!submissionId) return ErrorResponse(request, env, 'Invalid submission ID.', 400);
    const db = RequireDatabase(env);
    const review = await ReadLatestReview(db, submissionId);
    if (!review) return ErrorResponse(request, env, 'Manual-review request not found.', 404);

    if (decision === 'approve' && (review.scan_status !== 'passed' || review.hard_block_count > 0)) {
      return ErrorResponse(request, env, 'A hard-blocked or unpassed scan cannot be approved.', 409);
    }

    const nextStatus = decision === 'approve'
      ? 'approved'
      : decision === 'reject'
        ? 'rejected'
        : 'changes_requested';
    const now = new Date().toISOString();
    const update = await db
      .prepare(`
        UPDATE game_review_requests
        SET status = ?, reviewed_by_user_id = ?, review_note = ?,
            reviewed_at = ?, updated_at = ?
        WHERE id = ?
          AND status IN ('requested', 'in_review')
          AND submission_id = ?
      `)
      .bind(nextStatus, user.id, note || null, now, now, review.id, submissionId)
      .run();
    if (ReadChangedRows(update) !== 1) {
      return ErrorResponse(request, env, 'The review request changed while it was being processed.', 409);
    }

    await db.batch([
      CreateAdminAuditStatement(db, {
        actorUserId: user.id,
        action: `admin_game_submission.${nextStatus}`,
        targetType: 'game_submission',
        targetId: submissionId,
        metadata: {
          evidence,
          reviewRequestId: review.id,
          scanRunId: review.scan_run_id,
        },
      }),
    ]);

    return JsonResponse(request, env, {
      reviewRequest: {
        id: review.id,
        submissionId,
        status: nextStatus,
        reviewedAt: now,
      },
    });
  } catch (error) {
    console.error('Unable to review a game submission.', error);
    return ErrorResponse(request, env, 'Unable to review the game submission.', 500);
  }
}

async function ReadLatestReview(db, submissionId) {
  return db
    .prepare(`
      SELECT
        review.id,
        review.scan_run_id,
        review.status AS review_status,
        scan.status AS scan_status,
        (
          SELECT COUNT(*)
          FROM game_validation_findings AS finding
          WHERE finding.scan_run_id = review.scan_run_id
            AND finding.disposition = 'hard-block'
        ) AS hard_block_count
      FROM game_review_requests AS review
      INNER JOIN game_scan_runs AS scan ON scan.id = review.scan_run_id
      WHERE review.submission_id = ?
      ORDER BY review.updated_at DESC
      LIMIT 1
    `)
    .bind(submissionId)
    .first();
}

function ReadChangedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

function NormalizeNote(value) {
  const note = String(value || '').trim();
  return note.length <= maximumNoteLength
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)
    ? note
    : null;
}

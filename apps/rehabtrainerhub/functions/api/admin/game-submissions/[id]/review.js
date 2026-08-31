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
import { CreateGamePlatformNotificationStatement } from '../../../../_lib/gameNotifications.js';

const maximumBodyBytes = 16 * 1024;
const maximumNoteLength = 2_000;
const decisions = Object.freeze(['approve', 'reject', 'request-changes']);
const maximumOverrides = 50;
const maximumOverrideReasonLength = 2_000;

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
    const overrides = NormalizeOverrides(body.value?.overrides);
    if (overrides === null) return ErrorResponse(request, env, 'Invalid finding override evidence.', 400);
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

    const findings = await ReadFindings(db, review.scan_run_id);
    const eligibleFindings = findings.filter((finding) => (
      finding.disposition === 'fix-or-manual-review'
      || finding.disposition === 'manual-review'
    ));
    if (decision === 'approve') {
      const overrideIds = new Set(overrides.map((override) => override.findingId));
      if (overrides.length !== eligibleFindings.length
        || eligibleFindings.some((finding) => !overrideIds.has(finding.id))) {
        return ErrorResponse(request, env, 'Every eligible finding requires explicit override evidence before approval.', 400);
      }
      if (overrides.some((override) => !eligibleFindings.some((finding) => finding.id === override.findingId))) {
        return ErrorResponse(request, env, 'Hard-block or unknown findings cannot be overridden.', 400);
      }
    } else if (overrides.some((override) => !findings.some((finding) => finding.id === override.findingId))) {
      return ErrorResponse(request, env, 'Override evidence references an unknown finding.', 400);
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

    const statements = [];
    if (overrides.length > 0) {
      overrides.forEach((override) => {
        const finding = findings.find((candidate) => candidate.id === override.findingId);
        if (!finding || finding.disposition === 'hard-block') return;
        statements.push(db
          .prepare(`
            INSERT INTO game_validation_overrides (
              id, submission_id, scan_run_id, review_request_id, finding_id,
              reviewer_user_id, decision, reason, evidence_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            crypto.randomUUID(),
            submissionId,
            review.scan_run_id,
            review.id,
            finding.id,
            user.id,
            override.decision,
            override.reason,
            JSON.stringify({ evidence: override.evidence }),
            now,
          ));
      });
    }
    if (nextStatus === 'changes_requested' || nextStatus === 'rejected') {
      statements.push(CreateGamePlatformNotificationStatement(db, {
        recipientUserId: review.owner_user_id,
        gameId: review.game_id,
        submissionId,
        kind: nextStatus === 'changes_requested' ? 'request-changes' : 'rejected',
        payload: { note: note || null, reviewRequestId: review.id },
        createdAt: now,
      }));
    }
    statements.push(CreateAdminAuditStatement(db, {
      actorUserId: user.id,
      action: `admin_game_submission.${nextStatus}`,
      targetType: 'game_submission',
      targetId: submissionId,
      metadata: {
        evidence,
        overrides: overrides.map((override) => override.findingId),
        reviewRequestId: review.id,
        scanRunId: review.scan_run_id,
      },
    }));
    await db.batch([
      ...statements,
    ]);

    return JsonResponse(request, env, {
      reviewRequest: {
        id: review.id,
        submissionId,
        status: nextStatus,
        reviewedAt: now,
        overrideFindingIds: overrides.map((override) => override.findingId),
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
        submission.owner_user_id,
        submission.game_id,
        review.status AS review_status,
        scan.status AS scan_status,
        (
          SELECT COUNT(*)
          FROM game_validation_findings AS finding
          WHERE finding.scan_run_id = review.scan_run_id
            AND finding.disposition = 'hard-block'
        ) AS hard_block_count
      FROM game_review_requests AS review
      INNER JOIN game_submissions AS submission ON submission.id = review.submission_id
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

async function ReadFindings(db, scanRunId) {
  const result = await db
    .prepare(`
      SELECT id, disposition
      FROM game_validation_findings
      WHERE scan_run_id = ?
      ORDER BY id
      LIMIT 200
    `)
    .bind(scanRunId)
    .all();
  return result.results || [];
}

function NormalizeOverrides(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximumOverrides) return null;
  const overrides = value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    const findingId = NormalizeIdentifier(item.findingId);
    const decision = String(item.decision || '').trim();
    const reason = NormalizeNote(item.reason);
    const evidence = NormalizeNote(item.evidence);
    if (!findingId || !['accept', 'dismiss'].includes(decision) || reason === null || evidence === null) return null;
    if (reason.length > maximumOverrideReasonLength || evidence.length > maximumOverrideReasonLength) return null;
    return { findingId, decision, reason, evidence };
  });
  if (overrides.some((override) => !override)) return null;
  const ids = overrides.map((override) => override.findingId);
  return new Set(ids).size === ids.length ? overrides : null;
}

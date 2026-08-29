import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';

const queueNames = Object.freeze([
  'ready-for-review',
  'manual-review-requested',
  'security-blocked',
  'processing',
]);

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Read-only validation queues for the administrator console. Publication is
 * intentionally not performed here; it stays behind the existing immutable
 * release endpoint and its lease/evidence checks.
 */
export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);

    const queue = NormalizeQueue(new URL(request.url).searchParams.get('queue'));
    if (!queue) return ErrorResponse(request, env, 'Invalid validation queue.', 400);

    const result = await RequireDatabase(env)
      .prepare(`
        SELECT
          submission.id,
          submission.game_id,
          submission.target_version,
          submission.artifact_type,
          submission.artifact_sha256,
          submission.package_bytes,
          submission.submitted_at,
          submission.owner_user_id,
          developer_games.slug,
          developer_games.title,
          developer_games.summary,
          developer_games.category,
          owner.display_name AS owner_display_name,
          scan.id AS scan_run_id,
          scan.attempt AS scan_attempt,
          scan.status AS scan_status,
          scan.policy_version,
          scan.tool_versions_json,
          scan.report_sha256,
          scan.error_code,
          scan.queued_at,
          scan.started_at,
          scan.completed_at,
          scan_report.report_sha256 AS attested_report_sha256,
          scan_report.attestation_key_id,
          scan_report.received_at AS report_received_at,
          scan_report.report_json,
          review.id AS review_request_id,
          review.status AS review_status,
          review.reason AS review_reason,
          review.requested_at AS review_requested_at,
          review.review_note,
          COALESCE((
            SELECT json_group_array(json_object(
              'id', finding.id,
              'disposition', finding.disposition,
              'code', finding.code,
              'filePath', finding.file_path,
              'line', finding.line_number,
              'column', finding.column_number,
              'messageKey', finding.message_key
            ))
            FROM game_validation_findings AS finding
            WHERE finding.scan_run_id = scan.id
          ), '[]') AS findings_json
        FROM game_submissions AS submission
        INNER JOIN developer_games
          ON developer_games.id = submission.game_id
        INNER JOIN app_users AS owner
          ON owner.id = submission.owner_user_id
        LEFT JOIN game_scan_runs AS scan
          ON scan.submission_id = submission.id
         AND scan.attempt = (
           SELECT MAX(latest.attempt)
           FROM game_scan_runs AS latest
           WHERE latest.submission_id = submission.id
         )
        LEFT JOIN game_scan_reports AS scan_report
          ON scan_report.scan_run_id = scan.id
        LEFT JOIN game_review_requests AS review
          ON review.id = (
            SELECT latest_review.id
            FROM game_review_requests AS latest_review
            WHERE latest_review.submission_id = submission.id
            ORDER BY latest_review.updated_at DESC
            LIMIT 1
          )
        WHERE ${QueuePredicate(queue)}
        ORDER BY submission.submitted_at DESC
        LIMIT 200
      `)
      .all();

    return JsonResponse(request, env, {
      queue,
      submissions: (result.results || []).map(MapSubmission),
    });
  } catch (error) {
    console.error('Unable to list game validation queue.', error);
    return ErrorResponse(request, env, 'Unable to load game validation queue.', 500);
  }
}

function QueuePredicate(queue) {
  switch (queue) {
    case 'ready-for-review':
      return `scan.status = 'passed'
        AND (review.status IS NULL OR review.status = 'not_requested')
        AND NOT EXISTS (
          SELECT 1
          FROM game_validation_findings AS blocked
          WHERE blocked.scan_run_id = scan.id
            AND blocked.disposition = 'hard-block'
        )`;
    case 'manual-review-requested':
      return `review.status IN ('requested', 'in_review')`;
    case 'security-blocked':
      return `EXISTS (
        SELECT 1
        FROM game_validation_findings AS blocked
        WHERE blocked.scan_run_id = scan.id
          AND blocked.disposition = 'hard-block'
      )`;
    case 'processing':
      return `scan.status IN ('queued', 'running')`;
    default:
      throw new TypeError('Unknown validation queue.');
  }
}

function NormalizeQueue(value) {
  const queue = String(value || '').trim();
  return queueNames.includes(queue) ? queue : null;
}

function MapSubmission(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    owner: {
      id: row.owner_user_id,
      displayName: row.owner_display_name || 'Developer',
    },
    targetVersion: row.target_version,
    artifactType: row.artifact_type,
    artifactSha256: row.artifact_sha256,
    packageBytes: row.package_bytes,
    submittedAt: row.submitted_at,
    scan: {
      id: row.scan_run_id,
      attempt: row.scan_attempt,
      status: row.scan_status,
      policyVersion: row.policy_version,
      toolVersions: SafeJson(row.tool_versions_json, {}),
      reportSha256: row.report_sha256,
      errorCode: row.error_code,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      report: row.attested_report_sha256
        ? {
          sha256: row.attested_report_sha256,
          attestationKeyId: row.attestation_key_id,
          receivedAt: row.report_received_at,
          verdict: SafeJson(row.report_json, {}).verdict || null,
          networkAttempts: SafeJson(row.report_json, {}).observedNetworkAttempts || [],
        }
        : null,
    },
    review: row.review_request_id
      ? {
        id: row.review_request_id,
        status: row.review_status,
        reason: row.review_reason,
        note: row.review_note,
        requestedAt: row.review_requested_at,
      }
      : null,
    findings: SafeJson(row.findings_json, []),
    canApprove: row.scan_status === 'passed'
      && row.review_status === 'approved'
      && !SafeJson(row.findings_json, []).some((finding) => finding.disposition === 'hard-block'),
  };
}

function SafeJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

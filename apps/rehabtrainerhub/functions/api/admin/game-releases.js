import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);
    const status = new URL(request.url).searchParams.get('status');
    const allowedStatuses = new Set(['blocked', 'pending_review', 'publishing', 'approved', 'rejected', 'revoked']);
    const selectedStatus = status && allowedStatuses.has(status) ? status : null;
    const result = await RequireDatabase(env)
      .prepare(`
        SELECT
          game_releases.*,
          developer_games.slug,
          game_releases.submitted_title AS title,
          game_releases.submitted_summary AS summary,
          game_releases.submitted_category AS category,
          developer_games.owner_user_id,
          app_users.display_name AS owner_display_name,
          app_users.email AS owner_email,
          COALESCE((
            SELECT json_group_array(json_object(
              'severity', game_scan_findings.severity,
              'code', game_scan_findings.code,
              'filePath', game_scan_findings.file_path,
              'message', game_scan_findings.message
            ))
            FROM game_scan_findings
            WHERE game_scan_findings.release_id = game_releases.id
          ), '[]') AS findings_json
        FROM game_releases
        INNER JOIN developer_games ON developer_games.id = game_releases.game_id
        INNER JOIN app_users ON app_users.id = developer_games.owner_user_id
        WHERE (? IS NULL OR game_releases.status = ?)
        ORDER BY
          CASE game_releases.status
            WHEN 'pending_review' THEN 0
            WHEN 'publishing' THEN 1
            WHEN 'blocked' THEN 2
            WHEN 'approved' THEN 3
            WHEN 'revoked' THEN 4
            ELSE 5
          END,
          game_releases.submitted_at DESC
        LIMIT 200
      `)
      .bind(selectedStatus, selectedStatus)
      .all();
    const releases = (result.results || []).map(MapRelease);
    return JsonResponse(request, env, { releases });
  } catch (error) {
    console.error('Unable to list game releases for review.', error);
    return ErrorResponse(request, env, 'Unable to load game releases.', 500);
  }
}

function MapRelease(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    developerName: row.submitted_developer_name,
    owner: {
      id: row.owner_user_id,
      displayName: row.owner_display_name || row.owner_email || 'Developer',
    },
    version: row.version,
    artifactType: row.artifact_type,
    entryPath: row.entry_path,
    status: row.status,
    contentSha256: row.content_sha256,
    packageBytes: row.package_bytes,
    uncompressedBytes: row.uncompressed_bytes,
    fileCount: row.file_count,
    jsPsychVersion: row.jspsych_version,
    capabilities: SafeJson(row.capabilities_json, []),
    files: SafeJson(row.files_json, []),
    scan: SafeJson(row.scan_summary_json, {}),
    findings: SafeJson(row.findings_json, []),
    reviewNote: row.review_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  };
}

function SafeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
} from '../../_lib/authorization.js';
import { ReadJsonBody } from '../../_lib/request.js';

const maximumBodyBytes = 8 * 1024;
const reportStatuses = Object.freeze(['open', 'in_review', 'resolved', 'rejected']);
const statusTransitions = Object.freeze({
  open: new Set(['in_review', 'resolved', 'rejected']),
  in_review: new Set(['open', 'resolved', 'rejected']),
  resolved: new Set([]),
  rejected: new Set(['open']),
});

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
    const requestedStatus = String(new URL(request.url).searchParams.get('status') || '').trim();
    const status = reportStatuses.includes(requestedStatus) ? requestedStatus : null;
    const result = await RequireDatabase(env)
      .prepare(`
        SELECT
          report.id,
          report.game_id,
          report.release_id,
          report.reason,
          report.details,
          report.status,
          report.resolution_note,
          report.resolved_at,
          report.created_at,
          report.updated_at,
          game.slug,
          game.title,
          release.version,
          reporter.display_name AS reporter_display_name
        FROM game_platform_reports AS report
        INNER JOIN developer_games AS game ON game.id = report.game_id
        INNER JOIN game_releases AS release ON release.id = report.release_id
        LEFT JOIN app_users AS reporter ON reporter.id = report.reporter_user_id
        WHERE (? IS NULL OR report.status = ?)
        ORDER BY
          CASE report.status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,
          report.created_at ASC
        LIMIT 200
      `)
      .bind(status, status)
      .all();
    return JsonResponse(request, env, {
      reports: (result.results || []).map((row) => ({
        id: row.id,
        gameId: row.game_id,
        releaseId: row.release_id,
        slug: row.slug,
        title: row.title,
        version: row.version,
        reason: row.reason,
        details: row.details,
        status: row.status,
        resolutionNote: row.resolution_note,
        resolvedAt: row.resolved_at,
        reporterDisplayName: row.reporter_display_name || 'Signed-in user',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('Unable to list game platform reports.', error);
    return ErrorResponse(request, env, 'Unable to load game reports.', 500);
  }
}

export async function onRequestPut({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);
    const body = await ReadJsonBody(request, maximumBodyBytes);
    if (!body.ok) return ErrorResponse(request, env, 'Invalid report update payload.', 400);
    const reportId = NormalizeIdentifier(body.value?.reportId);
    const nextStatus = String(body.value?.status || '').trim();
    const resolutionNote = NormalizeNote(body.value?.resolutionNote);
    if (!reportId || !reportStatuses.includes(nextStatus) || resolutionNote === null) {
      return ErrorResponse(request, env, 'A report, status, and bounded resolution note are required.', 400);
    }
    if (['resolved', 'rejected'].includes(nextStatus) && !resolutionNote) {
      return ErrorResponse(request, env, 'A resolution note is required for a terminal report status.', 400);
    }
    const db = RequireDatabase(env);
    const current = await db
      .prepare('SELECT id, status, game_id, release_id FROM game_platform_reports WHERE id = ? LIMIT 1')
      .bind(reportId)
      .first();
    if (!current) return ErrorResponse(request, env, 'Game report not found.', 404);
    if (!statusTransitions[current.status]?.has(nextStatus)) {
      return ErrorResponse(request, env, 'Invalid report status transition.', 409);
    }
    const now = new Date().toISOString();
    const update = db
      .prepare(`
        UPDATE game_platform_reports
        SET status = ?, resolution_note = ?, resolved_by_user_id = ?,
            resolved_at = ?, updated_at = ?
        WHERE id = ? AND status = ?
      `)
      .bind(
        nextStatus,
        resolutionNote || null,
        ['resolved', 'rejected'].includes(nextStatus) ? user.id : null,
        ['resolved', 'rejected'].includes(nextStatus) ? now : null,
        now,
        reportId,
        current.status,
      );
    const audit = CreateAdminAuditStatement(db, {
      actorUserId: user.id,
      action: `game_platform_report.${nextStatus}`,
      targetType: 'game_platform_report',
      targetId: reportId,
      metadata: {
        from: current.status,
        gameId: current.game_id,
        releaseId: current.release_id,
        resolutionNote: resolutionNote || null,
        to: nextStatus,
      },
    });
    const results = await db.batch([update, audit]);
    if (ReadChangedRows(results?.[0]) !== 1) {
      return ErrorResponse(request, env, 'The report changed while it was being processed.', 409);
    }
    return JsonResponse(request, env, { report: { id: reportId, status: nextStatus, updatedAt: now } });
  } catch (error) {
    console.error('Unable to update a game platform report.', error);
    return ErrorResponse(request, env, 'Unable to update the game report.', 500);
  }
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

function NormalizeNote(value) {
  const note = String(value || '').trim();
  return note.length <= 2_000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)
    ? note
    : null;
}

function ReadChangedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

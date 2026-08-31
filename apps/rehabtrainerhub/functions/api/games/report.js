import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';
import { ReadJsonBody } from '../../_lib/request.js';

const maximumBodyBytes = 8 * 1024;
const reasons = Object.freeze(['safety', 'copyright', 'privacy', 'content', 'other']);
const maximumDetailsLength = 2_000;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Authenticated users can report a published third-party release. Reports are
 * queued for administrator action and cannot mutate catalog visibility from a
 * public request.
 */
export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const rateLimitError = await RateLimitResponse(request, env, 'game-platform-report', {
      identity: user.id,
      identityOnly: true,
      limit: 6,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;

    const body = await ReadJsonBody(request, maximumBodyBytes);
    if (!body.ok) return ErrorResponse(request, env, 'Invalid game report payload.', 400);
    const releaseId = NormalizeIdentifier(body.value?.releaseId);
    const reason = String(body.value?.reason || '').trim();
    const details = NormalizeDetails(body.value?.details);
    if (!releaseId || !reasons.includes(reason) || details === null) {
      return ErrorResponse(request, env, 'A release, report category, and details are required.', 400);
    }

    const db = RequireDatabase(env);
    const release = await db
      .prepare(`
        SELECT game_releases.id, game_releases.game_id
        FROM game_releases
        INNER JOIN developer_games
          ON developer_games.id = game_releases.game_id
        WHERE game_releases.id = ?
          AND developer_games.active_release_id = game_releases.id
          AND developer_games.status = 'published'
          AND game_releases.status = 'approved'
        LIMIT 1
      `)
      .bind(releaseId)
      .first();
    if (!release) return ErrorResponse(request, env, 'Published game release not found.', 404);

    const now = new Date().toISOString();
    const reportId = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO game_platform_reports (
          id, game_id, release_id, reporter_user_id, reason, details,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
      `)
      .bind(reportId, release.game_id, release.id, user.id, reason, details, now, now)
      .run();
    return JsonResponse(request, env, {
      report: { id: reportId, releaseId: release.id, status: 'open', createdAt: now },
    }, { status: 201 });
  } catch (error) {
    if (/UNIQUE|game_platform_reports/i.test(String(error))) {
      return ErrorResponse(request, env, 'You already have an open report for this category.', 409);
    }
    console.error('Unable to create a game platform report.', error);
    return ErrorResponse(request, env, 'Unable to report this game.', 500);
  }
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

function NormalizeDetails(value) {
  const details = String(value || '').trim();
  return details.length >= 2
    && details.length <= maximumDetailsLength
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(details)
    ? details
    : null;
}

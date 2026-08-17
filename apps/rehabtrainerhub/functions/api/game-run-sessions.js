import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../_lib/auth.js';
import { GetAuthenticatedUser } from '../_lib/authorization.js';
import {
  CreateGameRunSessionToken,
  gameRunSessionRequestMaximumBytes,
  gameRunSessionTtlSeconds,
  HashGameRunSessionToken,
  IsExactObject,
  IsGameRunIdentifier,
} from '../_lib/gameRuns.js';
import { ReadJsonBody } from '../_lib/request.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const rateLimitError = await RateLimitResponse(request, env, 'game-run-session', {
      identity: user.id,
      identityOnly: true,
      limit: 120,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;

    const body = await ReadJsonBody(request, gameRunSessionRequestMaximumBytes);
    if (!body.ok || !IsGameRunSessionInput(body.value)) {
      return ErrorResponse(request, env, 'Invalid game run session payload.', 400);
    }

    const db = RequireDatabase(env);
    const release = await db
      .prepare(`
        SELECT game_releases.id, game_releases.game_id
        FROM game_releases
        INNER JOIN developer_games
          ON developer_games.id = game_releases.game_id
         AND developer_games.active_release_id = game_releases.id
        WHERE game_releases.id = ?
          AND game_releases.status = 'approved'
          AND developer_games.status = 'published'
        LIMIT 1
      `)
      .bind(body.value.releaseId)
      .first();
    if (!release) return ErrorResponse(request, env, 'Active game release not found.', 404);

    const token = CreateGameRunSessionToken();
    const tokenSha256 = await HashGameRunSessionToken(token);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = nowSeconds + gameRunSessionTtlSeconds;
    const inserted = await db
      .prepare(`
        INSERT INTO game_run_sessions (
          id, token_sha256, user_id, game_id, release_id,
          client_run_id, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        tokenSha256,
        user.id,
        release.game_id,
        release.id,
        body.value.clientRunId,
        expiresAtSeconds,
        new Date(nowSeconds * 1000).toISOString(),
      )
      .run();
    if (Number(inserted?.meta?.changes || 0) !== 1) {
      throw new Error('The game run session was not persisted.');
    }

    return JsonResponse(request, env, {
      runSession: {
        token,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Unable to create a developer game run session.', error);
    return ErrorResponse(request, env, 'Unable to create the game run session.', 500);
  }
}

function IsGameRunSessionInput(value) {
  return IsExactObject(value, ['releaseId', 'clientRunId'])
    && IsGameRunIdentifier(value.releaseId)
    && IsGameRunIdentifier(value.clientRunId);
}

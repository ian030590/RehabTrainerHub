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
  gameRunRequestMaximumBytes,
  gameRunResultMaximumBytes,
  HashGameRunSessionToken,
  IsExactObject,
  IsGameRunIdentifier,
  IsGameRunSessionToken,
} from '../_lib/gameRuns.js';
import { ReadJsonBody } from '../_lib/request.js';

const sensitiveKeyPattern = /(auth|birthday|cookie|credential|dob|email|jwt|name|participant|password|phone|secret|session|token|user)/i;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const rateLimitError = await RateLimitResponse(request, env, 'game-result', {
      identity: user.id,
      identityOnly: true,
      limit: 120,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;
    const body = await ReadJsonBody(request, gameRunRequestMaximumBytes);
    if (!body.ok || !IsGameRunInput(body.value)) {
      return ErrorResponse(request, env, 'Invalid game result payload.', 400);
    }

    const db = RequireDatabase(env);
    const tokenSha256 = await HashGameRunSessionToken(body.value.runSessionToken);
    const existing = await FindExistingGameRun(
      db,
      tokenSha256,
      user.id,
      body.value.releaseId,
      body.value.clientRunId,
    );
    if (existing) {
      return JsonResponse(request, env, {
        run: { id: existing.id, duplicate: true, resultSource: 'client_reported' },
      });
    }

    const id = crypto.randomUUID();
    const result = body.value.result;
    let inserted;
    try {
      inserted = await db
        .prepare(`
        INSERT INTO game_runs (
          id, game_id, release_id, user_id, client_run_id,
          completed, score, duration_ms, result_json, created_at,
          run_session_id, result_source
        )
        SELECT
          ?, game_run_sessions.game_id, game_run_sessions.release_id,
          game_run_sessions.user_id, game_run_sessions.client_run_id,
          ?, ?, ?, ?, ?, game_run_sessions.id, 'sandbox_client_reported'
        FROM game_run_sessions
        INNER JOIN game_releases
          ON game_releases.id = game_run_sessions.release_id
         AND game_releases.game_id = game_run_sessions.game_id
        INNER JOIN developer_games
          ON developer_games.id = game_run_sessions.game_id
         AND developer_games.active_release_id = game_run_sessions.release_id
        WHERE game_run_sessions.token_sha256 = ?
          AND game_run_sessions.user_id = ?
          AND game_run_sessions.release_id = ?
          AND game_run_sessions.client_run_id = ?
          AND game_run_sessions.expires_at > ?
          AND game_releases.status = 'approved'
          AND developer_games.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM game_runs consumed_run
            WHERE consumed_run.run_session_id = game_run_sessions.id
          )
        `)
        .bind(
          id,
          result.status === 'completed' ? 1 : 0,
          result.score ?? null,
          result.durationMs ?? null,
          JSON.stringify(result),
          new Date().toISOString(),
          tokenSha256,
          user.id,
          body.value.releaseId,
          body.value.clientRunId,
          Math.floor(Date.now() / 1000),
        )
        .run();
    } catch (error) {
      if (!/UNIQUE|constraint|game_runs/i.test(String(error))) throw error;
      const racedExisting = await FindExistingGameRun(
        db,
        tokenSha256,
        user.id,
        body.value.releaseId,
        body.value.clientRunId,
      );
      if (!racedExisting) throw error;
      return JsonResponse(request, env, {
        run: { id: racedExisting.id, duplicate: true, resultSource: 'client_reported' },
      });
    }
    if (Number(inserted?.meta?.changes || 0) !== 1) {
      const racedExisting = await FindExistingGameRun(
        db,
        tokenSha256,
        user.id,
        body.value.releaseId,
        body.value.clientRunId,
      );
      if (racedExisting) {
        return JsonResponse(request, env, {
          run: { id: racedExisting.id, duplicate: true, resultSource: 'client_reported' },
        });
      }
      return ErrorResponse(request, env, 'Game run session is invalid, expired, consumed, or inactive.', 409);
    }
    return JsonResponse(request, env, {
      run: { id, duplicate: false, resultSource: 'client_reported' },
    }, { status: 201 });
  } catch (error) {
    console.error('Unable to save a developer game result.', error);
    return ErrorResponse(request, env, 'Unable to save the game result.', 500);
  }
}

function IsGameRunInput(value) {
  if (!IsExactObject(value, ['releaseId', 'clientRunId', 'runSessionToken', 'result'])) return false;
  if (!IsGameRunIdentifier(value.releaseId)
    || !IsGameRunIdentifier(value.clientRunId)
    || !IsGameRunSessionToken(value.runSessionToken)) return false;
  const result = value.result;
  if (!IsExactObject(result, ['status'], ['score', 'durationMs', 'trialCount', 'metrics'])) return false;
  if (!['completed', 'aborted'].includes(result.status)) return false;
  if ('score' in result && !IsFiniteNumber(result.score)) return false;
  if ('durationMs' in result && (
    !Number.isSafeInteger(result.durationMs)
    || result.durationMs < 0
    || result.durationMs > 24 * 60 * 60 * 1000
  )) return false;
  if ('trialCount' in result && (
    !Number.isSafeInteger(result.trialCount)
    || result.trialCount < 0
    || result.trialCount > 100_000
  )) return false;
  if ('metrics' in result && !IsMetrics(result.metrics)) return false;
  return new TextEncoder().encode(JSON.stringify(result)).byteLength <= gameRunResultMaximumBytes;
}

function IsMetrics(value) {
  if (!IsPlainObject(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 512 && entries.every(([key, metric]) => (
    /^[a-z][A-Za-z0-9_.-]{0,63}$/.test(key)
    && !sensitiveKeyPattern.test(key)
    && (metric === null || typeof metric === 'boolean' || IsFiniteNumber(metric))
  ));
}

function IsFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function FindExistingGameRun(db, tokenSha256, userId, releaseId, clientRunId) {
  return db
    .prepare(`
      SELECT game_runs.id
      FROM game_runs
      INNER JOIN game_run_sessions
        ON game_run_sessions.id = game_runs.run_session_id
      WHERE game_run_sessions.token_sha256 = ?
        AND game_run_sessions.user_id = ?
        AND game_run_sessions.release_id = ?
        AND game_run_sessions.client_run_id = ?
      LIMIT 1
    `)
    .bind(tokenSha256, userId, releaseId, clientRunId)
    .first();
}

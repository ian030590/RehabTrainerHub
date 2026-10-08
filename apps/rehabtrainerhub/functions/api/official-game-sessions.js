import { CreateSignedValue, ErrorResponse, GetBearerToken, GetSessionSecret, JsonResponse,
  OptionsResponse, RateLimitResponse, RejectDisallowedOrigin, RequireSession } from '../_lib/auth.js';
import { IsExactObject, IsSubjectId } from '../_lib/gameRuns.js';
import { ReadJsonBody } from '../_lib/request.js';
import { officialGameReleases } from '../_lib/officialGames.js';

export function onRequestOptions({ request, env }) { return OptionsResponse(request, env); }
export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  try {
    const session = GetBearerToken(request) ? await RequireSession(request, env) : null;
    if (GetBearerToken(request) && !session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!session?.sub && env.ANONYMOUS_RECORDS_ENABLED !== '1') return ErrorResponse(request, env, 'Anonymous record storage is unavailable.', 503);
    const limit = await RateLimitResponse(request, env, 'official-game-session', { identity: session?.sub, limit: 120, windowSeconds: 3600 });
    if (limit) return limit;
    const body = await ReadJsonBody(request, 4096);
    const input = body.value;
    if (!body.ok || !IsExactObject(input, ['gameId', 'version', 'subjectId'])
      || !Object.hasOwn(officialGameReleases, input.gameId)
      || officialGameReleases[input.gameId].version !== input.version || !IsSubjectId(input.subjectId)) {
      return ErrorResponse(request, env, 'Invalid official game session.', 400);
    }
    const object = await env.GAME_RELEASE_BUCKET?.get(`releases/${input.gameId}/${input.version}/release.json`);
    if (!object || object.size > 512 * 1024) return ErrorResponse(request, env, 'Game release unavailable.', 503);
    const release = await object.json();
    if (release.status !== 'approved' || release.gameId !== input.gameId || release.version !== input.version) {
      return ErrorResponse(request, env, 'Game release unavailable.', 503);
    }
    const recordId = crypto.randomUUID();
    const token = await CreateSignedValue({ purpose: 'official-game-result', gameId: input.gameId,
      version: input.version, recordId, subjectId: input.subjectId, userId: session?.sub || null }, GetSessionSecret(env), 86400);
    return JsonResponse(request, env, { recordId, token }, { status: 201 });
  } catch (error) {
    console.error('Unable to create official game session.', error);
    return ErrorResponse(request, env, 'Unable to create official game session.', 503);
  }
}

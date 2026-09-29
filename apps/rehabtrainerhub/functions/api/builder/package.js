import { ErrorResponse, RejectDisallowedOrigin } from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';
import { BuilderOrigin } from '../../_lib/builderAuth.js';

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env); if (originError) return originError;
  const user = await GetAuthenticatedUser(request, env);
  if (!user) return ErrorResponse(request, env, 'Sign in to Hub before accepting a Builder package.', 401);
  let input; try { input = await request.json(); } catch { return ErrorResponse(request, env, 'Invalid request.', 400); }
  if (!/^[0-9a-f]{64}$/.test(input?.ticket || '') || !env.BUILDER_CLIENT_SECRET) return ErrorResponse(request, env, 'Invalid ticket.', 400);
  const endpoint = new URL(`/api/handoff/${input.ticket}`, BuilderOrigin(env));
  const response = await fetch(endpoint, { headers: { 'X-Builder-Secret': env.BUILDER_CLIENT_SECRET, 'X-Hub-User-Id': user.id }, redirect: 'error' });
  if (!response.ok) return ErrorResponse(request, env, 'Builder ticket expired or belongs to another owner.', 403);
  if (response.headers.get('X-Builder-Owner') !== user.id) return ErrorResponse(request, env, 'Builder owner mismatch.', 403);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > 12 * 1024 * 1024) return ErrorResponse(request, env, 'Builder package is too large.', 413);
  const gameId = response.headers.get('X-Builder-Game-Id') || '';
  const version = response.headers.get('X-Builder-Version') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameId) || !/^\d+\.\d+\.\d+$/.test(version)) return ErrorResponse(request, env, 'Builder package metadata is invalid.', 400);
  return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/zip', 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${gameId}-${version}.zip"`, 'X-Builder-Game-Id': gameId, 'X-Builder-Version': version } });
}

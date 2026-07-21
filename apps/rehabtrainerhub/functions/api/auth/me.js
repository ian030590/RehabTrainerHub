import {
  ErrorResponse,
  GetUserById,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireSession,
  ToPublicUser,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const user = await GetUserById(env, session.sub);
  if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);

  return JsonResponse(request, env, { user: ToPublicUser(user) });
}

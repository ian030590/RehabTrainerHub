import {
  ErrorResponse,
  GetCookieSession,
  GetUserById,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  ToPublicUser,
} from '../../_lib/auth.js';
import { EnsureAccountSubjectId } from '../../_lib/subjects.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await GetCookieSession(request, env);
  if (!session?.payload?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const user = await GetUserById(env, session.payload.sub);
  if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);

  return JsonResponse(request, env, {
    token: session.token,
    user: ToPublicUser(user, await EnsureAccountSubjectId(RequireDatabase(env), user.id)),
  });
}

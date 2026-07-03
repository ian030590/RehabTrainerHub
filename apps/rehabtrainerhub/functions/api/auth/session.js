import {
  errorResponse,
  getCookieSession,
  getUserById,
  jsonResponse,
  optionsResponse,
  toPublicUser,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const session = await getCookieSession(request, env);
  if (!session?.payload?.sub) return errorResponse(request, env, 'Unauthorized.', 401);

  const user = await getUserById(env, session.payload.sub);
  if (!user) return errorResponse(request, env, 'Unauthorized.', 401);

  return jsonResponse(request, env, {
    token: session.token,
    user: toPublicUser(user),
  });
}

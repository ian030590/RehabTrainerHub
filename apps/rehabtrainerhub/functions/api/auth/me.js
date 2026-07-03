import {
  errorResponse,
  getUserById,
  jsonResponse,
  optionsResponse,
  requireSession,
  toPublicUser,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  if (!session?.sub) return errorResponse(request, env, 'Unauthorized.', 401);

  const user = await getUserById(env, session.sub);
  if (!user) return errorResponse(request, env, 'Unauthorized.', 401);

  return jsonResponse(request, env, { user: toPublicUser(user) });
}

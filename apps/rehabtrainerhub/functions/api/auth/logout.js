import {
  clearSessionCookie,
  jsonResponse,
  optionsResponse,
  rejectDisallowedOrigin,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export function onRequestPost({ request, env }) {
  const originError = rejectDisallowedOrigin(request, env);
  if (originError) return originError;

  return jsonResponse(request, env, { ok: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(request),
    },
  });
}

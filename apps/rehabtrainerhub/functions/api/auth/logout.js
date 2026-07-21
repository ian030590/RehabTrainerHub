import {
  ClearSessionCookie,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  return JsonResponse(request, env, { ok: true }, {
    headers: {
      'Set-Cookie': ClearSessionCookie(request),
    },
  });
}

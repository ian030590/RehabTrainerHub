import {
  clearSessionCookie,
  jsonResponse,
  optionsResponse,
} from '../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export function onRequestPost({ request, env }) {
  return jsonResponse(request, env, { ok: true }, {
    headers: {
      'Set-Cookie': clearSessionCookie(request),
    },
  });
}

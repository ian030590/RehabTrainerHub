import { ErrorResponse } from './auth.js';

export const builderOrigin = 'https://builder.trainerhub.cc';

export function CheckBuilderSecret(request, env) {
  const secret = env.BUILDER_CLIENT_SECRET;
  const supplied = request.headers.get('X-Builder-Secret');
  if (typeof secret !== 'string' || secret.length < 32 || !supplied || supplied !== secret) {
    return ErrorResponse(request, env, 'Unauthorized Builder client.', 401);
  }
  return null;
}

export function BuilderOrigin(env) {
  try {
    const candidate = new URL(env.BUILDER_ORIGIN || builderOrigin);
    return candidate.origin;
  } catch {
    return builderOrigin;
  }
}

export async function Sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

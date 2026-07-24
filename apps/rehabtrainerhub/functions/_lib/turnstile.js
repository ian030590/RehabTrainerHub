import { GetAllowedOrigins } from './auth.js';

const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const maximumTokenLength = 2048;

export function IsTurnstileConfigured(env) {
  return Boolean(String(env.TURNSTILE_SECRET_KEY || '').trim());
}

export async function VerifyTurnstileToken(request, env, token, expectedAction) {
  const secret = String(env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    return env.TURNSTILE_REQUIRED === '1'
      ? { success: false, reason: 'not-configured' }
      : { success: true, skipped: true };
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken || normalizedToken.length > maximumTokenLength) {
    return { success: false, reason: 'missing-token' };
  }

  const body = {
    secret,
    response: normalizedToken,
    remoteip: GetClientIp(request),
    idempotency_key: crypto.randomUUID(),
  };

  let response;
  try {
    response = await fetch(siteverifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: CreateTimeoutSignal(5000),
    });
  } catch (error) {
    console.warn('Turnstile verification request failed.', error);
    return { success: false, reason: 'verification-unavailable' };
  }

  if (!response.ok) {
    return { success: false, reason: 'verification-unavailable' };
  }

  const result = await response.json().catch(() => null);
  if (!result?.success) {
    return { success: false, reason: 'invalid-token' };
  }
  if (expectedAction && result.action !== expectedAction) {
    return { success: false, reason: 'invalid-action' };
  }

  const expectedHostnames = GetExpectedHostnames(request, env);
  if (
    expectedHostnames.size > 0
    && !expectedHostnames.has(String(result.hostname || '').toLowerCase())
  ) {
    return { success: false, reason: 'invalid-hostname' };
  }

  return {
    success: true,
    hostname: result.hostname,
  };
}

function GetClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || undefined;
}

function GetExpectedHostnames(request, env) {
  if (env.TURNSTILE_SKIP_HOSTNAME_CHECK === '1') return new Set();

  const configured = String(env.TURNSTILE_EXPECTED_HOSTNAMES || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length > 0) return new Set(configured);

  const hostnames = [];
  for (const origin of GetAllowedOrigins(env, request)) {
    try {
      hostnames.push(new URL(origin).hostname.toLowerCase());
    } catch {
      // Invalid configured origins are already ignored by the auth helper.
    }
  }
  return new Set(hostnames);
}

function CreateTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

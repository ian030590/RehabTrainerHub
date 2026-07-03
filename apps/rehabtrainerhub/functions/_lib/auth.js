const DEFAULT_ALLOWED_ORIGINS = [
  'https://rehabtrainerhub.pages.dev',
  'https://stroketrainer.pages.dev',
  'https://visiontrainer.pages.dev',
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

export const AUTH_MESSAGE_TYPE = 'rehabtrainerhub-auth-session';

export function getAuthBaseUrl(request, env) {
  const configured = env.AUTH_BASE_URL || env.NEXT_PUBLIC_REHABTRAINERHUB_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getAllowedOrigins(env) {
  const configured = (env.AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (!origin) {
    headers['Access-Control-Allow-Origin'] = '*';
    return headers;
  }

  if (getAllowedOrigins(env).has(origin.replace(/\/+$/, ''))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function optionsResponse(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && !getAllowedOrigins(env).has(origin.replace(/\/+$/, ''))) {
    return new Response('Origin is not allowed.', { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export function jsonResponse(request, env, data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders(request, env),
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(request, env, message, status = 400) {
  return jsonResponse(request, env, { error: message }, { status });
}

export function requireDatabase(env) {
  if (!env.REHAB_DB) throw new Error('REHAB_DB D1 binding is not configured.');
  return env.REHAB_DB;
}

export function requireSecret(env, name) {
  const value = env[name];
  if (!value || value.length < 24) {
    throw new Error(`${name} must be configured and at least 24 characters.`);
  }
  return value;
}

export function getStateSecret(env) {
  return env.AUTH_STATE_SECRET || requireSecret(env, 'AUTH_SESSION_SECRET');
}

export function getSessionSecret(env) {
  return requireSecret(env, 'AUTH_SESSION_SECRET');
}

export function getBearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireSession(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await verifySignedValue(token, getSessionSecret(env));
  } catch {
    return null;
  }
}

export async function createSignedValue(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = await createSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySignedValue(token, secret) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) throw new Error('Malformed token.');

  const expectedSignature = await createSignature(encodedPayload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) throw new Error('Invalid signature.');

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired.');
  }
  return payload;
}

async function createSignature(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function isSafeReturnTo(returnTo, env) {
  try {
    const url = new URL(returnTo);
    return getAllowedOrigins(env).has(url.origin);
  } catch {
    return false;
  }
}

export function toPublicUser(row) {
  const profile = row.profile_json ? safeJsonParse(row.profile_json) : undefined;
  return {
    id: row.id,
    displayName: row.display_name || row.email || 'RehabTrainerHub User',
    email: row.email || undefined,
    avatarUrl: row.avatar_url || undefined,
    profileCompleted: Boolean(row.profile_completed_at),
    privacyAcceptedAt: row.privacy_accepted_at || undefined,
    profile,
  };
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function getUserById(env, userId) {
  return requireDatabase(env)
    .prepare('SELECT * FROM app_users WHERE id = ?')
    .bind(userId)
    .first();
}

export async function createSessionForUser(env, user) {
  return createSignedValue(
    {
      sub: user.id,
      name: user.display_name || user.email || 'RehabTrainerHub User',
      email: user.email || undefined,
    },
    getSessionSecret(env),
    60 * 60 * 24 * 30,
  );
}

export function authPopupHtml(returnTo, token, user) {
  const targetOrigin = new URL(returnTo).origin;
  const fallback = new URL(returnTo);
  fallback.searchParams.set('auth_token', token);
  const message = JSON.stringify({ type: AUTH_MESSAGE_TYPE, token, user }).replace(/</g, '\\u003c');
  const targetOriginJson = JSON.stringify(targetOrigin);
  const fallbackJson = JSON.stringify(fallback.toString());

  return new Response(`<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RehabTrainerHub Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 700 18px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1c1e; background: #f9f9fc; }
    main { width: min(520px, calc(100% - 32px)); padding: 24px; border: 1px solid #bfc8ca; border-radius: 8px; background: #fff; }
    a { color: #004148; font-weight: 900; }
  </style>
</head>
<body>
  <main>
    <p>登入完成。視窗會自動關閉，或返回原本頁面。</p>
    <p><a id="fallback" href="#">回到 RehabTrainerHub</a></p>
  </main>
  <script>
    const message = ${message};
    const targetOrigin = ${targetOriginJson};
    const fallback = ${fallbackJson};
    document.getElementById('fallback').href = fallback;
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, targetOrigin);
      window.close();
    } else {
      window.location.replace(fallback);
    }
  </script>
</body>
</html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

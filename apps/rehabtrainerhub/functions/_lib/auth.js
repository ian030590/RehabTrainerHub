const DEFAULT_ALLOWED_ORIGINS = [
  'https://rehabtrainerhub.pages.dev',
  'https://stroketrainer.pages.dev',
  'https://visiontrainer.pages.dev',
  'https://braintrainer.pages.dev',
];

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
];

export const AUTH_MESSAGE_TYPE = 'rehabtrainerhub-auth-session';
export const AUTH_COOKIE_NAME = 'rehabtrainerhub_session';
const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 150000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const RATE_LIMIT_CLEANUP_INTERVAL = 100;
let rateLimitTableReady = false;
let rateLimitCleanupCounter = 0;

export function getAuthBaseUrl(request, env) {
  const configured = env.AUTH_BASE_URL || env.NEXT_PUBLIC_REHABTRAINERHUB_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getAllowedOrigins(env, request) {
  const configured = (env.AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const localOrigins = shouldAllowLocalOrigins(env, request) ? LOCAL_ALLOWED_ORIGINS : [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...localOrigins, ...configured]);
}

function shouldAllowLocalOrigins(env, request) {
  if (env.AUTH_ALLOW_LOCAL_ORIGINS === '1') return true;
  if (!request) return false;

  try {
    return isLocalHostname(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return getAllowedOrigins(env, request).has(origin.replace(/\/+$/, ''));
}

export function rejectDisallowedOrigin(request, env) {
  if (isAllowedOrigin(request, env)) return null;
  return new Response('Origin is not allowed.', {
    status: 403,
    headers: corsHeaders(request, env),
  });
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
    return headers;
  }

  if (getAllowedOrigins(env, request).has(origin.replace(/\/+$/, ''))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function optionsResponse(request, env) {
  if (!isAllowedOrigin(request, env)) {
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
  const db = env.REHAB_DB || env.rehab_db;
  if (!db) throw new Error('REHAB_DB D1 binding is not configured.');
  return db;
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

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
  return [
    PASSWORD_HASH_ALGORITHM,
    String(PASSWORD_HASH_ITERATIONS),
    base64UrlEncodeBytes(salt),
    base64UrlEncodeBytes(hash),
  ].join('$');
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, iterationsText, saltText, hashText] = String(storedHash || '').split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== PASSWORD_HASH_ALGORITHM || !Number.isInteger(iterations) || iterations < 100000) {
    return false;
  }

  try {
    const salt = base64UrlDecodeBytes(saltText);
    const hash = await derivePasswordHash(password, salt, iterations);
    return constantTimeEqual(base64UrlEncodeBytes(hash), hashText);
  } catch {
    return false;
  }
}

async function derivePasswordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
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

export function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;
    const cookieName = cookie.slice(0, separatorIndex);
    if (cookieName === name) return decodeURIComponent(cookie.slice(separatorIndex + 1));
  }
  return null;
}

export async function getCookieSession(request, env) {
  const token = getCookieValue(request, AUTH_COOKIE_NAME);
  if (!token) return null;
  try {
    return {
      token,
      payload: await verifySignedValue(token, getSessionSecret(env)),
    };
  } catch {
    return null;
  }
}

export function createSessionCookie(request, token) {
  const secureAttributes = new URL(request.url).protocol === 'https:'
    ? 'SameSite=None; Secure'
    : 'SameSite=Lax';
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    secureAttributes,
  ].join('; ');
}

export function clearSessionCookie(request) {
  const secureAttributes = new URL(request.url).protocol === 'https:'
    ? 'SameSite=None; Secure'
    : 'SameSite=Lax';
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    secureAttributes,
  ].join('; ');
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

/**
 * Constant-time comparison for ASCII/Base64URL strings only.
 * Do not reuse for arbitrary Unicode text; charCodeAt compares UTF-16 code units.
 */
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
  return new TextDecoder().decode(base64UrlDecodeBytes(value));
}

function base64UrlDecodeBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function isSafeReturnTo(returnTo, env, request) {
  try {
    const url = new URL(returnTo);
    return getAllowedOrigins(env, request).has(url.origin);
  } catch {
    return false;
  }
}

export function toPublicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name || row.email || 'Rehab Trainer Hub User',
    email: row.email || undefined,
    avatarUrl: row.avatar_url || undefined,
    profileCompleted: Boolean(row.profile_completed_at),
    privacyAcceptedAt: row.privacy_accepted_at || undefined,
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
      name: user.display_name || user.email || 'Rehab Trainer Hub User',
      email: user.email || undefined,
    },
    getSessionSecret(env),
    SESSION_TTL_SECONDS,
  );
}

export function authPopupHtml(returnTo, token, user, init = {}) {
  const targetOrigin = new URL(returnTo).origin;
  const message = escapeScriptJson({ type: AUTH_MESSAGE_TYPE, token, user });
  const targetOriginJson = escapeScriptJson(targetOrigin);
  const fallbackJson = escapeScriptJson(returnTo);

  return new Response(`<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rehab Trainer Hub Login</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 700 18px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1c1e; background: #f9f9fc; }
    main { width: min(520px, calc(100% - 32px)); padding: 24px; border: 1px solid #bfc8ca; border-radius: 8px; background: #fff; }
    a { color: #004148; font-weight: 900; }
  </style>
</head>
<body>
  <main>
    <p id="auth-status" data-zh="登入完成。視窗會自動關閉，或返回原本頁面。" data-en="Sign-in complete. This window will close automatically, or return to the original page.">登入完成。視窗會自動關閉，或返回原本頁面。</p>
    <p><a id="fallback" href="#" data-zh="回到 Rehab Trainer Hub" data-en="Return to Rehab Trainer Hub">回到 Rehab Trainer Hub</a></p>
  </main>
  <script>
    const locale = navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hant-TW';
    for (const element of document.querySelectorAll('[data-' + locale + ']')) {
      element.textContent = element.dataset[locale];
    }
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
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function escapeScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export async function rateLimitResponse(request, env, name, options = {}) {
  const result = await checkRateLimit(request, env, name, options);
  if (result.allowed) return null;
  return jsonResponse(request, env, { error: 'Too many requests.' }, {
    status: 429,
    headers: {
      'Retry-After': String(result.retryAfter),
    },
  });
}

async function checkRateLimit(request, env, name, options = {}) {
  const limit = options.limit ?? 10;
  const windowSeconds = options.windowSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / windowSeconds);
  const resetAt = (windowId + 1) * windowSeconds;
  const client = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
  const identity = options.identity ? `:${options.identity}` : '';
  const key = await sha256Base64Url(`${name}:${client}${identity}:${windowId}`);
  const db = requireDatabase(env);

  await ensureRateLimitTable(db);
  rateLimitCleanupCounter = (rateLimitCleanupCounter + 1) % RATE_LIMIT_CLEANUP_INTERVAL;
  if (rateLimitCleanupCounter === 1) {
    await db
      .prepare('DELETE FROM rate_limits WHERE reset_at < ?')
      .bind(now - 60 * 60)
      .run();
  }
  await db
    .prepare(`
      INSERT INTO rate_limits (key, count, reset_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = count + 1,
        updated_at = excluded.updated_at
    `)
    .bind(key, resetAt, new Date(now * 1000).toISOString())
    .run();

  const row = await db
    .prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?')
    .bind(key)
    .first();
  const count = Number(row?.count || 0);
  return {
    allowed: count <= limit,
    retryAfter: Math.max(1, Number(row?.reset_at || resetAt) - now),
  };
}

async function ensureRateLimitTable(db) {
  if (rateLimitTableReady) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at)').run();
  rateLimitTableReady = true;
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

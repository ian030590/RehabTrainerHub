const defaultAllowedOrigins = [
  'https://trainerhub.cc',
  'https://stroke.trainerhub.cc',
  'https://vision.trainerhub.cc',
  'https://brain.trainerhub.cc',
];
const defaultAuthBaseUrl = 'https://trainerhub.cc';

const localAllowedOrigins = [
  'http://localhost:3010',
  'http://127.0.0.1:3010',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
];

export const authMessageType = 'rehabtrainerhub-auth-session';
export const authCookieName = 'rehabtrainerhub_session';
const passwordHashAlgorithm = 'pbkdf2-sha256';
const passwordHashIterations = 150000;
const sessionTtlSeconds = 60 * 60 * 24 * 7;
const rateLimitCleanupInterval = 100;
let rateLimitTableReady = false;
let rateLimitCleanupCounter = 0;

export function GetAuthBaseUrl(request, env) {
  const url = new URL(request.url);
  if (ShouldAllowLocalOrigins(env, request)) {
    return `${url.protocol}//${url.host}`;
  }
  return GetConfiguredAuthBaseUrl(env);
}

export function GetAllowedOrigins(env, request) {
  const localOrigins = ShouldAllowLocalOrigins(env, request) ? localAllowedOrigins : [];
  return new Set([...defaultAllowedOrigins, ...GetConfiguredAllowedOrigins(env), ...localOrigins]);
}

function ShouldAllowLocalOrigins(env, request) {
  if (env.AUTH_ALLOW_LOCAL_ORIGINS === '1') return true;
  if (!request) return false;

  try {
    return IsLocalHostname(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

function IsLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function GetConfiguredAuthBaseUrl(env) {
  return NormalizeOrigin(env.AUTH_BASE_URL) || defaultAuthBaseUrl;
}

function GetConfiguredAllowedOrigins(env) {
  return String(env.AUTH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => NormalizeOrigin(origin))
    .filter(Boolean);
}

function NormalizeOrigin(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed).origin;
  } catch {
    return '';
  }
}

export function IsAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return GetAllowedOrigins(env, request).has(origin.replace(/\/+$/, ''));
}

export function RejectDisallowedOrigin(request, env) {
  if (IsAllowedOrigin(request, env)) return null;
  return new Response('Origin is not allowed.', {
    status: 403,
    headers: {
      ...CorsHeaders(request, env),
      ...SecurityHeaders(),
    },
  });
}

export function CorsHeaders(request, env) {
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

  if (GetAllowedOrigins(env, request).has(origin.replace(/\/+$/, ''))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function SecurityHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

export function OptionsResponse(request, env) {
  if (!IsAllowedOrigin(request, env)) {
    return new Response('Origin is not allowed.', { status: 403, headers: SecurityHeaders() });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...CorsHeaders(request, env),
      ...SecurityHeaders(),
    },
  });
}

export function JsonResponse(request, env, data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CorsHeaders(request, env),
      ...SecurityHeaders(),
      ...(init.headers || {}),
    },
  });
}

export function ErrorResponse(request, env, message, status = 400) {
  return JsonResponse(request, env, { error: message }, { status });
}

export function RequireDatabase(env) {
  const db = env.REHAB_DB || env.rehab_db;
  if (!db) throw new Error('REHAB_DB D1 binding is not configured.');
  return db;
}

export function RequireSecret(env, name) {
  const value = env[name];
  if (!value || value.length < 24) {
    throw new Error(`${name} must be configured and at least 24 characters.`);
  }
  return value;
}

export function GetStateSecret(env) {
  return RequireSecret(env, 'AUTH_STATE_SECRET');
}

export function GetSessionSecret(env) {
  return RequireSecret(env, 'AUTH_SESSION_SECRET');
}

export function NormalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function IsValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function HashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await DerivePasswordHash(password, salt, passwordHashIterations);
  return [
    passwordHashAlgorithm,
    String(passwordHashIterations),
    Base64UrlEncodeBytes(salt),
    Base64UrlEncodeBytes(hash),
  ].join('$');
}

export async function VerifyPassword(password, storedHash) {
  const [algorithm, iterationsText, saltText, hashText] = String(storedHash || '').split('$');
  const iterations = Number(iterationsText);
  if (algorithm !== passwordHashAlgorithm || !Number.isInteger(iterations) || iterations < 100000) {
    return false;
  }

  try {
    const salt = Base64UrlDecodeBytes(saltText);
    const hash = await DerivePasswordHash(password, salt, iterations);
    return ConstantTimeEqual(Base64UrlEncodeBytes(hash), hashText);
  } catch {
    return false;
  }
}

async function DerivePasswordHash(password, salt, iterations) {
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

export function GetBearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function RequireSession(request, env) {
  const token = GetBearerToken(request);
  if (!token) return null;
  try {
    return await VerifySignedValue(token, GetSessionSecret(env));
  } catch {
    return null;
  }
}

export function GetCookieValue(request, name) {
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

export async function GetCookieSession(request, env) {
  const token = GetCookieValue(request, authCookieName);
  if (!token) return null;
  try {
    return {
      token,
      payload: await VerifySignedValue(token, GetSessionSecret(env)),
    };
  } catch {
    return null;
  }
}

export function CreateSessionCookie(request, token) {
  const secureAttributes = new URL(request.url).protocol === 'https:'
    ? 'SameSite=None; Secure'
    : 'SameSite=Lax';
  return [
    `${authCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${sessionTtlSeconds}`,
    'HttpOnly',
    'Priority=High',
    secureAttributes,
  ].join('; ');
}

export function ClearSessionCookie(request) {
  const secureAttributes = new URL(request.url).protocol === 'https:'
    ? 'SameSite=None; Secure'
    : 'SameSite=Lax';
  return [
    `${authCookieName}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Priority=High',
    secureAttributes,
  ].join('; ');
}

export async function CreateSignedValue(payload, secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = Base64UrlEncode(JSON.stringify(body));
  const signature = await CreateSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function VerifySignedValue(token, secret) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) throw new Error('Malformed token.');

  const expectedSignature = await CreateSignature(encodedPayload, secret);
  if (!ConstantTimeEqual(signature, expectedSignature)) throw new Error('Invalid signature.');

  const payload = JSON.parse(Base64UrlDecode(encodedPayload));
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired.');
  }
  return payload;
}

async function CreateSignature(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Base64UrlEncodeBytes(new Uint8Array(signature));
}

/**
 * Constant-time comparison for ASCII/Base64URL strings only.
 * Do not reuse for arbitrary Unicode text; charCodeAt compares UTF-16 code units.
 */
function ConstantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function Base64UrlEncode(value) {
  return Base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function Base64UrlEncodeBytes(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function Base64UrlDecode(value) {
  return new TextDecoder().decode(Base64UrlDecodeBytes(value));
}

function Base64UrlDecodeBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function IsSafeReturnTo(returnTo, env, request) {
  try {
    const url = new URL(returnTo);
    return GetAllowedOrigins(env, request).has(url.origin);
  } catch {
    return false;
  }
}

export function ToPublicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name || row.email || 'Rehab Trainer Hub User',
    email: row.email || undefined,
    avatarUrl: row.avatar_url || undefined,
    profileCompleted: HasCompletedProfile(row),
    privacyAcceptedAt: row.privacy_accepted_at || undefined,
  };
}

function HasCompletedProfile(row) {
  const profile = row.profile_json ? SafeJsonParse(row.profile_json) : null;
  if (!profile || typeof profile !== 'object') return false;

  return Boolean(
    row.profile_completed_at
    && profile.ageRange
    && profile.gender
    && profile.nationality
    && Array.isArray(profile.chronicDiagnoses)
    && profile.smokingStatus
    && profile.alcoholStatus
    && (profile.smokingStatus !== 'current' || profile.smokingFrequency?.amount)
    && (profile.alcoholStatus !== 'current' || profile.alcoholFrequency?.amount)
  );
}

export function SafeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function GetUserById(env, userId) {
  return RequireDatabase(env)
    .prepare('SELECT * FROM app_users WHERE id = ?')
    .bind(userId)
    .first();
}

export async function CreateSessionForUser(env, user) {
  return CreateSignedValue(
    {
      sub: user.id,
      name: user.display_name || user.email || 'Rehab Trainer Hub User',
      email: user.email || undefined,
    },
    GetSessionSecret(env),
    sessionTtlSeconds,
  );
}

export function AuthPopupHtml(returnTo, token, user, init = {}) {
  const targetOrigin = new URL(returnTo).origin;
  const message = EscapeScriptJson({ type: authMessageType, token, user });
  const targetOriginJson = EscapeScriptJson(targetOrigin);
  const fallbackJson = EscapeScriptJson(returnTo);
  const nonce = crypto.randomUUID().replace(/-/g, '');

  return new Response(`<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rehab Trainer Hub Login</title>
  <style nonce="${nonce}">
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
  <script nonce="${nonce}">
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
      ...SecurityHeaders({
        'Content-Security-Policy': [
          "default-src 'none'",
          `script-src 'nonce-${nonce}'`,
          `style-src 'nonce-${nonce}'`,
          "base-uri 'none'",
          "connect-src 'none'",
          "form-action 'none'",
          "frame-ancestors 'none'",
          "img-src 'none'",
        ].join('; '),
      }),
      ...(init.headers || {}),
    },
  });
}

function EscapeScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export async function RateLimitResponse(request, env, name, options = {}) {
  const result = await CheckRateLimit(request, env, name, options);
  if (result.allowed) return null;
  return JsonResponse(request, env, { error: 'Too many requests.' }, {
    status: 429,
    headers: {
      'Retry-After': String(result.retryAfter),
    },
  });
}

async function CheckRateLimit(request, env, name, options = {}) {
  const limit = options.limit ?? 10;
  const windowSeconds = options.windowSeconds ?? 60;
  const now = Math.floor(Date.now() / 1000);
  const windowId = Math.floor(now / windowSeconds);
  const resetAt = (windowId + 1) * windowSeconds;
  const client = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'unknown';
  const identity = options.identity ? `:${options.identity}` : '';
  const key = await Sha256Base64Url(`${name}:${client}${identity}:${windowId}`);
  const db = RequireDatabase(env);

  await EnsureRateLimitTable(db);
  rateLimitCleanupCounter = (rateLimitCleanupCounter + 1) % rateLimitCleanupInterval;
  if (rateLimitCleanupCounter === 1) {
    await db
      .prepare('DELETE FROM rate_limits WHERE reset_at < ?')
      .bind(now - 60 * 60)
      .run();
  }
  const row = await db
    .prepare(`
      INSERT INTO rate_limits (key, count, reset_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = rate_limits.count + 1,
        updated_at = excluded.updated_at
      RETURNING count, reset_at
    `)
    .bind(key, resetAt, new Date(now * 1000).toISOString())
    .first();
  const count = Number(row?.count || 0);
  return {
    allowed: count <= limit,
    retryAfter: Math.max(1, Number(row?.reset_at || resetAt) - now),
  };
}

async function EnsureRateLimitTable(db) {
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

async function Sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Base64UrlEncodeBytes(new Uint8Array(digest));
}

import assert from 'node:assert/strict';
import {
  authPopupHtml,
  corsHeaders,
  createSessionForUser,
  rateLimitResponse,
  toPublicUser,
} from './auth.js';

const secret = '0123456789abcdef0123456789abcdef';
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: createRateLimitDb(),
};
const user = {
  id: 'user-1',
  display_name: 'Case One',
  email: 'case@example.test',
  profile_completed_at: '2026-07-12T00:00:00.000Z',
  profile_json: JSON.stringify({ chronicDiagnoses: ['centralNervousSystem'] }),
};

assert.equal(toPublicUser(user).profile, undefined);

const token = await createSessionForUser(env, user);
const [encodedPayload] = token.split('.');
const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
assert.equal(payload.exp - payload.iat, 60 * 60 * 24 * 7);

const noOriginHeaders = corsHeaders(new Request('https://rehabtrainerhub.pages.dev/api/auth/me'), env);
assert.equal(noOriginHeaders['Access-Control-Allow-Origin'], undefined);

const popup = await authPopupHtml('https://stroketrainer.pages.dev/', token, toPublicUser(user)).text();
assert.equal(popup.includes('auth_token'), false);
assert.equal(popup.includes('https://stroketrainer.pages.dev/'), true);

const request = new Request('https://rehabtrainerhub.pages.dev/api/auth/password/login', {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.10',
  },
});
assert.equal(await rateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 }), null);
assert.equal(await rateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 }), null);
const limited = await rateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 });
assert.equal(limited.status, 429);
assert.equal(limited.headers.has('retry-after'), true);

console.log('auth security checks passed');

function createRateLimitDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (/INSERT INTO rate_limits/i.test(sql)) {
                const [key, resetAt] = args;
                const current = rows.get(key);
                rows.set(key, {
                  count: (current?.count || 0) + 1,
                  reset_at: resetAt,
                });
              }
              return { success: true };
            },
            async first() {
              if (/SELECT count, reset_at FROM rate_limits/i.test(sql)) {
                return rows.get(args[0]) || null;
              }
              return null;
            },
          };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

import assert from 'node:assert/strict';
import {
  AuthPopupHtml,
  CorsHeaders,
  CreateSessionForUser,
  RateLimitResponse,
  ToPublicUser,
} from './auth.js';

const secret = '0123456789abcdef0123456789abcdef';
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: CreateRateLimitDb(),
};
const user = {
  id: 'user-1',
  display_name: 'Case One',
  email: 'case@example.test',
  profile_completed_at: '2026-07-12T00:00:00.000Z',
  age_range: '40-49',
  gender: 'woman',
  nationality: 'Taiwan',
  chronic_diagnoses_json: JSON.stringify(['centralNervousSystem']),
  smoking_status: 'none',
  alcohol_status: 'none',
  profile_json: JSON.stringify({
    ageRange: '40-49',
    gender: 'woman',
    nationality: 'Taiwan',
    chronicDiagnoses: ['centralNervousSystem'],
    smokingStatus: 'none',
    alcoholStatus: 'none',
  }),
};

assert.equal(ToPublicUser(user).profile, undefined);
assert.equal(ToPublicUser(user).profileCompleted, true);
assert.equal(ToPublicUser({ ...user, profile_json: null }).profileCompleted, false);

const token = await CreateSessionForUser(env, user);
const [encodedPayload] = token.split('.');
const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());
assert.equal(payload.exp - payload.iat, 60 * 60 * 24 * 7);

const noOriginHeaders = CorsHeaders(new Request('https://trainerhub.cc/api/auth/me'), env);
assert.equal(noOriginHeaders['Access-Control-Allow-Origin'], undefined);

const popup = await AuthPopupHtml('https://motor.trainerhub.cc/', token, ToPublicUser(user)).text();
assert.equal(popup.includes('auth_token'), false);
assert.equal(popup.includes('https://motor.trainerhub.cc/'), true);
const popupResponse = AuthPopupHtml('https://motor.trainerhub.cc/', token, ToPublicUser(user));
assert.match(popupResponse.headers.get('content-security-policy'), /script-src 'nonce-/);
assert.equal(popupResponse.headers.get('x-content-type-options'), 'nosniff');

const request = new Request('https://trainerhub.cc/api/auth/password/login', {
  method: 'POST',
  headers: {
    'CF-Connecting-IP': '203.0.113.10',
  },
});
assert.equal(await RateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 }), null);
assert.equal(await RateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 }), null);
const limited = await RateLimitResponse(request, env, 'test-login', { limit: 2, windowSeconds: 60 });
assert.equal(limited.status, 429);
assert.equal(limited.headers.has('retry-after'), true);

console.log('auth security checks passed');

function CreateRateLimitDb() {
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
              if (/INSERT INTO rate_limits/i.test(sql)) {
                const [key, resetAt] = args;
                const current = rows.get(key);
                const row = {
                  count: (current?.count || 0) + 1,
                  reset_at: resetAt,
                };
                rows.set(key, row);
                return row;
              }
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

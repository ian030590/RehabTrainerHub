import assert from 'node:assert/strict';
import {
  authPopupHtml,
  corsHeaders,
  createSessionForUser,
  rateLimitResponse,
  toPublicUser,
} from './auth.js';
import { scanHtml } from '../api/submissions.js';

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
const popupResponse = authPopupHtml('https://stroketrainer.pages.dev/', token, toPublicUser(user));
assert.match(popupResponse.headers.get('content-security-policy'), /script-src 'nonce-/);
assert.equal(popupResponse.headers.get('x-content-type-options'), 'nosniff');

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

const encodedScriptScan = scanHtml('<!doctype html><html><body><scr&#x69;pt>alert(1)</scr&#x69;pt></body></html>', 'en');
assert.equal(encodedScriptScan.ok, false);
assert(encodedScriptScan.messages.some((message) => /script/i.test(message)));

const encodedJavascriptScan = scanHtml('<!doctype html><html><body><a href="java&#115;cript:alert(1)">x</a></body></html>', 'en');
assert.equal(encodedJavascriptScan.ok, false);
assert(encodedJavascriptScan.messages.some((message) => /javascript/i.test(message)));

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

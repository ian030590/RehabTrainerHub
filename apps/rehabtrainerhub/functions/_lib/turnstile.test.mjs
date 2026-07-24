import assert from 'node:assert/strict';
import {
  IsTurnstileConfigured,
  VerifyTurnstileToken,
} from './turnstile.js';

const request = new Request('https://trainerhub.cc/api/auth/password/login', {
  headers: {
    'CF-Connecting-IP': '203.0.113.4',
    Origin: 'https://trainerhub.cc',
  },
});

assert.equal(IsTurnstileConfigured({}), false);
assert.deepEqual(
  await VerifyTurnstileToken(request, {}, '', 'auth'),
  { success: true, skipped: true },
);
assert.deepEqual(
  await VerifyTurnstileToken(request, { TURNSTILE_REQUIRED: '1' }, '', 'auth'),
  { success: false, reason: 'not-configured' },
);

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.equal(payload.secret, 'test-secret');
    assert.equal(payload.response, 'valid-token');
    assert.equal(payload.remoteip, '203.0.113.4');
    return Response.json({
      success: true,
      action: 'auth',
      hostname: 'trainerhub.cc',
    });
  };

  assert.deepEqual(
    await VerifyTurnstileToken(
      request,
      { TURNSTILE_SECRET_KEY: 'test-secret' },
      'valid-token',
      'auth',
    ),
    { success: true, hostname: 'trainerhub.cc' },
  );

  assert.deepEqual(
    await VerifyTurnstileToken(
      request,
      { TURNSTILE_SECRET_KEY: 'test-secret' },
      'valid-token',
      'records',
    ),
    { success: false, reason: 'invalid-action' },
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Turnstile validation checks passed');

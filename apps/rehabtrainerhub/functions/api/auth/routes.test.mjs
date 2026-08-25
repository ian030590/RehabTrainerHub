import assert from 'node:assert/strict';
import { onRequestGet as startAuth } from './start.js';
import { onRequestGet as callbackAuth } from './callback.js';

const env = {};

const startResponse = await startAuth({
  request: new Request('https://trainerhub.cc/api/auth/start?provider=unknown&privacyAccepted=1&returnTo=https%3A%2F%2Fmotor.trainerhub.cc%2F%23%2F'),
  env,
});
assert.notEqual(startResponse.status, 404, 'OAuth start must be handled by a Pages Function, not the static 404 page.');
assert.equal(startResponse.status, 400);

const invalidGoogleClientResponse = await startAuth({
  request: new Request('https://trainerhub.cc/api/auth/start?provider=google&privacyAccepted=1&returnTo=https%3A%2F%2Ftrainerhub.cc%2F'),
  env: {
    AUTH_BASE_URL: 'https://trainerhub.cc',
    GOOGLE_CLIENT_ID: 'not-a-google-web-client',
  },
});
assert.equal(invalidGoogleClientResponse.status, 503);
assert.match(
  await invalidGoogleClientResponse.text(),
  /Google OAuth web client ID/,
  'OAuth start must reject API keys, service accounts, secrets, and other malformed Google client IDs before redirecting.',
);

const callbackResponse = await callbackAuth({
  request: new Request('https://trainerhub.cc/api/auth/callback'),
  env,
});
assert.notEqual(callbackResponse.status, 404, 'OAuth callback must be handled by a Pages Function, not the static 404 page.');
assert.equal(callbackResponse.status, 400);

console.log('Auth route smoke checks passed.');

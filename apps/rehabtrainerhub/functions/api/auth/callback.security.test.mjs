import assert from 'node:assert/strict';
import {
  CreateSignedValue,
  oauthNonceCookieName,
} from '../../_lib/auth.js';
import { onRequestGet } from './callback.js';

const stateSecret = '0123456789abcdef0123456789abcdef';
const oauthNonce = crypto.randomUUID();
const state = await CreateSignedValue({
  provider: 'unsupported-test-provider',
  returnTo: 'https://trainerhub.cc/',
  privacyAccepted: true,
  locale: 'zh-TW',
  oauthNonce,
}, stateSecret, 60);
const callbackUrl = new URL('https://trainerhub.cc/api/auth/callback');
callbackUrl.searchParams.set('code', 'unused-test-code');
callbackUrl.searchParams.set('state', state);
const env = { AUTH_STATE_SECRET: stateSecret };

const missingNonceResponse = await onRequestGet({
  request: new Request(callbackUrl),
  env,
});
assert.equal(missingNonceResponse.status, 400);
assert.equal(await missingNonceResponse.text(), 'Invalid OAuth state.');
assert.match(
  missingNonceResponse.headers.get('Set-Cookie') || '',
  new RegExp(`${oauthNonceCookieName}=.*Max-Age=0`, 'i'),
);

const wrongNonceResponse = await onRequestGet({
  request: new Request(callbackUrl, {
    headers: {
      Cookie: `${oauthNonceCookieName}=${encodeURIComponent('wrong-nonce')}`,
    },
  }),
  env,
});
assert.equal(wrongNonceResponse.status, 400);
assert.equal(await wrongNonceResponse.text(), 'Invalid OAuth state.');

const matchingNonceResponse = await onRequestGet({
  request: new Request(callbackUrl, {
    headers: {
      Cookie: `${oauthNonceCookieName}=${encodeURIComponent(oauthNonce)}`,
    },
  }),
  env,
});
assert.equal(matchingNonceResponse.status, 400);
assert.deepEqual(await matchingNonceResponse.json(), {
  error: 'Unsupported auth provider.',
});

console.log('OAuth callback nonce checks passed');

import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet as authorize } from './authorize.js';
import { onRequestPost as exchange } from './exchange.js';
import { onRequestPost as resolveUser } from './resolve-user.js';
import { Sha256Hex } from '../../_lib/builderAuth.js';

const code = 'a'.repeat(64);
const verifier = 'b'.repeat(64);
const secret = 'c'.repeat(48);
const account = { id: 'hub-user-1', display_name: 'OT Editor', email: 'ot@example.test' };

test('Builder authorization accepts only its exact callback', async () => {
  const url = new URL('https://trainerhub.cc/api/builder/authorize');
  url.searchParams.set('state', code);
  url.searchParams.set('code_challenge', verifier);
  url.searchParams.set('redirect_uri', 'https://attacker.example/api/auth/callback');
  assert.equal((await authorize({ request: new Request(url), env: {} })).status, 400);

  url.searchParams.set('redirect_uri', 'https://builder.trainerhub.cc/api/auth/callback');
  assert.equal((await authorize({ request: new Request(url), env: {} })).status, 401);
});

test('Builder code exchange requires the shared secret and consumes codes once', async () => {
  const codeHash = await Sha256Hex(code);
  const challenge = await Sha256Hex(verifier);
  let used = false;
  const env = {
    BUILDER_CLIENT_SECRET: secret,
    REHAB_DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.startsWith('SELECT user_id,code_challenge')) {
                  return !used && args[0] === codeHash ? { user_id: account.id, code_challenge: challenge } : null;
                }
                if (sql.startsWith('UPDATE builder_auth_codes')) {
                  if (used || args[1] !== codeHash) return null;
                  used = true;
                  return { user_id: account.id };
                }
                if (sql.startsWith('SELECT id,display_name,email')) return account;
                throw new Error(`Unexpected query: ${sql}`);
              },
            };
          },
        };
      },
    },
  };
  const request = (supplied, codeVerifier = verifier) => new Request('https://trainerhub.cc/api/builder/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Builder-Secret': supplied },
    body: JSON.stringify({ code, code_verifier: codeVerifier }),
  });
  assert.equal((await exchange({ request: request('wrong'), env })).status, 401);
  assert.equal((await exchange({ request: request(secret, 'd'.repeat(64)), env })).status, 401);
  const accepted = await exchange({ request: request(secret), env });
  assert.equal(accepted.status, 200);
  assert.deepEqual((await accepted.json()).user, { id: account.id, displayName: account.display_name });
  assert.equal((await exchange({ request: request(secret), env })).status, 401);
});

test('Builder collaborator lookup is restricted to the shared secret', async () => {
  const env = {
    BUILDER_CLIENT_SECRET: secret,
    REHAB_DB: { prepare: () => ({ bind: () => ({ first: async () => account }) }) },
  };
  const request = (supplied) => new Request('https://trainerhub.cc/api/builder/resolve-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Builder-Secret': supplied },
    body: JSON.stringify({ email: account.email }),
  });
  assert.equal((await resolveUser({ request: request('wrong'), env })).status, 401);
  assert.equal((await resolveUser({ request: request(secret), env })).status, 200);
});

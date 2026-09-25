import assert from 'node:assert/strict';
import test from 'node:test';
import { EnsureOculomotorBucket } from './ensure-oculomotor-bucket.mjs';

const response = (status, result) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ success: status < 300, result }),
});

test('bucket provisioning is idempotent and uses a private R2 bucket name', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return calls.length === 1 ? response(404) : response(200, { name: 'oculomotor-data' });
  };
  assert.equal(await EnsureOculomotorBucket({ accountId: 'account', token: 'secret', fetchImpl }), 'created');
  assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/accounts/account/r2/buckets/oculomotor-data');
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { name: 'oculomotor-data' });
  assert.equal(await EnsureOculomotorBucket({
    accountId: 'account', token: 'secret', fetchImpl: async () => response(200, { name: 'oculomotor-data' }),
  }), 'existing');
  let racedCalls = 0;
  assert.equal(await EnsureOculomotorBucket({
    accountId: 'account', token: 'secret', fetchImpl: async () => {
      racedCalls += 1;
      return racedCalls === 1 ? response(404)
        : racedCalls === 2 ? response(409) : response(200, { name: 'oculomotor-data' });
    },
  }), 'existing');
});

test('bucket provisioning fails closed on permission or unexpected API responses', async () => {
  await assert.rejects(() => EnsureOculomotorBucket({ accountId: '', token: 'secret' }));
  await assert.rejects(() => EnsureOculomotorBucket({
    accountId: 'account', token: 'secret', fetchImpl: async () => response(403),
  }), /lookup failed/);
  await assert.rejects(() => EnsureOculomotorBucket({
    accountId: 'account', token: 'secret', fetchImpl: async (url) => url.endsWith('oculomotor-data')
      ? response(404) : response(403),
  }), /creation failed/);
});

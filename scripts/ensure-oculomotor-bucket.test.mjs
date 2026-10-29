import assert from 'node:assert/strict';
import test from 'node:test';
import { EnsureOculomotorBucket, EnsurePrivateDataBuckets } from './ensure-oculomotor-bucket.mjs';

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

test('the CI command ensures both private CSV buckets without changing public access', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return init.method === 'POST' ? response(200, { name: JSON.parse(init.body).name }) : response(404);
  };
  assert.deepEqual(await EnsurePrivateDataBuckets({ accountId: 'account', token: 'secret', fetchImpl }),
    { 'oculomotor-data': 'created', 'rehab-raw-data': 'created' });
  assert.deepEqual(calls.filter(call => call.init.method === 'POST').map(call => JSON.parse(call.init.body)),
    [{ name: 'oculomotor-data' }, { name: 'rehab-raw-data' }]);
  assert.equal(calls.length, 4);
});

test('raw bucket provisioning failure aborts the CI prerequisite', async () => {
  await assert.rejects(() => EnsurePrivateDataBuckets({ accountId: 'account', token: 'secret', fetchImpl: async url =>
    url.endsWith('/oculomotor-data') ? response(200, { name: 'oculomotor-data' }) : response(403) }), /lookup failed/);
});

test('both existing private buckets are reused without creation', async () => {
  const calls = [];
  assert.deepEqual(await EnsurePrivateDataBuckets({ accountId: 'account', token: 'secret', fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return response(200, { name: url.split('/').at(-1) });
  } }), { 'oculomotor-data': 'existing', 'rehab-raw-data': 'existing' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ init }) => !init.method));
});

test('malformed lookup and creation responses fail closed', async () => {
  for (const create of [false, true]) {
    for (const payload of [{ success: false, result: { name: 'oculomotor-data' } },
      { success: true, result: { name: 'another-bucket' } }]) {
      let calls = 0;
      await assert.rejects(() => EnsureOculomotorBucket({ accountId: 'account', token: 'secret', fetchImpl: async () => {
        calls++;
        return create && calls === 1 ? response(404) : { ok: true, status: 200, json: async () => payload };
      } }));
    }
  }
});

test('a create race only succeeds after a successful lookup of the exact bucket', async () => {
  let calls = 0;
  await assert.rejects(() => EnsureOculomotorBucket({ accountId: 'account', token: 'secret', fetchImpl: async () => {
    calls++;
    return calls === 1 ? response(404) : calls === 2 ? response(409)
      : { ok: true, status: 200, json: async () => ({ success: false, result: { name: 'oculomotor-data' } }) };
  } }), /creation failed/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CleanupOculomotorCsv } from './cleanup-oculomotor-csv.mjs';
import { GetCloudflareCredentials } from './cloudflare-credentials.mjs';

const credentials = { token: 'FAKE_SECRET_TOKEN', account: 'FAKE_ACCOUNT_ID' };
const getCredentials = async () => credentials;
const respond = (result, resultInfo = { is_truncated: false }) => Response.json({ success: true, result, result_info: resultInfo });

test('dry run lists all prefixes using REST cursor fields, counts bytes, and never leaks keys or credentials', async () => {
  const logs = [];
  const urls = [];
  const stats = await CleanupOculomotorCsv({ getCredentials, log: value => logs.push(value), fetchImpl: async (url, options) => {
    urls.push(new URL(url));
    assert.equal(options.headers.Authorization, `Bearer ${credentials.token}`);
    assert.equal(options.method, 'GET');
    return urls.length === 1 ? respond([{ key: 'guests/FAKE_SUBJECT/a.csv', size: 10 }, { key: 'users/FAKE_USER/b.csv', size: 20 }], { cursor: 'fake-next', is_truncated: true })
      : respond([{ key: 'checksums/fake', size: 3 }, { key: 'receipts/users/fake', size: 4 }, { key: 'other/private/file', size: 5 }, { key: 'private-root.csv', size: 6 }]);
  } });
  assert.equal(stats.scanned, 6);
  assert.equal(stats.bytes, 48);
  assert.equal(stats.deleted, 0);
  assert.deepEqual(stats.prefixes['guests/'], { count: 1, bytes: 10 });
  assert.deepEqual(stats.prefixes['(root)'], { count: 1, bytes: 6 });
  assert.equal(urls[0].searchParams.get('per_page'), '1000');
  assert.equal(urls[1].searchParams.get('cursor'), 'fake-next');
  assert.ok(urls.every(url => !url.searchParams.has('prefix') && !url.searchParams.has('delimiter')));
  for (const secret of ['FAKE_SUBJECT', 'FAKE_USER', credentials.token, credentials.account, 'private-root.csv', 'private/file']) assert.ok(!logs.join('\n').includes(secret));
});

test('apply requires explicit exact bucket name before looking up credentials or making requests', async () => {
  for (const options of [{ apply: true }, { apply: true, bucket: 'rehab-storage' }, { bucket: 'other' }]) {
    await assert.rejects(CleanupOculomotorCsv({ ...options, getCredentials: () => { throw new Error('must not run'); } }), /bucket|oculomotor-data/);
  }
});

test('apply encodes each key segment and bounds concurrency at eight', async () => {
  let active = 0;
  let peak = 0;
  const deletedUrls = [];
  const keys = Array.from({ length: 19 }, (_, i) => `users/fake/${i} 空白?#%'.csv`);
  const stats = await CleanupOculomotorCsv({ apply: true, bucket: 'oculomotor-data', getCredentials, log: () => {}, fetchImpl: async (url, options) => {
    if (options.method === 'GET') return respond(keys.map(key => ({ key, size: 2 })));
    active += 1; peak = Math.max(peak, active);
    deletedUrls.push(url);
    await new Promise(resolve => setTimeout(resolve, 2));
    active -= 1;
    return respond(null);
  } });
  assert.equal(stats.deleted, 19);
  assert.equal(stats.deletedBytes, 38);
  assert.equal(peak, 8);
  assert.ok(deletedUrls.includes(`https://api.cloudflare.com/client/v4/accounts/FAKE_ACCOUNT_ID/r2/buckets/oculomotor-data/objects/${keys[0].split('/').map(encodeURIComponent).join('/')}`));
});

test('cursor loops and malformed responses stop without exposing response bodies', async () => {
  let calls = 0;
  await assert.rejects(CleanupOculomotorCsv({ getCredentials, log: () => {}, fetchImpl: async () => {
    calls += 1;
    return respond([], { is_truncated: true, cursor: 'loop' });
  } }), /cursor/i);
  assert.equal(calls, 2);
  await assert.rejects(CleanupOculomotorCsv({ getCredentials, log: () => {}, fetchImpl: async () => respond([], { is_truncated: true }) }), /cursor/i);
  await assert.rejects(CleanupOculomotorCsv({ getCredentials, log: () => {}, fetchImpl: async () => Response.json({ success: true, result: {} }) }), /response/i);
});

test('429 and 5xx retry with backoff, repeated failures stop later work and print safe partial counts', async () => {
  const delays = [];
  let attempts = 0;
  const stats = await CleanupOculomotorCsv({ getCredentials, log: () => {}, sleep: async delay => delays.push(delay), fetchImpl: async () => {
    attempts += 1;
    if (attempts < 3) return new Response(credentials.token, { status: attempts === 1 ? 429 : 503 });
    return respond([]);
  } });
  assert.equal(stats.scanned, 0);
  assert.deepEqual(delays, [500, 1000]);
  const logs = [];
  let deletes = 0;
  await assert.rejects(CleanupOculomotorCsv({ apply: true, bucket: 'oculomotor-data', getCredentials, log: value => logs.push(value), sleep: async () => {}, fetchImpl: async (url, options) => {
    if (options.method === 'GET') return respond(Array.from({ length: 30 }, (_, i) => ({ key: `users/fake/${i}`, size: 1 })));
    deletes += 1;
    return new Response(credentials.token, { status: 503 });
  } }), error => !error.message.includes(credentials.token) && /failed|503/i.test(error.message));
  assert.equal(deletes, 8 * 4);
  assert.match(logs.at(-1), /deleted=0/);
  assert.ok(!logs.join('\n').includes(credentials.token));
});

test('network errors are sanitized and nonretryable failures are attempted once', async () => {
  for (const network of [false, true]) {
    let attempts = 0;
    await assert.rejects(CleanupOculomotorCsv({ getCredentials, log: () => {}, sleep: async () => {}, fetchImpl: async () => {
      attempts += 1;
      if (network) throw new Error(credentials.token);
      return new Response(credentials.token, { status: 403 });
    } }), error => !error.message.includes(credentials.token));
    assert.equal(attempts, network ? 4 : 1);
  }
});

test('dot path segments cannot redirect a delete outside the confirmed bucket', async () => {
  let deletes = 0;
  await assert.rejects(CleanupOculomotorCsv({ apply: true, bucket: 'oculomotor-data', getCredentials, log: () => {}, fetchImpl: async (url, options) => {
    if (options.method === 'GET') return respond([{ key: '../../another-bucket/objects/fake.csv', size: 1 }]);
    deletes += 1;
    return respond(null);
  } }), /key|path/i);
  assert.equal(deletes, 0);
});

test('shared credential lookup supports env and Wrangler OAuth without printing values', async () => {
  assert.deepEqual(await GetCloudflareCredentials({ env: { CLOUDFLARE_API_TOKEN: credentials.token, CLOUDFLARE_ACCOUNT_ID: credentials.account } }), credentials);
  let path;
  assert.deepEqual(await GetCloudflareCredentials({ env: { WRANGLER_AUTH_CONFIG: 'fake.toml' },
    readFileImpl: async configPath => { path = configPath; return `oauth_token = "${credentials.token}"`; },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.cloudflare.com/client/v4/accounts');
      assert.equal(options.headers.Authorization, `Bearer ${credentials.token}`);
      return respond([{ id: credentials.account }]);
    } }), credentials);
  assert.equal(path, 'fake.toml');
  await assert.rejects(GetCloudflareCredentials({ env: { CLOUDFLARE_API_TOKEN: credentials.token }, fetchImpl: async () => { throw new Error(credentials.token); } }), error => !error.message.includes(credentials.token));
});

test('a successful delete with an empty or non-JSON body still counts, but an explicit failure envelope stops', async () => {
  const bodies = [new Response(null, { status: 204 }), new Response('', { status: 200 }), new Response('deleted', { status: 200 })];
  const stats = await CleanupOculomotorCsv({ apply: true, bucket: 'oculomotor-data', getCredentials, log: () => {}, fetchImpl: async (url, options) => {
    if (options.method === 'GET') return respond([{ key: 'guests/a/1.csv', size: 1 }, { key: 'guests/a/2.csv', size: 1 }, { key: 'guests/a/3.csv', size: 1 }]);
    return bodies.shift();
  } });
  assert.equal(stats.deleted, 3);
  await assert.rejects(CleanupOculomotorCsv({ apply: true, bucket: 'oculomotor-data', getCredentials, log: () => {}, fetchImpl: async (url, options) => (
    options.method === 'GET' ? respond([{ key: 'guests/a/1.csv', size: 1 }]) : Response.json({ success: false })) }), /unsuccessful/);
});

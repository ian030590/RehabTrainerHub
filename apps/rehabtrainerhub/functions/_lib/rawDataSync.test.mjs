import assert from 'node:assert/strict';
import test from 'node:test';
import { ProcessRawDataSync } from './rawDataSync.js';

const subjectId = '12345678-1234-4234-8234-123456789abc';
const recordId = 'abcdefab-1234-4234-8234-123456789abc';
const rawKey = `pending/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const eyeKey = `guests/${subjectId}/${recordId}.csv`;
const root = '/RehabTrainerHub/raw-data';
const rawPath = `${root}/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const csv = 'trial,score\n1,7\n';

const username = 'fake-owner@example.test';
const password = 'fake-password-密碼🔑';

function CreateBucket(entries = [], pageSize = 1000) {
  const objects = new Map(entries.map((entry) => {
    const object = typeof entry === 'string' ? { key: entry } : entry;
    return [object.key, { text: csv, etag: 'etag-1', version: 'version-1',
      size: Buffer.byteLength(csv), uploaded: new Date('2026-10-24T02:00:00Z'), ...object }];
  }));
  return {
    objects, listCalls: [], getCalls: [], deleted: [],
    async list(options) {
      this.listCalls.push(options);
      const matching = [...objects.values()].filter(({ key }) => key.startsWith(options.prefix)
        && (!options.cursor || key > options.cursor)).sort((a, b) => a.key.localeCompare(b.key));
      const page = matching.slice(0, Math.min(pageSize, options.limit ?? 1000));
      return { objects: page.map(({ text, ...metadata }) => ({ ...metadata })),
        truncated: matching.length > page.length, cursor: page.at(-1)?.key };
    },
    async get(key, options) {
      this.getCalls.push({ key, options });
      const object = objects.get(key);
      if (!object) return null;
      const { text, ...metadata } = object;
      if (options?.onlyIf?.etagMatches && options.onlyIf.etagMatches !== object.etag) return metadata;
      return { ...metadata, body: new Blob([text]).stream(),
        async arrayBuffer() { return new TextEncoder().encode(text).buffer; } };
    },
    async head(key) {
      const object = objects.get(key);
      if (!object) return null;
      const { text, ...metadata } = object;
      return { ...metadata };
    },
    async delete(key) { this.deleted.push(key); objects.delete(key); },
  };
}

function CreateWebdav(options = {}) {
  const folders = new Map([['', true], ...(options.folders ?? []).map((path) => [path, true])]);
  const files = new Map(Object.entries(options.existing ?? {}));
  for (const path of files.keys()) {
    const segments = path.split('/').slice(1, -1);
    for (let index = 1; index <= segments.length; index++) folders.set(`/${segments.slice(0, index).join('/')}`, true);
  }
  const requests = [];
  const uploads = [];
  return { folders, files, requests, uploads,
    async fetch(url, init) {
      const parsed = new URL(url);
      const path = parsed.pathname.split('/').map(decodeURIComponent).join('/');
      const method = init.method;
      requests.push({ url: String(url), init, method, path });
      assert.equal(new Headers(init.headers).get('Authorization'), `Basic ${Buffer.from(`${options.username ?? username}:${password}`, 'utf8').toString('base64')}`);
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(parsed.username, '');
      assert.equal(parsed.password, '');
      assert.equal(parsed.search, '');
      assert.equal(parsed.hash, '');
      assert.ok(!String(url).includes(username) && !String(url).includes(password));
      if (options.failAt === method) {
        if (options.status === 'timeout') throw new DOMException(`${username} ${password} ${rawKey}`, 'TimeoutError');
        return new Response(`${username} ${password} ${rawKey}`, { status: options.status ?? 507 });
      }
      if (method === 'GET') {
        if (!files.has(path)) return new Response(null, { status: 404 });
        const text = uploads.some((upload) => upload.path === path) && options.verifyText !== undefined
          ? options.verifyText : files.get(path);
        return new Response(text, { headers: { 'Content-Length': String(Buffer.byteLength(text)) } });
      }
      const parent = path.slice(0, path.lastIndexOf('/'));
      if (!folders.has(parent)) return new Response(null, { status: 409 });
      if (method === 'MKCOL') {
        if (folders.has(path)) return new Response(null, { status: 405 });
        folders.set(path, true);
        return new Response(null, { status: 201 });
      }
      assert.equal(method, 'PUT');
      assert.equal(new Headers(init.headers).get('Content-Type'), 'text/csv; charset=utf-8');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(init.body);
      files.set(path, text);
      uploads.push({ path, text });
      return new Response(null, { status: options.putStatus ?? 201 });
    },
  };
}

function CreateRun(raw = [rawKey], eye = [], webdavOptions = {}, pageSize) {
  const rawBucket = CreateBucket(raw, pageSize);
  const eyeBucket = CreateBucket(eye, pageSize);
  const pcloud = CreateWebdav(webdavOptions);
  const logs = [];
  const env = { RAW_DATA: rawBucket, OCULOMOTOR_DATA: eyeBucket,
    PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com', PCLOUD_WEBDAV_USERNAME: webdavOptions.username ?? username, PCLOUD_WEBDAV_PASSWORD: password };
  const options = { fetch: pcloud.fetch, log: (...args) => logs.push(args) };
  return { rawBucket, eyeBucket, pcloud, logs, env, options, run: () => ProcessRawDataSync(env, options) };
}

function AssertPrivateLogs(logs) {
  for (const privateText of [username, password, rawKey, subjectId, csv]) assert.ok(!JSON.stringify(logs).includes(privateText));
}

test('uploads exact CSV bytes, verifies by GET before head and delete, and logs only the summary', async () => {
  const run = CreateRun();
  const originalHead = run.rawBucket.head.bind(run.rawBucket);
  run.rawBucket.head = async (key) => {
    assert.equal(run.pcloud.requests.filter(({ method }) => method === 'GET').length, 2);
    assert.equal(run.pcloud.files.get(rawPath), csv);
    return originalHead(key);
  };
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 1, alreadySynced: 0, deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text: csv }]);
  assert.deepEqual(run.rawBucket.deleted, [rawKey]);
  assert.deepEqual(run.rawBucket.getCalls[0].options, { onlyIf: { etagMatches: 'etag-1' } });
  assert.ok(JSON.stringify(run.logs).includes('"deleted":1'));
  AssertPrivateLogs(run.logs);
});

test('a matching earlier upload is verified by GET and deleted without PUT or MKCOL', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv } });
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 0, alreadySynced: 1, deleted: 1, skipped: 0, failed: 0 });
  assert.equal(run.pcloud.requests.length, 1);
  assert.equal(run.pcloud.requests[0].path, rawPath);
  assert.deepEqual(run.pcloud.uploads, []);
});

for (const verifyText of [csv.replace('7', '8'), `${csv}extra`, csv.slice(0, -1)]) {
  test(`an uploaded SHA-256 or size mismatch retains R2 data: ${verifyText.length}`, async () => {
    const run = CreateRun([rawKey], [], { verifyText });
    const summary = await run.run();
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

test('different existing bytes with the same length are overwritten at the same path and verified', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv.replace('7', '8') } });
  assert.equal((await run.run()).deleted, 1);
  assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text: csv }]);
});

test('a failed R2 deletion recovers next run through the previously verified remote file', async () => {
  const run = CreateRun();
  const originalDelete = run.rawBucket.delete.bind(run.rawBucket);
  run.rawBucket.delete = async () => { throw new Error('R2 unavailable'); };
  const first = await run.run();
  assert.equal(first.failed, 1);
  assert.equal(first.deleted, 0);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
  run.rawBucket.delete = originalDelete;
  const second = await run.run();
  assert.equal(second.alreadySynced, 1);
  assert.equal(second.uploaded, 0);
  assert.equal(second.deleted, 1);
  assert.equal(run.pcloud.uploads.length, 1);
});

for (const status of [401, 404, 507, 'timeout']) {
  test(`a failed verification GET retains the uploaded source: ${status}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => {
      if (init.method === 'GET' && run.pcloud.uploads.length) {
        if (status === 'timeout') throw new DOMException(`${password} ${rawKey}`, 'TimeoutError');
        return new Response(`${username} ${password}`, { status });
      }
      return originalFetch(url, init);
    };
    const summary = await run.run();
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(summary.failed, 1);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
    AssertPrivateLogs(run.logs);
  });
}

for (const method of ['GET', 'MKCOL', 'PUT']) {
  for (const status of [401, 507, 'timeout', 302, 202]) {
    test(`WebDAV ${method} ${status} retains R2 and counts a failure without leaking data`, async () => {
      const run = CreateRun([rawKey], [], { failAt: method, status });
      assert.equal((await run.run()).failed, 1);
      assert.deepEqual(run.rawBucket.deleted, []);
      AssertPrivateLogs(run.logs);
      const operation = { GET: 'existing-checksum', MKCOL: 'folders', PUT: 'upload' }[method];
      assert.ok(run.logs.some(([line]) => line === `raw-data-sync failed RAW_DATA item=1: ${operation}`));
      if (typeof status === 'number') assert.ok(run.logs.some(([line]) => line === `raw-data-sync webdav ${method} http=${status}`));
    });
  }
}

for (const putStatus of [200, 201, 204]) {
  test(`PUT ${putStatus} is accepted only after GET-back verification`, async () => {
    const run = CreateRun([rawKey], [], { putStatus });
    assert.equal((await run.run()).deleted, 1);
    assert.equal(run.pcloud.requests.at(-1).method, 'GET');
  });
}

test('MKCOL 405 accepts existing folders and PUT into a missing folder would fail', async () => {
  const run = CreateRun([rawKey], [], { folders: ['/RehabTrainerHub', root] });
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.requests.filter(({ method }) => method === 'MKCOL').length, 6);
});

for (const change of [
  { PCLOUD_WEBDAV_URL: undefined }, { PCLOUD_WEBDAV_URL: 'http://ewebdav.pcloud.com' },
  { PCLOUD_WEBDAV_URL: 'https://evil.example' }, { PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com/evil' },
  { PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com/' }, { PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com?secret=fake' },
  { PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com#fake' }, { PCLOUD_WEBDAV_URL: 'https://fake@ewebdav.pcloud.com' },
  { PCLOUD_WEBDAV_USERNAME: undefined }, { PCLOUD_WEBDAV_USERNAME: '' }, { PCLOUD_WEBDAV_USERNAME: 'fake:owner' },
  { PCLOUD_WEBDAV_USERNAME: 'fake\n' }, { PCLOUD_WEBDAV_USERNAME: 'fake\u007f' }, { PCLOUD_WEBDAV_USERNAME: 'fake\u0085' },
  { PCLOUD_WEBDAV_PASSWORD: undefined }, { PCLOUD_WEBDAV_PASSWORD: '' }, { PCLOUD_WEBDAV_PASSWORD: 'fake\n' },
  { PCLOUD_WEBDAV_PASSWORD: 'fake\u0085' }, { PCLOUD_ROOT_FOLDER: '/safe\n' },
  { PCLOUD_WEBDAV_URL: undefined, PCLOUD_WEBDAV_USERNAME: undefined, PCLOUD_WEBDAV_PASSWORD: undefined,
    PCLOUD_API_HOST: 'eapi.pcloud.com', PCLOUD_ACCESS_TOKEN: 'fake-old-token' },
  { PCLOUD_ROOT_FOLDER: 'relative' }, { PCLOUD_ROOT_FOLDER: '/safe/../unsafe' },
  { PCLOUD_ROOT_FOLDER: '/safe/%2e%2e/unsafe' }, { PCLOUD_ROOT_FOLDER: '/safe//unsafe' },
  { RAW_DATA: undefined }, { OCULOMOTOR_DATA: undefined },
]) {
  test(`unsafe or missing configuration refuses all I/O: ${JSON.stringify(change)}`, async () => {
    const run = CreateRun();
    Object.assign(run.env, change);
    await assert.rejects(run.run(), /configuration/i);
    assert.equal(run.rawBucket.listCalls.length, 0);
    assert.equal(run.pcloud.requests.length, 0);
    assert.deepEqual(run.logs, [['raw-data-sync refused: configuration']]);
    assert.equal(run.rawBucket.deleted.length, 0);
  });
}

test('UTF-8 credentials stay in the Basic header and both WebDAV regions are accepted', async () => {
  for (const endpoint of ['https://ewebdav.pcloud.com', 'https://webdav.pcloud.com']) {
    const run = CreateRun();
    run.env.PCLOUD_WEBDAV_URL = endpoint;
    assert.equal((await run.run()).deleted, 1);
    for (const request of run.pcloud.requests) assert.equal(new URL(request.url).origin, endpoint);
    AssertPrivateLogs(run.logs);
  }
});

test('a declared oversized existing GET is not buffered and is overwritten', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  let cancelled = false;
  run.options.fetch = async (url, init) => {
    if (init.method === 'GET' && !run.pcloud.uploads.length) {
      return { status: 200, headers: new Headers({ 'Content-Length': String(25 * 1024 * 1024 + 1) }),
        body: { async cancel() { cancelled = true; } },
        async arrayBuffer() { assert.fail('oversized body must not be buffered'); } };
    }
    return originalFetch(url, init);
  };
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.uploads.length, 1);
  assert.equal(cancelled, true);
});

test('Unicode credentials and CSV bytes survive UTF-8 encoding without changing the root validation', async () => {
  const text = 'trial,label\n1,測試🔑\n';
  const run = CreateRun([{ key: rawKey, text, size: Buffer.byteLength(text) }], [], { username: '假帳號@example.test' });
  assert.equal((await run.run()).deleted, 1);
  assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text }]);
  assert.ok(!JSON.stringify(run.logs).includes('假帳號'));
});

test('GET without Content-Length stops reading as soon as it exceeds the source size', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  let cancelled = false;
  run.options.fetch = async (url, init) => {
    if (init.method === 'GET' && !run.pcloud.uploads.length) {
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(Buffer.byteLength(csv) + 1)); },
        cancel() { cancelled = true; },
      }));
    }
    return originalFetch(url, init);
  };
  assert.equal((await run.run()).deleted, 1);
  assert.equal(cancelled, true);
});

test('an oversized verification response is not buffered and keeps the R2 source', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => {
    if (init.method === 'GET' && run.pcloud.uploads.length) {
      return { status: 200, headers: new Headers({ 'Content-Length': String(25 * 1024 * 1024 + 1) }),
        async arrayBuffer() { assert.fail('oversized verification must not be buffered'); } };
    }
    return originalFetch(url, init);
  };
  const summary = await run.run();
  assert.equal(summary.uploaded, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.deleted, 0);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
});

test('each request timeout is capped at 30 seconds and the remaining run budget', async (context) => {
  const timeouts = [];
  context.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const run = CreateRun();
  let now = 0;
  run.options.now = () => now;
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => {
    const response = await originalFetch(url, init);
    now = 580001;
    return response;
  };
  assert.equal((await run.run()).deleted, 1);
  assert.equal(timeouts[0], 30000);
  assert.ok(timeouts.slice(1).every((milliseconds) => milliseconds === 19999));
});

test('MKCOL and PUT response bodies are released before the next request', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  let pending = false;
  let cancelled = 0;
  run.options.fetch = async (url, init) => {
    assert.equal(pending, false, 'the previous response must release its connection');
    const response = await originalFetch(url, init);
    if (init.method === 'GET') return response;
    pending = true;
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('unused WebDAV response')); },
      cancel() { pending = false; cancelled++; },
    }), { status: response.status });
  };
  assert.equal((await run.run()).deleted, 1);
  assert.equal(cancelled, run.pcloud.requests.filter(({ method }) => method !== 'GET').length);
});

test('invalid ids, traversal, dates, extensions and oversized objects are skipped without reading bodies', async () => {
  const invalid = [
    rawKey.replace('/n-back/', '/N_BACK/'), rawKey.replace(subjectId, 'not-a-uuid'),
    rawKey.replace('2026-10-24', '2026-02-30'), rawKey.replace('2026-10-24', '../2026-10-24'),
    rawKey.replace(recordId, '%2fsecret'), rawKey.replace('.csv', '.json'),
    rawKey.replace('/rounds/', '/unknown/'), rawKey.replace('/n-back/', '/./'),
    rawKey.replace('/n-back/', '/n-back\n/'), rawKey.replace(subjectId, `${subjectId}\n`),
    { key: rawKey, size: 25 * 1024 * 1024 + 1 },
  ];
  const run = CreateRun(invalid);
  const summary = await run.run();
  assert.equal(summary.scanned, invalid.length);
  assert.equal(summary.skipped, invalid.length);
  assert.equal(run.rawBucket.getCalls.length, 0);
  assert.equal(run.pcloud.requests.length, 0);
});

test('all raw categories and guest eye keys map to Subject ID paths while old account eye files remain untouched', async () => {
  const raw = ['rounds', 'hand', 'head', 'pose', 'tongue'].map((kind) => rawKey.replace('/rounds/', `/${kind}/`));
  const accountKey = `users/encoded%40account/${recordId}.csv`;
  const run = CreateRun(raw, [eyeKey, accountKey]);
  assert.equal((await run.run()).deleted, 6);
  assert.equal(run.eyeBucket.objects.has(accountKey), true);
  assert.equal(run.eyeBucket.listCalls[0].prefix, 'guests/');
  assert.ok(run.pcloud.uploads.some(({ path }) => path === `${root}/eye/oculomotor-training/${subjectId}/2026-10-24/${recordId}.csv`));
  assert.doesNotMatch(JSON.stringify(run.pcloud.uploads), /encoded|account|users/);
});

test('account eye CSVs use verified Subject ID metadata and the fixed recorded date', async () => {
  const accountKey = `users/encoded%40account/${recordId}.csv`;
  const run = CreateRun([], [{ key: accountKey,
    customMetadata: { subjectId, recordedDate: '2026-10-23' } }]);
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 1, alreadySynced: 0, deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(run.pcloud.uploads, [{ path: `${root}/eye/oculomotor-training/${subjectId}/2026-10-23/${recordId}.csv`, text: csv }]);
  assert.deepEqual(run.eyeBucket.deleted, [accountKey]);
  assert.ok(run.eyeBucket.listCalls.some(({ prefix }) => prefix === 'users/'));
  assert.ok(run.eyeBucket.listCalls.every(({ include }) => include?.includes('customMetadata')));
  assert.doesNotMatch(JSON.stringify(run.pcloud.requests.map(({ url }) => url)) + JSON.stringify(run.logs), /encoded%40account|users\//);
});

test('account eye CSVs lacking valid Subject ID or fixed-date metadata are skipped without reading', async () => {
  const invalid = [undefined, {}, { subjectId }, { subjectId: 'account-id', recordedDate: '2026-10-23' },
    { subjectId, recordedDate: '2026-02-30' }, { subjectId, recordedDate: '2026-10-23\n' }];
  const entries = invalid.map((customMetadata, index) => ({ key: `users/account/record-${index}.csv`, customMetadata }));
  const run = CreateRun([], entries);
  assert.deepEqual(await run.run(), { scanned: invalid.length, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: invalid.length, failed: 0 });
  assert.equal(run.eyeBucket.getCalls.length, 0);
  assert.equal(run.pcloud.requests.length, 0);
});

test('guest eye CSVs prefer a valid fixed date and retain the uploaded-date fallback for older objects', async () => {
  for (const recordedDate of ['2026-10-23', '2026-02-30', undefined]) {
    const run = CreateRun([], [{ key: eyeKey, customMetadata: { recordedDate } }]);
    assert.equal((await run.run()).deleted, 1);
    const date = recordedDate === '2026-10-23' ? recordedDate : '2026-10-24';
    assert.equal(run.pcloud.uploads[0].path, `${root}/eye/oculomotor-training/${subjectId}/${date}/${recordId}.csv`);
    assert.ok(run.eyeBucket.listCalls.every(({ include }) => include?.includes('customMetadata')));
  }
});

for (const stage of ['get', 'head']) {
  for (const change of [{ subjectId: '87654321-1234-4234-8234-123456789abc' }, { recordedDate: '2026-10-22' }, { subjectId: undefined }]) {
    test(`account eye mapping changed at ${stage} cannot upload stale metadata or delete: ${JSON.stringify(change)}`, async () => {
      const accountKey = `users/encoded%40account/${recordId}.csv`;
      const run = CreateRun([], [{ key: accountKey, customMetadata: { subjectId, recordedDate: '2026-10-23' } }]);
      const original = run.eyeBucket[stage].bind(run.eyeBucket);
      run.eyeBucket[stage] = async (...args) => {
        const object = await original(...args);
        return { ...object, customMetadata: { ...object.customMetadata, ...change } };
      };
      const summary = await run.run();
      assert.equal(summary.failed, 1);
      assert.equal(summary.deleted, 0);
      assert.equal(run.eyeBucket.objects.has(accountKey), true);
      assert.equal(run.pcloud.uploads.length, stage === 'get' ? 0 : 1);
    });
  }
}

test('folders use encoded segments and MKCOLs are cached across pages', async () => {
  const nextKey = rawKey.replace(recordId, 'another-record');
  const run = CreateRun([rawKey, nextKey], [], {}, 1);
  run.env.PCLOUD_ROOT_FOLDER = '/Owner archive/raw data';
  assert.equal((await run.run()).deleted, 2);
  const folders = run.pcloud.requests.filter(({ method }) => method === 'MKCOL');
  const segments = ['Owner archive', 'raw data', 'rounds', 'n-back', subjectId, '2026-10-24'];
  assert.deepEqual(folders.map(({ url }) => url), segments.map((_, index) =>
    `https://ewebdav.pcloud.com/${segments.slice(0, index + 1).map(encodeURIComponent).join('/')}`));
  assert.equal(run.rawBucket.listCalls.length, 2);
  assert.ok(run.rawBucket.listCalls[1].cursor);
});

test('the global 200-object cap applies across both buckets with paginated lists', async () => {
  const raw = Array.from({ length: 199 }, (_, index) => rawKey.replace(recordId, `record-${String(index).padStart(3, '0')}`));
  const eye = Array.from({ length: 4 }, (_, index) => eyeKey.replace(recordId, `record-${index}`));
  const run = CreateRun(raw, eye, {}, 37);
  const summary = await run.run();
  assert.equal(summary.scanned, 200);
  assert.equal(summary.deleted, 200);
  assert.equal(run.eyeBucket.objects.size, 3);
});

test('three consecutive failures stop the run and leave the rest for a later cron', async () => {
  const raw = Array.from({ length: 8 }, (_, index) => rawKey.replace(recordId, `record-${index}`));
  const run = CreateRun(raw, [], { failAt: 'GET' });
  const summary = await run.run();
  assert.equal(summary.scanned, 3);
  assert.equal(summary.failed, 3);
  assert.equal(run.rawBucket.objects.size, 8);
});

for (const changed of [{ etag: 'new-etag' }, { size: 1000 }, { version: 'new-version' }]) {
  test(`an object changed between verification and deletion is retained: ${JSON.stringify(changed)}`, async () => {
    const run = CreateRun();
    const originalHead = run.rawBucket.head.bind(run.rawBucket);
    run.rawBucket.head = async (key) => ({ ...await originalHead(key), ...changed });
    const summary = await run.run();
    assert.equal(summary.deleted, 0);
    assert.equal(summary.failed, 1);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

test('a rewrite after listing cannot upload or delete stale bytes', async () => {
  const run = CreateRun();
  const originalGet = run.rawBucket.get.bind(run.rawBucket);
  run.rawBucket.get = async (key, options) => {
    run.rawBucket.objects.get(key).etag = 'changed-after-list';
    return originalGet(key, options);
  };
  assert.equal((await run.run()).deleted, 0);
  assert.equal(run.pcloud.uploads.length, 0);
});

test('the ten-minute budget stops starting new files and retains data when verification runs past it', async () => {
  const run = CreateRun();
  let now = 0;
  run.options.now = () => now;
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => {
    const response = await originalFetch(url, init);
    if (init.method === 'GET' && run.pcloud.uploads.length) now = 600001;
    return response;
  };
  const summary = await run.run();
  assert.equal(summary.deleted, 0);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
});

test('list errors retain all files and produce a summary without leaking exception text', async () => {
  const run = CreateRun();
  run.rawBucket.list = async () => { throw new Error('secret-token list error'); };
  assert.equal((await run.run()).failed, 1);
  assert.equal(run.rawBucket.deleted.length, 0);
  assert.doesNotMatch(JSON.stringify(run.logs), /secret-token/);
});

test('the scheduled entry keeps the sync alive through waitUntil', async (context) => {
  const worker = (await import('../../../../workers/raw-data-sync/index.js')).default;
  const run = CreateRun([], []);
  context.mock.method(console, 'log', () => {});
  let work;
  await worker.scheduled({}, run.env, { waitUntil(promise) { work = promise; } });
  assert.ok(work instanceof Promise);
  assert.deepEqual(await work, { scanned: 0, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: 0, failed: 0 });
});

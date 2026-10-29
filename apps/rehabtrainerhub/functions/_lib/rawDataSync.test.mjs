import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ProcessRawDataSync } from './rawDataSync.js';

const subjectId = '12345678-1234-4234-8234-123456789abc';
const recordId = 'abcdefab-1234-4234-8234-123456789abc';
const rawKey = `pending/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const eyeKey = `guests/${subjectId}/${recordId}.csv`;
const root = '/RehabTrainerHub/raw-data';
const rawPath = `${root}/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const csv = 'trial,score\n1,7\n';

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

function Checksum(text, sha256 = false) {
  return { result: 0, sha1: createHash('sha1').update(text).digest('hex'),
    ...(sha256 ? { sha256: createHash('sha256').update(text).digest('hex') } : {}),
    metadata: { size: Buffer.byteLength(text) } };
}

function CreatePcloud(options = {}) {
  const folders = new Map([['', 0]]);
  const pathsById = new Map([[0, '']]);
  const files = new Map(Object.entries(options.existing ?? {}));
  const pathsByFileId = new Map();
  const requests = [];
  const uploads = [];
  return { folders, requests, uploads,
    async fetch(url, init) {
      const method = new URL(url).pathname.slice(1);
      const params = init.body;
      requests.push({ url: String(url), init, method, params });
      if (options.failAt === method) return Response.json({ result: 5000, error: 'secret-token must never be logged' });
      if (method === 'checksumfile') {
        const path = params.has('path') ? params.get('path') : pathsByFileId.get(Number(params.get('fileid')));
        if (!files.has(path)) return Response.json({ result: options.missingResult ?? 2009, error: 'File not found' });
        const checksum = Checksum(files.get(path), options.eu);
        if (params.has('fileid')) {
          if (options.mismatch) checksum.sha1 = '0'.repeat(40);
          if (options.wrongSize) checksum.metadata.size++;
          if (options.sha256Mismatch) checksum.sha256 = '0'.repeat(64);
        }
        return Response.json(checksum);
      }
      if (method === 'createfolderifnotexists') {
        const parent = pathsById.get(Number(params.get('folderid')));
        assert.notEqual(parent, undefined, 'parent must be created before its child');
        const path = `${parent}/${params.get('name')}`;
        if (!folders.has(path)) { const id = folders.size; folders.set(path, id); pathsById.set(id, path); }
        return Response.json({ result: 0, metadata: { folderid: folders.get(path) } });
      }
      assert.equal(method, 'uploadfile');
      assert.ok(params instanceof FormData);
      assert.deepEqual([...params.keys()], ['folderid', 'nopartial', 'file']);
      assert.equal(params.get('nopartial'), '1');
      const file = params.get('file');
      const folder = pathsById.get(Number(params.get('folderid')));
      assert.notEqual(folder, undefined);
      const path = `${folder}/${file.name}`;
      const text = await file.text();
      files.set(path, text);
      const id = uploads.length + 100;
      pathsByFileId.set(id, path);
      uploads.push({ path, text });
      return Response.json({ result: 0, fileids: [id], metadata: [{ fileid: id, name: file.name, size: file.size }] });
    },
  };
}

function CreateRun(raw = [rawKey], eye = [], pcloudOptions = {}, pageSize) {
  const rawBucket = CreateBucket(raw, pageSize);
  const eyeBucket = CreateBucket(eye, pageSize);
  const pcloud = CreatePcloud(pcloudOptions);
  const logs = [];
  const env = { RAW_DATA: rawBucket, OCULOMOTOR_DATA: eyeBucket,
    PCLOUD_API_HOST: pcloudOptions.eu ? 'eapi.pcloud.com' : 'api.pcloud.com', PCLOUD_ACCESS_TOKEN: 'secret-token' };
  const options = { fetch: pcloud.fetch, log: (...args) => logs.push(args) };
  return { rawBucket, eyeBucket, pcloud, logs, env, options, run: () => ProcessRawDataSync(env, options) };
}

test('uploads exact CSV bytes, verifies by fileid, then deletes and logs the summary', async () => {
  const run = CreateRun();
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 1, alreadySynced: 0, deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text: csv }]);
  assert.deepEqual(run.rawBucket.deleted, [rawKey]);
  assert.ok(run.pcloud.requests.some(({ method, params }) => method === 'checksumfile' && params.has('fileid')));
  assert.ok(JSON.stringify(run.logs).includes('"deleted":1'));
});

for (const missingResult of [2002, 2005]) {
  test(`a first upload into folders pCloud does not have yet still happens (result ${missingResult})`, async () => {
    const run = CreateRun([rawKey], [], { missingResult });
    assert.deepEqual(await run.run(), { scanned: 1, uploaded: 1, alreadySynced: 0, deleted: 1, skipped: 0, failed: 0 });
  });
}

test('a matching earlier upload is verified by path and deleted without another upload', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv } });
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 0, alreadySynced: 1, deleted: 1, skipped: 0, failed: 0 });
  assert.equal(run.pcloud.requests.length, 1);
  assert.equal(run.pcloud.requests[0].params.get('path'), rawPath);
});

for (const options of [{ mismatch: true }, { wrongSize: true }, { eu: true, sha256Mismatch: true }]) {
  test(`an uploaded checksum or size mismatch retains R2 data: ${JSON.stringify(options)}`, async () => {
    const run = CreateRun([rawKey], [], options);
    const summary = await run.run();
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

test('a different existing file is overwritten at the same path and verified', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: 'old-data' }, eu: true });
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.uploads[0].path, rawPath);
});

test('a failed R2 deletion recovers next run through the previously verified pCloud file', async () => {
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

for (const failure of ['http', 'json', 'result']) {
  test(`an error during the final checksum retains the uploaded source: ${failure}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => {
      if (new URL(url).pathname === '/checksumfile' && init.body.has('fileid')) {
        if (failure === 'http') return new Response('secret-token error', { status: 503 });
        if (failure === 'json') return new Response('secret-token invalid JSON');
        return Response.json({ result: 2003, error: 'secret-token denied' });
      }
      return originalFetch(url, init);
    };
    const summary = await run.run();
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(summary.failed, 1);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
    assert.doesNotMatch(JSON.stringify(run.logs), /secret-token/);
  });
}

for (const method of ['checksumfile', 'createfolderifnotexists', 'uploadfile']) {
  test(`pCloud result errors at ${method} retain the object even with HTTP 200`, async () => {
    const run = CreateRun([rawKey], [], { failAt: method });
    assert.equal((await run.run()).failed, 1);
    assert.deepEqual(run.rawBucket.deleted, []);
  });
}

for (const change of [
  { PCLOUD_API_HOST: undefined }, { PCLOUD_API_HOST: 'evil.example' },
  { PCLOUD_API_HOST: 'https://api.pcloud.com' }, { PCLOUD_API_HOST: 'api.pcloud.com/evil' },
  { PCLOUD_ACCESS_TOKEN: undefined }, { PCLOUD_ACCESS_TOKEN: '' },
  { PCLOUD_ACCESS_TOKEN: 'secret-token\n' }, { PCLOUD_ROOT_FOLDER: '/safe\n' },
  { PCLOUD_ROOT_FOLDER: 'relative' }, { PCLOUD_ROOT_FOLDER: '/safe/../unsafe' },
  { PCLOUD_ROOT_FOLDER: '/safe/%2e%2e/unsafe' }, { PCLOUD_ROOT_FOLDER: '/safe//unsafe' },
]) {
  test(`unsafe or missing configuration refuses all I/O: ${JSON.stringify(change)}`, async () => {
    const run = CreateRun();
    Object.assign(run.env, change);
    await assert.rejects(run.run(), /configuration/i);
    assert.equal(run.rawBucket.listCalls.length, 0);
    assert.equal(run.pcloud.requests.length, 0);
    assert.equal(run.rawBucket.deleted.length, 0);
  });
}

test('tokens stay in the Authorization header, never URLs or logs, including remote/network errors', async () => {
  for (const networkError of [false, true]) {
    const run = CreateRun([rawKey], [], { failAt: networkError ? undefined : 'uploadfile' });
    if (networkError) run.options.fetch = async () => { throw new Error('secret-token network error'); };
    await run.run();
    for (const request of run.pcloud.requests) {
      assert.equal(new Headers(request.init.headers).get('Authorization'), 'Bearer secret-token');
      assert.equal(request.init.redirect, 'error');
      assert.ok(request.init.signal instanceof AbortSignal);
      assert.doesNotMatch(request.url, /secret-token|access_token/);
    }
    assert.doesNotMatch(JSON.stringify(run.logs), /secret-token/);
  }
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
  assert.doesNotMatch(JSON.stringify(run.pcloud.requests.map(({ params }) => [...params.entries()])) + JSON.stringify(run.logs), /encoded%40account|users\//);
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

test('folders are created segment by segment and shared folder ids are cached across pages', async () => {
  const nextKey = rawKey.replace(recordId, 'another-record');
  const run = CreateRun([rawKey, nextKey], [], {}, 1);
  run.env.PCLOUD_ROOT_FOLDER = '/Owner/archive';
  assert.equal((await run.run()).deleted, 2);
  const folders = run.pcloud.requests.filter(({ method }) => method === 'createfolderifnotexists');
  assert.deepEqual(folders.map(({ params }) => params.get('name')), ['Owner', 'archive', 'rounds', 'n-back', subjectId, '2026-10-24']);
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
  const run = CreateRun(raw, [], { failAt: 'checksumfile' });
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
    if (init.body.has('fileid')) now = 600001;
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

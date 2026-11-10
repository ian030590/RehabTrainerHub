import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ProcessRawDataSync } from './rawDataSync.js';

const subjectId = '12345678-1234-4234-8234-123456789abc';
const recordId = 'abcdefab-1234-4234-8234-123456789abc';
const rawKey = `pending/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const eyeKey = `guests/${subjectId}/${recordId}.csv`;
const root = '/RehabTrainerHub/raw-data';
const rawPath = `${root}/rounds/n-back/${subjectId}/2026-10-24/${recordId}.csv`;
const csv = 'trial,score\n1,7\n';
const progressKey = 'sync-state/raw-data-sync.json';
const accessToken = 'fake-pcloud-access-token';

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
        async text() { return text; },
        async arrayBuffer() { return new TextEncoder().encode(text).buffer; } };
    },
    async put(key, text) {
      objects.set(key, { key, text, size: Buffer.byteLength(text), etag: 'state-etag', version: 'state-version' });
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

function CreatePcloud(options = {}) {
  const folders = new Map([['', 0], ['/', 0]]);
  const AddFolders = (path) => {
    const segments = path.split('/').filter(Boolean);
    for (let index = 1; index <= segments.length; index++) {
      const folder = `/${segments.slice(0, index).join('/')}`;
      if (!folders.has(folder)) folders.set(folder, folders.size);
    }
  };
  for (const path of options.folders ?? []) AddFolders(path);
  const files = new Map(Object.entries(options.existing ?? {}));
  for (const path of files.keys()) AddFolders(path.slice(0, path.lastIndexOf('/')));
  const fileIds = new Map();
  const FileId = (path) => {
    if (!fileIds.has(path)) fileIds.set(path, fileIds.size + 100);
    return fileIds.get(path);
  };
  const requests = [];
  const uploads = [];
  const Json = (value) => Response.json(value);
  return { folders, files, requests, uploads,
    async fetch(url, init) {
      const parsed = new URL(url);
      const command = parsed.pathname.slice(1);
      const params = init.body instanceof FormData || init.body instanceof URLSearchParams ? init.body : null;
      const path = command === 'uploadfile' ? `${params?.get('path')}/${params?.get('file')?.name}` : params?.get('path');
      requests.push({ url: String(url), init, method: init.method, command, path, params });
      assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${accessToken}`);
      assert.equal(new Headers(init.headers).get('Cookie'), null);
      assert.equal(params?.get('auth'), null);
      assert.equal(params?.get('access_token'), null);
      assert.equal(init.redirect, 'manual');
      assert.ok(init.signal instanceof AbortSignal);
      assert.equal(parsed.username, '');
      assert.equal(parsed.password, '');
      assert.equal(parsed.search, '');
      assert.equal(parsed.hash, '');
      assert.ok(!String(url).includes(accessToken) && !String(url).includes(username) && !String(url).includes(password));
      if (options.failAt === command) {
        if (options.status === 'timeout') throw new DOMException(`${accessToken} ${rawKey}`, 'TimeoutError');
        if (options.result !== undefined) return Json({ result: options.result, error: `${accessToken} ${rawKey}` });
        return new Response(`${accessToken} ${rawKey}`, { status: options.status ?? 507 });
      }
      assert.equal(init.method, 'POST');
      assert.equal(parsed.hostname, 'eapi.pcloud.com');
      if (command === 'checksumfile') {
        if (!files.has(path)) return Json({ result: options.missingResult ?? 2009 });
        const text = uploads.some((upload) => upload.path === path) && options.verifyText !== undefined
          ? options.verifyText : files.get(path);
        const sha256 = createHash('sha256').update(text, 'utf8').digest('hex');
        return Json({ result: 0, sha256: options.uppercaseChecksum ? sha256.toUpperCase() : sha256,
          metadata: { isfolder: false, fileid: FileId(path), name: path.split('/').at(-1),
            parentfolderid: folders.get(path.slice(0, path.lastIndexOf('/'))), size: Buffer.byteLength(text) } });
      }
      const parent = path?.slice(0, path.lastIndexOf('/'));
      if (!folders.has(parent)) return Json({ result: 2002 });
      if (command === 'createfolderifnotexists') {
        if (!folders.has(path)) folders.set(path, folders.size);
        return Json({ result: 0, metadata: { isfolder: true, folderid: folders.get(path), name: path.split('/').at(-1) } });
      }
      assert.equal(command, 'uploadfile');
      assert.ok(init.body instanceof FormData);
      assert.equal(new Headers(init.headers).get('Content-Type'), null, 'fetch must provide the multipart boundary');
      assert.equal(params.get('renameifexists'), '1');
      assert.equal(params.get('nopartial'), '1');
      const file = params.get('file');
      assert.equal(file.type, 'text/csv; charset=utf-8');
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
      if (options.raceText !== undefined) files.set(path, options.raceText);
      const target = files.has(path) ? path.replace(/\.csv$/, ' (2).csv') : path;
      files.set(target, text);
      uploads.push({ path: target, text });
      return Json({ result: 0, metadata: [{ isfolder: false, fileid: FileId(target), name: target.split('/').at(-1),
        parentfolderid: folders.get(parent), size: Buffer.byteLength(text) }] });
    },
  };
}

function CreateRun(raw = [rawKey], eye = [], pcloudOptions = {}, pageSize) {
  const rawBucket = CreateBucket(raw, pageSize);
  const eyeBucket = CreateBucket(eye, pageSize);
  const pcloud = CreatePcloud(pcloudOptions);
  const logs = [];
  const env = { RAW_DATA: rawBucket, OCULOMOTOR_DATA: eyeBucket,
    PCLOUD_API_HOST: 'eapi.pcloud.com', PCLOUD_ACCESS_TOKEN: accessToken };
  const options = { fetch: pcloud.fetch, log: (...args) => logs.push(args) };
  return { rawBucket, eyeBucket, pcloud, logs, env, options, run: () => ProcessRawDataSync(env, options) };
}

function AssertPrivateLogs(logs) {
  for (const privateText of [accessToken, username, password, rawKey, subjectId, csv]) assert.ok(!JSON.stringify(logs).includes(privateText));
}

test('uploads exact CSV bytes, verifies EU SHA-256 before head and delete, and logs only the summary', async () => {
  const run = CreateRun();
  const originalHead = run.rawBucket.head.bind(run.rawBucket);
  run.rawBucket.head = async (key) => {
    assert.equal(run.pcloud.requests.filter(({ command }) => command === 'checksumfile').length, 2);
    assert.equal(run.pcloud.files.get(rawPath), csv);
    return originalHead(key);
  };
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 1, alreadySynced: 0, deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text: csv }]);
  assert.deepEqual(run.rawBucket.deleted, [rawKey]);
  assert.deepEqual(run.rawBucket.getCalls.find(({ key }) => key === rawKey).options, { onlyIf: { etagMatches: 'etag-1' } });
  assert.ok(JSON.stringify(run.logs).includes('"deleted":1'));
  AssertPrivateLogs(run.logs);
});

test('uploads use multipart and request rename-on-conflict without partial files', async () => {
  const run = CreateRun();
  assert.equal((await run.run()).deleted, 1);
  const uploads = run.pcloud.requests.filter(({ command }) => command === 'uploadfile');
  assert.equal(uploads.length, 1);
  for (const { params } of uploads) {
    assert.equal(params.get('renameifexists'), '1');
    assert.equal(params.get('nopartial'), '1');
  }
});

test('a matching earlier upload is verified by EU SHA-256 and deleted without uploading or creating folders', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv } });
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 0, alreadySynced: 1, deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(run.pcloud.requests.map(({ command }) => command), ['checksumfile']);
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

test('different existing bytes with the same length are retained at the same path', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv.replace('7', '8') } });
  assert.equal((await run.run()).deleted, 0);
  assert.equal(run.pcloud.files.get(rawPath), csv.replace('7', '8'));
  assert.deepEqual(run.pcloud.uploads, []);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
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

test('an interrupted uploadfile with complete remote bytes recovers without overwriting on retry', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => {
    const response = await originalFetch(url, init);
    if (new URL(url).pathname === '/uploadfile') throw new DOMException('fake interrupted upload', 'TimeoutError');
    return response;
  };
  assert.equal((await run.run()).failed, 1);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
  assert.equal(run.pcloud.files.get(rawPath), csv);
  run.options.fetch = originalFetch;
  const second = await run.run();
  assert.equal(second.alreadySynced, 1);
  assert.equal(second.uploaded, 0);
  assert.equal(second.deleted, 1);
  assert.equal(run.pcloud.uploads.length, 1);
});

for (const status of [401, 404, 507, 'timeout']) {
  test(`a failed verification checksumfile retains the uploaded source: ${status}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => {
      if (new URL(url).pathname === '/checksumfile' && run.pcloud.uploads.length) {
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

for (const command of ['checksumfile', 'createfolderifnotexists', 'uploadfile']) {
  for (const status of [401, 507, 'timeout', 302, 202]) {
    test(`pCloud ${command} HTTP ${status} retains R2 and counts a private failure`, async () => {
      const run = CreateRun([rawKey], [], { failAt: command, status });
      assert.equal((await run.run()).failed, 1);
      assert.deepEqual(run.rawBucket.deleted, []);
      AssertPrivateLogs(run.logs);
      const operation = { checksumfile: 'existing-checksum', createfolderifnotexists: 'folders', uploadfile: 'upload' }[command];
      assert.ok(run.logs.some(([line]) => line === `raw-data-sync failed RAW_DATA item=1: ${operation}`));
      if (typeof status === 'number') assert.ok(run.logs.some(([line]) => line === `raw-data-sync pcloud ${command} http=${status}`));
    });
  }
}

for (const missingResult of [2002, 2009]) {
  test(`checksumfile result ${missingResult} permits a new upload followed by size and SHA-256 verification`, async () => {
    const run = CreateRun([rawKey], [], { missingResult });
    assert.equal((await run.run()).deleted, 1);
    assert.equal(run.pcloud.requests.at(-1).command, 'checksumfile');
  });
}

test('createfolderifnotexists accepts existing folders and creates missing parents', async () => {
  const run = CreateRun([rawKey], [], { folders: ['/RehabTrainerHub', root] });
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.requests.filter(({ command }) => command === 'createfolderifnotexists').length, 6);
});

for (const command of ['checksumfile', 'createfolderifnotexists', 'uploadfile']) {
  for (const result of [1000, 2000, 2003, 2008, 2041, 2094, 4000, 5000]) {
    test(`pCloud ${command} result ${result} inside HTTP 200 retains the source and stops after three failures`, async () => {
      const raw = Array.from({ length: 8 }, (_, index) => rawKey.replace(recordId, `record-${index}`));
      const run = CreateRun(raw, [], { failAt: command, result });
      const summary = await run.run();
      assert.equal(summary.scanned, 3);
      assert.equal(summary.failed, 3);
      assert.equal(summary.deleted, 0);
      assert.equal(run.rawBucket.deleted.length, 0);
      AssertPrivateLogs(run.logs);
    });
  }
}

for (const payload of ['not json', 'null', '{}', '{"result":"0"}', '{"result":null}']) {
  test(`malformed API JSON is a service failure without leaking its body: ${payload}`, async () => {
    const raw = Array.from({ length: 8 }, (_, index) => rawKey.replace(recordId, `record-${index}`));
    const run = CreateRun(raw);
    run.options.fetch = async () => new Response(payload);
    const summary = await run.run();
    assert.equal(summary.scanned, 3);
    assert.equal(summary.failed, 3);
    assert.equal(summary.deleted, 0);
    AssertPrivateLogs(run.logs);
  });
}

for (const declared of [true, false]) {
  test(`API JSON exceeding 64 KiB is cancelled and retains R2: declared=${declared}`, async () => {
    const run = CreateRun();
    let cancelled = false;
    run.options.fetch = async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(64 * 1024 + 1)); },
      cancel() { cancelled = true; },
    }), { headers: declared ? { 'Content-Length': String(64 * 1024 + 1) } : {} });
    const summary = await run.run();
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(cancelled, true);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

test('an interrupted API JSON body is a private service failure', async () => {
  const run = CreateRun();
  run.options.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error(`${accessToken} ${rawKey}`)); },
  }));
  assert.equal((await run.run()).failed, 1);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
  AssertPrivateLogs(run.logs);
});

test('an API object error does not block later valid CSVs', async () => {
  const broken = Array.from({ length: 4 }, (_, index) => rawKey.replace(recordId, `aaa-${index}`));
  const run = CreateRun([...broken, rawKey]);
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => init.body?.get?.('path')?.includes('/aaa-')
    ? Response.json({ result: 2001, error: `${accessToken} ${rawKey}` }) : originalFetch(url, init);
  const summary = await run.run();
  assert.equal(summary.failed, 4);
  assert.equal(summary.deleted, 1);
  for (const key of broken) assert.equal(run.rawBucket.objects.has(key), true);
  AssertPrivateLogs(run.logs);
});

for (const result of [2002, 2009]) {
  test(`a missing uploaded file at API verification retains R2: ${result}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => new URL(url).pathname === '/checksumfile' && run.pcloud.uploads.length
      ? Response.json({ result }) : originalFetch(url, init);
    const summary = await run.run();
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

for (const raceText of [csv, csv.replace('7', '8')]) {
  test(`a file appearing during upload is preserved and a renamed upload cannot authorize deletion: ${raceText.length}`, async () => {
    const run = CreateRun([rawKey], [], { raceText });
    const summary = await run.run();
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(run.pcloud.files.get(rawPath), raceText);
    assert.equal(run.pcloud.files.get(rawPath.replace('.csv', ' (2).csv')), csv);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
    AssertPrivateLogs(run.logs);
  });
}

for (const metadata of [[], [{}], [{ isfolder: true }], [null], [{ fileid: 0 }],
  [{ name: 'different.csv' }], [{ size: 1 }], [{ parentfolderid: 0 }]]) {
  test(`invalid upload metadata cannot authorize R2 deletion: ${JSON.stringify(metadata)}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => {
      const response = await originalFetch(url, init);
      if (new URL(url).pathname !== '/uploadfile') return response;
      const result = await response.json();
      result.metadata = metadata.length === 1 && metadata[0] && Object.keys(metadata[0]).length
        ? [{ ...result.metadata[0], ...metadata[0] }] : metadata;
      return Response.json(result);
    };
    assert.equal((await run.run()).deleted, 0);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

for (const change of [
  { PCLOUD_API_HOST: undefined }, { PCLOUD_API_HOST: 'api.pcloud.com' }, { PCLOUD_API_HOST: 'https://eapi.pcloud.com' },
  { PCLOUD_API_HOST: 'evil.example' }, { PCLOUD_API_HOST: 'eapi.pcloud.com/evil' },
  { PCLOUD_API_HOST: 'eapi.pcloud.com/' }, { PCLOUD_API_HOST: 'eapi.pcloud.com?secret=fake' },
  { PCLOUD_API_HOST: 'eapi.pcloud.com#fake' }, { PCLOUD_API_HOST: 'fake@eapi.pcloud.com' },
  { PCLOUD_ACCESS_TOKEN: undefined }, { PCLOUD_ACCESS_TOKEN: '' }, { PCLOUD_ACCESS_TOKEN: 'fake\n' },
  { PCLOUD_ACCESS_TOKEN: 'fake\u007f' }, { PCLOUD_ACCESS_TOKEN: 'fake\u0085' },
  { PCLOUD_ACCESS_TOKEN: 'fake token' }, { PCLOUD_ACCESS_TOKEN: '\u5bc6\u78bc' },
  { PCLOUD_ROOT_FOLDER: '/safe\n' },
  { PCLOUD_API_HOST: undefined, PCLOUD_ACCESS_TOKEN: undefined, PCLOUD_WEBDAV_URL: 'https://ewebdav.pcloud.com',
    PCLOUD_WEBDAV_USERNAME: username, PCLOUD_WEBDAV_PASSWORD: password },
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

test('EU checksum verification uses only fixed API endpoints and no downloadable links', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv } });
  const summary = await run.run();
  assert.equal(summary.alreadySynced, 1);
  assert.equal(summary.deleted, 1);
  assert.deepEqual(run.pcloud.requests.map(({ command }) => command), ['checksumfile']);
  assert.ok(run.pcloud.requests.every(({ url, method }) => new URL(url).origin === 'https://eapi.pcloud.com' && method === 'POST'));
  AssertPrivateLogs(run.logs);
});

for (const [label, text] of [['BOM and CRLF', '\ufefftrial,score\r\n1,7\r\n'],
  ['Unicode', 'trial,label\n1,測試🔑\n'], ['empty', '']]) {
  test(`EU checksum matches original ${label} bytes without changing the upload`, async () => {
    const run = CreateRun([{ key: rawKey, text, size: Buffer.byteLength(text) }]);
    const summary = await run.run();
    assert.equal(summary.deleted, 1);
    assert.equal(summary.failed, 0);
    assert.deepEqual(run.pcloud.uploads, [{ path: rawPath, text }]);
    assert.equal(run.pcloud.files.get(rawPath), text);
  });
}

test('uppercase hexadecimal SHA-256 is normalized before comparison', async () => {
  const run = CreateRun([rawKey], [], { uppercaseChecksum: true });
  assert.equal((await run.run()).deleted, 1);
});

for (const stage of ['existing', 'uploaded']) {
  for (const sha256 of [undefined, null, 123, '', 'a'.repeat(40), 'a'.repeat(63), 'a'.repeat(65),
    'z'.repeat(64), `${'a'.repeat(64)}\n`]) {
    test(`invalid SHA-256 at ${stage} refuses upload or R2 deletion: ${JSON.stringify(sha256)}`, async () => {
      const run = CreateRun([rawKey], [], stage === 'existing' ? { existing: { [rawPath]: csv } } : {});
      const originalFetch = run.options.fetch;
      run.options.fetch = async (url, init) => {
        const response = await originalFetch(url, init);
        if (new URL(url).pathname !== '/checksumfile' || (stage === 'uploaded' && !run.pcloud.uploads.length)) return response;
        const result = await response.json();
        return Response.json({ ...result, sha256, sha1: 'a'.repeat(40) });
      };
      const summary = await run.run();
      assert.equal(summary.failed, 1);
      assert.equal(summary.deleted, 0);
      assert.equal(run.pcloud.uploads.length, stage === 'existing' ? 0 : 1);
      assert.equal(run.rawBucket.objects.has(rawKey), true);
      assert.equal(run.pcloud.files.get(rawPath), csv);
      AssertPrivateLogs(run.logs);
    });
  }
}

for (const stage of ['existing', 'uploaded']) {
  for (const change of [undefined, null, {}, { name: 'other.csv' }, { isfolder: true },
    { fileid: 0 }, { fileid: -1 }, { fileid: '100' }, { fileid: Number.MAX_SAFE_INTEGER + 1 },
    { parentfolderid: undefined }, { parentfolderid: -1 }, { parentfolderid: '0' },
    { parentfolderid: Number.MAX_SAFE_INTEGER + 1 }, { size: undefined }, { size: -1 },
    { size: '16' }, { size: Number.MAX_SAFE_INTEGER + 1 }]) {
    test(`invalid checksum metadata at ${stage} refuses upload or R2 deletion: ${JSON.stringify(change)}`, async () => {
      const run = CreateRun([rawKey], [], stage === 'existing' ? { existing: { [rawPath]: csv } } : {});
      const originalFetch = run.options.fetch;
      run.options.fetch = async (url, init) => {
        const response = await originalFetch(url, init);
        if (new URL(url).pathname !== '/checksumfile' || (stage === 'uploaded' && !run.pcloud.uploads.length)) return response;
        const result = await response.json();
        const metadata = change && Object.keys(change).length ? { ...result.metadata, ...change } : change;
        return Response.json({ ...result, metadata });
      };
      const summary = await run.run();
      assert.equal(summary.failed, 1);
      assert.equal(summary.deleted, 0);
      assert.equal(run.pcloud.uploads.length, stage === 'existing' ? 0 : 1);
      assert.equal(run.rawBucket.objects.has(rawKey), true);
      assert.equal(run.pcloud.files.get(rawPath), csv);
      AssertPrivateLogs(run.logs);
    });
  }
}

for (const change of [{ fileid: 9999 }, { parentfolderid: 9999 }]) {
  test(`a matching checksum from a different uploaded file identity retains R2: ${JSON.stringify(change)}`, async () => {
    const run = CreateRun();
    const originalFetch = run.options.fetch;
    run.options.fetch = async (url, init) => {
      const response = await originalFetch(url, init);
      if (new URL(url).pathname !== '/checksumfile' || !run.pcloud.uploads.length) return response;
      const result = await response.json();
      return Response.json({ ...result, metadata: { ...result.metadata, ...change } });
    };
    const summary = await run.run();
    assert.equal(summary.uploaded, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.deleted, 0);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
  });
}

test('an existing matching archive may have any nonnegative safe parent folder ID', async () => {
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: csv } });
  const originalFetch = run.options.fetch;
  run.options.fetch = async (url, init) => {
    const response = await originalFetch(url, init);
    const result = await response.json();
    return Response.json({ ...result, metadata: { ...result.metadata, parentfolderid: 0 } });
  };
  const summary = await run.run();
  assert.equal(summary.alreadySynced, 1);
  assert.equal(summary.deleted, 1);
  assert.equal(run.pcloud.uploads.length, 0);
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

test('API JSON response bodies are consumed before the next request', async () => {
  const run = CreateRun();
  const originalFetch = run.options.fetch;
  let previous;
  let checked = 0;
  run.options.fetch = async (url, init) => {
    if (previous) {
      assert.equal(previous.bodyUsed, true, 'the previous response must release its connection');
      checked++;
    }
    const response = await originalFetch(url, init);
    previous = response;
    return response;
  };
  assert.equal((await run.run()).deleted, 1);
  assert.equal(checked, run.pcloud.requests.length - 1);
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
  assert.deepEqual(run.rawBucket.getCalls.map(({ key }) => key), [progressKey]);
  assert.equal(run.pcloud.requests.length, 0);
});

test('all raw categories and guest eye keys map to Subject ID paths while old account eye files remain untouched', async () => {
  const raw = ['rounds', 'hand', 'head', 'pose', 'tongue'].map((kind) => rawKey.replace('/rounds/', `/${kind}/`));
  const accountKey = `users/encoded%40account/${recordId}.csv`;
  const run = CreateRun(raw, [eyeKey, accountKey]);
  assert.equal((await run.run()).deleted, 6);
  assert.equal(run.eyeBucket.objects.has(accountKey), true);
  assert.equal(run.eyeBucket.listCalls[0].prefix, 'guests/');
  assert.ok(run.pcloud.uploads.some(({ path }) => path === `${root}/guest-eye/oculomotor-training/${subjectId}/2026-10-24/${recordId}.csv`));
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

test('a guest eye upload cannot replace an archived account CSV with the same subject, record and date', async () => {
  const accountKey = `users/fake-account/${recordId}.csv`;
  const accountPath = `${root}/eye/oculomotor-training/${subjectId}/2026-10-24/${recordId}.csv`;
  const run = CreateRun([], [{ key: accountKey, customMetadata: { subjectId, recordedDate: '2026-10-24' } }]);
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.eyeBucket.objects.has(accountKey), false);
  const guestCsv = csv.replace('7', '9');
  run.eyeBucket.objects.set(eyeKey, { key: eyeKey, text: guestCsv, size: Buffer.byteLength(guestCsv),
    etag: 'guest-etag', version: 'guest-version', uploaded: new Date('2026-10-24T02:00:00Z'),
    customMetadata: { subjectId, recordedDate: '2026-10-24' } });
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.files.get(accountPath), csv, 'the archived account bytes must remain unchanged');
  assert.equal(run.pcloud.files.get(`${root}/guest-eye/oculomotor-training/${subjectId}/2026-10-24/${recordId}.csv`), guestCsv);
  AssertPrivateLogs(run.logs);
});

test('an archive conflict retains both the remote bytes and the R2 source', async () => {
  const archivedCsv = csv.replace('7', '8');
  const run = CreateRun([rawKey], [], { existing: { [rawPath]: archivedCsv } });
  const summary = await run.run();
  assert.equal(run.pcloud.files.get(rawPath), archivedCsv, 'different archived bytes must never be overwritten');
  assert.equal(summary.failed, 1);
  assert.equal(summary.deleted, 0);
  assert.equal(run.rawBucket.objects.has(rawKey), true);
  assert.equal(run.pcloud.uploads.length, 0);
  assert.ok(run.logs.some(([line]) => line === 'raw-data-sync failed RAW_DATA item=1: conflict'));
  AssertPrivateLogs(run.logs);
});

test('uploadfile HTTP 412 retains R2 without verification', async () => {
  const run = CreateRun([rawKey], [], { failAt: 'uploadfile', status: 412 });
  assert.deepEqual(await run.run(), { scanned: 1, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: 0, failed: 1 });
  assert.equal(run.rawBucket.objects.has(rawKey), true);
  assert.equal(run.pcloud.uploads.length, 0);
  assert.ok(run.logs.some(([line]) => line === 'raw-data-sync pcloud uploadfile http=412'));
  assert.ok(run.logs.some(([line]) => line === 'raw-data-sync failed RAW_DATA item=1: upload'));
  assert.equal(run.pcloud.requests.filter(({ command }) => command === 'checksumfile').length, 1);
  AssertPrivateLogs(run.logs);
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
    assert.equal(run.pcloud.uploads[0].path, `${root}/guest-eye/oculomotor-training/${subjectId}/${date}/${recordId}.csv`);
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

test('folders use form-encoded paths and are cached across pages', async () => {
  const nextKey = rawKey.replace(recordId, 'another-record');
  const run = CreateRun([rawKey, nextKey], [], {}, 1);
  run.env.PCLOUD_ROOT_FOLDER = '/Owner archive/raw data';
  assert.equal((await run.run()).deleted, 2);
  const folders = run.pcloud.requests.filter(({ command }) => command === 'createfolderifnotexists');
  const segments = ['Owner archive', 'raw data', 'rounds', 'n-back', subjectId, '2026-10-24'];
  assert.deepEqual(folders.map(({ params }) => params.get('path')), segments.map((_, index) =>
    `/${segments.slice(0, index + 1).join('/')}`));
  assert.ok(folders[0].params.toString().includes('Owner+archive'));
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

for (const oversized of [false, true]) {
  test(`more than 200 ${oversized ? 'oversized' : 'malformed'} objects cannot block later valid raw and account CSVs`, async () => {
    const invalid = Array.from({ length: 205 }, (_, index) => ({
      key: rawKey.replace(recordId, `aaa-${String(index).padStart(3, '0')}${oversized ? '' : '.invalid'}`),
      ...(oversized ? { size: 25 * 1024 * 1024 + 1 } : {}),
    }));
    const accountKey = `users/fake-account/${recordId}.csv`;
    const run = CreateRun([...invalid, rawKey], [{ key: accountKey,
      customMetadata: { subjectId, recordedDate: '2026-10-24' } }], {}, 37);
    const summary = await run.run();
    assert.equal(summary.deleted, 2, 'valid CSVs after the skipped objects must be archived');
    assert.equal(summary.skipped, invalid.length);
    assert.equal(run.pcloud.files.get(rawPath), csv);
    assert.equal(run.eyeBucket.objects.has(accountKey), false);
    for (const { key } of invalid) assert.equal(run.rawBucket.objects.has(key), true);
  });
}

test('a persisted listing position lets later runs pass a full run of skipped objects', async () => {
  const invalid = Array.from({ length: 2200 }, (_, index) => rawKey.replace(recordId, `aaa-${String(index).padStart(4, '0')}.invalid`));
  const run = CreateRun([...invalid, rawKey], [], {}, 37);
  const first = await run.run();
  assert.ok(first.scanned <= 2000, 'listing has a separate bounded budget');
  assert.equal(first.deleted, 0);
  assert.equal((await ProcessRawDataSync(run.env, run.options)).deleted, 1, 'the next run must continue past skipped objects');
  assert.equal(run.pcloud.files.get(rawPath), csv);
  for (const key of invalid) assert.equal(run.rawBucket.objects.has(key), true);
});

test('a mid-page time limit resumes at the next untouched file and revisits the retained failure', async () => {
  const firstKey = rawKey.replace(recordId, 'aaa-first');
  const run = CreateRun([firstKey, rawKey]);
  let now = 0;
  run.options.now = () => now;
  const originalGet = run.rawBucket.get.bind(run.rawBucket);
  run.rawBucket.get = async (key, options) => {
    if (key === firstKey) {
      now = 600001;
      throw new Error('fake failed first object');
    }
    return originalGet(key, options);
  };
  assert.equal((await run.run()).failed, 1);
  assert.equal(run.pcloud.uploads.length, 0);
  now = 0;
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.pcloud.files.get(rawPath), csv);
  assert.equal(run.rawBucket.objects.has(firstKey), true);
  run.rawBucket.get = originalGet;
  now = 0;
  assert.equal((await run.run()).deleted, 1);
  assert.equal(run.rawBucket.objects.has(firstKey), false);
});

for (const stage of ['read', 'write']) {
  test(`a progress ${stage} failure is reported without leaking data or removing unarchived sources`, async () => {
    const run = CreateRun();
    if (stage === 'read') {
      run.rawBucket.get = async () => { throw new Error(`${password} ${rawKey}`); };
    } else {
      run.rawBucket.objects.get(rawKey).size = 25 * 1024 * 1024 + 1;
      run.rawBucket.objects.set(progressKey, { key: progressKey, text: JSON.stringify({ source: 0, cursor: 'aaa' }) });
      run.rawBucket.put = async () => { throw new Error(`${password} ${rawKey}`); };
    }
    const summary = await run.run();
    assert.equal(summary.failed, 1);
    assert.equal(run.rawBucket.objects.has(rawKey), true);
    assert.equal(run.pcloud.uploads.length, 0);
    assert.ok(run.logs.some(([line]) => line === `raw-data-sync failed RAW_DATA: progress-${stage}`));
    AssertPrivateLogs(run.logs);
  });
}

for (const failure of ['read', 'checksum', 'conflict', 'http']) {
  test(`object-specific ${failure} failures cannot block a later valid CSV`, async () => {
    const broken = Array.from({ length: 4 }, (_, index) => rawKey.replace(recordId, `aaa-${index}`));
    const run = CreateRun([...broken, rawKey], [], { existing: failure === 'conflict' ?
      Object.fromEntries(broken.map(key => [`${root}/${key.slice('pending/'.length)}`, csv.replace('7', '8')])) : {} });
    const originalGet = run.rawBucket.get.bind(run.rawBucket);
    const originalFetch = run.options.fetch;
    run.rawBucket.get = async (key, options) => {
      if (failure === 'read' && broken.includes(key)) throw new Error('fake object read failure');
      const object = await originalGet(key, options);
      if (failure === 'checksum' && broken.includes(key)) object.size++;
      return object;
    };
    run.options.fetch = async (url, init) => {
      if ((init.body?.get?.('path') ?? new URL(url).pathname).includes('/aaa-')) {
        if (failure === 'http') return new Response(null, { status: 409 });
      }
      return originalFetch(url, init);
    };
    const summary = await run.run();
    assert.equal(summary.deleted, 1, 'a valid CSV must be archived after four object-specific failures');
    assert.equal(summary.failed, 4);
    for (const key of broken) assert.equal(run.rawBucket.objects.has(key), true);
    assert.equal(run.pcloud.files.get(rawPath), csv);
  });
}

for (const status of [401, 403, 408, 429, 507, 'timeout', 302]) {
  test(`three consecutive service failures stop the run and leave the rest for a later cron: ${status}`, async () => {
    const raw = Array.from({ length: 8 }, (_, index) => rawKey.replace(recordId, `record-${index}`));
    const run = CreateRun(raw, [], { failAt: 'checksumfile', status });
    const summary = await run.run();
    assert.equal(summary.scanned, 3);
    assert.equal(summary.failed, 3);
    assert.equal([...run.rawBucket.objects.keys()].filter(key => key.startsWith('pending/')).length, 8);
    AssertPrivateLogs(run.logs);
  });
}

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
    if (key === rawKey) run.rawBucket.objects.get(key).etag = 'changed-after-list';
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
    if (new URL(url).pathname === '/checksumfile' && run.pcloud.uploads.length) now = 600001;
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

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { CreateRawDataEnvironment, CreateMemoryBucket } from '../_lib/rawDataTestFixtures.mjs';
import { StoreImmutableCsv } from '../_lib/rawData.js';
import { onRequestPost } from './records.js';
import { onRequestPost as uploadRaw } from './raw-data.js';

function Post(env, session, rounds, record = {}) {
  return onRequestPost({ env, request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.201' },
    body: JSON.stringify({ appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
      officialGameVersion: session.version, runSessionToken: session.token,
      record: { id: session.recordId, gameId: session.gameId, moduleId: session.gameId, config: {},
        score: { schema: 'rehab-trainer.game-score/v1', gameId: session.gameId, summary: { total: 5 }, rounds }, ...record } }),
  }) });
}

test('rounds go to immutable private CSV before both summary-only D1 columns; identical retry succeeds', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    const rounds = [{ points: 2, seconds: 0.0000001 }, { seconds: null, accuracy: 0.8 }];
    assert.equal((await Post(fixture.env, session, rounds)).status, 201);
    const files = [...fixture.env.RAW_DATA.objects].filter(([key]) => key.startsWith('pending/'));
    assert.equal(files.length, 1, 'per-trial rows must be written to R2');
    const [key, object] = files[0];
    assert.match(key, new RegExp(`^pending/rounds/${session.gameId}/${session.subjectId}/\\d{4}-\\d{2}-\\d{2}/${session.recordId}\\.csv$`));
    assert.equal(object.text, 'round_index,points,seconds,accuracy\n1,2,0.0000001,\n2,,,0.8\n');
    assert.deepEqual(object.options.onlyIf, { etagDoesNotMatch: '*' });
    const sha256 = createHash('sha256').update(object.text).digest('hex');
    assert.equal(object.customMetadata.sha256, sha256);
    assert.equal(object.customMetadata.subjectId, session.subjectId);
    const row = fixture.sqlite.prepare('SELECT payload_json,summary_json FROM training_records').get();
    assert.equal(row.payload_json, row.summary_json);
    const stored = JSON.parse(row.payload_json);
    assert.deepEqual(stored.score.rounds, []);
    assert.equal(stored.scoreRoundCount, 2);
    assert.deepEqual(stored.rawFiles, [{ kind: 'rounds', key, rows: 2, sha256 }]);
    const retry = await Post(fixture.env, session, rounds);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).duplicate, true);
    assert.equal((await Post(fixture.env, session, [{ points: 9 }])).status, 409);
    assert.equal(fixture.env.RAW_DATA.objects.get(key).text, object.text);
  } finally { fixture.sqlite.close(); }
});

for (const unavailable of ['missing', 'put-fails']) {
  test(`rounds storage ${unavailable} returns 503 with no D1 training record`, async () => {
    const fixture = CreateRawDataEnvironment();
    try {
      const session = await fixture.session();
      if (unavailable === 'missing') delete fixture.env.RAW_DATA;
      else fixture.env.RAW_DATA.put = async () => { throw new Error('offline'); };
      assert.equal((await Post(fixture.env, session, [{ points: 1 }])).status, 503);
      assert.equal(fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    } finally { fixture.sqlite.close(); }
  });
}

test('empty rounds need no R2 and client rawFiles cannot forge stored references', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const session = await fixture.session();
    delete fixture.env.RAW_DATA;
    assert.equal((await Post(fixture.env, session, [], { rawFiles: [{ kind: 'head', key: 'private' }] })).status, 400);
    assert.equal((await Post(fixture.env, session, [])).status, 201);
    const record = JSON.parse(fixture.sqlite.prepare('SELECT payload_json FROM training_records').get().payload_json);
    assert.equal(record.scoreRoundCount, 0);
  } finally { fixture.sqlite.close(); }
});

test('legacy writes retain scalar summaries while per-trial and coordinate arrays leave both D1 columns', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const response = await onRequestPost({ env: fixture.env, request: new Request('https://trainerhub.cc/api/records', {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'rehabtrainerhub', runtimeId: 'vision', subjectId: crypto.randomUUID(),
        record: { id: crypto.randomUUID(), moduleId: 'moving-card', details: { total: 5 }, detailRows: [{ score: 2 }],
          results: [{ trial_index: 0, score: 2 }, { trial_index: 1, score: 3 }],
          nested: { samples: [{ x: 2, y: 3 }], gaze_samples: [[1, 2]], webgazer_data: [{ x: 2, y: 3 }] } } }),
    }) });
    assert.equal(response.status, 201);
    const row = fixture.sqlite.prepare('SELECT payload_json,summary_json FROM training_records').get();
    assert.equal(row.payload_json, row.summary_json);
    const record = JSON.parse(row.payload_json);
    assert.deepEqual(record.details, { total: 5 });
    assert.deepEqual(record.detailRows, []);
    assert.deepEqual(record.results, []);
    assert.deepEqual(record.nested.samples, []);
    assert.equal(record.nested.gaze_samples, undefined);
    assert.equal(record.nested.webgazer_data, undefined);
  } finally { fixture.sqlite.close(); }
});

test('legacy singleton results project summary fields and omit sample coordinates', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    const response = await onRequestPost({ env: fixture.env, request: new Request('https://trainerhub.cc/api/records', {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: 'rehabtrainerhub', runtimeId: 'vision', subjectId: crypto.randomUUID(),
        record: { id: crypto.randomUUID(), moduleId: 'moving-card', results: [{ score: 2, x: 3, y: 4, t: 8 }] } }),
    }) });
    assert.equal(response.status, 201);
    assert.deepEqual(JSON.parse(fixture.sqlite.prepare('SELECT payload_json FROM training_records').get().payload_json).results, [{ score: 2 }]);
  } finally { fixture.sqlite.close(); }
});

test('record traces coordinates from receipts even if their CSV was already archived', async () => {
  const fixture = CreateRawDataEnvironment('seagull-flight', ['head-tracking']);
  try {
    const session = await fixture.session();
    const response = await uploadRaw({ env: fixture.env, request: new Request('https://trainerhub.cc/api/raw-data', {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'text/csv',
        'X-Raw-Data': JSON.stringify({ kind: 'head', gameId: session.gameId, officialGameVersion: session.version,
          recordId: session.recordId, subjectId: session.subjectId, runSessionToken: session.token, truncated: false }) },
      body: 't_ms,yaw,pitch,roll,face_found\n0,1,2,3,1\n',
    }) });
    assert.equal(response.status, 201);
    const file = await response.json();
    fixture.env.RAW_DATA.objects.delete(file.key);
    assert.equal((await Post(fixture.env, session, [])).status, 201);
    const record = JSON.parse(fixture.sqlite.prepare('SELECT payload_json FROM training_records').get().payload_json);
    assert.deepEqual(record.rawFiles, [file]);
  } finally { fixture.sqlite.close(); }
});

test('an archived gaze CSV receipt still permits the matching official summary to save', async () => {
  const fixture = CreateRawDataEnvironment('oculomotor-training', ['eye-tracking']);
  try {
    const session = await fixture.session();
    fixture.env.OCULOMOTOR_DATA = CreateMemoryBucket();
    const key = `guests/${session.subjectId}/${session.recordId}.csv`;
    await StoreImmutableCsv(fixture.env.OCULOMOTOR_DATA, key, 'csv', { officialGameVersion: session.version, gazeSampleCount: '1' });
    fixture.env.OCULOMOTOR_DATA.objects.delete(key);
    const response = await Post(fixture.env, session, [], { score: { schema: 'rehab-trainer.game-score/v1',
      gameId: session.gameId, summary: { samples: 1 }, rounds: [] } });
    assert.equal(response.status, 201);
  } finally { fixture.sqlite.close(); }
});

test('a failed gaze CSV write reserves the checksum but cannot authorize a result without a CSV', async () => {
  const fixture = CreateRawDataEnvironment('oculomotor-training', ['eye-tracking']);
  try {
    const session = await fixture.session();
    const bucket = fixture.env.OCULOMOTOR_DATA = CreateMemoryBucket();
    const key = `guests/${session.subjectId}/${session.recordId}.csv`;
    const put = bucket.put.bind(bucket);
    bucket.put = async (path, csv, options) => { if (path === key) throw new Error('offline'); return put(path, csv, options); };
    await assert.rejects(() => StoreImmutableCsv(bucket, key, 'csv', { officialGameVersion: session.version, gazeSampleCount: '1' }));
    const response = await Post(fixture.env, session, [], { score: { schema: 'rehab-trainer.game-score/v1',
      gameId: session.gameId, summary: { samples: 1 }, rounds: [] } });
    assert.equal(response.status, 409);
  } finally { fixture.sqlite.close(); }
});

function TokenIssuedDate(token, timeZone) {
  const { iat } = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iat * 1000));
}

test('raw file dates use the configured REHAB_TIME_ZONE for official sessions', async () => {
  const fixture = CreateRawDataEnvironment();
  try {
    fixture.env.REHAB_TIME_ZONE = 'Pacific/Pago_Pago';
    const session = await fixture.session();
    assert.equal((await Post(fixture.env, session, [{ points: 1 }])).status, 201);
    const [key] = [...fixture.env.RAW_DATA.objects.keys()].filter((path) => path.startsWith('pending/'));
    assert.equal(key.split('/')[4], TokenIssuedDate(session.token, 'Pacific/Pago_Pago'));
    const row = fixture.sqlite.prepare('SELECT verified_training_date FROM training_records').get();
    assert.equal(row.verified_training_date, key.split('/')[4]);
  } finally { fixture.sqlite.close(); }
});

test('saving a game without camera or sensor input does not look up coordinate files', async () => {
  const fixture = CreateRawDataEnvironment('every-ball-response', []);
  try {
    const session = await fixture.session();
    const lookups = [];
    const get = fixture.env.RAW_DATA.get.bind(fixture.env.RAW_DATA);
    fixture.env.RAW_DATA.get = async (key) => { lookups.push(key); return get(key); };
    assert.equal((await Post(fixture.env, session, [])).status, 201);
    assert.deepEqual(lookups, []);
  } finally { fixture.sqlite.close(); }
});

test('a head-tracking game only looks up its own coordinate kind', async () => {
  const fixture = CreateRawDataEnvironment('seagull-flight', ['head-tracking']);
  try {
    const session = await fixture.session();
    const lookups = [];
    const get = fixture.env.RAW_DATA.get.bind(fixture.env.RAW_DATA);
    fixture.env.RAW_DATA.get = async (key) => { lookups.push(key); return get(key); };
    assert.equal((await Post(fixture.env, session, [])).status, 201);
    assert.ok(lookups.length > 0);
    assert.ok(lookups.every((key) => key.includes('/head/')), lookups.join(', '));
  } finally { fixture.sqlite.close(); }
});

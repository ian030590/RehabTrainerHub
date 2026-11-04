import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { CreateRawDataEnvironment } from '../apps/rehabtrainerhub/functions/_lib/rawDataTestFixtures.mjs';
import { CreateSessionForUser } from '../apps/rehabtrainerhub/functions/_lib/auth.js';
import { EnsureAccountSubjectId } from '../apps/rehabtrainerhub/functions/_lib/subjects.js';
import { rawCoordinateColumns } from '../packages/ui/src/rawCoordinateRecorder.js';
import { browserApiHandlers, CreateBrowserDatabase, ReadSavedGameRecord, VerifyRemotePreview } from './r2-browser-fixtures.mjs';

for (const [gameId, kind, capabilities] of [
  ['tongue-catch', 'tongue', ['tongue-tracking']],
  ['gesture-battler', 'hand', ['hand-tracking']],
  ['whack-a-mole', null, ['pointer']],
]) test(`${gameId}: browser fixture uploads coordinates and verifies persisted rounds from private CSV`, async t => {
  const fixture = CreateRawDataEnvironment(gameId, capabilities);
  t.after(() => fixture.sqlite.close());
  fixture.env.REHAB_DB = CreateBrowserDatabase(fixture.sqlite);
  const session = await fixture.session();
  const request = (path, body, headers = {}) => new Request('https://trainerhub.cc' + path, {
    method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'CF-Connecting-IP': '192.0.2.212', ...headers }, body,
  });
  if (kind) {
    const metadata = { kind, gameId, officialGameVersion: session.version, recordId: session.recordId,
      subjectId: session.subjectId, runSessionToken: session.token, truncated: false };
    const columns = rawCoordinateColumns[kind];
    const csv = columns.join(',') + '\n' + columns.map(() => 0).join(',') + '\n';
    assert.equal(typeof browserApiHandlers['/api/raw-data'], 'function', 'Route coordinate uploads to the real API.');
    const upload = () => browserApiHandlers['/api/raw-data']({ env: fixture.env,
      request: request('/api/raw-data', csv, { 'Content-Type': 'text/csv', 'X-Raw-Data': JSON.stringify(metadata) }) });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await upload();
      assert.equal(response.status, 201, await response.text());
    }
    const invalid = await browserApiHandlers['/api/raw-data']({ env: fixture.env,
      request: request('/api/raw-data', csv, { 'Content-Type': 'text/csv',
        'X-Raw-Data': JSON.stringify({ ...metadata, runSessionToken: session.token + 'x' }) }) });
    assert.equal(invalid.status, 400, 'The fixture keeps session signature validation.');
  }
  const rounds = [{ trial: 1, responseMs: 0.0000001, outcome: 1 }, { trial: 2, responseMs: null, outcome: 0 }];
  const input = { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
    officialGameVersion: session.version, runSessionToken: session.token,
    record: { id: session.recordId, gameId, moduleId: gameId, config: {},
      score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { hits: 1, misses: 1 }, rounds } } };
  const save = () => browserApiHandlers['/api/records']({ env: fixture.env,
    request: request('/api/records', JSON.stringify(input), { 'Content-Type': 'application/json' }) });
  const response = await save();
  assert.equal(response.status, 201, await response.text());
  assert.equal((await save()).status, 200, 'An identical retry is idempotent.');
  const row = fixture.sqlite.prepare('SELECT * FROM training_records').get();
  const stored = JSON.parse(row.payload_json);
  assert.deepEqual(stored.score.rounds, []);
  assert.equal(stored.scoreRoundCount, 2);
  const saved = await ReadSavedGameRecord(row, fixture.env.RAW_DATA, session.version);
  assert.deepEqual(saved.score.rounds, rounds);
  if (kind) assert.ok(saved.rawFiles.some(file => file.kind === kind && file.rows === 1));
  const roundFile = stored.rawFiles.find(file => file.kind === 'rounds');
  const object = fixture.env.RAW_DATA.objects.get(roundFile.key);
  const badCount = { ...row, payload_json: JSON.stringify({ ...stored, scoreRoundCount: 3 }) };
  await assert.rejects(() => ReadSavedGameRecord(badCount, fixture.env.RAW_DATA, session.version), /count/i);
  await assert.rejects(() => ReadSavedGameRecord({ ...row, subject_id: crypto.randomUUID() }, fixture.env.RAW_DATA, session.version), /scope/i);
  await assert.rejects(() => ReadSavedGameRecord(row, fixture.env.RAW_DATA, '9.9.9'), /version/i);
  fixture.env.RAW_DATA.objects.set(roundFile.key, { ...object, text: object.text.replace('0.0000001', '0.0000002') });
  await assert.rejects(() => ReadSavedGameRecord(row, fixture.env.RAW_DATA, session.version), /sha-256/i);
  fixture.env.RAW_DATA.objects.delete(roundFile.key);
  await assert.rejects(() => ReadSavedGameRecord(row, fixture.env.RAW_DATA, session.version), /missing.*csv/i);
});

test('signed-in browser fixture assigns an account subject through an atomic D1 batch', async t => {
  const fixture = CreateRawDataEnvironment();
  t.after(() => fixture.sqlite.close());
  const db = CreateBrowserDatabase(fixture.sqlite);
  fixture.env.REHAB_DB = db;
  const userId = crypto.randomUUID();
  fixture.sqlite.prepare('INSERT INTO app_users (id,display_name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(userId, 'Local browser account', new Date().toISOString(), new Date().toISOString());
  const token = await CreateSessionForUser(fixture.env, { id: userId });
  assert.ok(token);
  const subjectId = await EnsureAccountSubjectId(db, userId);
  assert.match(subjectId, /^[0-9a-f-]{36}$/);
  assert.equal(await EnsureAccountSubjectId(db, userId), subjectId);
});

test('browser D1 batch rolls back earlier writes when a later statement fails', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('CREATE TABLE sample (id INTEGER PRIMARY KEY)');
  const db = CreateBrowserDatabase(sqlite);
  await assert.rejects(() => db.batch([
    db.prepare('INSERT INTO sample VALUES (?)').bind(1), db.prepare('INSERT INTO sample VALUES (?)').bind(1),
  ]), /UNIQUE/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM sample').get().count, 0);
});

test('remote preview preflight rejects an unpublished candidate or different immutable bytes', async () => {
  const bytes = Buffer.from('preview fixture');
  const file = { path: 'preview.webp', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  const manifest = { gameId: 'simon-says', version: '2.0.1', files: [file] };
  const runnerOrigin = 'https://runner.example';
  const catalog = { preview: 'preview.webp' };
  await assert.rejects(() => VerifyRemotePreview(manifest, catalog, runnerOrigin, async url => {
    assert.equal(url, runnerOrigin + '/games/simon-says/2.0.1/package/preview.webp');
    return new Response('Missing', { status: 404 });
  }), /simon-says@2\.0\.1.*HTTP 404.*local candidate/i);
  await assert.rejects(() => VerifyRemotePreview(manifest, catalog, runnerOrigin,
    async () => new Response(Buffer.from('different bytes'))), /preview.*(size|sha-256)/i);
  await VerifyRemotePreview(manifest, catalog, runnerOrigin, async () => new Response(bytes));
});

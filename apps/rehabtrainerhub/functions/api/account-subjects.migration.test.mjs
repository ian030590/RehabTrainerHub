import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { CreateSessionForUser, CreateSignedValue, VerifySignedValue, authCookieName } from '../_lib/auth.js';
import { onRequestPost as createOfficialSession } from './official-game-sessions.js';
import { onRequestPost as saveRecord } from './records.js';
import { onRequestPost as createPackageSession } from './game-run-sessions.js';
import { onRequestPost as savePackageRun } from './game-runs.js';
import { onRequestPost as saveCsv } from './oculomotor-data.js';
import { onRequestGet as getMe } from './auth/me.js';
import { onRequestGet as getSharedSession } from './auth/session.js';
import { CreateMemoryBucket } from '../_lib/rawDataTestFixtures.mjs';

const secret = 'account-subject-test-secret-0123456789abcdef';
const timestamp = '2026-10-24T00:00:00.000Z';
const migrationsUrl = new URL('../../migrations/', import.meta.url);

test('0015 adds a nullable unique account subject without backfilling or changing history', async () => {
  const { sqlite } = await CreateFixture();
  try {
    const migration = await readFile(new URL('0015_account_subject_ids.sql', migrationsUrl), 'utf8');
    assert.match(migration, /ALTER TABLE app_users ADD COLUMN subject_id TEXT/i);
    assert.equal(sqlite.prepare('SELECT subject_id FROM app_users WHERE id = ?').get('account-a').subject_id, null);
    sqlite.prepare('UPDATE app_users SET subject_id = ? WHERE id = ?').run(crypto.randomUUID(), 'account-a');
    const subjectId = sqlite.prepare('SELECT subject_id FROM app_users WHERE id = ?').get('account-a').subject_id;
    assert.throws(() => sqlite.prepare('UPDATE app_users SET subject_id = ? WHERE id = ?').run(subjectId, 'account-b'), /UNIQUE/);
    assert.equal(sqlite.prepare("SELECT subject_id FROM training_records WHERE id = 'old-account-a'").get().subject_id, null);
    assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { sqlite.close(); }
});

test('first assignment atomically relabels only the account history and concurrent devices get one ID', async () => {
  const { sqlite, db } = await CreateFixture();
  try {
    const { EnsureAccountSubjectId } = await import('../_lib/subjects.js');
    const [first, second] = await Promise.all([EnsureAccountSubjectId(db, 'account-a'), EnsureAccountSubjectId(db, 'account-a')]);
    assert.match(first, /^[0-9a-f-]{36}$/);
    assert.equal(first, second);
    assert.equal(await EnsureAccountSubjectId(db, 'account-a'), first);
    assert.notEqual(await EnsureAccountSubjectId(db, 'account-b'), first);
    for (const table of ['training_records', 'game_run_sessions', 'game_runs']) {
      const rows = sqlite.prepare(`SELECT subject_id, user_id FROM ${table}`).all();
      assert.ok(rows.some(row => row.user_id === 'account-a'));
      for (const row of rows) {
        if (row.user_id === 'account-a') assert.equal(row.subject_id, first);
        if (row.user_id === null) assert.equal(row.subject_id, '550e8400-e29b-41d4-a716-446655440000');
      }
    }
  } finally { sqlite.close(); }
});

test('two devices get the same official signed subject and save under that account ID', async () => {
  const { sqlite, env, token } = await CreateFixture();
  try {
    const subjects = [];
    for (let device = 0; device < 2; device++) {
      const clientSubject = crypto.randomUUID();
      const response = await createOfficialSession({ request: JsonRequest('official-game-sessions', { gameId: 'drawing-defense', subjectId: clientSubject }, token), env });
      assert.equal(response.status, 201);
      const session = await response.json();
      const claims = await VerifySignedValue(session.token, secret);
      assert.equal(typeof session.subjectId, 'string');
      assert.equal(claims.subjectId, session.subjectId);
      assert.notEqual(session.subjectId, clientSubject);
      subjects.push(session.subjectId);
      const saved = await saveRecord({ request: JsonRequest('records', OfficialRecord(session, clientSubject), token), env });
      assert.equal(saved.status, 201);
      assert.equal(sqlite.prepare('SELECT subject_id FROM training_records WHERE id = ?').get(session.recordId).subject_id, session.subjectId);
    }
    assert.equal(subjects[0], subjects[1]);
    const invalid = await createOfficialSession({ request: JsonRequest('official-game-sessions', { gameId: 'drawing-defense', subjectId: 'bad' }, token), env });
    assert.equal(invalid.status, 400);
  } finally { sqlite.close(); }
});

test('an authenticated result rejects a signed token carrying another account subject', async () => {
  const { sqlite, env, token } = await CreateFixture();
  try {
    const otherSubject = crypto.randomUUID();
    const recordId = crypto.randomUUID();
    const runSessionToken = await CreateSignedValue({ purpose: 'official-game-result', gameId: 'drawing-defense', version: '2.0.0',
      recordId, userId: 'account-a', subjectId: otherSubject }, secret, 3600);
    const response = await saveRecord({ request: JsonRequest('records', OfficialRecord({ recordId, token: runSessionToken, version: '2.0.0' }, otherSubject), token), env });
    assert.equal(response.status, 400);
    assert.equal(sqlite.prepare('SELECT id FROM training_records WHERE id = ?').get(recordId), undefined);
  } finally { sqlite.close(); }
});

test('two devices use one package subject and foreign subjects cannot consume or retry a run', async () => {
  const { sqlite, env, token } = await CreateFixture();
  try {
    const subjects = [];
    for (let device = 0; device < 2; device++) {
      const clientRunId = `device-run-${device}`;
      const response = await createPackageSession({ request: JsonRequest('game-run-sessions', { releaseId: 'release-test', clientRunId, subjectId: crypto.randomUUID() }, token, true), env });
      assert.equal(response.status, 201);
      const session = await response.json();
      assert.equal(typeof session.subjectId, 'string');
      subjects.push(session.subjectId);
      const body = { releaseId: 'release-test', clientRunId, runSessionToken: session.runSession.token, result: { status: 'completed', score: 1 } };
      const saved = await savePackageRun({ request: JsonRequest('game-runs', body, token, true), env });
      assert.equal(saved.status, 201);
      assert.equal(sqlite.prepare('SELECT subject_id FROM game_runs WHERE client_run_id = ?').get(clientRunId).subject_id, session.subjectId);
      sqlite.prepare('UPDATE game_run_sessions SET subject_id = ? WHERE client_run_id = ?').run(crypto.randomUUID(), clientRunId);
      assert.equal((await savePackageRun({ request: JsonRequest('game-runs', body, token, true), env })).status, 409);
    }
    assert.equal(subjects[0], subjects[1]);
    const response = await createPackageSession({ request: JsonRequest('game-run-sessions', { releaseId: 'release-test', clientRunId: 'foreign-run', subjectId: crypto.randomUUID() }, token, true), env });
    const session = await response.json();
    sqlite.prepare("UPDATE game_run_sessions SET subject_id = ? WHERE client_run_id = 'foreign-run'").run(crypto.randomUUID());
    assert.equal((await savePackageRun({ request: JsonRequest('game-runs', { releaseId: 'release-test', clientRunId: 'foreign-run', runSessionToken: session.runSession.token, result: { status: 'completed' } }, token, true), env })).status, 409);
  } finally { sqlite.close(); }
});

test('guest sessions and records retain the supplied guest ID', async () => {
  const { sqlite, env } = await CreateFixture();
  try {
    const subjectId = crypto.randomUUID();
    const sessionResponse = await createOfficialSession({ request: JsonRequest('official-game-sessions', { gameId: 'drawing-defense', subjectId }), env });
    const session = await sessionResponse.json();
    assert.equal((await VerifySignedValue(session.token, secret)).subjectId, subjectId);
    assert.equal((await saveRecord({ request: JsonRequest('records', OfficialRecord(session, subjectId)), env })).status, 201);
    const row = sqlite.prepare('SELECT subject_id,user_id FROM training_records WHERE id = ?').get(session.recordId);
    assert.equal(row.subject_id, subjectId);
    assert.equal(row.user_id, null);
  } finally { sqlite.close(); }
});

test('me and shared-session responses return the same account subject on both devices', async () => {
  const { sqlite, env, token } = await CreateFixture();
  try {
    const me = await getMe({ request: JsonRequest('auth/me', undefined, token), env });
    const user = (await me.json()).user;
    assert.equal(typeof user.subjectId, 'string');
    const shared = await getSharedSession({ request: JsonRequest('auth/session', undefined, token, true), env });
    assert.equal((await shared.json()).user.subjectId, user.subjectId);
    assert.equal(sqlite.prepare('SELECT subject_id FROM app_users WHERE id = ?').get('account-a').subject_id, user.subjectId);
  } finally { sqlite.close(); }
});

test('signed-in CSV replaces a client subject and verifies the canonical subject in its official token', async () => {
  const { sqlite, env, token } = await CreateFixture();
  try {
    env.OCULOMOTOR_DATA = CreateMemoryBucket();
    const clientSubject = crypto.randomUUID();
    const body = { recordId: crypto.randomUUID(), subjectId: clientSubject, source: 'webgazer',
      metadata: { mode: 'pursuit', pattern: 'horizontalSweep', eye_tracking_source: 'webgazer', screen_width_px: 1920, duration_ms: 15000 },
      records: [[1, 10, null, 10, 100, 1, 320, 240, 330, 245, 11.18, 0.2, 1, 'training', 'right']] };
    assert.equal((await saveCsv({ request: JsonRequest('oculomotor-data', body, token), env })).status, 201);
    const csv = env.OCULOMOTOR_DATA.objects.get(`users/account-a/${body.recordId}.csv`).text;
    assert.ok(!csv.includes(clientSubject));
    const accountSubject = sqlite.prepare('SELECT subject_id FROM app_users WHERE id = ?').get('account-a').subject_id;
    assert.ok(csv.includes(accountSubject));
    body.recordId = crypto.randomUUID();
    const claims = { purpose: 'official-game-result', gameId: 'oculomotor-training', version: '2.0.0', recordId: body.recordId, userId: 'account-a', subjectId: clientSubject };
    assert.equal((await saveCsv({ request: JsonRequest('oculomotor-data', { ...body, officialGameVersion: '2.0.0', runSessionToken: await CreateSignedValue(claims, secret, 3600) }, token), env })).status, 400);
    const canonicalToken = await CreateSignedValue({ ...claims, subjectId: accountSubject }, secret, 3600);
    assert.equal((await saveCsv({ request: JsonRequest('oculomotor-data', { ...body, officialGameVersion: '2.0.0', runSessionToken: canonicalToken }, token), env })).status, 201);
  } finally { sqlite.close(); }
});

function JsonRequest(path, body, token, cookie = false) {
  return new Request(`https://trainerhub.cc/api/${path}`, { method: body ? 'POST' : 'GET',
    headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.242',
      ...(token ? cookie ? { Cookie: `${authCookieName}=${token}` } : { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}

function OfficialRecord(session, subjectId) {
  return { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId, officialGameVersion: session.version, runSessionToken: session.token,
    record: { id: session.recordId, userName: '', moduleId: 'drawing-defense', gameId: 'drawing-defense', config: {},
      score: { schema: 'rehab-trainer.game-score/v1', gameId: 'drawing-defense', summary: { defeated: 1 }, rounds: [] } } };
}

async function CreateFixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const name of (await readdir(migrationsUrl)).filter(name => /^00(?:0\d|1[0-5])_.*\.sql$/.test(name)).sort()) {
    sqlite.exec(await readFile(new URL(name, migrationsUrl), 'utf8'));
  }
  for (const id of ['account-a', 'account-b']) {
    sqlite.prepare('INSERT INTO app_users (id,created_at,updated_at) VALUES (?,?,?)').run(id, timestamp, timestamp);
  }
  sqlite.exec(`INSERT INTO developer_games (id,slug,owner_user_id,title,status,created_at,updated_at)
    VALUES ('game-test','game-test','account-a','Test','published','${timestamp}','${timestamp}');
    INSERT INTO game_releases (id,game_id,version,submitted_developer_name,submitted_title,artifact_type,status,content_sha256,package_bytes,uncompressed_bytes,file_count,jspsych_version,files_json,scan_summary_json,submitted_at,created_at,updated_at)
    VALUES ('release-test','game-test','1.0.0','Test','Test','html','approved','digest',1,1,1,'8.2.3','[]','{}','${timestamp}','${timestamp}','${timestamp}');
    UPDATE developer_games SET active_release_id='release-test';`);
  for (const userId of ['account-a', 'account-b', null]) {
    const scope = userId || 'guest';
    const subjectId = userId ? null : '550e8400-e29b-41d4-a716-446655440000';
    sqlite.prepare(`INSERT INTO training_records (id,subject_id,user_id,app_id,runtime_id,module_id,saved_at,payload_json,created_at,updated_at)
      VALUES (?,?,?,'rehabtrainerhub','motor','upper-limb-training',?,'{}',?,?)`).run(`old-${scope}`, subjectId, userId, timestamp, timestamp, timestamp);
    sqlite.prepare(`INSERT INTO game_run_sessions (id,token_sha256,subject_id,user_id,game_id,release_id,client_run_id,expires_at,created_at)
      VALUES (?,?,?,?,'game-test','release-test',?,2000000000,?)`).run(`session-${scope}`, `token-${scope}`, subjectId, userId, `client-${scope}`, timestamp);
    sqlite.prepare(`INSERT INTO game_runs (id,subject_id,user_id,game_id,release_id,client_run_id,completed,result_json,created_at,run_session_id,result_source)
      VALUES (?,?,?, 'game-test','release-test',?,1,'{}',?,?,'sandbox_client_reported')`).run(`run-${scope}`, subjectId, userId, `client-${scope}`, timestamp, `session-${scope}`);
  }
  const db = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    let bindings = [];
    const wrapper = { bind(...values) { bindings = values; return wrapper; },
      first: async () => statement.get(...bindings) ?? null,
      all: async () => ({ results: statement.all(...bindings) }),
      run: async () => ({ meta: { changes: Number(statement.run(...bindings).changes) } }) };
    return wrapper;
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  // Serialize batches as D1 does while allowing competing initial reads.
  const executeBatch = db.batch;
  let pendingBatch = Promise.resolve();
  db.batch = statements => { const result = pendingBatch.then(() => executeBatch(statements)); pendingBatch = result.catch(() => {}); return result; };
  const files = [{ path: 'index.html', size: 1, sha256: 'a'.repeat(64), contentType: 'text/html; charset=utf-8' }];
  const contentSha256 = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  const env = { AUTH_SESSION_SECRET: secret, REHAB_DB: db, ANONYMOUS_RECORDS_ENABLED: '1', GAME_RELEASE_BUCKET: { async get(key) {
    const gameId = key.includes('oculomotor-training') ? 'oculomotor-training' : 'drawing-defense';
    const value = key.endsWith('current.json') ? { schemaVersion: 1, gameId, currentVersion: '2.0.0', releases: { '2.0.0': { contentSha256 } } }
      : { schemaVersion: 1, status: 'approved', gameId, version: '2.0.0', name: 'Test', entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game', capabilities: ['pointer'], files, contentSha256 };
    const source = JSON.stringify(value);
    return { size: Buffer.byteLength(source), text: async () => source };
  } } };
  return { sqlite, db, env, token: await CreateSessionForUser(env, { id: 'account-a' }) };
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { CreateSignedValue, GetSessionSecret, CreateSessionForUser, VerifySignedValue } from '../_lib/auth.js';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { onRequestPost as createSession } from './official-game-sessions.js';
import { onRequestPost as saveRecord } from './records.js';

const env = { AUTH_SESSION_SECRET: 'official-game-test-secret-abcdefghijklmnopqrstuvwxyz' };
const version = '2.0.2';
const nextVersion = '2.0.3';

function CreateOfficialRelease(releaseVersion, gameId = 'drawing-defense') {
  const bytes = Buffer.from(`<!doctype html><title>Game ${releaseVersion}</title>`);
  const files = [{ path: 'index.html', size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), contentType: 'text/html; charset=utf-8' }];
  return { schemaVersion: 1, status: 'approved', gameId, version: releaseVersion,
    name: 'Drawing defense', entry: 'index.html', runtime: { name: 'native', major: 1 },
    presentation: 'game', capabilities: ['pointer'], files,
    contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

function CreateOfficialBucket(gameId = 'drawing-defense') {
  const releases = new Map([version, nextVersion].map(releaseVersion => [releaseVersion, CreateOfficialRelease(releaseVersion, gameId)]));
  const catalog = { schemaVersion: 1, gameId, currentVersion: version,
    releases: Object.fromEntries([...releases].map(([releaseVersion, release]) => [releaseVersion, { contentSha256: release.contentSha256 }])) };
  const bucket = { get: async key => {
    const value = key === `official-games/${gameId}/current.json`
      ? catalog : releases.get((key.startsWith(`releases/${gameId}/`) && key.endsWith('/release.json')) ? key.split('/')[2] : undefined);
    if (!value) return null;
    const source = JSON.stringify(value);
    return { size: Buffer.byteLength(source), text: async () => source, json: async () => JSON.parse(source) };
  } };
  return { bucket, catalog, releases };
}

for (const gameId of ['drawing-defense', 'asteroid-shield']) {
test(`${gameId}: official sessions bind the result to a game version, record, account and subject`, async () => {
  const { VerifyOfficialGameSession } = await import('../_lib/officialGames.js');
  const environment = { ...env, GAME_RELEASE_BUCKET: CreateOfficialBucket(gameId).bucket };
  const claims = { purpose: 'official-game-result', gameId, version,
    recordId: crypto.randomUUID(), subjectId: crypto.randomUUID(), userId: 'account-1' };
  const token = await CreateSignedValue(claims, GetSessionSecret(env), 3600);
  const input = { officialGameVersion: claims.version, runSessionToken: token, record: {
    id: claims.recordId, gameId: claims.gameId, moduleId: claims.gameId,
  } };
  assert.equal(await VerifyOfficialGameSession(input, environment, claims.userId, claims.subjectId), true);
  assert.equal(await VerifyOfficialGameSession(input, environment, 'other-account', claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession(input, environment, claims.userId, crypto.randomUUID()), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, officialGameVersion: '3.0.0' }, environment, claims.userId, claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, record: { ...input.record, id: crypto.randomUUID() } }, environment, claims.userId, claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, runSessionToken: token + 'a' }, environment, claims.userId, claims.subjectId), false);
  const expired = await CreateSignedValue(claims, GetSessionSecret(env), -1);
  assert.equal(await VerifyOfficialGameSession({ ...input, runSessionToken: expired }, environment, claims.userId, claims.subjectId), false);
});

test(`${gameId}: current changes preserve official sessions while revocation and digest changes reject them`, async () => {
  const { VerifyOfficialGameSession } = await import('../_lib/officialGames.js');
  const fixture = CreateOfficialBucket(gameId);
  const environment = { ...env, GAME_RELEASE_BUCKET: fixture.bucket };
  const claims = { purpose: 'official-game-result', gameId, version,
    contentSha256: fixture.releases.get(version).contentSha256,
    recordId: crypto.randomUUID(), subjectId: crypto.randomUUID(), userId: null };
  const input = { officialGameVersion: version, runSessionToken: await CreateSignedValue(claims, GetSessionSecret(env), 86400),
    record: { id: claims.recordId, gameId: claims.gameId, moduleId: claims.gameId } };
  fixture.catalog.currentVersion = nextVersion;
  assert.equal(await VerifyOfficialGameSession(input, environment, null, claims.subjectId), true);
  const { contentSha256, ...legacyClaims } = claims;
  const legacyInput = { ...input, runSessionToken: await CreateSignedValue(legacyClaims, GetSessionSecret(env), 86400) };
  assert.equal(await VerifyOfficialGameSession(legacyInput, environment, null, claims.subjectId), true);
  const wrongDigest = await CreateSignedValue({ ...claims, contentSha256: 'f'.repeat(64) }, GetSessionSecret(env), 86400);
  assert.equal(await VerifyOfficialGameSession({ ...input, runSessionToken: wrongDigest }, environment, null, claims.subjectId), false);
  fixture.releases.get(version).status = 'revoked';
  assert.equal(await VerifyOfficialGameSession(input, environment, null, claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession(legacyInput, environment, null, claims.subjectId), false);
  fixture.releases.get(version).status = 'approved';
  fixture.catalog.releases[version].contentSha256 = 'b'.repeat(64);
  assert.equal(await VerifyOfficialGameSession(input, environment, null, claims.subjectId), false);
  delete fixture.catalog.releases[version];
  assert.equal(await VerifyOfficialGameSession(legacyInput, environment, null, claims.subjectId), false);
});

test(`${gameId}: a real SQL database saves official game results once, permits retry, and rejects mutation`, async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const migrations = new URL('../../migrations/', import.meta.url);
    for (const path of (await readdir(migrations)).filter(path => path.endsWith('.sql')).sort()) {
      sqlite.exec(await readFile(new URL(path, migrations), 'utf8'));
    }
    let recordReads = 0;
    let releaseRace;
    const race = new Promise(resolve => { releaseRace = resolve; });
    const database = { prepare: sql => {
      const statement = sqlite.prepare(sql);
      let bindings = [];
      const wrapper = {
        bind: (...values) => { bindings = values; return wrapper; },
        first: async () => {
          const row = statement.get(...bindings) ?? null;
          if (sql.startsWith('SELECT payload_json, user_id, subject_id') && recordReads++ < 2) {
            if (recordReads === 2) releaseRace();
            await race;
          }
          return row;
        },
        all: async () => ({ results: statement.all(...bindings) }),
        run: async () => ({ meta: { changes: Number(statement.run(...bindings).changes) } }),
      };
      return wrapper;
    } };
    const fixture = CreateOfficialBucket(gameId);
    const environment = { ...env, REHAB_DB: database, ANONYMOUS_RECORDS_ENABLED: '1', GAME_RELEASE_BUCKET: fixture.bucket };
    const subjectId = crypto.randomUUID();
    const request = (path, body, authToken) => new Request(`https://trainerhub.cc/api/${path}`, {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.9', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(body),
    });
    const sessionResponse = await createSession({ request: request('official-game-sessions', { gameId, subjectId }), env: environment });
    assert.equal(sessionResponse.status, 201);
    const session = await sessionResponse.json();
    assert.equal(session.version, version);
    assert.equal(session.contentSha256, fixture.releases.get(version).contentSha256);
    assert.match(sessionResponse.headers.get('Cache-Control'), /no-store/);
    const claims = await VerifySignedValue(session.token, GetSessionSecret(env));
    assert.equal(claims.contentSha256, session.contentSha256);
    assert.equal(claims.exp - claims.iat, 86400);
    fixture.catalog.currentVersion = nextVersion;
    const newSessionResponse = await createSession({ request: request('official-game-sessions', { gameId, subjectId }), env: environment });
    assert.equal(newSessionResponse.status, 201);
    assert.equal((await newSessionResponse.json()).version, nextVersion);
    const legacyResponse = await createSession({ request: request('official-game-sessions', { gameId, version, subjectId }), env: environment });
    assert.equal(legacyResponse.status, 201);
    assert.equal((await legacyResponse.json()).version, version);
    fixture.releases.set('9.0.0', CreateOfficialRelease('9.0.0', gameId));
    const unofficialResponse = await createSession({ request: request('official-game-sessions', { gameId, version: '9.0.0', subjectId }), env: environment });
    assert.equal(unofficialResponse.status, 503);
    const payload = { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId, officialGameVersion: version, runSessionToken: session.token,
      record: { id: session.recordId, userName: '', moduleId: gameId, gameId, config: { difficulty: 'Beginner' },
        score: { schema: 'rehab-trainer.game-score/v1', gameId, summary: { defeated: 1 }, rounds: [{ reactionSeconds: 0.2 }] } } };
    assert.equal((await saveRecord({ request: request('records', { ...payload, runSessionToken: undefined }), env: environment })).status, 400);
    assert.equal((await saveRecord({ request: request('records', { ...payload, record: { ...payload.record, config: { authToken: 'secret' } } }), env: environment })).status, 400);
    const concurrent = await Promise.all([1, 2].map(() => saveRecord({ request: request('records', payload), env: environment })));
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 201]);
    assert.equal((await saveRecord({ request: request('records', payload), env: environment })).status, 200);
    const outage = { ...environment, GAME_RELEASE_BUCKET: { get: async () => { throw new Error('Storage unavailable'); } } };
    assert.equal((await saveRecord({ request: request('records', payload), env: outage })).status, 503);
    payload.record.score.summary.defeated = 99;
    assert.equal((await saveRecord({ request: request('records', payload), env: environment })).status, 409);
    const stored = sqlite.prepare('SELECT subject_id,user_id,payload_json FROM training_records').all();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].subject_id, subjectId);
    assert.equal(stored[0].user_id, null);
    assert.equal(JSON.parse(stored[0].payload_json).score.summary.defeated, 1);
    const userId = crypto.randomUUID();
    sqlite.prepare('INSERT INTO app_users (id,display_name,created_at,updated_at) VALUES (?,?,?,?)').run(userId, 'Test account', new Date().toISOString(), new Date().toISOString());
    const accountToken = await CreateSessionForUser(environment, { id: userId });
    const accountSubject = crypto.randomUUID();
    const accountSessionResponse = await createSession({ request: request('official-game-sessions', { gameId, version, subjectId: accountSubject }, accountToken), env: environment });
    assert.equal(accountSessionResponse.status, 201);
    const accountSession = await accountSessionResponse.json();
    const accountPayload = { ...payload, subjectId: accountSubject, runSessionToken: accountSession.token, record: { ...payload.record, id: accountSession.recordId } };
    assert.equal((await saveRecord({ request: request('records', accountPayload), env: environment })).status, 400);
    assert.equal((await saveRecord({ request: request('records', accountPayload, accountToken), env: environment })).status, 201);
    const accountRow = sqlite.prepare('SELECT subject_id,user_id FROM training_records WHERE id = ?').get(accountSession.recordId);
    assert.equal(accountRow.user_id, userId);
    assert.equal(accountRow.subject_id, accountSubject);
  } finally { sqlite.close(); }
});

}

import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSignedValue, GetSessionSecret, CreateSessionForUser } from '../_lib/auth.js';
import { officialGameReleases } from '../_lib/officialGames.js';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { onRequestPost as createSession } from './official-game-sessions.js';
import { onRequestPost as saveRecord } from './records.js';

const env = { AUTH_SESSION_SECRET: 'official-game-test-secret-abcdefghijklmnopqrstuvwxyz' };
const { version } = officialGameReleases['drawing-defense'];
test('official sessions bind the result to a game version, record, account and subject', async () => {
  const { VerifyOfficialGameSession } = await import('../_lib/officialGames.js');
  const claims = { purpose: 'official-game-result', gameId: 'drawing-defense', version,
    recordId: crypto.randomUUID(), subjectId: crypto.randomUUID(), userId: 'account-1' };
  const token = await CreateSignedValue(claims, GetSessionSecret(env), 3600);
  const input = { officialGameVersion: claims.version, runSessionToken: token, record: {
    id: claims.recordId, gameId: claims.gameId, moduleId: claims.gameId,
  } };
  assert.equal(await VerifyOfficialGameSession(input, env, claims.userId, claims.subjectId), true);
  assert.equal(await VerifyOfficialGameSession(input, env, 'other-account', claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession(input, env, claims.userId, crypto.randomUUID()), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, officialGameVersion: '3.0.0' }, env, claims.userId, claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, record: { ...input.record, id: crypto.randomUUID() } }, env, claims.userId, claims.subjectId), false);
  assert.equal(await VerifyOfficialGameSession({ ...input, runSessionToken: token + 'a' }, env, claims.userId, claims.subjectId), false);
  const expired = await CreateSignedValue(claims, GetSessionSecret(env), -1);
  assert.equal(await VerifyOfficialGameSession({ ...input, runSessionToken: expired }, env, claims.userId, claims.subjectId), false);
});

test('a real SQL database saves official game results once, permits retry, and rejects mutation', async () => {
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
    const environment = { ...env, REHAB_DB: database, ANONYMOUS_RECORDS_ENABLED: '1', GAME_RELEASE_BUCKET: {
      get: async () => ({ size: 100, json: async () => ({ status: 'approved', gameId: 'drawing-defense', version }) }),
    } };
    const subjectId = crypto.randomUUID();
    const request = (path, body, authToken) => new Request(`https://trainerhub.cc/api/${path}`, {
      method: 'POST', headers: { Origin: 'https://trainerhub.cc', 'Content-Type': 'application/json', 'CF-Connecting-IP': '127.0.0.9', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify(body),
    });
    const sessionResponse = await createSession({ request: request('official-game-sessions', { gameId: 'drawing-defense', version, subjectId }), env: environment });
    assert.equal(sessionResponse.status, 201);
    const session = await sessionResponse.json();
    const payload = { appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId, officialGameVersion: version, runSessionToken: session.token,
      record: { id: session.recordId, userName: '', moduleId: 'drawing-defense', gameId: 'drawing-defense', config: { difficulty: 'Beginner' },
        score: { schema: 'rehab-trainer.game-score/v1', gameId: 'drawing-defense', summary: { defeated: 1 }, rounds: [{ reactionSeconds: 0.2 }] } } };
    assert.equal((await saveRecord({ request: request('records', { ...payload, runSessionToken: undefined }), env: environment })).status, 400);
    assert.equal((await saveRecord({ request: request('records', { ...payload, record: { ...payload.record, config: { authToken: 'secret' } } }), env: environment })).status, 400);
    const concurrent = await Promise.all([1, 2].map(() => saveRecord({ request: request('records', payload), env: environment })));
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 201]);
    assert.equal((await saveRecord({ request: request('records', payload), env: environment })).status, 200);
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
    const accountSessionResponse = await createSession({ request: request('official-game-sessions', { gameId: 'drawing-defense', version, subjectId: accountSubject }, accountToken), env: environment });
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

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { CreateSignedValue, authCookieName } from '../../_lib/auth.js';
import { Sha256Hex } from '../../_lib/builderAuth.js';
import { onRequestGet as authorize } from './authorize.js';
import { onRequestPost as exchange } from './exchange.js';
import { onRequestPost as receivePackage } from './package.js';
import { onRequestPost as submitGame } from '../developer/games.js';
import { onRequestPost as createRunSession } from '../game-run-sessions.js';
import { onRequestPost as saveRun } from '../game-runs.js';

const hubOrigin = 'https://trainerhub.cc';
const builderOrigin = 'https://builder.trainerhub.cc';
const authSecret = 'test-auth-secret-with-at-least-32-characters';
const builderSecret = 'test-builder-secret-with-at-least-32-characters';
const owner = { id: 'builder-owner', email: 'owner@example.test', displayName: 'Builder Owner' };
const editor = { id: 'builder-editor', email: 'editor@example.test', displayName: 'Builder Editor' };
const gameId = 'builder-activity';
const score = {
  schema: 'rehab-trainer.game-score/v1', gameId,
  presentation: { primarySummaryKeys: ['accuracy'], qualitySummaryKeys: [], defaultRoundMetricKey: 'correct', chartType: 'bar' },
  columns: [{ key: 'correct', label: { zh: '正確', en: 'Correct' }, sources: ['correct'] }],
  summary: [{ key: 'accuracy', label: { zh: '正確率', en: 'Accuracy' }, sources: ['accuracy'], unit: '%' }],
};
const settings = { schemaVersion: 1, gameId, sections: [{ id: 'activity',
  title: { 'zh-TW': '活動設定', en: 'Activity settings' }, fields: [],
}] };
const zip = zipSync({
  'index.html': strToU8('<!doctype html><meta charset="utf-8"><button id="go">Go</button><script>document.getElementById("go").onclick = () => {};</script>'),
  'settings.json': strToU8(JSON.stringify(settings)),
  'score.json': strToU8(JSON.stringify(score)),
});

test('Hub authorizes Builder, receives a package, accepts submission, and stores an approved native result', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrationDir = new URL('../../../migrations/', import.meta.url);
  for (const name of (await readdir(migrationDir)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    sqlite.exec(await readFile(new URL(name, migrationDir), 'utf8'));
  }
  const now = new Date().toISOString();
  const insertUser = sqlite.prepare('INSERT INTO app_users (id,display_name,email,created_at,updated_at) VALUES (?,?,?,?,?)');
  for (const user of [owner, editor]) insertUser.run(user.id, user.displayName, user.email, now, now);
  const quarantineObjects = new Map();
  const env = {
    AUTH_SESSION_SECRET: authSecret,
    BUILDER_CLIENT_SECRET: builderSecret,
    REHAB_DB: CreateD1(sqlite),
    GAME_QUARANTINE_BUCKET: {
      async put(key, value) { quarantineObjects.set(key, value); },
      async delete(keys) { for (const key of keys) quarantineObjects.delete(key); },
    },
    GAME_RELEASE_BUCKET: {
      async get(key) {
        assert.equal(key, `releases/${gameId}/1.0.0/files/score.json`);
        return { text: async () => JSON.stringify(score) };
      },
    },
  };
  const ownerCookie = `${authCookieName}=${encodeURIComponent(await CreateSignedValue({ sub: owner.id }, authSecret, 60))}`;
  const editorCookie = `${authCookieName}=${encodeURIComponent(await CreateSignedValue({ sub: editor.id }, authSecret, 60))}`;
  const post = (path, body, cookie) => new Request(`${hubOrigin}${path}`, {
    method: 'POST', headers: { Origin: hubOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const verifier = 'a'.repeat(64), state = 'b'.repeat(64);
  const authorization = new URL(`${hubOrigin}/api/builder/authorize`);
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('code_challenge', await Sha256Hex(verifier));
  authorization.searchParams.set('redirect_uri', `${builderOrigin}/api/auth/callback`);
  const originalFetch = globalThis.fetch;
  const builderCalls = [];
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/builder\.trainerhub\.cc\/api\/handoff\/[0-9a-f]{64}$/);
    assert.equal(options.headers['X-Builder-Secret'], builderSecret);
    builderCalls.push(options.headers['X-Hub-User-Id']);
    return new Response(zip, { headers: {
      'X-Builder-Owner': owner.id, 'X-Builder-Game-Id': gameId, 'X-Builder-Version': '1.0.0',
    } });
  };

  try {
    assert.equal((await authorize({ request: new Request(authorization), env })).status, 401);
    const permitted = await authorize({ request: new Request(authorization, { headers: { Cookie: ownerCookie } }), env });
    assert.equal(permitted.status, 303);
    const callback = new URL(permitted.headers.get('Location'));
    assert.equal(callback.origin, builderOrigin);
    assert.equal(callback.searchParams.get('state'), state);
    const code = callback.searchParams.get('code');
    assert.match(code, /^[0-9a-f]{64}$/);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM builder_auth_codes').get().count, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM builder_auth_codes WHERE code_hash=?').get(await Sha256Hex(code)).count, 1);
    const credentials = { code, code_verifier: verifier };
    assert.equal((await exchange({ request: post('/api/builder/exchange', credentials, ownerCookie), env })).status, 401);
    const exchangeRequest = (codeVerifier) => new Request(`${hubOrigin}/api/builder/exchange`, {
      method: 'POST', headers: { 'X-Builder-Secret': builderSecret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    });
    assert.equal((await exchange({ request: exchangeRequest('c'.repeat(64)), env })).status, 401);
    assert.deepEqual((await (await exchange({ request: exchangeRequest(verifier), env })).json()).user,
      { id: owner.id, displayName: owner.displayName });
    assert.equal((await exchange({ request: exchangeRequest(verifier), env })).status, 401);

    const ticket = 'd'.repeat(64);
    const requestPackage = (cookie) => receivePackage({ request: post('/api/builder/package', { ticket }, cookie), env });
    assert.equal((await requestPackage(editorCookie)).status, 403);
    const received = await requestPackage(ownerCookie);
    assert.equal(received.status, 200);
    assert.equal(received.headers.get('X-Builder-Game-Id'), gameId);
    const packageBytes = new Uint8Array(await received.arrayBuffer());
    assert.deepEqual(packageBytes, zip);
    assert.deepEqual(builderCalls, [editor.id, owner.id]);

    const form = new FormData();
    form.set('slug', gameId); form.set('version', '1.0.0'); form.set('title', 'Builder Activity');
    form.set('developerName', owner.displayName); form.set('summary', 'A Builder activity.');
    form.set('trainer', 'brain'); form.set('category', 'attention');
    form.set('capabilities', JSON.stringify(['keyboard', 'pointer'])); form.set('jsPsychVersion', 'none');
    form.set('package', new File([packageBytes], `${gameId}.zip`, { type: 'application/zip' }));
    form.set('slug', 'drawing-defense');
    const reservedUpload = new Request(`${hubOrigin}/api/developer/games`, {
      method: 'POST', headers: { Origin: hubOrigin, Cookie: ownerCookie }, body: form,
    });
    reservedUpload.headers.set('Content-Length', String((await reservedUpload.clone().arrayBuffer()).byteLength));
    assert.equal((await submitGame({ request: reservedUpload, env })).status, 409);
    assert.equal(quarantineObjects.size, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM developer_games').get().count, 0);
    form.set('slug', gameId);
    const upload = new Request(`${hubOrigin}/api/developer/games`, {
      method: 'POST', headers: { Origin: hubOrigin, Cookie: ownerCookie }, body: form,
    });
    upload.headers.set('Content-Length', String((await upload.clone().arrayBuffer()).byteLength));
    const submitted = await submitGame({ request: upload, env });
    assert.equal(submitted.status, 201, await submitted.clone().text());
    const { game, release } = await submitted.json();
    assert.equal(release.status, 'pending_review');
    assert.equal(release.fileCount, 3);
    assert.equal(sqlite.prepare('SELECT owner_user_id FROM developer_games WHERE id=?').get(game.id).owner_user_id, owner.id);
    assert.equal(sqlite.prepare('SELECT status FROM game_releases WHERE id=?').get(release.id).status, 'pending_review');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_release_files WHERE release_id=?').get(release.id).count, 3);
    assert.ok(quarantineObjects.size >= 4);

    const clientRunId = 'client_run_builder_1';
    const sessionInput = { releaseId: release.id, clientRunId };
    assert.equal((await createRunSession({ request: post('/api/game-run-sessions', sessionInput, ownerCookie), env })).status, 404);
    sqlite.prepare("UPDATE game_releases SET status='approved' WHERE id=?").run(release.id);
    sqlite.prepare("UPDATE developer_games SET status='published',active_release_id=? WHERE id=?").run(release.id, game.id);
    const issued = await createRunSession({ request: post('/api/game-run-sessions', sessionInput, ownerCookie), env });
    assert.equal(issued.status, 201, await issued.clone().text());
    const { runSession } = await issued.json();
    const resultInput = { ...sessionInput, runSessionToken: runSession.token,
      result: { status: 'completed', score: 1, durationMs: 200, trialCount: 1,
        details: { accuracy: 100 }, detailRows: [{ correct: true }] },
    };
    const stored = await saveRun({ request: post('/api/game-runs', resultInput, ownerCookie), env });
    assert.equal(stored.status, 201, await stored.clone().text());
    const row = sqlite.prepare('SELECT user_id,completed,result_source,result_json FROM game_runs WHERE release_id=?').get(release.id);
    assert.equal(row.user_id, owner.id);
    assert.equal(row.completed, 1);
    assert.equal(row.result_source, 'sandbox_client_reported');
    assert.deepEqual(JSON.parse(row.result_json).scoreProjection,
      { schema: score.schema, gameId, rounds: [{ correct: 1 }], summary: { accuracy: 100 } });
    const retry = await saveRun({ request: post('/api/game-runs', resultInput, ownerCookie), env });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).run.duplicate, true);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_runs WHERE release_id=?').get(release.id).count, 1);
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});

function CreateD1(db) {
  return {
    prepare(sql) {
      const statement = db.prepare(sql);
      const bound = (args = []) => ({
        bind(...values) { return bound(values); },
        async first() { return statement.get(...args) || null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { return { meta: { changes: statement.run(...args).changes } }; },
      });
      return bound();
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { CreateSignedValue, authCookieName } from '../_lib/auth.js';
import { onRequestPost as submitGame } from './game-submissions.js';
import { onRequestPost as createRunSession } from './game-run-sessions.js';
import { onRequestPost as saveRun } from './game-runs.js';

const hubOrigin = 'https://trainerhub.cc';
const authSecret = 'test-auth-secret-with-at-least-32-characters';
const owner = { id: 'native-owner', email: 'owner@example.test', displayName: 'Native Owner' };
const gameId = 'native-activity';
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

test('owner submits a native package, then records one result after approval', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrationDir = new URL('../../migrations/', import.meta.url);
  for (const name of (await readdir(migrationDir)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    sqlite.exec(await readFile(new URL(name, migrationDir), 'utf8'));
  }
  const now = new Date().toISOString();
  const insertUser = sqlite.prepare('INSERT INTO app_users (id,display_name,email,created_at,updated_at) VALUES (?,?,?,?,?)');
  insertUser.run(owner.id, owner.displayName, owner.email, now, now);
  const quarantineObjects = new Map();
  const env = {
    AUTH_SESSION_SECRET: authSecret,
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
  const post = (path, body, cookie) => new Request(`${hubOrigin}${path}`, {
    method: 'POST', headers: { Origin: hubOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  try {
    const form = new FormData();
    form.set('slug', gameId); form.set('version', '1.0.0'); form.set('title', 'Native Activity');
    form.set('developerName', owner.displayName); form.set('summary', 'A native activity.');
    form.set('trainer', 'brain'); form.set('category', 'attention');
    form.set('changeNotes', 'Initial release for review.');
    form.set('capabilities', JSON.stringify(['keyboard', 'pointer'])); form.set('jsPsychVersion', 'none');
    form.set('package', new File([zip], `${gameId}.zip`, { type: 'application/zip' }));
    form.set('slug', 'drawing-defense');
    const reservedUpload = new Request(`${hubOrigin}/api/developer/games`, {
      method: 'POST', headers: { Origin: hubOrigin, Cookie: ownerCookie }, body: form,
    });
    reservedUpload.headers.set('Content-Length', String((await reservedUpload.clone().arrayBuffer()).byteLength));
    assert.equal((await submitGame({ request: reservedUpload, env })).status, 409);
    assert.equal(quarantineObjects.size, 0);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM developer_games').get().count, 0);
    form.set('slug', gameId);
    const upload = new Request(`${hubOrigin}/api/game-submissions`, {
      method: 'POST', headers: { Origin: hubOrigin, Cookie: ownerCookie }, body: form,
    });
    upload.headers.set('Content-Length', String((await upload.clone().arrayBuffer()).byteLength));
    const submitted = await submitGame({ request: upload, env });
    assert.equal(submitted.status, 201, await submitted.clone().text());
    const { game, release } = await submitted.json();
    assert.equal(release.status, 'pending_review');
    assert.equal(release.fileCount, 3);
    assert.match(release.reviewDigest, /^[a-f0-9]{64}$/);
    assert.equal(release.changeNotes, 'Initial release for review.');
    assert.deepEqual(release.reviewIssue, { status: 'pending', number: null, url: null });
    assert.equal(sqlite.prepare('SELECT review_digest FROM game_review_issues WHERE release_id=?').get(release.id).review_digest, release.reviewDigest);
    assert.equal(sqlite.prepare('SELECT status FROM game_review_issue_jobs WHERE release_id=?').get(release.id).status, 'pending');
    assert.equal(sqlite.prepare('SELECT active_release_id FROM developer_games WHERE id=?').get(game.id).active_release_id, null);
    assert.equal(sqlite.prepare('SELECT owner_user_id FROM developer_games WHERE id=?').get(game.id).owner_user_id, owner.id);
    assert.equal(sqlite.prepare('SELECT status FROM game_releases WHERE id=?').get(release.id).status, 'pending_review');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_release_files WHERE release_id=?').get(release.id).count, 3);
    assert.ok(quarantineObjects.size >= 4);

    const clientRunId = 'client_run_native_1';
    const sessionInput = { releaseId: release.id, clientRunId };
    assert.equal((await createRunSession({ request: post('/api/game-run-sessions', sessionInput, ownerCookie), env })).status, 404);
    sqlite.prepare("UPDATE game_releases SET status='approved' WHERE id=?").run(release.id);
    sqlite.prepare("UPDATE developer_games SET status='published',active_release_id=? WHERE id=?").run(release.id, game.id);
    const issued = await createRunSession({ request: post('/api/game-run-sessions', sessionInput, ownerCookie), env });
    assert.equal(issued.status, 201, await issued.clone().text());
    const { runSession } = await issued.json();
    const nextRelease = { ...sqlite.prepare('SELECT * FROM game_releases WHERE id=?').get(release.id),
      id: 'native-next-version', version: '1.0.1' };
    const columns = Object.keys(nextRelease);
    sqlite.prepare(`INSERT INTO game_releases (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`)
      .run(...Object.values(nextRelease));
    sqlite.prepare('UPDATE developer_games SET active_release_id=? WHERE id=?').run(nextRelease.id, game.id);
    assert.equal((await createRunSession({ request: post('/api/game-run-sessions', {
      releaseId: release.id, clientRunId: 'client_run_old_version',
    }, ownerCookie), env })).status, 404);
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
      { schema: score.schema, gameId, rounds: [], summary: { accuracy: 100 } });
    assert.deepEqual(JSON.parse(row.result_json).detailRows, []);
    assert.equal(JSON.parse(row.result_json).scoreRoundCount, 1);
    const retry = await saveRun({ request: post('/api/game-runs', resultInput, ownerCookie), env });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).run.duplicate, true);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM game_runs WHERE release_id=?').get(release.id).count, 1);
  } finally {
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSessionForUser } from '../_lib/auth.js';
import { CreateRawDataEnvironment } from '../_lib/rawDataTestFixtures.mjs';
import { onRequestPost } from './records.js';

function Post(fixture, input) {
  return onRequestPost({ env: fixture.env, request: new Request('https://trainerhub.cc/api/records', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.211',
      ...(fixture.authToken ? { Authorization: `Bearer ${fixture.authToken}` } : {}),
    },
    body: JSON.stringify(input),
  }) });
}

async function CreateFixture(signedIn) {
  const fixture = CreateRawDataEnvironment();
  const subjectId = crypto.randomUUID();
  const userId = signedIn ? 'record-integrity-test-user' : null;
  if (signedIn) {
    fixture.sqlite.prepare(`
      INSERT INTO app_users (id, subject_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, subjectId, new Date().toISOString(), new Date().toISOString());
    fixture.authToken = await CreateSessionForUser(fixture.env, { id: userId });
  }
  fixture.session = await fixture.session(userId, subjectId);
  return fixture;
}

function OfficialInput(session, rounds) {
  return {
    appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
    officialGameVersion: session.version, runSessionToken: session.token,
    record: {
      id: session.recordId, gameId: session.gameId, moduleId: session.gameId, config: {},
      score: { schema: 'rehab-trainer.game-score/v1', gameId: session.gameId, summary: { total: 5 }, rounds },
    },
  };
}

test('legacy upserts bind at most 17 parameters', async (t) => {
  const fixture = await CreateFixture(false);
  try {
    const database = fixture.env.REHAB_DB;
    const prepare = database.prepare.bind(database);
    const legacyBindings = [];
    t.mock.method(database, 'prepare', (sql) => {
      const statement = prepare(sql);
      if (sql.includes('INSERT INTO training_records')) {
        const bind = statement.bind.bind(statement);
        t.mock.method(statement, 'bind', (...values) => {
          legacyBindings.push(values);
          return bind(...values);
        });
      }
      return statement;
    });
    const { session } = fixture;
    const response = await Post(fixture, {
      appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
      record: { id: session.recordId, moduleId: session.gameId, results: [{ score: 2 }] },
    });
    assert.equal(response.status, 201);
    assert.equal(legacyBindings.length, 1);
    assert.ok(legacyBindings[0].length <= 17,
      `Legacy upsert bound ${legacyBindings[0].length} parameters; maximum is 17.`);
  } finally { fixture.sqlite.close(); }
});

for (const signedIn of [false, true]) {
  const owner = signedIn ? 'signed-in' : 'guest';
  test(`legacy upserts cannot modify a ${owner} official result`, async () => {
    const fixture = await CreateFixture(signedIn);
    try {
      const { session } = fixture;
      assert.equal((await Post(fixture, OfficialInput(session, [{ points: 2 }]))).status, 201);
      const select = fixture.sqlite.prepare('SELECT * FROM training_records WHERE id = ?');
      const original = select.get(session.recordId);
      const response = await Post(fixture, {
        appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
        record: { id: session.recordId, moduleId: session.gameId, difficulty: 'changed', results: [{ score: 999 }] },
      });
      const stored = select.get(session.recordId);
      assert.equal(stored.game_id, original.game_id);
      assert.equal(stored.payload_json, original.payload_json);
      assert.equal(stored.summary_json, original.summary_json);
      assert.equal(stored.difficulty, original.difficulty);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).ok, undefined);
    } finally { fixture.sqlite.close(); }
  });

  test(`legacy upserts still update a ${owner} record in the same scope`, async () => {
    const fixture = await CreateFixture(signedIn);
    try {
      const { session } = fixture;
      const input = {
        appId: 'rehabtrainerhub', runtimeId: 'hub', subjectId: session.subjectId,
        record: { id: session.recordId, moduleId: session.gameId, results: [{ score: 2 }] },
      };
      assert.equal((await Post(fixture, input)).status, 201);
      input.record.results = [{ score: 9 }];
      const response = await Post(fixture, input);
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { ok: true, recordId: session.recordId });
      const stored = fixture.sqlite.prepare('SELECT payload_json FROM training_records WHERE id = ?').get(session.recordId);
      assert.deepEqual(JSON.parse(stored.payload_json).results, [{ score: 9 }]);
      input.record.gameId = 'unregistered-game';
      assert.equal((await Post(fixture, input)).status, 201);
      input.record.results = [{ score: 10 }];
      assert.equal((await Post(fixture, input)).status, 201);
      const updated = fixture.sqlite.prepare('SELECT game_id, payload_json FROM training_records WHERE id = ?').get(session.recordId);
      assert.equal(updated.game_id, 'unregistered-game');
      assert.deepEqual(JSON.parse(updated.payload_json).results, [{ score: 10 }]);
    } finally { fixture.sqlite.close(); }
  });
}

for (const distinctKeys of [2000, 65]) {
  test(`official results reject ${distinctKeys} distinct round metric keys before writing raw data`, async () => {
    const fixture = await CreateFixture(false);
    try {
      const rounds = Array.from({ length: distinctKeys }, (_, index) => ({ [`metric${index}`]: index }));
      const response = await Post(fixture, OfficialInput(fixture.session, rounds));
      assert.equal(response.status, 400);
      assert.equal(fixture.env.RAW_DATA.objects.size, 0);
      assert.equal(fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM training_records').get().count, 0);
    } finally { fixture.sqlite.close(); }
  });
}

test('official results accept 4000 rounds reusing 64 distinct metric keys', async () => {
  const fixture = await CreateFixture(false);
  try {
    const rounds = Array.from({ length: 4000 }, (_, index) => ({ [`metric${index % 64}`]: index }));
    assert.equal((await Post(fixture, OfficialInput(fixture.session, rounds))).status, 201);
    const files = [...fixture.env.RAW_DATA.objects].filter(([key]) => key.startsWith('pending/'));
    assert.equal(files.length, 1);
    const lines = files[0][1].text.trimEnd().split('\n');
    assert.equal(lines.length, 4001);
    assert.equal(lines[0].split(',').length, 65);
    const stored = JSON.parse(fixture.sqlite.prepare('SELECT payload_json FROM training_records').get().payload_json);
    assert.equal(stored.scoreRoundCount, 4000);
    assert.deepEqual(stored.score.rounds, []);
  } finally { fixture.sqlite.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { CleanTrainingRecord, TransformTrainingRow, TransformGameRunRow, BuildUpdateSql, CleanupD1Records, ParseWranglerJson } from './cleanup-d1-raw-records.mjs';

function TrainingRow(record, summary = record) {
  return { id: 'row-1', updated_at: '2026-10-29', payload_json: JSON.stringify(record), summary_json: summary === null ? null : JSON.stringify(summary) };
}

test('training cleanup shares API summary rules, removes gaze and trials, and preserves counts and raw files', () => {
  const record = { id: 'test-record', score: { summary: { total: 2 }, rounds: [{ score: 1 }, { score: 1 }] },
    scoreRoundCount: 9, rawFiles: [{ kind: 'rounds', key: 'fake.csv', rows: 2 }],
    data: { gaze_samples: [[1, 2]], webgazer_data: [{ x: 2 }],
      results: [{ trial_type: 'summary', accuracy: 1, secretTrial: 2, nested: [3] }] }, trials: [{ trial_index: 1 }] };
  const cleaned = CleanTrainingRecord(record);
  assert.deepEqual(cleaned.score, { summary: { total: 2 }, rounds: [] });
  assert.equal(cleaned.scoreRoundCount, 9);
  assert.deepEqual(cleaned.rawFiles, record.rawFiles);
  assert.deepEqual(cleaned.data, { results: [{ trial_type: 'summary', accuracy: 1 }], gaze_samples_omitted: true, webgazer_data_omitted: true });
  assert.deepEqual(cleaned.trials, []);
  assert.equal(record.score.rounds.length, 2);
  assert.deepEqual(CleanTrainingRecord(cleaned), cleaned);
  assert.equal(TransformTrainingRow(TrainingRow(cleaned)).status, 'unchanged');
  assert.equal(CleanTrainingRecord({ score: { rounds: [1, 2] } }).scoreRoundCount, 2);
  assert.deepEqual(CleanTrainingRecord({ results: [{ trial_index: 1 }, { trial_index: 2 }] }).results, []);
});

test('training transforms both JSON columns, preserves null and formatting, and skips malformed rows atomically', () => {
  const row = TrainingRow({ score: { rounds: [1] } }, { results: [{ trial_index: 0 }] });
  const result = TransformTrainingRow(row);
  assert.equal(result.status, 'changed');
  assert.deepEqual(JSON.parse(result.values.summary_json).results, []);
  assert.equal(TransformTrainingRow(TrainingRow({ score: { rounds: [1] } }, null)).values.summary_json, null);
  assert.equal(TransformTrainingRow({ ...row, summary_json: '{' }).status, 'unparseable');
  assert.equal(TransformTrainingRow({ ...row, payload_json: 'null' }).status, 'unparseable');
  const current = TrainingRow({ score: { summary: { score: 1 }, rounds: [] }, scoreRoundCount: 2,
    rawFiles: [{ kind: 'rounds', rows: 2 }], results: [{ accuracy: 1 }] });
  current.payload_json = JSON.stringify(JSON.parse(current.payload_json), null, 2);
  assert.equal(TransformTrainingRow(current).status, 'unchanged');
});

test('game runs remove only the two current API trial arrays and prefer projection count', () => {
  const row = { id: 'game-1', created_at: 'date', result_json: JSON.stringify({ status: 'completed', details: { total: 1 },
    detailRows: [1, 2], scoreProjection: { summary: { total: 1 }, rounds: [1] } }) };
  const result = TransformGameRunRow(row);
  const value = JSON.parse(result.values.result_json);
  assert.deepEqual(value, { status: 'completed', details: { total: 1 }, detailRows: [], scoreProjection: { summary: { total: 1 }, rounds: [] }, scoreRoundCount: 1 });
  assert.equal(TransformGameRunRow({ ...row, result_json: result.values.result_json }).status, 'unchanged');
  assert.equal(JSON.parse(TransformGameRunRow({ ...row,
    result_json: JSON.stringify({ ...JSON.parse(row.result_json), scoreRoundCount: 99 }) }).values.result_json).scoreRoundCount, 1);
  assert.equal(JSON.parse(TransformGameRunRow({ ...row, result_json: '{"detailRows":[1,2]}' }).values.result_json).scoreRoundCount, 2);
  assert.equal(JSON.parse(TransformGameRunRow({ ...row, result_json: '{"detailRows":[1],"scoreProjection":{"rounds":[]}}' }).values.result_json).scoreRoundCount, 0);
  assert.equal(TransformGameRunRow({ ...row, result_json: '{' }).status, 'unparseable');
});

test('SQL round trips quotes, backslashes and Unicode and rejects concurrent changes', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE training_records (id TEXT PRIMARY KEY, updated_at TEXT, payload_json TEXT, summary_json TEXT); CREATE TABLE game_runs (id TEXT PRIMARY KEY, created_at TEXT, result_json TEXT);');
    const row = { ...TrainingRow({ label: "引號 ' \\ 😀", score: { rounds: [1] } }), id: "測試'\\😀" };
    db.prepare('INSERT INTO training_records VALUES (?,?,?,?)').run(row.id, row.updated_at, row.payload_json, row.summary_json);
    const transformed = TransformTrainingRow(row);
    const sql = BuildUpdateSql('training_records', row, transformed.values);
    db.exec(sql);
    assert.deepEqual({ ...db.prepare('SELECT payload_json,summary_json FROM training_records').get() }, transformed.values);
    db.exec("UPDATE training_records SET updated_at='new', payload_json='concurrent';");
    db.exec(sql);
    assert.equal(db.prepare('SELECT payload_json FROM training_records').get().payload_json, 'concurrent');
    const gameRow = { id: 'fake', created_at: 'date', result_json: '{"label":"😀","detailRows":[1]}' };
    db.prepare('INSERT INTO game_runs VALUES (?,?,?)').run(gameRow.id, gameRow.created_at, gameRow.result_json);
    const gameSql = BuildUpdateSql('game_runs', gameRow, TransformGameRunRow(gameRow).values);
    db.exec(gameSql);
    assert.equal(JSON.parse(db.prepare('SELECT result_json FROM game_runs').get().result_json).scoreRoundCount, 1);
    db.exec("UPDATE game_runs SET result_json='concurrent';");
    db.exec(gameSql);
    assert.equal(db.prepare('SELECT result_json FROM game_runs').get().result_json, 'concurrent');
  } finally { db.close(); }
});

function WranglerFixture() {
  const calls = [];
  const files = [];
  let page = 0;
  const runWrangler = async args => {
    calls.push(args);
    if (args.includes('--file')) {
      const path = args[args.indexOf('--file') + 1];
      files.push({ path, sql: await readFile(path, 'utf8') });
      return [{ success: true, results: [], meta: { changes: 50 } }];
    }
    const sql = args[args.indexOf('--command') + 1];
    if (sql.includes('FROM game_runs')) return [{ success: true, results: [] }];
    page += 1;
    return [{ success: true, results: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ ...TrainingRow({ score: { rounds: [{ responseTime: 150, score: 1 }, { responseTime: 250, score: 1 }] } }), id: `row-${String(i).padStart(3, '0')}` }))
      : page === 2 ? [{ ...TrainingRow({}), id: 'row-101' }, { ...TrainingRow({}), id: 'row-102', payload_json: '{' }] : [] }];
  };
  return { calls, files, runWrangler };
}

test('D1 dry run pages by id in groups of 100, reports only counts and row ids, and never mutates', async () => {
  const fixture = WranglerFixture();
  const logs = [];
  const stats = await CleanupD1Records({ runWrangler: fixture.runWrangler, log: value => logs.push(value) });
  assert.deepEqual(stats.training_records, { scanned: 102, wouldChange: 100, unchanged: 1, unparseable: 1, submitted: 0, bytesSaved: stats.training_records.bytesSaved });
  assert.ok(stats.training_records.bytesSaved > 0);
  assert.ok(fixture.calls.every(args => args.includes('--command') && args.includes('--remote') && args.includes('--json') && !args.includes('--file')));
  assert.match(fixture.calls[1].at(-1), /WHERE id > .*ORDER BY id LIMIT 100/);
  assert.ok(!logs.join('\n').includes('rounds'));
});

test('apply writes bounded SQL batches and deletes temporary files, including on failure', async () => {
  const fixture = WranglerFixture();
  const logs = [];
  const stats = await CleanupD1Records({ apply: true, runWrangler: fixture.runWrangler, log: value => logs.push(value) });
  assert.equal(fixture.files.length, 2);
  assert.equal(stats.training_records.submitted, 100);
  assert.match(logs[0], /d1 time-travel info rehab_db --config apps\/rehabtrainerhub\/wrangler.workers.jsonc/);
  for (const file of fixture.files) {
    assert.equal((file.sql.match(/UPDATE training_records/g) || []).length, 50);
    await assert.rejects(access(file.path));
  }
  let failedPath;
  const failing = WranglerFixture();
  await assert.rejects(CleanupD1Records({ apply: true, log: () => {}, runWrangler: async args => {
    if (!args.includes('--file')) return failing.runWrangler(args);
    failedPath = args[args.indexOf('--file') + 1];
    throw new Error('fake failure');
  } }));
  await assert.rejects(access(failedPath));
});

test('D1 paging rejects repeated cursors and failed Wrangler envelopes', async () => {
  let calls = 0;
  await assert.rejects(CleanupD1Records({ log: () => {}, runWrangler: async () => {
    calls += 1;
    return [{ success: true, results: Array.from({ length: 100 }, () => TrainingRow({})) }];
  } }), /paging/i);
  assert.ok(calls <= 2);
  await assert.rejects(CleanupD1Records({ log: () => {}, runWrangler: async () => [{ success: false, errors: [{ message: 'fake private data' }] }] }), /Wrangler/);
});

test('file imports use the real Wrangler envelope and report submitted statements without claiming affected rows', async () => {
  const fixture = WranglerFixture();
  const stats = await CleanupD1Records({ apply: true, log: () => {}, runWrangler: async args => {
    if (!args.includes('--file')) return fixture.runWrangler(args);
    return [{ success: true, results: [{ 'Total queries executed': 50, 'Rows written': 47 }], meta: { rows_written: 47 }, finalBookmark: 'fake-bookmark' }];
  } });
  assert.equal(stats.training_records.submitted, 100);
  assert.equal(stats.training_records.applied, undefined);
});

test('wrangler file execution prints upload progress before the JSON, which is still read', () => {
  const json = [{ results: [{ 'Total queries executed': 1 }], success: true }];
  const progress = ['├ Checking if file needs uploading', '│', '├ 🌀 Uploading x.sql', '│ 🌀 Uploading complete.', '│'];
  const stdout = [...progress, JSON.stringify(json, null, 2), ''].join('\n');
  assert.deepEqual(ParseWranglerJson(stdout), json);
  assert.deepEqual(ParseWranglerJson(JSON.stringify(json)), json);
  assert.throws(() => ParseWranglerJson(['├ Uploading', 'not json'].join('\n')), /invalid JSON/);
});

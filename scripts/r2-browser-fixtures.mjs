import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { onRequestPost as createSession } from '../apps/rehabtrainerhub/functions/api/official-game-sessions.js';
import { onRequestPost as saveRecord } from '../apps/rehabtrainerhub/functions/api/records.js';
import { onRequestPost as saveCsv } from '../apps/rehabtrainerhub/functions/api/oculomotor-data.js';
import { onRequestPost as uploadRaw } from '../apps/rehabtrainerhub/functions/api/raw-data.js';
import { RawDataKey } from '../apps/rehabtrainerhub/functions/_lib/rawData.js';

export const browserApiHandlers = {
  '/api/official-game-sessions': createSession,
  '/api/records': saveRecord,
  '/api/oculomotor-data': saveCsv,
  '/api/raw-data': uploadRaw,
};

export function CreateBrowserDatabase(sqlite) {
  return { prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    const result = { bind: (...bindings) => { values = bindings; return result; },
      first: async () => statement.get(...values) ?? null, all: async () => ({ results: statement.all(...values) }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }) };
    return result;
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  } };
}

export async function ReadSavedGameRecord(row, bucket, version) {
  const record = JSON.parse(row.payload_json);
  assert.deepEqual(record.score.rounds, [], 'D1 stores summary-only rounds.');
  assert.ok(Number.isSafeInteger(record.scoreRoundCount) && record.scoreRoundCount >= 0, 'Invalid round count.');
  assert.ok(Array.isArray(record.rawFiles), 'D1 must reference its private CSV files.');
  const roundFiles = record.rawFiles.filter(file => file.kind === 'rounds');
  assert.equal(roundFiles.length, record.scoreRoundCount > 0 ? 1 : 0, 'Round count needs exactly one matching CSV.');
  let rounds = [];
  for (const file of record.rawFiles) {
    assert.equal(file.key, RawDataKey(file.kind, record.gameId, row.subject_id, record.trainingDate, record.id), 'CSV scope mismatch.');
    const object = await bucket.get(file.key);
    assert.ok(object, `Missing private CSV: ${file.key}`);
    const metadata = object.customMetadata;
    assert.equal(metadata?.version, version, 'CSV release version mismatch.');
    for (const [key, value] of Object.entries({ kind: file.kind, gameId: record.gameId, recordId: record.id,
      subjectId: row.subject_id, recordedDate: record.trainingDate, rows: String(file.rows), sha256: file.sha256 })) {
      assert.equal(metadata[key], value, `CSV ${key} mismatch.`);
    }
    const csv = await object.text();
    assert.equal(createHash('sha256').update(csv).digest('hex'), file.sha256, 'CSV SHA-256 mismatch.');
    assert.ok(csv.endsWith('\n'), 'CSV must end with a newline.');
    const [header, ...lines] = csv.slice(0, -1).split('\n');
    assert.equal(lines.length, file.rows, 'CSV row count mismatch.');
    if (file.kind !== 'rounds') continue;
    assert.equal(file.rows, record.scoreRoundCount, 'Saved round count mismatch.');
    const columns = header.split(',');
    assert.equal(columns[0], 'round_index');
    assert.equal(new Set(columns).size, columns.length, 'Round CSV columns must be unique.');
    rounds = lines.map((line, index) => {
      const values = line.split(',');
      assert.equal(values.length, columns.length, 'Round CSV column count mismatch.');
      assert.equal(values[0], String(index + 1), 'Round CSV index mismatch.');
      return Object.fromEntries(columns.slice(1).map((key, column) => {
        const text = values[column + 1];
        const value = text === '' ? null : Number(text);
        assert.ok(value === null || Number.isFinite(value), `Invalid round metric: ${key}`);
        return [key, value];
      }));
    });
  }
  return { ...record, score: { ...record.score, rounds } };
}

export async function VerifyRemotePreview(manifest, catalog, runnerOrigin, request = fetch) {
  const file = manifest.files.find(file => file.path === catalog.preview);
  assert.ok(file, 'The preview must belong to the candidate manifest.');
  const url = `${runnerOrigin}/games/${manifest.gameId}/${manifest.version}/package/${file.path}`;
  const response = await request(url, { signal: AbortSignal.timeout(20000) });
  const label = `${manifest.gameId}@${manifest.version} remote preview`;
  assert.ok(response.ok, `${label}: HTTP ${response.status}. The local candidate must already be published before --remote; use --lobby for local validation.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length, file.size, `${label}: preview size differs from the local candidate.`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256,
    `${label}: preview SHA-256 differs from the local candidate. Validate the matching immutable release.`);
}

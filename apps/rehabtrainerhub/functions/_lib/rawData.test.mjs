import assert from 'node:assert/strict';
import test from 'node:test';
import { BuildRoundsCsv, OfficialRecordedDate, StoreImmutableCsv } from './rawData.js';
import { CreateMemoryBucket } from './rawDataTestFixtures.mjs';

test('CSV keys retain their checksum after sync removes the raw object', async () => {
  const bucket = CreateMemoryBucket();
  const key = 'pending/head/game/subject/2026-10-29/record.csv';
  const sha256 = await StoreImmutableCsv(bucket, key, 't_ms,x\n0,1\n', {});
  bucket.objects.delete(key);
  assert.equal(await StoreImmutableCsv(bucket, key, 't_ms,x\n0,2\n', {}), null);
  assert.equal(bucket.objects.has(key), false);
  assert.equal(await StoreImmutableCsv(bucket, key, 't_ms,x\n0,1\n', {}), sha256);
});

test('an R2-first interruption retries only the original bytes and concurrent mutations cannot replace them', async () => {
  const bucket = CreateMemoryBucket();
  const key = 'pending/rounds/game/subject/2026-10-29/record.csv';
  const put = bucket.put.bind(bucket);
  bucket.put = async (path, text, options) => { if (path === key) throw new Error('offline'); return put(path, text, options); };
  await assert.rejects(() => StoreImmutableCsv(bucket, key, 'a', {}));
  bucket.put = put;
  assert.equal(await StoreImmutableCsv(bucket, key, 'b', {}), null);
  assert.match(await StoreImmutableCsv(bucket, key, 'a', {}), /^[0-9a-f]{64}$/);
});

test('round metrics use decimal numbers and a fixed Asia/Taipei session date', () => {
  assert.equal(BuildRoundsCsv([{ score: -1e-7, tiny: 5e-324 }, { score: 1e12, tiny: null }]),
    'round_index,score,tiny\n1,-0.0000001,0.' + '0'.repeat(323) + '5\n2,1000000000000,\n');
  assert.equal(OfficialRecordedDate({ iat: Date.parse('2026-10-29T16:00:00Z') / 1000 }), '2026-10-30');
});

test('missing own metrics remain empty even when a metric name is inherited from Object', () => {
  assert.equal(BuildRoundsCsv([{ constructor: 1, toString: 2, valueOf: 3 }, { score: 4 }]),
    'round_index,constructor,toString,valueOf,score\n1,1,2,3,\n2,,,,4\n');
});

test('matching bytes do not bypass the existing official eye version and sample-count checks', async () => {
  const bucket = CreateMemoryBucket();
  await StoreImmutableCsv(bucket, 'guests/subject/record.csv', 'csv', { officialGameVersion: '2.0.0', gazeSampleCount: '1' });
  assert.equal(await StoreImmutableCsv(bucket, 'guests/subject/record.csv', 'csv', { officialGameVersion: '2.0.1', gazeSampleCount: '1' }), null);
});

test('same-byte legacy eye retries keep the first recorded date after archival', async () => {
  const bucket = CreateMemoryBucket();
  const key = 'users/account/record.csv';
  await StoreImmutableCsv(bucket, key, 'csv', { subjectId: 'subject', recordedDate: '2026-10-28' });
  bucket.objects.delete(key);
  await StoreImmutableCsv(bucket, key, 'csv', { subjectId: 'subject', recordedDate: '2026-10-29' });
  assert.equal(bucket.objects.get(key).customMetadata.recordedDate, '2026-10-28');
});

test('the session date follows the configured Hub time zone', () => {
  assert.equal(OfficialRecordedDate({ iat: Date.parse('2026-10-29T16:00:00Z') / 1000 }, 'UTC'), '2026-10-29');
});

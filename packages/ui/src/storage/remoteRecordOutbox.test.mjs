import assert from 'node:assert/strict';
import test from 'node:test';

test('outbox records expire after 30 days but remain fresh before the deadline', async () => {
  const { IsPendingRemoteTrainingRecordFresh, remoteTrainingRecordOutboxRetentionMs } =
    await import(`./remoteRecordOutbox.ts?test=${crypto.randomUUID()}`);
  const now = Date.parse('2026-09-22T00:00:00.000Z');
  const fresh = new Date(now - remoteTrainingRecordOutboxRetentionMs + 1).toISOString();
  const expired = new Date(now - remoteTrainingRecordOutboxRetentionMs - 1).toISOString();

  assert.equal(IsPendingRemoteTrainingRecordFresh(fresh, now), true);
  assert.equal(IsPendingRemoteTrainingRecordFresh(expired, now), false);
  assert.equal(IsPendingRemoteTrainingRecordFresh('not-a-date', now), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IsSafeQuarantineObjectKey,
  IsSafeQuarantinePrefix,
  ReconcileOrphanQuarantineObjects,
  ReconcileGamePlatformStorage,
} from './gamePlatformMaintenance.js';

test('reconciles only expired unpublished quarantine prefixes and delivered notices', async () => {
  const deleted = [];
  const batches = [];
  const db = CreateDb({
    candidates: [{ id: 'submission-old', release_id: 'release-old' }],
    keys: [{ quarantine_key: 'quarantine/owner-1/release-old/' + 'a'.repeat(64) + '/files/index.html' }],
    notificationChanges: 2,
    batches,
  });
  const result = await ReconcileGamePlatformStorage({
    db,
    quarantineBucket: {
      async delete(keys) {
        deleted.push(keys);
      },
    },
    now: new Date('2026-08-29T00:00:00.000Z'),
    retentionDays: 90,
    notificationRetentionDays: 365,
    maxSubmissions: 10,
  });

  assert.equal(result.candidates, 1);
  assert.equal(result.deletedSubmissions, 1);
  assert.equal(result.deletedObjects, 2);
  assert.equal(result.deletedNotifications, 2);
  assert.deepEqual(deleted[0], [
    'quarantine/owner-1/release-old/' + 'a'.repeat(64) + '/files/index.html',
    'quarantine/owner-1/release-old/' + 'a'.repeat(64) + '/artifact',
  ]);
  assert.equal(batches.length, 1);
});

test('rejects unsafe quarantine prefixes before any destructive operation', async () => {
  assert.equal(IsSafeQuarantinePrefix('quarantine/owner/release/' + 'b'.repeat(64) + '/'), true);
  assert.equal(IsSafeQuarantinePrefix('quarantine/owner/release/../artifact/'), false);
  const deleted = [];
  const result = await ReconcileGamePlatformStorage({
    db: CreateDb({
      candidates: [{ id: 'submission-unsafe', release_id: null }],
      keys: [{ quarantine_key: 'quarantine/owner/release/../files/index.html' }],
      notificationChanges: 0,
    }),
    quarantineBucket: { async delete(keys) { deleted.push(keys); } },
    now: '2026-08-29T00:00:00.000Z',
  });
  assert.equal(result.deletedSubmissions, 0);
  assert.equal(result.skippedSubmissions, 1);
  assert.equal(deleted.length, 0);
});

test('reconciles only old orphan objects and preserves inventory/protected scopes', async () => {
  const hash = 'c'.repeat(64);
  const orphanKey = `quarantine/orphan/release/${hash}/files/game.js`;
  const inventoryKey = `quarantine/owner/release/${hash}/files/index.html`;
  const protectedHash = 'd'.repeat(64);
  const protectedKey = `quarantine/owner/protected/${protectedHash}/artifact`;
  const deleted = [];
  const result = await ReconcileOrphanQuarantineObjects({
    db: {
      prepare(sql) {
        const all = async () => {
          if (/SELECT quarantine_key AS key/i.test(sql)) return { results: [{ key: inventoryKey }] };
          if (/INNER JOIN game_releases AS release/i.test(sql)) {
            return {
              results: [{
                owner_user_id: 'owner',
                release_id: 'protected',
                artifact_sha256: protectedHash,
              }],
            };
          }
          return { results: [] };
        };
        return {
          all,
          bind() {
            return {
              all,
            };
          },
        };
      },
    },
    quarantineBucket: {
      async list() {
        return {
          objects: [
            { key: orphanKey, uploaded: '2025-01-01T00:00:00.000Z' },
            { key: inventoryKey, uploaded: '2025-01-01T00:00:00.000Z' },
            { key: protectedKey, uploaded: '2025-01-01T00:00:00.000Z' },
            { key: 'quarantine/unsafe/../artifact', uploaded: '2025-01-01T00:00:00.000Z' },
          ],
          truncated: false,
        };
      },
      async delete(keys) { deleted.push(keys); },
    },
    now: '2026-08-29T00:00:00.000Z',
    cutoff: '2026-01-01T00:00:00.000Z',
    maxObjects: 20,
  });
  assert.equal(result.orphanCandidates, 1);
  assert.equal(result.deletedOrphanObjects, 1);
  assert.deepEqual(deleted, [[orphanKey]]);
  assert.equal(IsSafeQuarantineObjectKey(orphanKey), true);
  assert.equal(IsSafeQuarantineObjectKey('quarantine/orphan/release/' + hash + '/files/../secret'), false);
});

test('fails closed when a protected row cannot be mapped to a quarantine prefix', async () => {
  const listCalls = [];
  const deleted = [];
  const result = await ReconcileOrphanQuarantineObjects({
    db: {
      prepare(sql) {
        const all = async () => {
          if (/SELECT quarantine_key AS key/i.test(sql)) return { results: [] };
          if (/INNER JOIN game_releases AS release/i.test(sql)) {
            return {
              // A released/active row with a missing digest must never make
              // the orphan reconciler guess which prefix is safe to delete.
              results: [{ owner_user_id: 'owner', release_id: 'release', artifact_sha256: null }],
            };
          }
          return { results: [] };
        };
        return { all };
      },
    },
    quarantineBucket: {
      async list() {
        listCalls.push(true);
        return {
          objects: [{
            key: `quarantine/orphan/release/${'e'.repeat(64)}/files/game.js`,
            uploaded: '2025-01-01T00:00:00.000Z',
          }],
          truncated: false,
        };
      },
      async delete(keys) { deleted.push(keys); },
    },
    now: '2026-08-29T00:00:00.000Z',
    cutoff: '2026-01-01T00:00:00.000Z',
  });

  assert.deepEqual(result, {
    orphanCandidates: 0,
    deletedOrphanObjects: 0,
    skippedOrphanObjects: 0,
    orphanListingTruncated: false,
  });
  assert.equal(listCalls.length, 0);
  assert.deepEqual(deleted, []);
});

function CreateDb({ candidates, keys, notificationChanges, batches = [] }) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async all() {
              if (/FROM game_submissions AS submission/i.test(sql)) return { results: candidates };
              if (/SELECT quarantine_key/i.test(sql)) return { results: keys };
              return { results: [] };
            },
            async run() {
              if (/DELETE FROM game_platform_notifications/i.test(sql)) {
                return { meta: { changes: notificationChanges } };
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

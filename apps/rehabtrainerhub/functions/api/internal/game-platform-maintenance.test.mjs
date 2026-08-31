import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost } from './game-platform-maintenance.js';

const token = 'maintenance-secret-value-0123456789';

test('maintenance endpoint requires a deployment token and runs bounded cleanup', async () => {
  const unauthorized = await onRequestPost({
    request: new Request('https://trainerhub.cc/api/internal/game-platform-maintenance', { method: 'POST' }),
    env: { GAME_MAINTENANCE_TOKEN: token },
  });
  assert.equal(unauthorized.status, 401);

  const deleted = [];
  const response = await onRequestPost({
    request: new Request('https://trainerhub.cc/api/internal/game-platform-maintenance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env: {
      GAME_MAINTENANCE_TOKEN: token,
      GAME_QUARANTINE_RETENTION_DAYS: '90',
      GAME_NOTIFICATION_RETENTION_DAYS: '365',
      GAME_MAINTENANCE_BATCH_SIZE: '10',
      GAME_QUARANTINE_BUCKET: { async delete(keys) { deleted.push(keys); } },
      REHAB_DB: CreateDb(),
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(deleted.length, 1);
});

function CreateDb() {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async all() {
              if (/FROM game_submissions AS submission/i.test(sql)) {
                return { results: [{ id: 'submission-old', release_id: null }] };
              }
              if (/SELECT quarantine_key/i.test(sql)) {
                return { results: [{ quarantine_key: 'quarantine/owner/release/' + 'a'.repeat(64) + '/files/index.html' }] };
              }
              return { results: [] };
            },
            async run() {
              return { meta: { changes: /game_platform_notifications/i.test(sql) ? 0 : 1 } };
            },
          };
        },
      };
    },
    async batch(statements) {
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

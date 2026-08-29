import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../../../../_lib/auth.js';
import { onRequestGet as diffRelease } from './diff.js';

const secret = '0123456789abcdef0123456789abcdef';
const admin = { id: 'diff-admin', display_name: 'Admin', email: null, role: 'admin' };
const adminToken = await CreateSignedValue({ sub: admin.id }, secret, 60);

test('release diff requires an administrator and returns data-only text changes', async () => {
  const response = await diffRelease({
    request: new Request('https://trainerhub.cc/api/admin/game-releases/release-1/diff', {
      headers: {
        Origin: 'https://trainerhub.cc',
        Cookie: `${authCookieName}=${encodeURIComponent(adminToken)}`,
      },
    }),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb(),
      GAME_QUARANTINE_BUCKET: {
        async get(key) {
          const values = {
            'quarantine/user/release/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/files/index.html': '<main>old</main>',
            'quarantine/user/release/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/files/index.html': '<main>new</main>',
          };
          const text = values[key];
          return text === undefined ? null : {
            size: new TextEncoder().encode(text).byteLength,
            async arrayBuffer() { return new TextEncoder().encode(text).buffer; },
          };
        },
      },
    },
    params: { id: 'release-1' },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.currentAttempt, 2);
  assert.equal(payload.previousAttempt, 1);
  assert.deepEqual(payload.changes[0], {
    path: 'index.html',
    status: 'changed',
    before: { byteSize: 16, contentType: 'text/html; charset=utf-8', sha256: 'a'.repeat(64) },
    after: { byteSize: 16, contentType: 'text/html; charset=utf-8', sha256: 'b'.repeat(64) },
    beforeText: '<main>old</main>',
    afterText: '<main>new</main>',
  });
});

function CreateDb() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return admin;
              if (/FROM game_releases AS release/i.test(sql)) {
                return {
                  id: 'release-1',
                  game_id: 'game-1',
                  submission_id: 'submission-2',
                  attempt: 2,
                  target_version: '1.0.0',
                };
              }
              if (/FROM game_submissions/i.test(sql)) {
                return { id: 'submission-1', attempt: 1 };
              }
              return null;
            },
            async all() {
              if (/FROM game_submission_files/i.test(sql)) {
                const submissionId = args[0];
                const hash = submissionId === 'submission-1' ? 'a'.repeat(64) : 'b'.repeat(64);
                const digest = submissionId === 'submission-1' ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
                return {
                  results: [{
                    path: 'index.html',
                    content_type: 'text/html; charset=utf-8',
                    byte_size: 16,
                    sha256: hash,
                    quarantine_key: `quarantine/user/release/${digest}/files/index.html`,
                  }],
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

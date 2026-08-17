import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../_lib/auth.js';
import { onRequestGet as listReleases } from './admin/game-releases.js';
import { onRequestPut as reviewRelease } from './admin/game-releases/[id].js';
import { onRequestGet as downloadArtifact } from './admin/game-releases/[id]/artifact.js';
import { onRequestPost as saveGameRun } from './game-runs.js';
import { onRequestGet as listGames } from './games.js';

const secret = '0123456789abcdef0123456789abcdef';
const users = new Map([
  ['patient-1', { id: 'patient-1', display_name: 'Patient', email: null, role: 'patient' }],
  ['therapist-1', { id: 'therapist-1', display_name: 'Staff', email: null, role: 'therapist' }],
  ['admin-1', { id: 'admin-1', display_name: 'Admin', email: null, role: 'admin' }],
]);
const env = {
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: CreateSecurityDb(),
};
const tokens = Object.fromEntries(await Promise.all(
  [...users.keys()].map(async (id) => [id, await CreateSignedValue({ sub: id }, secret, 60)]),
));

test('game review endpoints require an administrator', async () => {
  const therapistList = await listReleases({
    request: AuthorizedRequest('https://trainerhub.cc/api/admin/game-releases', tokens['therapist-1']),
    env,
  });
  assert.equal(therapistList.status, 403);

  const artifact = await downloadArtifact({
    request: AuthorizedRequest('https://trainerhub.cc/api/admin/game-releases/release-1/artifact', tokens['therapist-1']),
    env,
    params: { id: 'release-1' },
  });
  assert.equal(artifact.status, 403);
});

test('approval requires source, public metadata, and isolated play-test evidence', async () => {
  const response = await reviewRelease({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/admin/game-releases/release-1',
      tokens['admin-1'],
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approve',
          note: '',
          sourceReviewed: true,
          playTested: true,
          metadataReviewed: false,
        }),
      },
    ),
    env,
    params: { id: 'release-1' },
  });
  assert.equal(response.status, 400);
});

test('game results reject identifying metric keys before persistence', async () => {
  const response = await saveGameRun({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/game-runs',
      tokens['patient-1'],
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: 'release_12345678',
          clientRunId: 'client_run_12345678',
          runSessionToken: 'a'.repeat(64),
          result: { status: 'completed', metrics: { userName: 1 } },
        }),
      },
    ),
    env,
  });
  assert.equal(response.status, 400);
});

test('catalog refuses a runner under trainerhub.cc', async () => {
  const response = await listGames({
    request: new Request('https://trainerhub.cc/api/games', {
      headers: { Origin: 'https://trainerhub.cc' },
    }),
    env: { ...env, GAME_RUNNER_ORIGIN: 'https://games.trainerhub.cc' },
  });
  assert.equal(response.status, 503);
});

test('submission metadata remains release-scoped until an administrator publishes it', async () => {
  const [submissionSource, reviewSource, migrationSource] = await Promise.all([
    readFile(new URL('./developer/games.js', import.meta.url), 'utf8'),
    readFile(new URL('./admin/game-releases/[id].js', import.meta.url), 'utf8'),
    readFile(new URL('../../migrations/0007_game_platform.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(migrationSource, /submitted_developer_name TEXT NOT NULL/);
  assert.match(migrationSource, /submitted_title TEXT NOT NULL/);
  assert.match(migrationSource, /publication_lease_id TEXT/);
  assert.match(submissionSource, /submitted_developer_name, submitted_title, submitted_summary, submitted_category/);
  assert.doesNotMatch(
    submissionSource,
    /UPDATE developer_games\s+SET[\s\S]{0,240}developer_display_name/i,
  );
  assert.match(
    reviewSource,
    /UPDATE developer_games\s+SET developer_display_name = \?, title = \?, summary = \?, category = \?/i,
  );
  assert.match(
    reviewSource,
    /WHERE id = \? AND status = 'publishing' AND publication_lease_id = \?/i,
  );
});

test('approval fences the public release pointer with conditional R2 writes', async () => {
  const fileBytes = new TextEncoder().encode('<!doctype html><title>Reviewed</title>');
  const fileSha256 = await Sha256Hex(fileBytes);
  const approvalDb = CreateApprovalDb({ fileBytes, fileSha256 });
  const fileWrites = [];
  const manifestWrites = [];
  const approvalEnv = {
    AUTH_SESSION_SECRET: secret,
    GAME_QUARANTINE_BUCKET: {
      async get() {
        return { async arrayBuffer() { return fileBytes.slice().buffer; } };
      },
    },
    GAME_RELEASE_BUCKET: {
      async get() {
        return null;
      },
      async put(key, body, options = {}) {
        if (!key.endsWith('/release.json')) {
          fileWrites.push({ key, options });
          return { etag: 'file-etag' };
        }
        manifestWrites.push({ key, manifest: JSON.parse(body), options });
        return { etag: manifestWrites.length === 1 ? 'staging-etag' : 'approved-etag' };
      },
    },
    REHAB_DB: approvalDb,
  };
  const response = await reviewRelease({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/admin/game-releases/release-1',
      tokens['admin-1'],
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approve',
          note: 'Reviewed in the isolated profile.',
          sourceReviewed: true,
          playTested: true,
          metadataReviewed: true,
        }),
      },
    ),
    env: approvalEnv,
    params: { id: 'release-1' },
  });

  assert.equal(response.status, 200);
  assert.equal(fileWrites.length, 1);
  assert.deepEqual(fileWrites[0].options.onlyIf, { etagDoesNotMatch: '*' });
  assert.equal(manifestWrites.length, 2);
  assert.deepEqual(manifestWrites[0].options.onlyIf, { etagDoesNotMatch: '*' });
  assert.equal(manifestWrites[0].manifest.status, 'staging');
  assert.deepEqual(manifestWrites[1].options.onlyIf, { etagMatches: 'staging-etag' });
  assert.equal(manifestWrites[1].manifest.status, 'approved');
  const publicMetadataUpdate = approvalDb.lastBatch.find((statement) => (
    /UPDATE developer_games\s+SET developer_display_name/i.test(statement.sql)
  ));
  assert.deepEqual(publicMetadataUpdate.args.slice(0, 4), [
    'Reviewed Studio',
    'Reviewed Game',
    'A reviewed summary.',
    'attention',
  ]);
});

test('a stale publisher cannot overwrite a release pointer changed by revoke or retry', async () => {
  const fileBytes = new TextEncoder().encode('<!doctype html><title>Reviewed</title>');
  const fileSha256 = await Sha256Hex(fileBytes);
  const approvalDb = CreateApprovalDb({ fileBytes, fileSha256 });
  let manifestWriteCount = 0;
  const response = await reviewRelease({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/admin/game-releases/release-1',
      tokens['admin-1'],
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approve',
          note: 'Reviewed in the isolated profile.',
          sourceReviewed: true,
          playTested: true,
          metadataReviewed: true,
        }),
      },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      GAME_QUARANTINE_BUCKET: {
        async get() {
          return { async arrayBuffer() { return fileBytes.slice().buffer; } };
        },
      },
      GAME_RELEASE_BUCKET: {
        async get() {
          return null;
        },
        async put(key) {
          if (!key.endsWith('/release.json')) return { etag: 'file-etag' };
          manifestWriteCount += 1;
          return manifestWriteCount === 1 ? { etag: 'staging-etag' } : null;
        },
      },
      REHAB_DB: approvalDb,
    },
    params: { id: 'release-1' },
  });

  assert.equal(response.status, 409);
  assert.equal(manifestWriteCount, 2);
  assert.equal(approvalDb.lastBatch.length, 0);
});

test('an expired publication lease cannot claim another reviewer\'s database approval', async () => {
  const fileBytes = new TextEncoder().encode('<!doctype html><title>Reviewed</title>');
  const fileSha256 = await Sha256Hex(fileBytes);
  const approvalDb = CreateApprovalDb({
    batchChanges: [0, 0, 0],
    fileBytes,
    fileSha256,
  });
  const approvedManifest = JSON.stringify({
    schemaVersion: 1,
    status: 'approved',
    gameId: 'reviewed-game',
    version: '1.0.0',
    contentSha256: 'b'.repeat(64),
  });
  const response = await reviewRelease({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/admin/game-releases/release-1',
      tokens['admin-1'],
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approve',
          note: 'Reviewed in the isolated profile.',
          sourceReviewed: true,
          playTested: true,
          metadataReviewed: true,
        }),
      },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      GAME_QUARANTINE_BUCKET: {
        async get() {
          return { async arrayBuffer() { return fileBytes.slice().buffer; } };
        },
      },
      GAME_RELEASE_BUCKET: {
        async get(key) {
          if (!key.endsWith('/release.json')) return null;
          return {
            etag: 'approved-etag',
            size: new TextEncoder().encode(approvedManifest).byteLength,
            async text() { return approvedManifest; },
          };
        },
        async put() {
          return { etag: 'file-etag' };
        },
      },
      REHAB_DB: approvalDb,
    },
    params: { id: 'release-1' },
  });

  assert.equal(response.status, 409);
  assert.deepEqual(approvalDb.lastBatch.map((statement) => statement.args.at(-1)).slice(0, 3), [
    approvalDb.lastBatch[0].args.at(-1),
    approvalDb.lastBatch[0].args.at(-1),
    approvalDb.lastBatch[0].args.at(-1),
  ]);
});

test('revocation disables the runner manifest before clearing the catalog release', async () => {
  let revokedManifest;
  const revokeEnv = {
    AUTH_SESSION_SECRET: secret,
    GAME_RELEASE_BUCKET: {
      async get() {
        const manifest = JSON.stringify({
          schemaVersion: 1,
          status: 'approved',
          gameId: 'sample-game',
          version: '1.0.0',
          contentSha256: 'a'.repeat(64),
        });
        return {
          etag: 'approved-etag',
          size: new TextEncoder().encode(manifest).byteLength,
          async text() { return manifest; },
        };
      },
      async put(key, body, options) {
        revokedManifest = { key, body: JSON.parse(body) };
        assert.deepEqual(options.onlyIf, { etagMatches: 'approved-etag' });
        return { etag: 'revoked-etag' };
      },
    },
    REHAB_DB: CreateRevocationDb(),
  };
  const response = await reviewRelease({
    request: AuthorizedRequest(
      'https://trainerhub.cc/api/admin/game-releases/release-1',
      tokens['admin-1'],
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'revoke',
          note: 'Security review found an unsafe navigation path.',
          sourceReviewed: false,
          playTested: false,
          metadataReviewed: false,
        }),
      },
    ),
    env: revokeEnv,
    params: { id: 'release-1' },
  });
  assert.equal(response.status, 200);
  assert.equal(revokedManifest.key, 'releases/sample-game/1.0.0/release.json');
  assert.equal(revokedManifest.body.status, 'revoked');
});

function AuthorizedRequest(url, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Origin', 'https://trainerhub.cc');
  headers.set('Cookie', `${authCookieName}=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

function CreateApprovalDb({ batchChanges = [1, 1, 1], fileBytes, fileSha256 }) {
  const release = {
    id: 'release-1',
    game_id: 'game-1',
    version: '1.0.0',
    status: 'pending_review',
    slug: 'reviewed-game',
    submitted_developer_name: 'Reviewed Studio',
    submitted_title: 'Reviewed Game',
    submitted_summary: 'A reviewed summary.',
    submitted_category: 'attention',
    title: 'Reviewed Game',
    summary: 'A reviewed summary.',
    category: 'attention',
    content_sha256: 'b'.repeat(64),
    file_count: 1,
    entry_path: 'index.html',
    capabilities_json: '[]',
  };
  const db = {
    lastBatch: [],
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql,
            args,
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return users.get(args[0]) ?? null;
              if (/FROM game_releases\s+INNER JOIN developer_games/i.test(sql)) return release;
              return null;
            },
            async all() {
              if (/FROM game_release_files/i.test(sql)) {
                return {
                  results: [{
                    path: 'index.html',
                    content_type: 'text/html; charset=utf-8',
                    byte_size: fileBytes.byteLength,
                    sha256: fileSha256,
                    quarantine_key: 'quarantine/release-1/files/index.html',
                  }],
                };
              }
              return { results: [] };
            },
            async run() {
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
    async batch(statements) {
      db.lastBatch = statements;
      return statements.map((_, index) => ({
        success: true,
        meta: { changes: batchChanges[index] ?? 1 },
      }));
    },
  };
  return db;
}

function CreateSecurityDb() {
  return {
    prepare(sql) {
      return {
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        bind(...args) {
          return {
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return users.get(args[0]) ?? null;
              if (/RETURNING count, reset_at/i.test(sql)) {
                return { count: 1, reset_at: Math.floor(Date.now() / 1000) + 3600 };
              }
              return null;
            },
            async run() {
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function CreateRevocationDb() {
  const db = CreateSecurityDb();
  return {
    ...db,
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        ...statement,
        bind(...args) {
          const bound = statement.bind(...args);
          return {
            ...bound,
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return users.get(args[0]) ?? null;
              if (/FROM game_releases\s+INNER JOIN developer_games/i.test(sql)) {
                return {
                  id: 'release-1',
                  game_id: 'game-1',
                  version: '1.0.0',
                  status: 'approved',
                  slug: 'sample-game',
                  title: 'Sample Game',
                  summary: '',
                  category: 'general',
                  content_sha256: 'a'.repeat(64),
                };
              }
              return bound.first?.() ?? null;
            },
          };
        },
      };
    },
    async batch() {
      return [
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
        { success: true, meta: { changes: 1 } },
      ];
    },
  };
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

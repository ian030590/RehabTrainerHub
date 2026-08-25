import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../_lib/auth.js';
import { HashGameRunSessionToken } from '../_lib/gameRuns.js';
import { onRequestPost as createGameRunSession } from './game-run-sessions.js';
import { onRequestPost as saveGameRun } from './game-runs.js';

const secret = '0123456789abcdef0123456789abcdef';
const user = {
  id: 'patient-1',
  display_name: 'Patient',
  email: null,
  avatar_url: null,
  role: 'patient',
};
const secondUser = {
  ...user,
  id: 'patient-2',
  display_name: 'Second Patient',
};
const users = new Map([
  [user.id, user],
  [secondUser.id, secondUser],
]);
const token = await CreateSignedValue({ sub: user.id }, secret, 60);
const secondUserToken = await CreateSignedValue({ sub: secondUser.id }, secret, 60);
const releaseId = 'release_12345678';
const secondReleaseId = 'release_87654321';
const clientRunId = 'client_run_12345678';

test('issues an opaque session only for the current active release and stores only its hash', async () => {
  const db = CreateGameRunDb();
  const env = { AUTH_SESSION_SECRET: secret, REHAB_DB: db };
  const oldReleaseResponse = await createGameRunSession({
    request: AuthorizedJsonRequest('/api/game-run-sessions', {
      releaseId: secondReleaseId,
      clientRunId,
    }),
    env,
  });
  assert.equal(oldReleaseResponse.status, 404);

  const response = await IssueSession(env);
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.match(payload.runSession.token, /^[a-f0-9]{64}$/);
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0].userId, user.id);
  assert.equal(db.sessions[0].releaseId, releaseId);
  assert.equal(db.sessions[0].clientRunId, clientRunId);
  assert.equal(db.sessions[0].tokenSha256, await HashGameRunSessionToken(payload.runSession.token));
  assert.notEqual(db.sessions[0].tokenSha256, payload.runSession.token);
  assert.ok(db.sessions[0].expiresAt > Math.floor(Date.now() / 1000));
});

test('atomically consumes one session and makes a network retry idempotent', async () => {
  const db = CreateGameRunDb();
  const env = { AUTH_SESSION_SECRET: secret, REHAB_DB: db };
  const sessionResponse = await IssueSession(env);
  const { runSession } = await sessionResponse.json();
  const input = {
    releaseId,
    clientRunId,
    runSessionToken: runSession.token,
    result: {
      status: 'completed',
      score: 7,
      durationMs: 1200,
      trialCount: 10,
      metrics: { accuracy: 0.7 },
    },
  };

  const firstResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', input),
    env,
  });
  assert.equal(firstResponse.status, 201);
  assert.equal((await firstResponse.json()).run.resultSource, 'client_reported');
  assert.equal(db.runs.length, 1);
  assert.equal(db.runs[0].resultSource, 'sandbox_client_reported');
  assert.equal(db.runs[0].runSessionId, db.sessions[0].id);

  const retryResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', input),
    env,
  });
  assert.equal(retryResponse.status, 200);
  assert.equal((await retryResponse.json()).run.duplicate, true);
  assert.equal(db.runs.length, 1);
});

test('rejects forged, expired, mismatched, and no-longer-active run sessions', async () => {
  const db = CreateGameRunDb();
  const env = { AUTH_SESSION_SECRET: secret, REHAB_DB: db };
  const sessionResponse = await IssueSession(env);
  const { runSession } = await sessionResponse.json();
  const validInput = {
    releaseId,
    clientRunId,
    runSessionToken: runSession.token,
    result: { status: 'aborted' },
  };

  const forgedResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', {
      ...validInput,
      runSessionToken: '0'.repeat(64),
    }),
    env,
  });
  assert.equal(forgedResponse.status, 409);

  const mismatchResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', {
      ...validInput,
      clientRunId: 'different_client_run',
    }),
    env,
  });
  assert.equal(mismatchResponse.status, 409);

  const wrongUserResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', validInput, secondUserToken),
    env,
  });
  assert.equal(wrongUserResponse.status, 409);

  db.sessions[0].expiresAt = Math.floor(Date.now() / 1000) - 1;
  const expiredResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', validInput),
    env,
  });
  assert.equal(expiredResponse.status, 409);

  db.sessions[0].expiresAt = Math.floor(Date.now() / 1000) + 3600;
  db.activeReleaseId = secondReleaseId;
  const inactiveResponse = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', validInput),
    env,
  });
  assert.equal(inactiveResponse.status, 409);
  assert.equal(db.runs.length, 0);
});

test('enforces the 16000-byte aggregate limit even with a short request envelope', async () => {
  const result = CreateBoundaryResultPayload(23);
  const input = {
    releaseId,
    clientRunId,
    runSessionToken: '0'.repeat(64),
    result,
  };
  assert.equal(new TextEncoder().encode(JSON.stringify(result)).byteLength, 16_001);
  assert.ok(new TextEncoder().encode(JSON.stringify(input)).byteLength < 16 * 1024);
  const response = await saveGameRun({
    request: AuthorizedJsonRequest('/api/game-runs', input),
    env: { AUTH_SESSION_SECRET: secret, REHAB_DB: CreateGameRunDb() },
  });
  assert.equal(response.status, 400);
});

test('schema makes the game run row the unique consumption record', async () => {
  const migration = await readFile(
    new URL('../../migrations/0008_game_run_sessions.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /token_sha256 TEXT NOT NULL UNIQUE/);
  assert.match(migration, /ALTER TABLE game_runs ADD COLUMN run_session_id TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_game_runs_run_session/);
  assert.match(migration, /sandbox_client_reported/);
});

async function IssueSession(env) {
  return createGameRunSession({
    request: AuthorizedJsonRequest('/api/game-run-sessions', { releaseId, clientRunId }),
    env,
  });
}

function AuthorizedJsonRequest(path, body, authToken = token) {
  return new Request(`https://trainerhub.cc${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${authCookieName}=${encodeURIComponent(authToken)}`,
      Origin: 'https://trainerhub.cc',
    },
    body: JSON.stringify(body),
  });
}

function CreateBoundaryResultPayload(finalMetricKeyLength) {
  const metrics = Object.fromEntries(Array.from({ length: 231 }, (_, index) => [
    `m${index.toString(36).padStart(3, '0')}${'x'.repeat(60)}`,
    0,
  ]));
  metrics[`z${'q'.repeat(finalMetricKeyLength - 1)}`] = 0;
  return { status: 'completed', metrics };
}

function CreateGameRunDb() {
  const db = {
    activeReleaseId: releaseId,
    releases: new Map([
      [releaseId, { id: releaseId, game_id: 'game_12345678', status: 'approved' }],
      [secondReleaseId, { id: secondReleaseId, game_id: 'game_12345678', status: 'approved' }],
    ]),
    runs: [],
    sessions: [],
    prepare(sql) {
      return CreateStatement(db, sql);
    },
  };
  return db;
}

function CreateStatement(db, sql, args = []) {
  return {
    bind(...nextArgs) {
      return CreateStatement(db, sql, nextArgs);
    },
    async first() {
      if (/FROM app_users\s+WHERE id = \?/i.test(sql)) {
        return users.get(args[0]) ?? null;
      }
      if (/RETURNING count, reset_at/i.test(sql)) {
        return { count: 1, reset_at: Math.floor(Date.now() / 1000) + 3600 };
      }
      if (/FROM game_releases[\s\S]+active_release_id = game_releases\.id/i.test(sql)) {
        const release = db.releases.get(args[0]);
        return release?.status === 'approved' && release.id === db.activeReleaseId
          ? { id: release.id, game_id: release.game_id }
          : null;
      }
      if (/FROM game_runs[\s\S]+INNER JOIN game_run_sessions/i.test(sql)) {
        const [tokenSha256, userId, requestedReleaseId, requestedClientRunId] = args;
        const session = db.sessions.find((candidate) => (
          candidate.tokenSha256 === tokenSha256
          && candidate.userId === userId
          && candidate.releaseId === requestedReleaseId
          && candidate.clientRunId === requestedClientRunId
        ));
        const run = session
          ? db.runs.find((candidate) => candidate.runSessionId === session.id)
          : null;
        return run ? { id: run.id } : null;
      }
      return null;
    },
    async run() {
      if (/INSERT INTO game_run_sessions/i.test(sql)) {
        const [id, tokenSha256, userId, gameId, requestedReleaseId,
          requestedClientRunId, expiresAt, createdAt] = args;
        db.sessions.push({
          id,
          tokenSha256,
          userId,
          gameId,
          releaseId: requestedReleaseId,
          clientRunId: requestedClientRunId,
          expiresAt,
          createdAt,
        });
        return { success: true, meta: { changes: 1 } };
      }
      if (/INSERT INTO game_runs/i.test(sql)) {
        const [id, completed, score, durationMs, resultJson, createdAt,
          tokenSha256, userId, requestedReleaseId, requestedClientRunId, nowSeconds] = args;
        const session = db.sessions.find((candidate) => (
          candidate.tokenSha256 === tokenSha256
          && candidate.userId === userId
          && candidate.releaseId === requestedReleaseId
          && candidate.clientRunId === requestedClientRunId
          && candidate.expiresAt > nowSeconds
          && candidate.releaseId === db.activeReleaseId
          && db.releases.get(candidate.releaseId)?.status === 'approved'
          && !db.runs.some((run) => run.runSessionId === candidate.id)
        ));
        if (!session) return { success: true, meta: { changes: 0 } };
        db.runs.push({
          id,
          completed,
          score,
          durationMs,
          resultJson,
          createdAt,
          runSessionId: session.id,
          resultSource: 'sandbox_client_reported',
        });
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    },
  };
}

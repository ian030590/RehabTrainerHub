import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../_lib/auth.js';
import { onRequestPost as reportGame } from './games/report.js';
import {
  onRequestGet as listReports,
  onRequestPut as updateReport,
} from './admin/game-reports.js';

const secret = '0123456789abcdef0123456789abcdef';
const developer = { id: 'report-developer', display_name: 'Developer', email: null, role: 'patient' };
const admin = { id: 'report-admin', display_name: 'Admin', email: null, role: 'admin' };
const developerToken = await CreateSignedValue({ sub: developer.id }, secret, 60);
const adminToken = await CreateSignedValue({ sub: admin.id }, secret, 60);

test('published-game reports require auth and never accept inactive releases', async () => {
  const unauthenticated = await reportGame({
    request: new Request('https://trainerhub.cc/api/games/report', { method: 'POST' }),
    env: CreateEnv({ user: null }),
  });
  assert.equal(unauthenticated.status, 401);

  const inactive = await reportGame({
    request: RequestWithAuth(developerToken, { releaseId: 'release-1', reason: 'safety', details: 'A concern.' }),
    env: CreateEnv({ user: developer, release: null }),
  });
  assert.equal(inactive.status, 404);
});

test('a valid report is queued for admin review with bounded details', async () => {
  const response = await reportGame({
    request: RequestWithAuth(developerToken, { releaseId: 'release-1', reason: 'copyright', details: 'Please verify this asset licence.' }),
    env: CreateEnv({ user: developer }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).report.status, 'open');
});

test('admins can list and transition report state with an audit write', async () => {
  const listed = await listReports({
    request: AuthorizedAdminRequest('https://trainerhub.cc/api/admin/game-reports'),
    env: CreateEnv({ user: admin }),
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).reports[0].status, 'open');

  const updated = await updateReport({
    request: AuthorizedAdminRequest(
      'https://trainerhub.cc/api/admin/game-reports',
      { method: 'PUT', body: JSON.stringify({ reportId: 'report-1', status: 'in_review', resolutionNote: '' }) },
    ),
    env: CreateEnv({ user: admin }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).report.status, 'in_review');
});

test('terminal report decisions require an auditable resolution note', async () => {
  const response = await updateReport({
    request: AuthorizedAdminRequest(
      'https://trainerhub.cc/api/admin/game-reports',
      { method: 'PUT', body: JSON.stringify({ reportId: 'report-1', status: 'resolved', resolutionNote: '' }) },
    ),
    env: CreateEnv({ user: admin }),
  });
  assert.equal(response.status, 400);
});

function RequestWithAuth(token, payload) {
  return new Request('https://trainerhub.cc/api/games/report', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function AuthorizedAdminRequest(url, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Origin', 'https://trainerhub.cc');
  headers.set('Cookie', `${authCookieName}=${encodeURIComponent(adminToken)}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Request(url, { ...init, headers });
}

function CreateEnv({ user, release = { id: 'release-1', game_id: 'game-1' } }) {
  return {
    AUTH_SESSION_SECRET: secret,
    REHAB_DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return user;
                if (/FROM game_releases/i.test(sql) && /active_release_id/i.test(sql)) return release;
                if (/SELECT id, status, game_id, release_id FROM game_platform_reports/i.test(sql)) {
                  return { id: 'report-1', status: 'open', game_id: 'game-1', release_id: 'release-1' };
                }
                if (/INSERT INTO rate_limits/i.test(sql)) return { count: 1, reset_at: Math.floor(Date.now() / 1000) + 3600 };
                return null;
              },
              async all() {
                if (/FROM game_platform_reports AS report/i.test(sql)) {
                  return { results: [{
                    id: 'report-1',
                    game_id: 'game-1',
                    release_id: 'release-1',
                    slug: 'sample-game',
                    title: 'Sample game',
                    version: '1.0.0',
                    reason: 'safety',
                    details: 'A concern.',
                    status: 'open',
                    resolution_note: null,
                    resolved_at: null,
                    reporter_display_name: 'Reporter',
                    created_at: '2026-08-28T00:00:00.000Z',
                    updated_at: '2026-08-28T00:00:00.000Z',
                  }] };
                }
                return { results: [] };
              },
              async run() { return { meta: { changes: 1 } }; },
            };
          },
          async run() { return { meta: { changes: 1 } }; },
        };
      },
      async batch(statements) {
        return (statements || []).map(() => ({ meta: { changes: 1 } }));
      },
    },
  };
}

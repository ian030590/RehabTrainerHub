import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../_lib/auth.js';
import { onRequestPost as requestManualReview } from './developer/game-submissions/[id]/review.js';
import { onRequestPut as reviewManualRequest } from './admin/game-submissions/[id]/review.js';

const secret = '0123456789abcdef0123456789abcdef';
const developer = { id: 'developer-1', display_name: 'Developer', email: null, role: 'patient' };
const admin = { id: 'admin-1', display_name: 'Admin', email: null, role: 'admin' };
const developerToken = await CreateSignedValue({ sub: developer.id }, secret, 60);
const adminToken = await CreateSignedValue({ sub: admin.id }, secret, 60);

test('manual-review request requires authentication and cannot dispute hard blocks', async () => {
  const unauthorized = await requestManualReview({
    request: RequestWithAuth('https://trainerhub.cc/api/developer/game-submissions/submission-1/review'),
    env: { AUTH_SESSION_SECRET: secret, REHAB_DB: CreateDb({ user: null }) },
    params: { id: 'submission-1' },
  });
  assert.equal(unauthorized.status, 401);

  const blocked = await requestManualReview({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/developer/game-submissions/submission-1/review',
      developerToken,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Please review this false positive.', findingIds: ['finding-1'] }),
      },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: developer,
        submission: { id: 'submission-1', scan_run_id: 'scan-1', scan_status: 'flagged', review_status: 'not_requested' },
        findings: [{ id: 'finding-1', disposition: 'hard-block' }],
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(blocked.status, 409);
});

test('eligible findings can create one manual-review request', async () => {
  const response = await requestManualReview({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/developer/game-submissions/submission-1/review',
      developerToken,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'The scanner matched a documented local helper.', findingIds: ['finding-1'] }),
      },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: developer,
        submission: { id: 'submission-1', scan_run_id: 'scan-1', scan_status: 'flagged', review_status: 'not_requested' },
        findings: [{ id: 'finding-1', disposition: 'fix-or-manual-review' }],
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).reviewRequest.status, 'requested');
});

test('admin approval still requires a passed scan without hard blocks', async () => {
  const nonAdmin = await reviewManualRequest({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/admin/game-submissions/submission-1/review',
      developerToken,
      { method: 'PUT', body: JSON.stringify({ decision: 'approve', note: 'Reviewed', sourceReviewed: true, playTested: true, metadataReviewed: true }) },
    ),
    env: { AUTH_SESSION_SECRET: secret, REHAB_DB: CreateDb({ user: developer }) },
    params: { id: 'submission-1' },
  });
  assert.equal(nonAdmin.status, 403);

  const blocked = await reviewManualRequest({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/admin/game-submissions/submission-1/review',
      adminToken,
      { method: 'PUT', body: JSON.stringify({ decision: 'approve', note: 'Reviewed', sourceReviewed: true, playTested: true, metadataReviewed: true }) },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: admin,
        review: { id: 'review-1', scan_run_id: 'scan-1', review_status: 'in_review', scan_status: 'flagged', hard_block_count: 1 },
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(blocked.status, 409);

  const approved = await reviewManualRequest({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/admin/game-submissions/submission-1/review',
      adminToken,
      { method: 'PUT', body: JSON.stringify({ decision: 'approve', note: 'Reviewed', sourceReviewed: true, playTested: true, metadataReviewed: true }) },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: admin,
        review: { id: 'review-1', scan_run_id: 'scan-1', review_status: 'in_review', scan_status: 'passed', hard_block_count: 0 },
        updateChanges: 1,
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).reviewRequest.status, 'approved');
});

test('admin approval requires per-finding override evidence for eligible findings', async () => {
  const missingEvidence = await reviewManualRequest({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/admin/game-submissions/submission-1/review',
      adminToken,
      { method: 'PUT', body: JSON.stringify({ decision: 'approve', note: 'Reviewed', sourceReviewed: true, playTested: true, metadataReviewed: true }) },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: admin,
        review: { id: 'review-1', scan_run_id: 'scan-1', review_status: 'in_review', scan_status: 'passed', hard_block_count: 0, owner_user_id: developer.id, game_id: 'game-1' },
        findings: [{ id: 'finding-1', disposition: 'manual-review' }],
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(missingEvidence.status, 400);

  const approved = await reviewManualRequest({
    request: RequestWithAuth(
      'https://trainerhub.cc/api/admin/game-submissions/submission-1/review',
      adminToken,
      {
        method: 'PUT',
        body: JSON.stringify({
          decision: 'approve',
          note: 'Reviewed',
          sourceReviewed: true,
          playTested: true,
          metadataReviewed: true,
          overrides: [{ findingId: 'finding-1', decision: 'dismiss', reason: 'Local-only API reference is unreachable.', evidence: 'Isolated play test recorded no network attempt.' }],
        }),
      },
    ),
    env: {
      AUTH_SESSION_SECRET: secret,
      REHAB_DB: CreateDb({
        user: admin,
        review: { id: 'review-1', scan_run_id: 'scan-1', review_status: 'in_review', scan_status: 'passed', hard_block_count: 0, owner_user_id: developer.id, game_id: 'game-1' },
        findings: [{ id: 'finding-1', disposition: 'manual-review' }],
      }),
    },
    params: { id: 'submission-1' },
  });
  assert.equal(approved.status, 200);
  assert.deepEqual((await approved.json()).reviewRequest.overrideFindingIds, ['finding-1']);
});

function RequestWithAuth(url, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Origin', 'https://trainerhub.cc');
  if (token) headers.set('Cookie', `${authCookieName}=${encodeURIComponent(token)}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Request(url, { ...init, headers });
}

function CreateDb({ user, submission, findings = [], review, updateChanges = 1 }) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) return user;
              if (/FROM game_submissions/i.test(sql)) return submission ?? null;
              if (/FROM game_review_requests AS review/i.test(sql)) return review ?? null;
              return null;
            },
            async all() {
              if (/FROM game_validation_findings/i.test(sql)) return { results: findings };
              return { results: [] };
            },
            async run() {
              return { success: true, meta: { changes: updateChanges } };
            },
          };
        },
      };
    },
    async batch(statements) {
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    },
  };
}

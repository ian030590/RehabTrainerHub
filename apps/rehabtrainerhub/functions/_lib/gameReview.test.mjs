import assert from 'node:assert/strict';
import test from 'node:test';
import { BuildReviewIssueBody, CheckGameReleaseOwner, CreateGameReviewDigest } from './gameReview.js';

const release = {
  id: 'release_12345678', game_id: 'game_12345678', slug: 'sample-game', version: '1.0.0',
  submitted_title: 'Sample game', submitted_summary: 'A practice activity.', submitted_developer_name: 'Studio',
  submitted_trainer: 'brain', submitted_category: 'attention', change_notes: 'Initial release.',
  artifact_type: 'zip', entry_path: 'index.html', content_sha256: 'a'.repeat(64),
  jspsych_version: 'none', capabilities_json: '["keyboard","pointer"]',
  files_json: JSON.stringify([
    { path: 'index.html', byteSize: 20, contentType: 'text/html', sha256: 'b'.repeat(64) },
    { path: 'game.js', byteSize: 30, contentType: 'text/javascript', sha256: 'c'.repeat(64) },
  ]),
};

test('approval identifies the exact version, public metadata, capabilities, and runtime files', async () => {
  const digest = await CreateGameReviewDigest(release);
  assert.match(digest, /^[a-f0-9]{64}$/);
  for (const changes of [
    { version: '1.0.1' }, { submitted_title: 'Changed title' }, { submitted_summary: 'Changed description' },
    { submitted_developer_name: 'Different author' }, { submitted_category: 'memory' },
    { content_sha256: 'd'.repeat(64) }, { jspsych_version: '8.2.3' },
    { capabilities_json: '["keyboard","fullscreen"]' }, { entry_path: 'other.html' },
    { files_json: release.files_json.replace('game.js', 'other.js') }, { change_notes: 'Different change notes.' },
  ]) assert.notEqual(await CreateGameReviewDigest({ ...release, ...changes }), digest);
  assert.equal(await CreateGameReviewDigest({ ...release, status: 'approved', review_note: 'Checked' }), digest);
  assert.equal(await CreateGameReviewDigest({ ...release,
    capabilities_json: '["pointer","keyboard"]',
    files_json: JSON.stringify(JSON.parse(release.files_json).reverse()),
  }), digest);
});

test('only the configured platform owner can publish, including another administrator', () => {
  const request = new Request('https://trainerhub.cc/api/admin/game-releases/release-1');
  const owner = { id: 'owner-1', role: 'admin' };
  assert.equal(CheckGameReleaseOwner(request, {}, owner).status, 503);
  assert.equal(CheckGameReleaseOwner(request, { GAME_RELEASE_OWNER_USER_ID: 'owner-1' }, { id: 'other-admin', role: 'admin' }).status, 403);
  assert.equal(CheckGameReleaseOwner(request, { GAME_RELEASE_OWNER_USER_ID: 'owner-1' }, owner), null);
});

test('the Issue is a review ticket with a protected link and no private files, identities, or scanner excerpts', async () => {
  const reviewDigest = await CreateGameReviewDigest(release);
  const body = BuildReviewIssueBody({ ...release, review_digest: reviewDigest,
    owner_user_id: 'private-account', quarantine_key: 'private/key',
    findings_json: '[{"message":"LEAKED_SECRET"}]',
  });
  assert.ok(body.includes(reviewDigest));
  assert.match(body, /\n## 遊戲版本審核\n/);
  assert.doesNotMatch(body, /\\n/);
  assert.ok(body.includes(`trainerhub-release:${release.id}`));
  assert.match(body, /https:\/\/trainerhub\.cc\/admin\/\?release=release_12345678/);
  assert.doesNotMatch(body, /private-account|private\/key|LEAKED_SECRET|token=|\.zip/);
});

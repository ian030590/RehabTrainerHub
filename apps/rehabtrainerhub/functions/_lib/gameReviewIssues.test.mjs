import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from './auth.js';
import { CreateGameReviewDigest } from './gameReview.js';
import { CreateGameReviewIssueStatements, CreateGameReviewIssueSyncStatement, ProcessGameReviewIssueJobs } from './gameReviewIssues.js';
import { onRequestPut as reviewRelease } from '../api/admin/game-releases/[id].js';
import { onRequestGet as listReviewReleases } from '../api/admin/game-releases.js';
import reviewIssueWorker from '../../../../workers/game-review-issues/index.js';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const nowSeconds = Math.floor(Date.now() / 1000);

test('the deployed Worker entry keeps the Issue job alive with only the configured database and App credentials', async context => {
  const db = await CreateDatabase(context);
  await SeedRelease(db);
  const github = CreateGitHub();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = github.fetch;
  try {
    let backgroundWork;
    await reviewIssueWorker.scheduled({}, CreateEnvironment(db), { waitUntil(work) { backgroundWork = work; } });
    assert.ok(backgroundWork instanceof Promise);
    await backgroundWork;
    assert.equal(github.created.length, 1);
    const config = await readFile(new URL('../../../../workers/game-review-issues/wrangler.toml', import.meta.url), 'utf8');
    assert.match(config, /binding = "REHAB_DB"/);
    assert.doesNotMatch(config, /\[\[r2_buckets\]\]|AUTH_|GAME_QUARANTINE|GAME_RELEASE_BUCKET/);
  } finally { globalThis.fetch = originalFetch; }
});

test('the Issue deep link selects only its exact release and exposes owner permission without granting it to another admin', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await SeedRelease(db, { id: 'another-release', version: '1.0.1' });
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  for (const [identity, canReview] of [['owner-1', true], ['other-admin', false]]) {
    const authRequest = await ReviewRequest(identity, {});
    const request = new Request(`https://trainerhub.cc/api/admin/game-releases?release=${release.id}`, { headers: authRequest.headers });
    const response = await listReviewReleases({ request, env: CreateEnvironment(db) });
    assert.equal(response.status, 200, await response.clone().text());
    const payload = await response.json();
    assert.equal(payload.releases.length, 1);
    assert.equal(payload.releases[0].id, release.id);
    assert.equal(payload.releases[0].canReview, canReview);
    assert.equal(payload.releases[0].reviewDigest, release.review_digest);
    assert.equal(payload.releases[0].reviewIssue.status, 'pending');
  }
});

test('the worker recovers pending uploads made between migration and Hub deployment without reopening approved history', async context => {
  const db = await CreateDatabase(context);
  const pending = await SeedRelease(db);
  await SeedRelease(db, { id: 'release_history', version: '0.9.0', status: 'approved' });
  const github = CreateGitHub();
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  assert.equal(github.created.length, 1);
  assert.equal((await db.prepare('SELECT release_id, status FROM game_review_issues').first()).release_id, pending.id);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM game_review_issues').first()).count, 1);
});

test('a submission creates a durable version ticket while the code remains private', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  const env = CreateEnvironment(db);
  let releaseBucketReads = 0;
  env.GAME_RELEASE_BUCKET = { get() { releaseBucketReads++; throw new Error('Issue creation must not read published files'); } };
  await ProcessGameReviewIssueJobs(env, { fetch: github.fetch, nowSeconds });
  assert.equal(releaseBucketReads, 0);
  assert.equal(github.created.length, 1);
  assert.doesNotMatch(github.created[0].body, /PRIVATE_SOURCE|quarantine\/|owner-1|token=/);
  const issue = await db.prepare('SELECT * FROM game_review_issues WHERE release_id = ?').bind(release.id).first();
  assert.equal(issue.status, 'ready');
  assert.equal(issue.issue_number, 1);
  assert.equal(issue.review_digest, release.review_digest);
  assert.equal((await db.prepare('SELECT status FROM game_releases WHERE id = ?').bind(release.id).first()).status, 'pending_review');
});

test('GitHub outages retain the private ticket and retry the same release', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub({ outage: true });
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  assert.equal((await db.prepare('SELECT status FROM game_review_issues').first()).status, 'pending');
  const job = await db.prepare('SELECT * FROM game_review_issue_jobs').first();
  assert.equal(job.status, 'pending');
  assert.equal(job.attempts, 1);
  assert.ok(job.next_attempt_at > nowSeconds);
  assert.doesNotMatch(job.last_error, /ghs_|BEGIN PRIVATE KEY/);
  github.outage = false;
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds: nowSeconds + 3600 });
  assert.equal(github.created.length, 1);
  assert.equal((await db.prepare('SELECT status FROM game_review_issues').first()).status, 'ready');
});

test('a lost create response is reconciled with the App-created Issue before retrying', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub({ loseCreateResponse: true });
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  assert.equal(github.created.length, 1);
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds: nowSeconds + 3600 });
  assert.equal(github.created.length, 1);
  assert.equal((await db.prepare('SELECT issue_number FROM game_review_issues').first()).issue_number, 1);
});

test('concurrent workers claim one job and another user cannot forge its review ticket marker', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  github.issues.push({ number: 99, body: `<!-- trainerhub-release:${release.id} review-digest:${release.review_digest} -->`,
    performed_via_github_app: null, html_url: 'https://github.com/ian030590/RehabTrainerHub/issues/99', node_id: 'I_fake' });
  await Promise.all([
    ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds }),
    ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds }),
  ]);
  assert.equal(github.created.length, 1);
  assert.equal((await db.prepare('SELECT issue_number FROM game_review_issues').first()).issue_number, 1);
});

test('a delayed worker cannot create a second Issue after another worker takes its expired lease', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  let resumeLookup;
  let notifyLookup;
  const lookupStarted = new Promise(resolve => { notifyLookup = resolve; });
  const firstFetch = async (input, init) => {
    if (!init.method || init.method === 'GET') {
      const wait = new Promise(resolve => { resumeLookup = resolve; });
      notifyLookup();
      await wait;
      return Response.json([]);
    }
    return github.fetch(input, init);
  };
  const firstRun = ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: firstFetch, nowSeconds });
  await lookupStarted;
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds: nowSeconds + 181 });
  resumeLookup();
  await firstRun;
  assert.equal(github.created.length, 1);
  assert.equal((await db.prepare('SELECT status FROM game_review_issue_jobs').first()).status, 'done');
});

test('each new version gets its own Issue without changing the active release', async context => {
  const db = await CreateDatabase(context);
  const first = await SeedRelease(db);
  const second = await SeedRelease(db, { id: 'release_87654321', version: '1.0.1' });
  await db.batch([...CreateGameReviewIssueStatements(db, first.id), ...CreateGameReviewIssueStatements(db, second.id)]);
  const github = CreateGitHub();
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  assert.equal(github.created.length, 2);
  assert.equal(new Set(github.created.map(issue => issue.body.match(/審核雜湊：([a-f0-9]+)/)?.[1])).size, 2);
  assert.equal((await db.prepare('SELECT active_release_id FROM developer_games').first()).active_release_id, null);
});

test('Issue updates for one release run in order so a late approval update cannot overwrite revocation', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  await db.prepare("UPDATE game_releases SET status='approved' WHERE id=?").bind(release.id).run();
  await db.batch([CreateGameReviewIssueSyncStatement(db, release.id, 'approved')]);
  let resumePatch;
  let notifyPatch;
  let held = false;
  const patchStarted = new Promise(resolve => { notifyPatch = resolve; });
  const firstFetch = async (input, init) => {
    if (init.method === 'PATCH' && !held) {
      held = true;
      const wait = new Promise(resolve => { resumePatch = resolve; });
      notifyPatch(); await wait;
    }
    return github.fetch(input, init);
  };
  const firstRun = ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: firstFetch, nowSeconds });
  await patchStarted;
  await db.prepare("UPDATE game_releases SET status='revoked' WHERE id=?").bind(release.id).run();
  await db.batch([CreateGameReviewIssueSyncStatement(db, release.id, 'revoked')]);
  const parallel = await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  resumePatch(); await firstRun;
  assert.equal(parallel.processed, 0);
  assert.match(github.issues[0].body, /版本狀態：revoked/);
});

test('the review endpoint refuses another administrator, missing owner configuration, stale content, and an unbound Issue', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const env = CreateEnvironment(db);
  let storageAccesses = 0;
  env.GAME_QUARANTINE_BUCKET = { get() { storageAccesses++; throw new Error('Should reject before storage'); } };
  env.GAME_RELEASE_BUCKET = { get() { storageAccesses++; }, put() { storageAccesses++; } };
  for (const [identity, overrides, expectedReviewDigest, status] of [
    ['other-admin', {}, release.review_digest, 403],
    ['owner-1', { GAME_RELEASE_OWNER_USER_ID: '' }, release.review_digest, 503],
    ['owner-1', {}, '0'.repeat(64), 409],
    ['owner-1', {}, release.review_digest, 409],
  ]) {
    const request = await ReviewRequest(identity, { decision: 'approve', expectedReviewDigest,
      note: 'Checked', sourceReviewed: true, playTested: true, metadataReviewed: true });
    const response = await reviewRelease({ request, env: { ...env, ...overrides }, params: { id: release.id } });
    assert.equal(response.status, status, await response.text());
  }
  assert.equal(storageAccesses, 0);
});

test('editing or closing the linked Issue does not authorize a release', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds });
  github.issues[0].state = 'closed';
  github.issues[0].body = 'approved by an Issue editor';
  await ProcessGameReviewIssueJobs(CreateEnvironment(db), { fetch: github.fetch, nowSeconds: nowSeconds + 3600 });
  assert.equal((await db.prepare('SELECT status FROM game_releases').first()).status, 'pending_review');
});

test('owner approval publishes the exact version and durably synchronizes its Issue', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  const env = CreateEnvironment(db);
  await ProcessGameReviewIssueJobs(env, { fetch: github.fetch, nowSeconds });
  const bytes = new TextEncoder().encode('<!doctype html><title>Sample</title>');
  const file = JSON.parse(release.files_json)[0];
  await db.prepare('INSERT INTO game_release_files (release_id,path,content_type,byte_size,sha256,quarantine_key) VALUES (?,?,?,?,?,?)')
    .bind(release.id, file.path, file.contentType, file.byteSize, file.sha256, 'quarantine/private/index.html').run();
  const published = new Map();
  env.GAME_QUARANTINE_BUCKET = { get: async () => ({ arrayBuffer: async () => bytes.slice().buffer }) };
  env.GAME_RELEASE_BUCKET = CreateBucket(published);
  const response = await reviewRelease({ request: await ReviewRequest('owner-1', {
    decision: 'approve', expectedReviewDigest: release.review_digest,
    sourceReviewed: true, playTested: true, metadataReviewed: true, note: 'Checked the exact source and play flow.',
  }), env, params: { id: release.id } });
  assert.equal(response.status, 200, await response.text());
  assert.equal(JSON.parse(new TextDecoder().decode(published.get('releases/sample-game/1.0.0/release.json').bytes)).status, 'approved');
  assert.equal((await db.prepare('SELECT active_release_id FROM developer_games').first()).active_release_id, release.id);
  assert.equal((await db.prepare("SELECT status FROM game_review_issue_jobs WHERE kind='sync_issue'").first()).status, 'pending');
  await ProcessGameReviewIssueJobs(env, { fetch: github.fetch, nowSeconds: nowSeconds + 60 });
  assert.equal(github.created.length, 1);
  assert.equal(github.issues[0].state, 'closed');
  assert.match(github.issues[0].body, /版本狀態：approved/);
});

test('a file inventory changed after the review cannot publish a different manifest', async context => {
  const db = await CreateDatabase(context);
  const release = await SeedRelease(db);
  await db.batch(CreateGameReviewIssueStatements(db, release.id));
  const github = CreateGitHub();
  const env = CreateEnvironment(db);
  await ProcessGameReviewIssueJobs(env, { fetch: github.fetch, nowSeconds });
  const file = JSON.parse(release.files_json)[0];
  await db.prepare('INSERT INTO game_release_files (release_id,path,content_type,byte_size,sha256,quarantine_key) VALUES (?,?,?,?,?,?)')
    .bind(release.id, 'different.html', file.contentType, file.byteSize, file.sha256, 'quarantine/private/index.html').run();
  let fileReads = 0;
  const published = new Map();
  env.GAME_QUARANTINE_BUCKET = { get: async () => { fileReads++; return { arrayBuffer: async () => new TextEncoder().encode('<!doctype html><title>Sample</title>').buffer }; } };
  env.GAME_RELEASE_BUCKET = CreateBucket(published);
  const response = await reviewRelease({ request: await ReviewRequest('owner-1', {
    decision: 'approve', expectedReviewDigest: release.review_digest, note: 'Checked',
    sourceReviewed: true, playTested: true, metadataReviewed: true,
  }), env, params: { id: release.id } });
  assert.equal(response.status, 409);
  assert.equal(fileReads, 0);
  assert.equal(published.size, 0);
});

function CreateBucket(objects) {
  return {
    async get(key) {
      const object = objects.get(key);
      return object ? { size: object.bytes.length, etag: object.etag, customMetadata: object.customMetadata,
        arrayBuffer: async () => object.bytes.slice().buffer, text: async () => new TextDecoder().decode(object.bytes) } : null;
    },
    async put(key, body, options = {}) {
      const previous = objects.get(key);
      if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null;
      if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body);
      const etag = createHash('sha256').update(bytes).digest('hex');
      objects.set(key, { bytes, etag, customMetadata: options.customMetadata });
      return { etag };
    },
  };
}

function CreateEnvironment(db) {
  return { REHAB_DB: db, AUTH_SESSION_SECRET: '0123456789abcdef0123456789abcdef', GAME_RELEASE_OWNER_USER_ID: 'owner-1',
    GITHUB_APP_ID: '123', GITHUB_APP_INSTALLATION_ID: '456', GITHUB_REVIEW_REPOSITORY_ID: '789', GITHUB_APP_PRIVATE_KEY: privateKey };
}

async function ReviewRequest(identity, body) {
  const token = await CreateSignedValue({ sub: identity }, '0123456789abcdef0123456789abcdef', 3600);
  return new Request('https://trainerhub.cc/api/admin/game-releases/release_12345678', { method: 'PUT',
    headers: { Origin: 'https://trainerhub.cc', Cookie: `${authCookieName}=${encodeURIComponent(token)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
}

async function CreateDatabase(context) {
  const sqlite = new DatabaseSync(':memory:');
  context.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrations = new URL('../../migrations/', import.meta.url);
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(await readFile(new URL(name, migrations), 'utf8'));
  }
  sqlite.prepare('INSERT INTO app_users (id, role, created_at, updated_at) VALUES (?, ?, ?, ?)').run('owner-1', 'admin', '2026-10-08', '2026-10-08');
  sqlite.prepare('INSERT INTO app_users (id, role, created_at, updated_at) VALUES (?, ?, ?, ?)').run('other-admin', 'admin', '2026-10-08', '2026-10-08');
  sqlite.prepare("INSERT INTO developer_games (id, slug, owner_user_id, title, category, trainer, created_at, updated_at) VALUES ('game_12345678', 'sample-game', 'owner-1', 'Sample', 'attention', 'brain', '2026-10-08', '2026-10-08')").run();
  const db = {
    sqlite,
    prepare(sql) {
      const statement = { sql, args: [], bind(...args) { return { ...statement, args }; },
        async first() { return sqlite.prepare(sql).get(...this.args) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...this.args) }; },
        async run() { const result = sqlite.prepare(sql).run(...this.args); return { success: true, meta: { changes: Number(result.changes) } }; } };
      return statement;
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => ({ success: true,
          meta: { changes: Number(sqlite.prepare(statement.sql).run(...statement.args).changes) } }));
        sqlite.exec('COMMIT'); return results;
      }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return db;
}

async function SeedRelease(db, overrides = {}) {
  const bytes = new TextEncoder().encode('<!doctype html><title>Sample</title>');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const release = { id: 'release_12345678', game_id: 'game_12345678', slug: 'sample-game', version: '1.0.0',
    submitted_developer_name: 'Studio', submitted_title: 'Sample', submitted_summary: 'A practice activity.',
    submitted_trainer: 'brain', submitted_category: 'attention', artifact_type: 'html', entry_path: 'index.html',
    content_sha256: sha256, jspsych_version: 'none', capabilities_json: '["keyboard"]', change_notes: 'Initial version.',
    files_json: JSON.stringify([{ path: 'index.html', byteSize: bytes.length, contentType: 'text/html', sha256 }]), ...overrides };
  release.review_digest = await CreateGameReviewDigest(release);
  db.sqlite.prepare(`INSERT INTO game_releases (id,game_id,version,submitted_developer_name,submitted_title,submitted_summary,
    submitted_trainer,submitted_category,artifact_type,entry_path,status,content_sha256,package_bytes,uncompressed_bytes,file_count,
    jspsych_version,capabilities_json,files_json,scan_summary_json,submitted_at,created_at,updated_at,review_digest,change_notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'{"blockCount":0}',?,?,?, ?,?)`).run(
    release.id, release.game_id, release.version, release.submitted_developer_name, release.submitted_title, release.submitted_summary,
    release.submitted_trainer, release.submitted_category, release.artifact_type, release.entry_path,
    release.status || 'pending_review',
    release.content_sha256, bytes.length, bytes.length, 1, release.jspsych_version, release.capabilities_json, release.files_json,
    '2026-10-08', '2026-10-08', '2026-10-08', release.review_digest, release.change_notes);
  return release;
}

function CreateGitHub(options = {}) {
  const github = { issues: [], created: [], outage: false, loseCreateResponse: false, ...options };
  github.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/access_tokens')) {
      const payload = JSON.parse(init.body);
      assert.deepEqual(payload.repository_ids, [789]);
      assert.deepEqual(payload.permissions, { issues: 'write' });
      return Response.json({ token: 'ghs_test_private', expires_at: new Date((nowSeconds + 7200) * 1000).toISOString() });
    }
    if (github.outage) return new Response(null, { status: 503 });
    assert.ok(url.pathname.startsWith('/repos/ian030590/RehabTrainerHub/issues'));
    if (!init.method || init.method === 'GET') return Response.json(github.issues);
    const payload = JSON.parse(init.body);
    if (init.method === 'PATCH') {
      const issue = github.issues.find(issue => issue.number === Number(url.pathname.split('/').at(-1)));
      assert.ok(issue);
      Object.assign(issue, payload);
      return Response.json(issue);
    }
    const issue = { ...payload, number: github.created.length + 1, node_id: `I_${github.created.length + 1}`,
      html_url: `https://github.com/ian030590/RehabTrainerHub/issues/${github.created.length + 1}`,
      performed_via_github_app: { id: 123 } };
    github.created.push(payload);
    github.issues.push(issue);
    if (github.loseCreateResponse) { github.loseCreateResponse = false; throw new Error('Connection reset after creation'); }
    return Response.json(issue, { status: 201 });
  };
  return github;
}

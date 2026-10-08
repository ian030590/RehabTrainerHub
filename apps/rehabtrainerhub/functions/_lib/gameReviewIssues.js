import { BuildReviewIssueBody, CreateGameReviewDigest, IsGameReviewIssueUrl, gameReviewRepository } from './gameReview.js';

const maximumJobsPerRun = 10;
const leaseSeconds = 180;
const githubApiOrigin = 'https://api.github.com';

export function CreateGameReviewIssueStatements(db, releaseId) {
  const now = new Date().toISOString();
  return [
    db.prepare(`INSERT OR IGNORE INTO game_review_issues (release_id, review_digest, created_at, updated_at)
      SELECT id, review_digest, ?, ? FROM game_releases WHERE id = ?`).bind(now, now, releaseId),
    db.prepare(`INSERT OR IGNORE INTO game_review_issue_jobs (id, release_id, kind, dedupe_key, created_at, updated_at)
      VALUES (?, ?, 'create_issue', ?, ?, ?)`).bind(`create:${releaseId}`, releaseId, `create:${releaseId}`, now, now),
  ];
}

export function CreateGameReviewIssueSyncStatement(db, releaseId, status) {
  const key = `sync:${releaseId}:${status}`;
  const now = new Date().toISOString();
  return db.prepare(`INSERT OR IGNORE INTO game_review_issue_jobs (id, release_id, kind, dedupe_key, created_at, updated_at)
    SELECT ?, release_id, 'sync_issue', ?, ?, ? FROM game_review_issues WHERE release_id = ?`)
    .bind(key, key, now, now, releaseId);
}

export async function ProcessGameReviewIssueJobs(env, options = {}) {
  const config = ReadGitHubConfiguration(env);
  const db = env.REHAB_DB;
  if (!db?.prepare || !db.batch) throw new Error('Game review database is unavailable.');
  const fetchRequest = options.fetch || fetch;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timestamp = new Date(nowSeconds * 1000).toISOString();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO game_review_issues (release_id, review_digest, created_at, updated_at)
      SELECT id, review_digest, ?, ? FROM game_releases
      WHERE status IN ('pending_review', 'blocked', 'publishing')`).bind(timestamp, timestamp),
    db.prepare(`INSERT OR IGNORE INTO game_review_issue_jobs (id, release_id, kind, dedupe_key, created_at, updated_at)
      SELECT 'create:' || game_releases.id, game_releases.id, 'create_issue', 'create:' || game_releases.id, ?, ?
      FROM game_releases INNER JOIN game_review_issues ON game_review_issues.release_id = game_releases.id
      WHERE game_releases.status IN ('pending_review', 'blocked', 'publishing')
        AND game_review_issues.status = 'pending'`).bind(timestamp, timestamp),
  ]);
  let accessToken;
  let processed = 0;
  for (let index = 0; index < maximumJobsPerRun; index++) {
    const jobNowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    const leaseId = crypto.randomUUID();
    const job = await db.prepare(`UPDATE game_review_issue_jobs
      SET status = 'running', lease_id = ?, lease_until = ?, attempts = attempts + 1, updated_at = ?
      WHERE id = (SELECT candidate.id FROM game_review_issue_jobs AS candidate
        WHERE ((candidate.status = 'pending' AND candidate.next_attempt_at <= ?)
          OR (candidate.status = 'running' AND candidate.lease_until <= ?))
        AND NOT EXISTS (SELECT 1 FROM game_review_issue_jobs AS running
          WHERE running.release_id = candidate.release_id AND running.id != candidate.id
            AND running.status = 'running' AND running.lease_until > ?)
        ORDER BY candidate.created_at, candidate.id LIMIT 1)
      AND ((status = 'pending' AND next_attempt_at <= ?) OR (status = 'running' AND lease_until <= ?))
      RETURNING *`).bind(leaseId, jobNowSeconds + leaseSeconds, new Date(jobNowSeconds * 1000).toISOString(),
      jobNowSeconds, jobNowSeconds, jobNowSeconds, jobNowSeconds, jobNowSeconds).first();
    if (!job) break;
    processed++;
    try {
      const release = await db.prepare(`SELECT game_releases.*, developer_games.slug,
          game_review_issues.status AS issue_status, game_review_issues.issue_number,
          game_review_issues.issue_node_id, game_review_issues.issue_url,
          game_review_issues.review_digest AS issue_review_digest
        FROM game_releases INNER JOIN developer_games ON developer_games.id = game_releases.game_id
        INNER JOIN game_review_issues ON game_review_issues.release_id = game_releases.id
        WHERE game_releases.id = ?`).bind(job.release_id).first();
      if (!release) throw new GameReviewIssueError('Review version is unavailable.');
      const digest = await CreateGameReviewDigest(release);
      if ((release.review_digest && release.review_digest !== digest)
        || (release.issue_review_digest && release.issue_review_digest !== digest)) {
        throw new GameReviewIssueError('Review snapshot no longer matches its digest.');
      }
      release.review_digest = digest;
      const pins = await db.batch([
        db.prepare(`UPDATE game_releases SET review_digest = ? WHERE id = ?
          AND (review_digest IS NULL OR review_digest = ?)
          AND EXISTS (SELECT 1 FROM game_review_issue_jobs WHERE id = ? AND lease_id = ? AND status = 'running')`)
          .bind(digest, release.id, digest, job.id, leaseId),
        db.prepare(`UPDATE game_review_issues SET review_digest = ? WHERE release_id = ?
          AND (review_digest IS NULL OR review_digest = ?)
          AND EXISTS (SELECT 1 FROM game_review_issue_jobs WHERE id = ? AND lease_id = ? AND status = 'running')`)
          .bind(digest, release.id, digest, job.id, leaseId),
      ]);
      if (pins.some(result => Number(result.meta?.changes) !== 1)) throw new GameReviewIssueError('Review job lost its lease.');
      accessToken ||= await CreateInstallationToken(config, fetchRequest, jobNowSeconds);
      const github = async (path, init = {}) => {
        if (init.method === 'POST' || init.method === 'PATCH') {
          const mutationNowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
          const renewed = await db.prepare(`UPDATE game_review_issue_jobs SET lease_until = ?
            WHERE id = ? AND lease_id = ? AND status = 'running' AND lease_until > ?`)
            .bind(mutationNowSeconds + leaseSeconds, job.id, leaseId, mutationNowSeconds).run();
          if (Number(renewed.meta?.changes) !== 1) throw new GameReviewIssueError('Review job lost its lease.');
        }
        return GitHubRequest(path, accessToken, fetchRequest, init);
      };
      if (job.kind === 'create_issue' && release.issue_status !== 'ready') {
        const issue = await FindExistingReviewIssue(github, release, config.appId)
          || await github(`/repos/${gameReviewRepository}/issues`, { method: 'POST', body: {
            title: `[遊戲版本審核] ${release.slug} v${release.version}`, body: BuildReviewIssueBody(release),
          } });
        ValidateIssueIdentity(issue, config.appId);
        const bound = await db.prepare(`UPDATE game_review_issues
          SET status = 'ready', repository_id = ?, issue_number = ?, issue_node_id = ?, issue_url = ?, updated_at = ?
          WHERE release_id = ? AND review_digest = ?
          AND EXISTS (SELECT 1 FROM game_review_issue_jobs WHERE id = ? AND lease_id = ? AND status = 'running')`)
          .bind(config.repositoryId, issue.number, issue.node_id, issue.html_url, new Date().toISOString(),
            release.id, digest, job.id, leaseId).run();
        if (Number(bound.meta?.changes) !== 1) throw new GameReviewIssueError('Review job lost its lease.');
      } else if (job.kind === 'sync_issue') {
        if (release.issue_status !== 'ready' || !IsGameReviewIssueUrl(release.issue_url, release.issue_number)) {
          throw new GameReviewIssueError('Review Issue is not ready.');
        }
        await github(`/repos/${gameReviewRepository}/issues/${release.issue_number}`, { method: 'PATCH', body: {
          body: BuildReviewIssueBody(release),
          state: ['approved', 'rejected', 'revoked'].includes(release.status) ? 'closed' : 'open',
        } });
      }
      await db.prepare(`UPDATE game_review_issue_jobs SET status = 'done', lease_id = NULL,
        lease_until = NULL, last_error = NULL, updated_at = ? WHERE id = ? AND lease_id = ? AND status = 'running'`)
        .bind(new Date().toISOString(), job.id, leaseId).run();
    } catch (error) {
      const retryNowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
      const delay = Math.min(3600, 60 * 2 ** Math.min(job.attempts - 1, 6));
      const message = error instanceof GameReviewIssueError ? error.message : 'GitHub communication failed.';
      await db.prepare(`UPDATE game_review_issue_jobs SET status = 'pending', next_attempt_at = ?,
        lease_id = NULL, lease_until = NULL, last_error = ?, updated_at = ? WHERE id = ? AND lease_id = ? AND status = 'running'`)
        .bind(retryNowSeconds + delay, message, new Date().toISOString(), job.id, leaseId).run();
    }
  }
  return { processed };
}

class GameReviewIssueError extends Error {}

function ReadGitHubConfiguration(env) {
  const appId = Number(env.GITHUB_APP_ID);
  const installationId = Number(env.GITHUB_APP_INSTALLATION_ID);
  const repositoryId = Number(env.GITHUB_REVIEW_REPOSITORY_ID);
  const privateKey = String(env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (![appId, installationId, repositoryId].every(value => Number.isSafeInteger(value) && value > 0)
    || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('GitHub review App configuration is incomplete.');
  }
  return { appId, installationId, repositoryId, privateKey };
}

async function CreateInstallationToken(config, fetchRequest, nowSeconds) {
  const pem = config.privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), value => value.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const header = EncodeBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = EncodeBase64Url(new TextEncoder().encode(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: String(config.appId) })));
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  const result = await GitHubRequest(`/app/installations/${config.installationId}/access_tokens`,
    `${input}.${EncodeBase64Url(new Uint8Array(signature))}`, fetchRequest, { method: 'POST', body: {
      repository_ids: [config.repositoryId], permissions: { issues: 'write' },
    } });
  if (typeof result.token !== 'string' || result.token.length < 8 || result.token.length > 4096
    || !Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= nowSeconds * 1000) {
    throw new GameReviewIssueError('GitHub App token response is invalid.');
  }
  return result.token;
}

function EncodeBase64Url(bytes) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function GitHubRequest(path, token, fetchRequest, init = {}) {
  const response = await fetchRequest(`${githubApiOrigin}${path}`, {
    method: init.method || 'GET', signal: AbortSignal.timeout(15000), redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'User-Agent': 'RehabTrainerHub-game-review', 'X-GitHub-Api-Version': '2026-03-10' },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) throw new GameReviewIssueError(`GitHub request failed (${response.status}).`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024) throw new GameReviewIssueError('GitHub response exceeds the review limit.');
  try { return JSON.parse(text); }
  catch { throw new GameReviewIssueError('GitHub response is invalid.'); }
}

async function FindExistingReviewIssue(github, release, appId) {
  const marker = `<!-- trainerhub-release:${release.id} review-digest:${release.review_digest} -->`;
  for (let page = 1; page <= 10; page++) {
    const issues = await github(`/repos/${gameReviewRepository}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    if (!Array.isArray(issues)) throw new GameReviewIssueError('GitHub Issue list is invalid.');
    const issue = issues.find(candidate => !candidate.pull_request && candidate.performed_via_github_app?.id === appId
      && typeof candidate.body === 'string' && candidate.body.includes(marker));
    if (issue) return issue;
    if (issues.length < 100) return null;
  }
  throw new GameReviewIssueError('Issue reconciliation limit reached; manual reconciliation is required.');
}

function ValidateIssueIdentity(issue, appId) {
  if (!issue || issue.pull_request || !IsGameReviewIssueUrl(issue.html_url, issue.number)
    || issue.performed_via_github_app?.id !== appId
    || typeof issue.node_id !== 'string' || !issue.node_id || issue.node_id.length > 200) {
    throw new GameReviewIssueError('GitHub review Issue identity is invalid.');
  }
}

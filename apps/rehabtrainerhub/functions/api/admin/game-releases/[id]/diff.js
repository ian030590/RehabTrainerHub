import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../../../_lib/authorization.js';

const maximumDiffFiles = 100;
const maximumTextFileBytes = 128 * 1024;
const maximumTextResponseBytes = 512 * 1024;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const quarantineKeyPattern = /^quarantine\/[A-Za-z0-9._:-]{1,128}\/[A-Za-z0-9._:-]{1,128}\/[a-f0-9]{64}\/files\//;
const packagePathPattern = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Return a bounded, data-only diff between the current release submission and
 * the previous attempt for the same game/version. The endpoint never renders
 * or executes package HTML; large/binary files remain hash-only evidence.
 */
export async function onRequestGet({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);
    const releaseId = NormalizeIdentifier(params?.id);
    if (!releaseId) return ErrorResponse(request, env, 'Invalid release ID.', 400);
    const bucket = env.GAME_QUARANTINE_BUCKET;
    if (!bucket || typeof bucket.get !== 'function') {
      return ErrorResponse(request, env, 'Game quarantine storage is not configured.', 503);
    }

    const db = RequireDatabase(env);
    const current = await db
      .prepare(`
        SELECT release.id, release.game_id, release.submission_id,
               submission.attempt, submission.target_version
        FROM game_releases AS release
        INNER JOIN developer_games AS game ON game.id = release.game_id
        INNER JOIN game_submissions AS submission ON submission.id = release.submission_id
        WHERE release.id = ?
        LIMIT 1
      `)
      .bind(releaseId)
      .first();
    if (!current) return ErrorResponse(request, env, 'Game release not found.', 404);

    const previous = await db
      .prepare(`
        SELECT id, attempt
        FROM game_submissions
        WHERE game_id = ? AND target_version = ? AND attempt < ?
        ORDER BY attempt DESC
        LIMIT 1
      `)
      .bind(current.game_id, current.target_version, current.attempt)
      .first();
    const [currentFiles, previousFiles] = await Promise.all([
      ReadSubmissionFiles(db, current.submission_id),
      previous ? ReadSubmissionFiles(db, previous.id) : [],
    ]);
    const currentByPath = new Map(currentFiles.map((file) => [file.path, file]));
    const previousByPath = new Map(previousFiles.map((file) => [file.path, file]));
    const paths = [...new Set([...currentByPath.keys(), ...previousByPath.keys()])].sort();
    const changes = [];
    let truncated = paths.length > maximumDiffFiles;
    let contentBytes = 0;
    for (const path of paths.slice(0, maximumDiffFiles)) {
      const after = currentByPath.get(path) || null;
      const before = previousByPath.get(path) || null;
      const status = !before ? 'added' : !after ? 'removed' : before.sha256 === after.sha256 ? 'unchanged' : 'changed';
      if (status === 'unchanged') continue;
      const change = {
        path,
        status,
        before: CreateFileEvidence(before),
        after: CreateFileEvidence(after),
      };
      const textDiff = await ReadTextDiff(bucket, before, after, contentBytes);
      if (textDiff) {
        change.beforeText = textDiff.beforeText;
        change.afterText = textDiff.afterText;
        contentBytes += textDiff.bytes;
        if (textDiff.truncated) change.contentTruncated = true;
      }
      changes.push(change);
    }

    return JsonResponse(request, env, {
      currentAttempt: Number(current.attempt) || null,
      previousAttempt: previous ? Number(previous.attempt) || null : null,
      changes,
      truncated,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to diff game release attempts.', error);
    return ErrorResponse(request, env, 'Unable to load the release diff.', 500);
  }
}

async function ReadSubmissionFiles(db, submissionId) {
  const result = await db
    .prepare(`
      SELECT path, content_type, byte_size, sha256, quarantine_key
      FROM game_submission_files
      WHERE submission_id = ?
      ORDER BY path
      LIMIT 192
    `)
    .bind(submissionId)
    .all();
  return (result.results || []).filter((file) => (
    typeof file.path === 'string'
      && file.path.length > 0
      && file.path.length <= 256
      && packagePathPattern.test(file.path)
      && typeof file.quarantine_key === 'string'
      && quarantineKeyPattern.test(file.quarantine_key)
      && file.quarantine_key.slice(file.quarantine_key.indexOf('/files/') + '/files/'.length) === file.path
  ));
}

function CreateFileEvidence(file) {
  if (!file) return null;
  return {
    byteSize: Number(file.byte_size) || 0,
    contentType: String(file.content_type || 'application/octet-stream'),
    sha256: String(file.sha256 || ''),
  };
}

async function ReadTextDiff(bucket, before, after, contentBytes) {
  const beforeTextFile = IsTextFile(before) ? before : null;
  const afterTextFile = IsTextFile(after) ? after : null;
  if (!beforeTextFile && !afterTextFile) return null;
  const remaining = maximumTextResponseBytes - contentBytes;
  if (remaining <= 0) return { beforeText: null, afterText: null, bytes: 0, truncated: true };
  const beforeText = beforeTextFile && beforeTextFile.byte_size <= maximumTextFileBytes
    ? await ReadTextObject(bucket, beforeTextFile.quarantine_key)
    : null;
  const afterText = afterTextFile && afterTextFile.byte_size <= maximumTextFileBytes
    ? await ReadTextObject(bucket, afterTextFile.quarantine_key)
    : null;
  const beforeValue = beforeText?.text ?? null;
  const afterValue = afterText?.text ?? null;
  const bytes = (beforeText?.bytes || 0) + (afterText?.bytes || 0);
  if (bytes > remaining) {
    return { beforeText: null, afterText: null, bytes: 0, truncated: true };
  }
  return {
    beforeText: beforeValue,
    afterText: afterValue,
    bytes,
    truncated: Boolean((beforeTextFile && !beforeText) || (afterTextFile && !afterText)),
  };
}

function IsTextFile(file) {
  if (!file || Number(file.byte_size) < 0) return false;
  return /^text\//i.test(String(file.content_type || ''))
    || /\.(?:css|html?|js|json|mjs|svg|txt|xml)$/i.test(String(file.path || ''));
}

async function ReadTextObject(bucket, key) {
  if (typeof key !== 'string' || !quarantineKeyPattern.test(key)) return null;
  const object = await bucket.get(key);
  if (!object || Number.isSafeInteger(object.size) && object.size > maximumTextFileBytes) return null;
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.byteLength > maximumTextFileBytes) return null;
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      bytes: bytes.byteLength,
    };
  } catch {
    return null;
  }
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return identifierPattern.test(normalized) ? normalized : null;
}

const defaultQuarantineRetentionDays = 90;
const defaultNotificationRetentionDays = 365;
const maximumRetentionDays = 3_650;
const maximumSubmissionBatch = 100;
const maximumOrphanObjectBatch = 500;
const quarantinePrefixPattern = /^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9]{64}\/$/i;
const quarantineObjectPattern = /^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9]{64}\/(?:artifact|files\/[A-Za-z0-9._/-]+)$/i;

/**
 * Remove only old, unpublished quarantine attempts. D1 rows containing the
 * artifact hash, scan result, review decisions, and audit events remain so the
 * platform can explain what happened after the bytes are gone. The scheduler
 * or operator endpoint is the only caller; this helper has no implicit timer.
 */
export async function ReconcileGamePlatformStorage({
  db,
  quarantineBucket,
  now = new Date(),
  retentionDays = defaultQuarantineRetentionDays,
  notificationRetentionDays = defaultNotificationRetentionDays,
  maxSubmissions = maximumSubmissionBatch,
}) {
  if (!db || !quarantineBucket || typeof quarantineBucket.delete !== 'function') {
    throw new GamePlatformMaintenanceError('maintenance-storage-unavailable');
  }
  const nowDate = NormalizeDate(now);
  const normalizedRetentionDays = NormalizeRetentionDays(retentionDays);
  const normalizedNotificationRetentionDays = NormalizeRetentionDays(notificationRetentionDays);
  const normalizedMaxSubmissions = NormalizeBatchSize(maxSubmissions);
  const quarantineCutoff = new Date(nowDate.getTime() - normalizedRetentionDays * 86_400_000).toISOString();
  const notificationCutoff = new Date(
    nowDate.getTime() - normalizedNotificationRetentionDays * 86_400_000,
  ).toISOString();

  const candidates = await db
    .prepare(`
      SELECT
        submission.id,
        release.id AS release_id
      FROM game_submissions AS submission
      LEFT JOIN game_releases AS release
        ON release.submission_id = submission.id
      WHERE submission.submitted_at < ?
        AND NOT EXISTS (
          SELECT 1
          FROM game_releases AS protected_release
          WHERE protected_release.submission_id = submission.id
            AND protected_release.status IN ('approved', 'publishing', 'revoked')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM game_review_requests AS active_review
          WHERE active_review.submission_id = submission.id
            AND active_review.status IN ('requested', 'in_review')
        )
        AND (
          EXISTS (SELECT 1 FROM game_submission_files WHERE submission_id = submission.id)
          OR EXISTS (SELECT 1 FROM game_release_files WHERE release_id = release.id)
        )
      ORDER BY submission.submitted_at ASC
      LIMIT ?
    `)
    .bind(quarantineCutoff, normalizedMaxSubmissions)
    .all();

  let deletedSubmissions = 0;
  let deletedObjects = 0;
  let skippedSubmissions = 0;
  for (const candidate of candidates.results || []) {
    const keysResult = await db
      .prepare(`
        SELECT quarantine_key
        FROM game_submission_files
        WHERE submission_id = ?
        UNION
        SELECT quarantine_key
        FROM game_release_files
        WHERE release_id = ?
      `)
      .bind(candidate.id, candidate.release_id || '')
      .all();
    const keySet = new Set((keysResult.results || []).map((row) => row.quarantine_key));
    const prefix = FindSingleQuarantinePrefix(keySet);
    if (!prefix) {
      skippedSubmissions += 1;
      continue;
    }
    const keys = [...keySet, `${prefix}artifact`];
    try {
      await quarantineBucket.delete(keys);
    } catch (error) {
      skippedSubmissions += 1;
      console.warn('Unable to delete an expired game quarantine prefix.', error);
      continue;
    }

    const cleanupStatements = [
      db
        .prepare('DELETE FROM game_submission_files WHERE submission_id = ?')
        .bind(candidate.id),
    ];
    if (candidate.release_id) {
      cleanupStatements.push(
        db
          .prepare('DELETE FROM game_release_files WHERE release_id = ?')
          .bind(candidate.release_id),
      );
    }
    try {
      await db.batch(cleanupStatements);
      deletedSubmissions += 1;
      deletedObjects += keys.length;
    } catch (error) {
      // Keep the inventory rows when D1 cleanup fails. A later reconciliation
      // run can safely retry the idempotent R2 delete and the D1 transaction.
      skippedSubmissions += 1;
      console.warn('Unable to remove expired game quarantine inventory.', error);
    }
  }

  const notificationCleanup = await db
    .prepare(`
      DELETE FROM game_platform_notifications
      WHERE delivered_at IS NOT NULL
        AND delivered_at < ?
        AND id IN (
          SELECT id
          FROM game_platform_notifications
          WHERE delivered_at IS NOT NULL AND delivered_at < ?
          ORDER BY delivered_at ASC
          LIMIT ?
        )
    `)
    .bind(notificationCutoff, notificationCutoff, normalizedMaxSubmissions * 5)
    .run();

  // R2 listing is optional in local fixtures and older deployments. When it
  // is available, perform a bounded, age-gated orphan pass as part of the
  // same scheduled job. Unknown/malformed keys and protected prefixes are
  // always retained; the pass can therefore be safely retried after a
  // partial outage without turning an inventory mismatch into broad deletion.
  const orphanResult = typeof quarantineBucket.list === 'function'
    ? await ReconcileOrphanQuarantineObjects({
      db,
      quarantineBucket,
      now: nowDate,
      cutoff: quarantineCutoff,
      maxObjects: normalizedMaxSubmissions * 5,
    })
    : {
      orphanCandidates: 0,
      deletedOrphanObjects: 0,
      skippedOrphanObjects: 0,
      orphanListingTruncated: false,
    };

  return {
    quarantineCutoff,
    notificationCutoff,
    candidates: (candidates.results || []).length,
    deletedSubmissions,
    deletedObjects,
    skippedSubmissions,
    deletedNotifications: ReadChangedRows(notificationCleanup),
    ...orphanResult,
  };
}

/**
 * Reconcile R2 objects that no longer have a D1 inventory row. This is kept
 * separate from the submission-retention query so an operator can test the
 * object-key safety rules without granting the helper any write access to a
 * release bucket. Only old objects in a valid quarantine prefix are eligible.
 */
export async function ReconcileOrphanQuarantineObjects({
  db,
  quarantineBucket,
  now = new Date(),
  cutoff = undefined,
  maxObjects = maximumOrphanObjectBatch,
}) {
  if (!db || !quarantineBucket || typeof quarantineBucket.list !== 'function'
    || typeof quarantineBucket.delete !== 'function') {
    throw new GamePlatformMaintenanceError('maintenance-storage-unavailable');
  }
  const nowDate = NormalizeDate(now);
  const cutoffDate = cutoff === undefined
    ? new Date(nowDate.getTime() - defaultQuarantineRetentionDays * 86_400_000).toISOString()
    : NormalizeDate(cutoff).toISOString();
  const limit = NormalizeOrphanBatchSize(maxObjects);
  const inventory = await ReadQuarantineInventory(db);
  const protectedState = await ReadProtectedQuarantinePrefixes(db);
  // A protected/active D1 row with an invalid or incomplete identity cannot
  // be mapped to a quarantine prefix safely. Fail closed for the entire
  // orphan pass until an operator repairs the inventory instead of risking a
  // delete against bytes that may still belong to that row.
  if (protectedState.protectUnknown) {
    return {
      orphanCandidates: 0,
      deletedOrphanObjects: 0,
      skippedOrphanObjects: 0,
      orphanListingTruncated: false,
    };
  }
  const protectedPrefixes = protectedState.prefixes;

  const orphanKeys = [];
  let listingTruncated = false;
  let cursor;
  while (orphanKeys.length < limit) {
    const page = await quarantineBucket.list({
      prefix: 'quarantine/',
      limit: Math.min(1000, limit - orphanKeys.length),
      ...(cursor ? { cursor } : {}),
    });
    const objects = Array.isArray(page?.objects) ? page.objects : [];
    if (objects.length === 0 && !page?.truncated) break;
    for (const object of objects) {
      const key = typeof object?.key === 'string' ? object.key : '';
      if (!IsSafeQuarantineObjectKey(key) || inventory.has(key)) continue;
      const uploadedAt = object?.uploaded instanceof Date
        ? object.uploaded.toISOString()
        : typeof object?.uploaded === 'string'
          ? object.uploaded
          : null;
      if (!uploadedAt || Number.isNaN(Date.parse(uploadedAt)) || uploadedAt >= cutoffDate) continue;
      const prefix = GetQuarantinePrefixFromObjectKey(key);
      if (!prefix || protectedPrefixes.has(prefix)) continue;
      orphanKeys.push(key);
      if (orphanKeys.length >= limit) break;
    }
    if (!page?.truncated || !page?.cursor || orphanKeys.length >= limit) {
      listingTruncated = Boolean(page?.truncated && orphanKeys.length >= limit);
      break;
    }
    cursor = String(page.cursor);
  }

  let deleted = 0;
  let skipped = 0;
  for (let index = 0; index < orphanKeys.length; index += 128) {
    const batch = orphanKeys.slice(index, index + 128);
    try {
      await quarantineBucket.delete(batch);
      deleted += batch.length;
    } catch (error) {
      skipped += batch.length;
      console.warn('Unable to delete orphaned game quarantine objects.', error);
    }
  }
  return {
    orphanCandidates: orphanKeys.length,
    deletedOrphanObjects: deleted,
    skippedOrphanObjects: skipped,
    orphanListingTruncated: listingTruncated,
  };
}

export function IsSafeQuarantinePrefix(value) {
  return typeof value === 'string' && quarantinePrefixPattern.test(value);
}

export function IsSafeQuarantineObjectKey(value) {
  if (typeof value !== 'string' || !quarantineObjectPattern.test(value)) return false;
  if (value.includes('..') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  const filePath = value.split('/files/')[1];
  return !filePath || filePath.split('/').every((segment) => (
    segment.length > 0 && segment.length <= 100 && segment !== '.' && segment !== '..' && !segment.startsWith('.')
  ));
}

export class GamePlatformMaintenanceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'GamePlatformMaintenanceError';
    this.code = code;
  }
}

function FindSingleQuarantinePrefix(keys) {
  const prefixes = new Set();
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith('quarantine/')) return null;
    const marker = key.indexOf('/files/');
    if (marker <= 0) return null;
    const prefix = key.slice(0, marker + 1);
    if (!IsSafeQuarantinePrefix(prefix)) return null;
    if (key.includes('..') || /[\u0000-\u001f\u007f]/.test(key)) return null;
    prefixes.add(prefix);
  }
  return prefixes.size === 1 ? [...prefixes][0] : null;
}

async function ReadQuarantineInventory(db) {
  const result = await db
    .prepare(`
      SELECT quarantine_key AS key FROM game_submission_files
      UNION
      SELECT quarantine_key AS key FROM game_release_files
    `)
    .all();
  return new Set((result.results || []).map((row) => row.key).filter(IsSafeQuarantineObjectKey));
}

async function ReadProtectedQuarantinePrefixes(db) {
  const protectedRows = await db
    .prepare(`
      SELECT submission.owner_user_id,
             submission.artifact_sha256,
             release.id AS release_id
      FROM game_submissions AS submission
      INNER JOIN game_releases AS release ON release.submission_id = submission.id
      WHERE release.status IN ('approved', 'publishing', 'revoked')
    `)
    .all();
  const activeRows = await db
    .prepare(`
      SELECT submission.owner_user_id,
             submission.artifact_sha256,
             release.id AS release_id
      FROM game_review_requests AS review
      INNER JOIN game_submissions AS submission ON submission.id = review.submission_id
      LEFT JOIN game_releases AS release ON release.submission_id = submission.id
      WHERE review.status IN ('requested', 'in_review')
    `)
    .all();
  const prefixes = new Set();
  let protectUnknown = false;
  for (const row of [...(protectedRows.results || []), ...(activeRows.results || [])]) {
    const prefix = BuildQuarantinePrefix(row);
    if (prefix) prefixes.add(prefix);
    else protectUnknown = true;
  }
  return { prefixes, protectUnknown };
}

function BuildQuarantinePrefix(row) {
  if (!row || typeof row.owner_user_id !== 'string' || typeof row.release_id !== 'string'
    || typeof row.artifact_sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.artifact_sha256)) return null;
  const prefix = `quarantine/${row.owner_user_id}/${row.release_id}/${row.artifact_sha256.toLowerCase()}/`;
  return IsSafeQuarantinePrefix(prefix) ? prefix : null;
}

function GetQuarantinePrefixFromObjectKey(key) {
  const marker = key.indexOf('/files/');
  if (marker > 0) return `${key.slice(0, marker)}/`;
  if (key.endsWith('/artifact')) return `${key.slice(0, -'/artifact'.length)}/`;
  return null;
}

function NormalizeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Maintenance date is invalid.');
  return date;
}

function NormalizeRetentionDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > maximumRetentionDays) {
    throw new TypeError('Maintenance retention days are invalid.');
  }
  return days;
}

function NormalizeBatchSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > maximumSubmissionBatch) {
    throw new TypeError('Maintenance batch size is invalid.');
  }
  return size;
}

function NormalizeOrphanBatchSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > maximumOrphanObjectBatch) {
    throw new TypeError('Maintenance orphan batch size is invalid.');
  }
  return size;
}

function ReadChangedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

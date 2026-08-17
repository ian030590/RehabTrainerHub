import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../../_lib/auth.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
} from '../../../_lib/authorization.js';
import { ReadJsonBody } from '../../../_lib/request.js';

const maximumReviewBodyBytes = 8 * 1024;
const maximumReleaseManifestBytes = 512 * 1024;
const immutableCacheControl = 'public, max-age=31536000, immutable';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPut({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);
    const body = await ReadJsonBody(request, maximumReviewBodyBytes);
    if (!body.ok) return ErrorResponse(request, env, 'Invalid review payload.', 400);
    const decision = body.value?.decision;
    const note = NormalizeReviewNote(body.value?.note);
    const sourceReviewed = body.value?.sourceReviewed === true;
    const playTested = body.value?.playTested === true;
    const metadataReviewed = body.value?.metadataReviewed === true;
    if (!['approve', 'reject', 'revoke'].includes(decision) || note === null) {
      return ErrorResponse(request, env, 'Invalid review decision.', 400);
    }
    if (decision === 'approve' && (!sourceReviewed || !playTested || !metadataReviewed)) {
      return ErrorResponse(request, env, 'Source review, public metadata review, and an isolated play test are required.', 400);
    }
    if (decision === 'revoke' && !note) {
      return ErrorResponse(request, env, 'A revocation reason is required.', 400);
    }

    const db = RequireDatabase(env);
    const release = await db
      .prepare(`
        SELECT
          game_releases.*,
          developer_games.slug,
          game_releases.submitted_title AS title,
          game_releases.submitted_summary AS summary,
          game_releases.submitted_category AS category
        FROM game_releases
        INNER JOIN developer_games ON developer_games.id = game_releases.game_id
        WHERE game_releases.id = ?
        LIMIT 1
      `)
      .bind(String(params.id || ''))
      .first();
    if (!release) return ErrorResponse(request, env, 'Game release not found.', 404);
    if (decision === 'revoke') {
      if (release.status !== 'approved') {
        return ErrorResponse(request, env, 'Only an approved release can be revoked.', 409);
      }
      if (!env.GAME_RELEASE_BUCKET?.get || !env.GAME_RELEASE_BUCKET?.put) {
        return ErrorResponse(request, env, 'Game release storage is not configured.', 503);
      }
      const revoked = await RevokeApprovedRelease(db, env.GAME_RELEASE_BUCKET, release, user, note);
      if (!revoked) {
        return ErrorResponse(request, env, 'The release changed while it was being revoked.', 409);
      }
      return JsonResponse(request, env, { release: { id: release.id, status: 'revoked' } });
    }
    if (decision === 'reject') {
      if (release.status === 'approved' || release.status === 'publishing') {
        return ErrorResponse(request, env, 'A publishing or approved immutable release cannot be rejected.', 409);
      }
      const rejected = await UpdateRejectedRelease(db, release, user, note);
      if (!rejected) {
        return ErrorResponse(request, env, 'The release changed while it was being reviewed.', 409);
      }
      return JsonResponse(request, env, { release: { id: release.id, status: 'rejected' } });
    }
    if (release.status === 'blocked') {
      return ErrorResponse(request, env, 'A release with blocking scan findings cannot be approved.', 409);
    }
    if (!['pending_review', 'publishing'].includes(release.status)) {
      return ErrorResponse(request, env, 'This release is not awaiting approval.', 409);
    }
    if (
      !env.GAME_QUARANTINE_BUCKET?.get
      || !env.GAME_RELEASE_BUCKET?.get
      || !env.GAME_RELEASE_BUCKET?.put
    ) {
      return ErrorResponse(request, env, 'Game release storage is not configured.', 503);
    }

    const publicationLeaseId = await ClaimReleaseForPublishing(db, release.id, user.id, note);
    if (!publicationLeaseId) {
      return ErrorResponse(request, env, 'This release is already being published. Retry after ten minutes.', 409);
    }
    release.status = 'publishing';

    const fileRows = await db
      .prepare(`
        SELECT path, content_type, byte_size, sha256, quarantine_key
        FROM game_release_files
        WHERE release_id = ?
        ORDER BY path
      `)
      .bind(release.id)
      .all();
    const files = fileRows.results || [];
    if (files.length !== release.file_count || files.length === 0) {
      return ErrorResponse(request, env, 'Release file inventory does not match the reviewed package.', 409);
    }
    const releasePrefix = `releases/${release.slug}/${release.version}`;
    for (const file of files) {
      const source = await env.GAME_QUARANTINE_BUCKET.get(file.quarantine_key);
      if (!source) throw new Error(`Missing quarantine object: ${file.quarantine_key}`);
      const bytes = new Uint8Array(await source.arrayBuffer());
      if (bytes.byteLength !== file.byte_size || await Sha256Hex(bytes) !== file.sha256) {
        return ErrorResponse(request, env, 'A quarantined file changed after scanning.', 409);
      }
      const releaseFileKey = `${releasePrefix}/files/${file.path}`;
      const publishedFile = await env.GAME_RELEASE_BUCKET.put(
        releaseFileKey,
        bytes,
        {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: {
            cacheControl: immutableCacheControl,
            contentType: file.content_type,
          },
          customMetadata: {
            releaseId: release.id,
            sha256: file.sha256,
          },
        },
      );
      if (!publishedFile) {
        const existingFile = await env.GAME_RELEASE_BUCKET.get(releaseFileKey);
        if (!existingFile
          || existingFile.size !== file.byte_size
          || existingFile.customMetadata?.sha256 !== file.sha256) {
          return ErrorResponse(request, env, 'An immutable release file already exists with different metadata.', 409);
        }
        const existingBytes = new Uint8Array(await existingFile.arrayBuffer());
        if (await Sha256Hex(existingBytes) !== file.sha256) {
          return ErrorResponse(request, env, 'An immutable release file already exists with different content.', 409);
        }
      }
    }

    const now = new Date().toISOString();
    const releaseManifest = CreateReleaseManifest(release, files, now, 'staging');
    const manifestKey = `${releasePrefix}/release.json`;
    const manifestPublished = await PublishReleaseManifest(
      env.GAME_RELEASE_BUCKET,
      manifestKey,
      releaseManifest,
      release,
    );
    if (!manifestPublished) {
      return ErrorResponse(
        request,
        env,
        'The release pointer changed during publication. Reload before retrying.',
        409,
      );
    }
    const publicationResults = await db.batch([
      db
        .prepare(`
          UPDATE game_releases
          SET status = 'approved', reviewer_user_id = ?, review_note = ?,
              reviewed_at = ?, updated_at = ?
          WHERE id = ? AND status = 'publishing' AND publication_lease_id = ?
        `)
        .bind(user.id, note || null, now, now, release.id, publicationLeaseId),
      db
        .prepare(`
          UPDATE developer_games
          SET developer_display_name = ?, title = ?, summary = ?, category = ?,
              status = 'published', active_release_id = ?, updated_at = ?
          WHERE id = ?
            AND EXISTS (
              SELECT 1 FROM game_releases
              WHERE game_releases.id = ?
                AND game_releases.game_id = developer_games.id
                AND game_releases.status = 'approved'
                AND game_releases.publication_lease_id = ?
            )
        `)
        .bind(
          release.submitted_developer_name,
          release.title,
          release.summary,
          release.category,
          release.id,
          now,
          release.game_id,
          release.id,
          publicationLeaseId,
        ),
      CreateConditionalPublicationAuditStatement(db, {
        actorUserId: user.id,
        action: 'developer_game.approve',
        targetType: 'game_release',
        targetId: release.id,
        metadata: {
          contentSha256: release.content_sha256,
          gameId: release.game_id,
          slug: release.slug,
          version: release.version,
          sourceReviewed,
          playTested,
          metadataReviewed,
        },
      }, release.id, publicationLeaseId),
    ]);
    if (ReadChangedRows(publicationResults[0]) !== 1
      || ReadChangedRows(publicationResults[1]) !== 1
      || ReadChangedRows(publicationResults[2]) !== 1) {
      return ErrorResponse(request, env, 'The release changed before publication completed.', 409);
    }
    return JsonResponse(request, env, {
      release: {
        id: release.id,
        status: 'approved',
        gameId: release.game_id,
        slug: release.slug,
        version: release.version,
        contentSha256: release.content_sha256,
      },
    });
  } catch (error) {
    console.error('Unable to review a game release.', error);
    return ErrorResponse(request, env, 'Unable to review the game release.', 500);
  }
}

async function RevokeApprovedRelease(db, bucket, release, user, note) {
  const now = new Date().toISOString();
  const manifestKey = `releases/${release.slug}/${release.version}/release.json`;
  const currentPointer = await ReadReleaseManifest(bucket, manifestKey);
  if (!currentPointer || !IsMatchingReleasePointer(currentPointer.manifest, release)) return false;
  if (currentPointer.manifest.status !== 'revoked') {
    if (currentPointer.manifest.status !== 'approved') return false;
    const revokedObject = await PutReleaseManifest(bucket, manifestKey, {
      schemaVersion: 1,
      status: 'revoked',
      gameId: release.slug,
      version: release.version,
      contentSha256: release.content_sha256,
      revokedAt: now,
    }, { etagMatches: currentPointer.etag });
    if (!revokedObject) return false;
  }
  const results = await db.batch([
    db
      .prepare(`
        UPDATE game_releases
        SET status = 'revoked', reviewer_user_id = ?, review_note = ?,
            reviewed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'approved'
      `)
      .bind(user.id, note, now, now, release.id),
    db
      .prepare(`
        UPDATE developer_games
        SET status = 'draft', active_release_id = NULL, updated_at = ?
        WHERE id = ? AND active_release_id = ?
      `)
      .bind(now, release.game_id, release.id),
    CreateAdminAuditStatement(db, {
      actorUserId: user.id,
      action: 'developer_game.revoke',
      targetType: 'game_release',
      targetId: release.id,
      metadata: {
        contentSha256: release.content_sha256,
        gameId: release.game_id,
        note,
        slug: release.slug,
        version: release.version,
      },
    }),
  ]);
  return ReadChangedRows(results[0]) === 1;
}

async function UpdateRejectedRelease(db, release, user, note) {
  const now = new Date().toISOString();
  const results = await db.batch([
    db
      .prepare(`
        UPDATE game_releases
        SET status = 'rejected', reviewer_user_id = ?, review_note = ?,
            reviewed_at = ?, updated_at = ?
        WHERE id = ? AND status IN ('blocked', 'pending_review', 'rejected')
      `)
      .bind(user.id, note || null, now, now, release.id),
    CreateAdminAuditStatement(db, {
      actorUserId: user.id,
      action: 'developer_game.reject',
      targetType: 'game_release',
      targetId: release.id,
      metadata: {
        contentSha256: release.content_sha256,
        gameId: release.game_id,
        note: note || undefined,
        version: release.version,
      },
    }),
  ]);
  return ReadChangedRows(results[0]) === 1;
}

async function ClaimReleaseForPublishing(db, releaseId, reviewerUserId, note) {
  const now = new Date().toISOString();
  const expiredLease = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const publicationLeaseId = crypto.randomUUID();
  const result = await db
    .prepare(`
      UPDATE game_releases
      SET status = 'publishing', publication_lease_id = ?, reviewer_user_id = ?,
          review_note = ?, updated_at = ?
      WHERE id = ?
        AND (
          status = 'pending_review'
          OR (status = 'publishing' AND updated_at < ?)
        )
    `)
    .bind(publicationLeaseId, reviewerUserId, note || null, now, releaseId, expiredLease)
    .run();
  return ReadChangedRows(result) === 1 ? publicationLeaseId : null;
}

function ReadChangedRows(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? 0);
}

function CreateConditionalPublicationAuditStatement(db, event, releaseId, publicationLeaseId) {
  const metadataJson = JSON.stringify(event.metadata ?? null);
  return db
    .prepare(`
      INSERT INTO admin_audit_events (
        id, actor_user_id, action, target_type, target_id, metadata_json, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM game_releases
        WHERE id = ? AND status = 'approved' AND publication_lease_id = ?
      )
    `)
    .bind(
      crypto.randomUUID(),
      event.actorUserId,
      event.action,
      event.targetType,
      event.targetId,
      metadataJson,
      new Date().toISOString(),
      releaseId,
      publicationLeaseId,
    );
}

function CreateReleaseManifest(release, files, approvedAt, status) {
  return {
    schemaVersion: 1,
    status,
    gameId: release.slug,
    version: release.version,
    name: release.title,
    shortName: release.title.slice(0, 30).replace(/[\uD800-\uDBFF]$/, ''),
    description: release.summary,
    entry: release.entry_path,
    files: files.map((file) => ({
      path: file.path,
      size: file.byte_size,
      sha256: file.sha256,
      contentType: file.content_type,
    })),
    runtime: {
      name: 'jspsych',
      major: 8,
    },
    capabilities: SafeJson(release.capabilities_json, []),
    contentSha256: release.content_sha256,
    approvedAt,
  };
}

async function PublishReleaseManifest(bucket, key, stagingManifest, release) {
  const currentPointer = await ReadReleaseManifest(bucket, key);
  if (currentPointer) {
    if (!IsMatchingReleasePointer(currentPointer.manifest, release)) return false;
    if (currentPointer.manifest.status === 'approved') return true;
    if (currentPointer.manifest.status !== 'staging') return false;
  }

  const stagingObject = await PutReleaseManifest(
    bucket,
    key,
    stagingManifest,
    currentPointer
      ? { etagMatches: currentPointer.etag }
      : { etagDoesNotMatch: '*' },
  );
  const stagingEtag = ReadObjectEtag(stagingObject);
  if (!stagingEtag) return false;

  const approvedManifest = { ...stagingManifest, status: 'approved' };
  return Boolean(await PutReleaseManifest(
    bucket,
    key,
    approvedManifest,
    { etagMatches: stagingEtag },
  ));
}

async function ReadReleaseManifest(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  const etag = ReadObjectEtag(object);
  if (!etag
    || (Number.isSafeInteger(object.size)
      && (object.size < 2 || object.size > maximumReleaseManifestBytes))) {
    return null;
  }
  try {
    const source = await object.text();
    if (new TextEncoder().encode(source).byteLength > maximumReleaseManifestBytes) return null;
    const manifest = JSON.parse(source);
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
    return { etag, manifest };
  } catch {
    return null;
  }
}

function IsMatchingReleasePointer(manifest, release) {
  return manifest.schemaVersion === 1
    && manifest.gameId === release.slug
    && manifest.version === release.version
    && manifest.contentSha256 === release.content_sha256;
}

function ReadObjectEtag(object) {
  if (!object || typeof object !== 'object') return null;
  if (typeof object.etag === 'string' && object.etag) return object.etag;
  if (typeof object.httpEtag !== 'string') return null;
  return object.httpEtag.replace(/^W\//, '').replace(/^"|"$/g, '') || null;
}

async function PutReleaseManifest(bucket, key, manifest, onlyIf) {
  try {
    return await bucket.put(key, JSON.stringify(manifest), {
      ...(onlyIf ? { onlyIf } : {}),
      httpMetadata: {
        cacheControl: 'no-cache, no-store, must-revalidate',
        contentType: 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    if (onlyIf && (error?.code === 10031 || /precondition/i.test(String(error)))) return null;
    throw error;
  }
}

function NormalizeReviewNote(value) {
  const note = String(value || '').trim();
  return note.length <= 2000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note)
    ? note
    : null;
}

function SafeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

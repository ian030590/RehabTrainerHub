import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
} from '../../_lib/authorization.js';
import {
  GamePackageError,
  InspectGamePackage,
  NormalizeGameCapabilities,
  NormalizeGameSlug,
  NormalizeGameVersion,
  gameValidationIntakePolicy,
  gamePackageLimits,
  gamePackageRuntimeContract,
} from '../../_lib/gamePackages.js';

const maximumMultipartBytes = gamePackageLimits.maximumCompressedBytes + 128 * 1024;
// Theme IDs are registry-owned Hub labels. Keep the API forward-compatible
// with newly registered labels while still accepting only bounded slug data.
const categoryPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const rows = await RequireDatabase(env)
      .prepare(`
        SELECT
          developer_games.id,
          developer_games.slug,
          developer_games.developer_display_name,
          developer_games.title,
          developer_games.summary,
          developer_games.category,
          developer_games.status,
          developer_games.active_release_id,
          developer_games.created_at,
          developer_games.updated_at,
          game_releases.id AS release_id,
          game_releases.version,
          game_releases.submitted_developer_name,
          game_releases.submitted_title,
          game_releases.submitted_summary,
          game_releases.submitted_category,
          game_releases.status AS release_status,
          game_releases.content_sha256,
          game_releases.package_bytes,
          game_releases.uncompressed_bytes,
          game_releases.file_count,
          game_releases.submission_id,
          game_releases.scan_summary_json,
          (
            SELECT latest_review.status
            FROM game_review_requests AS latest_review
            WHERE latest_review.submission_id = game_releases.submission_id
            ORDER BY latest_review.updated_at DESC
            LIMIT 1
          ) AS validation_review_status,
          COALESCE((
            SELECT json_group_array(json_object(
              'id', finding.id,
              'disposition', finding.disposition,
              'code', finding.code,
              'filePath', finding.file_path,
              'line', finding.line_number,
              'column', finding.column_number,
              'messageKey', finding.message_key
            ))
            FROM game_validation_findings AS finding
            INNER JOIN game_scan_runs AS finding_run
              ON finding_run.id = finding.scan_run_id
            WHERE finding_run.submission_id = game_releases.submission_id
              AND finding_run.attempt = (
                SELECT MAX(latest.attempt)
                FROM game_scan_runs AS latest
                WHERE latest.submission_id = game_releases.submission_id
              )
          ), '[]') AS validation_findings_json,
          game_releases.review_note,
          game_releases.submitted_at,
          game_releases.reviewed_at
        FROM developer_games
        LEFT JOIN game_releases ON game_releases.game_id = developer_games.id
        WHERE developer_games.owner_user_id = ?
        ORDER BY COALESCE(game_releases.created_at, developer_games.created_at) DESC
        LIMIT 200
      `)
      .bind(user.id)
      .all();
    return JsonResponse(request, env, { games: GroupDeveloperGames(rows.results || []) });
  } catch (error) {
    console.error('Unable to list developer games.', error);
    return ErrorResponse(request, env, 'Unable to load developer games.', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  let quarantineCleanup = null;
  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const rateLimitError = await RateLimitResponse(request, env, 'developer-game-upload', {
      identity: user.id,
      identityOnly: true,
      limit: 8,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data')) {
      return ErrorResponse(request, env, 'Expected multipart form data.', 415);
    }
    const contentLength = Number(request.headers.get('Content-Length'));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maximumMultipartBytes) {
      return ErrorResponse(request, env, 'The upload must not exceed 12 MB.', 413);
    }
    const quarantineBucket = env.GAME_QUARANTINE_BUCKET;
    if (!quarantineBucket || typeof quarantineBucket.put !== 'function') {
      return ErrorResponse(request, env, 'Game quarantine storage is not configured.', 503);
    }

    const formData = await request.formData();
    const input = NormalizeSubmissionInput(formData);
    if (!input) return ErrorResponse(request, env, 'Invalid game submission metadata.', 400);
    const inspection = await InspectGamePackage(formData.get('package'));
    const db = RequireDatabase(env);
    const existingGame = await db
      .prepare('SELECT id, owner_user_id FROM developer_games WHERE slug = ? LIMIT 1')
      .bind(input.slug)
      .first();
    if (existingGame && existingGame.owner_user_id !== user.id) {
      return ErrorResponse(request, env, 'This game slug is already in use.', 409);
    }
    const gameId = existingGame?.id || crypto.randomUUID();
    const existingRelease = await db
      .prepare('SELECT id FROM game_releases WHERE game_id = ? AND version = ? LIMIT 1')
      .bind(gameId, input.version)
      .first();
    if (existingRelease) return ErrorResponse(request, env, 'This game version already exists.', 409);

    const releaseId = crypto.randomUUID();
    const submissionId = crypto.randomUUID();
    const scanRunId = crypto.randomUUID();
    const jobNonce = crypto.randomUUID();
    const quarantinePrefix = `quarantine/${user.id}/${releaseId}/${inspection.contentSha256}`;
    quarantineCleanup = {
      bucket: quarantineBucket,
      keys: [
        `${quarantinePrefix}/artifact`,
        ...inspection.files.map((file) => `${quarantinePrefix}/files/${file.path}`),
      ],
    };
    await quarantineBucket.put(
      `${quarantinePrefix}/artifact`,
      inspection.packageData,
      {
        httpMetadata: { contentType: 'application/octet-stream' },
        customMetadata: {
          contentSha256: inspection.contentSha256,
          releaseId,
          uploadedBy: user.id,
        },
      },
    );
    await PutFilesInBatches(
      quarantineBucket,
      inspection.files,
      quarantinePrefix,
      {
        gameId,
        releaseId,
        uploadedBy: user.id,
      },
    );
    const now = new Date().toISOString();
    const releaseStatus = inspection.blockCount > 0 ? 'blocked' : 'pending_review';
    const publicFiles = inspection.files.map((file) => ({
      path: file.path,
      byteSize: file.byteSize,
      contentType: file.contentType,
      sha256: file.sha256,
    }));
    const scanSummary = {
      blockCount: inspection.blockCount,
      reviewCount: inspection.reviewCount,
      findingCodes: [...new Set(inspection.findings.map((finding) => finding.code))],
    };
    const scanStatus = inspection.blockCount > 0 ? 'flagged' : 'passed';
    const scanEvidence = {
      schemaVersion: 1,
      submissionId,
      scanRunId,
      artifactSha256: inspection.contentSha256,
      policyVersion: gameValidationIntakePolicy.policyVersion,
      findings: inspection.findings.map((finding) => ({
        code: finding.code,
        filePath: finding.filePath || null,
        severity: finding.severity,
      })),
    };
    const reportSha256 = await Sha256Hex(
      new TextEncoder().encode(JSON.stringify(scanEvidence)),
    );
    const statements = [];
    if (!existingGame) {
      statements.push(db
        .prepare(`
          INSERT INTO developer_games (
            id, slug, owner_user_id, developer_display_name,
            title, summary, category, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        `)
        .bind(
          gameId,
          input.slug,
          user.id,
          input.developerName,
          input.title,
          input.summary,
          input.category,
          now,
          now,
        ));
    }
    // Insert the submission before the release row because the migration adds
    // a foreign key from game_releases.submission_id to game_submissions.id.
    statements.push(db
      .prepare(`
        INSERT INTO game_submissions (
          id, game_id, owner_user_id, target_version, artifact_type,
          entry_path, artifact_sha256, package_bytes,
          submitted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        submissionId,
        gameId,
        user.id,
        input.version,
        inspection.artifactType,
        inspection.entryPath,
        inspection.contentSha256,
        inspection.packageBytes,
        now,
        now,
        now,
      ));
    statements.push(db
      .prepare(`
        INSERT INTO game_releases (
          id, game_id, version,
          submitted_developer_name, submitted_title, submitted_summary, submitted_category,
          artifact_type, entry_path, status,
          content_sha256, package_bytes, uncompressed_bytes, file_count,
          submission_id,
          jspsych_version, capabilities_json, files_json, scan_summary_json,
          submitted_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        releaseId,
        gameId,
        input.version,
        input.developerName,
        input.title,
        input.summary,
        input.category,
        inspection.artifactType,
        inspection.entryPath,
        releaseStatus,
        inspection.contentSha256,
        inspection.packageBytes,
        inspection.totalBytes,
        inspection.files.length,
        submissionId,
        input.jsPsychVersion,
        JSON.stringify(input.capabilities),
        JSON.stringify(publicFiles),
        JSON.stringify(scanSummary),
        now,
        now,
        now,
      ));
    statements.push(db
      .prepare(`
        INSERT INTO game_scan_runs (
          id, submission_id, attempt, job_nonce, artifact_sha256,
          policy_version, limits_profile, status, tool_versions_json,
          report_sha256, queued_at, started_at, completed_at, created_at, updated_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        scanRunId,
        submissionId,
        jobNonce,
        inspection.contentSha256,
        gameValidationIntakePolicy.policyVersion,
        gameValidationIntakePolicy.limitsProfile,
        scanStatus,
        JSON.stringify(gameValidationIntakePolicy.toolVersions),
        reportSha256,
        now,
        now,
        now,
        now,
        now,
      ));
    inspection.files.forEach((file) => {
      statements.push(db
        .prepare(`
          INSERT INTO game_release_files (
            release_id, path, content_type, byte_size, sha256, quarantine_key
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          releaseId,
          file.path,
          file.contentType,
          file.byteSize,
          file.sha256,
          `${quarantinePrefix}/files/${file.path}`,
        ));
      statements.push(db
        .prepare(`
          INSERT INTO game_submission_files (
            submission_id, path, content_type, byte_size, sha256, quarantine_key
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          submissionId,
          file.path,
          file.contentType,
          file.byteSize,
          file.sha256,
          `${quarantinePrefix}/files/${file.path}`,
        ));
    });
    inspection.findings.forEach((finding) => {
      statements.push(db
        .prepare(`
          INSERT INTO game_scan_findings (
            id, release_id, severity, code, file_path, message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          releaseId,
          finding.severity,
          finding.code,
          finding.filePath || null,
          finding.message,
          now,
        ));
      statements.push(db
        .prepare(`
          INSERT INTO game_validation_findings (
            id, scan_run_id, disposition, code, file_path,
            line_number, column_number, message_key, evidence_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          scanRunId,
          MapFindingDisposition(finding.severity),
          finding.code,
          finding.filePath || null,
          finding.line || null,
          finding.column || null,
          finding.message,
          JSON.stringify({ severity: finding.severity }),
          now,
        ));
    });
    statements.push(CreateAdminAuditStatement(db, {
      actorUserId: user.id,
      action: 'developer_game.submit',
      targetType: 'game_release',
      targetId: releaseId,
      metadata: {
        contentSha256: inspection.contentSha256,
        fileCount: inspection.files.length,
        gameId,
        reportSha256,
        scanRunId,
        status: releaseStatus,
        submissionId,
        version: input.version,
      },
    }));
    await db.batch(statements);
    quarantineCleanup = null;

    return JsonResponse(request, env, {
      game: {
        id: gameId,
        slug: input.slug,
        title: input.title,
      },
      release: {
        id: releaseId,
        submissionId,
        scanRunId,
        version: input.version,
        status: releaseStatus,
        contentSha256: inspection.contentSha256,
        fileCount: inspection.files.length,
        packageBytes: inspection.packageBytes,
        uncompressedBytes: inspection.totalBytes,
        scan: scanSummary,
        findings: inspection.findings,
      },
    }, { status: 201 });
  } catch (error) {
    if (quarantineCleanup) await DeleteQuarantineObjectsBestEffort(quarantineCleanup);
    if (error instanceof GamePackageError) {
      return ErrorResponse(request, env, error.message, 400);
    }
    if (/UNIQUE|developer_games\.slug|game_releases\.game_id/i.test(String(error))) {
      return ErrorResponse(request, env, 'This game or version already exists.', 409);
    }
    console.error('Unable to submit a developer game.', error);
    return ErrorResponse(request, env, 'Unable to submit the game package.', 500);
  }
}

function MapFindingDisposition(severity) {
  if (severity === 'block') return 'hard-block';
  if (severity === 'review') return 'fix-or-manual-review';
  return 'info';
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function DeleteQuarantineObjectsBestEffort({ bucket, keys }) {
  if (typeof bucket?.delete !== 'function' || keys.length === 0) return;
  try {
    for (let index = 0; index < keys.length; index += 128) {
      await bucket.delete(keys.slice(index, index + 128));
    }
  } catch (error) {
    console.warn('Unable to remove orphaned game quarantine objects.', error);
  }
}

function NormalizeSubmissionInput(formData) {
  const slug = NormalizeGameSlug(formData.get('slug'));
  const version = NormalizeGameVersion(formData.get('version'));
  const title = NormalizeText(formData.get('title'), 2, 120);
  const developerName = NormalizeText(formData.get('developerName'), 2, 80);
  const summary = NormalizeText(formData.get('summary'), 0, 500);
  const category = String(formData.get('category') || 'general').trim();
  const capabilities = NormalizeGameCapabilities(formData.get('capabilities') || '[]');
  const jsPsychVersion = String(formData.get('jsPsychVersion') || '').trim();
  if (
    !slug
    || !version
    || !title
    || !developerName
    || summary === null
    || !categoryPattern.test(category)
    || !capabilities
    || jsPsychVersion !== gamePackageRuntimeContract.jsPsychVersion
  ) {
    return null;
  }
  return { capabilities, category, developerName, jsPsychVersion, slug, summary, title, version };
}

function NormalizeText(value, minimumLength, maximumLength) {
  const text = String(value || '').trim();
  return text.length >= minimumLength
    && text.length <= maximumLength
    && !/[\u0000-\u001f\u007f]/.test(text)
    ? text
    : null;
}

async function PutFilesInBatches(bucket, files, prefix, metadata) {
  const batchSize = 12;
  for (let index = 0; index < files.length; index += batchSize) {
    await Promise.all(files.slice(index, index + batchSize).map((file) => bucket.put(
      `${prefix}/files/${file.path}`,
      file.bytes,
      {
        httpMetadata: { contentType: file.contentType },
        customMetadata: {
          ...metadata,
          sha256: file.sha256,
        },
      },
    )));
  }
}

function GroupDeveloperGames(rows) {
  const games = new Map();
  rows.forEach((row) => {
    let game = games.get(row.id);
    if (!game) {
      game = {
        id: row.id,
        slug: row.slug,
        developerName: row.submitted_developer_name || row.developer_display_name,
        title: row.submitted_title || row.title,
        summary: row.submitted_summary ?? row.summary,
        category: row.submitted_category || row.category,
        status: row.status,
        activeReleaseId: row.active_release_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        releases: [],
      };
      games.set(row.id, game);
    }
    if (row.release_id) {
      game.releases.push({
        id: row.release_id,
        version: row.version,
        status: row.release_status,
        contentSha256: row.content_sha256,
        packageBytes: row.package_bytes,
        uncompressedBytes: row.uncompressed_bytes,
        fileCount: row.file_count,
        submissionId: row.submission_id || null,
        scan: SafeJson(row.scan_summary_json, {}),
        manualReviewStatus: row.validation_review_status || null,
        findings: SafeArrayJson(row.validation_findings_json),
        reviewNote: row.review_note,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
      });
    }
  });
  return [...games.values()];
}

function SafeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function SafeArrayJson(value) {
  const parsed = SafeJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

import {
  CorsHeaders,
  ErrorResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  SecurityHeaders,
} from '../../../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../../../_lib/authorization.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (user.role !== 'admin') return ErrorResponse(request, env, 'Forbidden.', 403);
    if (!env.GAME_QUARANTINE_BUCKET?.get) {
      return ErrorResponse(request, env, 'Game quarantine storage is not configured.', 503);
    }

    const release = await RequireDatabase(env)
      .prepare(`
        SELECT
          game_releases.id,
          game_releases.version,
          game_releases.artifact_type,
          game_releases.package_bytes,
          game_releases.content_sha256,
          developer_games.slug,
          (
            SELECT quarantine_key
            FROM game_release_files
            WHERE game_release_files.release_id = game_releases.id
            ORDER BY path
            LIMIT 1
          ) AS quarantine_key
        FROM game_releases
        INNER JOIN developer_games ON developer_games.id = game_releases.game_id
        WHERE game_releases.id = ?
        LIMIT 1
      `)
      .bind(String(params.id || ''))
      .first();
    if (!release) return ErrorResponse(request, env, 'Game release not found.', 404);
    const marker = '/files/';
    const markerIndex = String(release.quarantine_key || '').indexOf(marker);
    if (markerIndex < 1) return ErrorResponse(request, env, 'Review artifact is unavailable.', 404);
    const prefix = release.quarantine_key.slice(0, markerIndex);
    if (!/^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9]{64}$/.test(prefix)) {
      return ErrorResponse(request, env, 'Review artifact path is invalid.', 409);
    }
    const artifact = await env.GAME_QUARANTINE_BUCKET.get(`${prefix}/artifact`);
    if (!artifact
      || artifact.size !== release.package_bytes
      || artifact.customMetadata?.contentSha256 !== release.content_sha256) {
      return ErrorResponse(request, env, 'Review artifact is unavailable.', 404);
    }
    const bytes = new Uint8Array(await artifact.arrayBuffer());
    if (await Sha256Hex(bytes) !== release.content_sha256) {
      return ErrorResponse(request, env, 'Review artifact integrity check failed.', 409);
    }
    const extension = release.artifact_type === 'zip' ? 'zip' : 'html';
    const filename = `${release.slug}-${release.version}.${extension}`;
    return new Response(bytes, {
      status: 200,
      headers: {
        ...CorsHeaders(request, env),
        ...SecurityHeaders({
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(bytes.byteLength),
          'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox",
          'Content-Type': 'application/octet-stream',
        }),
      },
    });
  } catch (error) {
    console.error('Unable to download a game review artifact.', error);
    return ErrorResponse(request, env, 'Unable to download the review artifact.', 500);
  }
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

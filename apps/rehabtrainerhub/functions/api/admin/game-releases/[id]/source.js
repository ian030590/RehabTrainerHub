import {
  CorsHeaders,
  ErrorResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  SecurityHeaders,
} from '../../../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../../../_lib/authorization.js';

const maximumSourceBytes = 512 * 1024;
const sourcePathPattern = /^(?!\.)(?:[^/\\\u0000-\u001f\u007f]+\/)*[^/\\\u0000-\u001f\u007f]+$/;
const textContentPattern = /^(?:text\/|application\/(?:javascript|json|xml)|image\/svg\+xml)/i;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

/**
 * Return one quarantined source file as text only. The endpoint is deliberately
 * separate from artifact download: browsers can inspect the response, but the
 * response can never be interpreted as executable HTML/JavaScript.
 */
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

    const path = NormalizeSourcePath(new URL(request.url).searchParams.get('path'));
    if (!path) return ErrorResponse(request, env, 'Invalid source path.', 400);
    const releaseId = NormalizeIdentifier(params?.id);
    if (!releaseId) return ErrorResponse(request, env, 'Invalid release ID.', 400);

    const file = await RequireDatabase(env)
      .prepare(`
        SELECT
          game_release_files.path,
          game_release_files.content_type,
          game_release_files.byte_size,
          game_release_files.sha256,
          game_release_files.quarantine_key
        FROM game_release_files
        INNER JOIN game_releases
          ON game_releases.id = game_release_files.release_id
        WHERE game_release_files.release_id = ?
          AND game_release_files.path = ?
        LIMIT 1
      `)
      .bind(releaseId, path)
      .first();
    if (!file) return ErrorResponse(request, env, 'Source file not found.', 404);
    if (!textContentPattern.test(String(file.content_type || ''))) {
      return ErrorResponse(request, env, 'Binary files are not available in the source viewer.', 415);
    }
    if (!Number.isSafeInteger(file.byte_size) || file.byte_size < 0 || file.byte_size > maximumSourceBytes) {
      return ErrorResponse(request, env, 'Source file exceeds the viewer limit.', 413);
    }
    if (!IsSafeQuarantineFileKey(file.quarantine_key)) {
      return ErrorResponse(request, env, 'Source file path is invalid.', 409);
    }

    const object = await env.GAME_QUARANTINE_BUCKET.get(file.quarantine_key);
    if (!object || object.size !== file.byte_size) {
      return ErrorResponse(request, env, 'Source file is unavailable.', 404);
    }
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.byteLength !== file.byte_size || await Sha256Hex(bytes) !== String(file.sha256).toLowerCase()) {
      return ErrorResponse(request, env, 'Source file integrity check failed.', 409);
    }
    let source;
    try {
      source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return ErrorResponse(request, env, 'Source file encoding is not supported.', 415);
    }

    const filename = SanitizeFilename(file.path.split('/').pop() || 'source.txt');
    return new Response(source, {
      status: 200,
      headers: {
        ...CorsHeaders(request, env),
        ...SecurityHeaders({
          'Cache-Control': 'no-store',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': String(bytes.byteLength),
          'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      },
    });
  } catch (error) {
    console.error('Unable to read a game source file.', error);
    return ErrorResponse(request, env, 'Unable to load the source file.', 500);
  }
}

function NormalizeIdentifier(value) {
  const normalized = String(value || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized) ? normalized : null;
}

function NormalizeSourcePath(value) {
  const path = String(value || '').trim();
  if (path.length === 0 || path.length > 256 || !sourcePathPattern.test(path)) return null;
  const segments = path.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  return path;
}

function IsSafeQuarantineFileKey(value) {
  return typeof value === 'string'
    && /^quarantine\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9]{64}\/files\//i.test(value)
    && !value.includes('..')
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function SanitizeFilename(value) {
  const filename = String(value || 'source.txt').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96);
  return filename || 'source.txt';
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

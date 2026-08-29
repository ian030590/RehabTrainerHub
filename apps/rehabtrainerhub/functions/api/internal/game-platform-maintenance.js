import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RequireDatabase,
} from '../../_lib/auth.js';
import { ReconcileGamePlatformStorage } from '../../_lib/gamePlatformMaintenance.js';

/**
 * Operator/scheduler entry point for quarantine retention and notification
 * cleanup. It is intentionally separate from browser auth and accepts no
 * caller-controlled retention or object paths.
 */
export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  if (!(await IsMaintenanceRequest(request, env))) {
    return ErrorResponse(request, env, 'Maintenance authentication failed.', 401);
  }
  if (!env.GAME_QUARANTINE_BUCKET?.delete) {
    return ErrorResponse(request, env, 'Game quarantine storage is not configured.', 503);
  }
  try {
    const result = await ReconcileGamePlatformStorage({
      db: RequireDatabase(env),
      quarantineBucket: env.GAME_QUARANTINE_BUCKET,
      retentionDays: env.GAME_QUARANTINE_RETENTION_DAYS || 90,
      notificationRetentionDays: env.GAME_NOTIFICATION_RETENTION_DAYS || 365,
      maxSubmissions: env.GAME_MAINTENANCE_BATCH_SIZE || 100,
    });
    return JsonResponse(request, env, { ok: true, ...result });
  } catch (error) {
    console.error('Unable to reconcile game platform storage.', error);
    return ErrorResponse(request, env, 'Unable to reconcile game platform storage.', 500);
  }
}

async function IsMaintenanceRequest(request, env) {
  const configured = String(env?.GAME_MAINTENANCE_TOKEN || '');
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!configured || !match) return false;
  const encoder = new TextEncoder();
  const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(configured)));
  const provided = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(match[1])));
  let difference = expected.length === provided.length ? 0 : 1;
  for (let index = 0; index < Math.min(expected.length, provided.length); index += 1) {
    difference |= expected[index] ^ provided[index];
  }
  return difference === 0;
}

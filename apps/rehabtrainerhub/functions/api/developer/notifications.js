import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';
import { CreateNotificationReadQuery } from '../../_lib/gameNotifications.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    const limit = Number(new URL(request.url).searchParams.get('limit') || 50);
    const result = await CreateNotificationReadQuery(RequireDatabase(env), user.id, limit).all();
    return JsonResponse(request, env, {
      notifications: (result.results || []).map(MapNotification),
    });
  } catch (error) {
    console.error('Unable to load game platform notifications.', error);
    return ErrorResponse(request, env, 'Unable to load notifications.', 500);
  }
}

function MapNotification(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    releaseId: row.release_id || null,
    submissionId: row.submission_id || null,
    kind: row.kind,
    payload: SafeJson(row.payload_json),
    deliveredAt: row.delivered_at || null,
    createdAt: row.created_at,
  };
}

function SafeJson(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

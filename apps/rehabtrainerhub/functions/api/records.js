import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  RequireSession,
  SafeJsonParse,
} from '../_lib/auth.js';

const appIds = new Set(['rehabtrainerhub', 'motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer']);

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const url = new URL(request.url);
  const appId = url.searchParams.get('appId');
  if (!appIds.has(appId)) return ErrorResponse(request, env, 'Invalid app id.', 400);

  const db = RequireDatabase(env);
  const result = await db
    .prepare('SELECT payload_json FROM training_records WHERE user_id = ? AND app_id = ? ORDER BY saved_at ASC')
    .bind(session.sub, appId)
    .all();
  const records = (result.results || [])
    .map((row) => SafeJsonParse(row.payload_json))
    .filter(Boolean);

  return JsonResponse(request, env, { records });
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const input = await request.json().catch(() => null);
  const payload = NormalizeRecordPayload(input);
  if (!payload) return ErrorResponse(request, env, 'Invalid training record payload.', 400);

  const db = RequireDatabase(env);
  const now = new Date().toISOString();
  const result = await db
    .prepare(`
      INSERT INTO training_records (
        id, user_id, app_id, module_id, game_id, saved_at, training_date, difficulty, user_name, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        module_id = excluded.module_id,
        game_id = excluded.game_id,
        saved_at = excluded.saved_at,
        training_date = excluded.training_date,
        difficulty = excluded.difficulty,
        user_name = excluded.user_name,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
      WHERE training_records.user_id = excluded.user_id
        AND training_records.app_id = excluded.app_id
    `)
    .bind(
      payload.record.id,
      session.sub,
      payload.appId,
      payload.record.moduleId,
      payload.record.gameId || null,
      payload.record.savedAt,
      payload.record.trainingDate || null,
      payload.record.difficulty || null,
      payload.record.userName || null,
      JSON.stringify(payload.record),
      now,
      now,
    )
    .run();

  if (result?.meta?.changes === 0) {
    return ErrorResponse(request, env, 'Training record id belongs to a different account or app.', 409);
  }

  return JsonResponse(request, env, { ok: true, record: payload.record }, { status: 201 });
}

function NormalizeRecordPayload(input) {
  if (!input || typeof input !== 'object') return null;
  const appId = typeof input.appId === 'string' ? input.appId : '';
  const record = input.record && typeof input.record === 'object' ? input.record : null;
  if (!appIds.has(appId) || !record) return null;

  const id = typeof record.id === 'string' && record.id.trim() ? record.id : crypto.randomUUID();
  const savedAt = typeof record.savedAt === 'string' && record.savedAt.trim()
    ? record.savedAt
    : new Date().toISOString();
  const moduleId = typeof record.moduleId === 'string' ? record.moduleId : '';
  if (!moduleId) return null;

  return {
    appId,
    record: {
      ...record,
      id,
      savedAt,
      userName: typeof record.userName === 'string' ? record.userName : '',
      moduleId,
      gameId: typeof record.gameId === 'string' ? record.gameId : undefined,
      trainingDate: typeof record.trainingDate === 'string' ? record.trainingDate : undefined,
      difficulty: typeof record.difficulty === 'string' ? record.difficulty : undefined,
    },
  };
}

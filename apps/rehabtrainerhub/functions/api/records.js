import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  RequireSession,
  SafeJsonParse,
  TransientRateLimitResponse,
} from '../_lib/auth.js';
import { defaultRehabTimeZone, GetServerDate } from '../_lib/progress.js';
import { ReadJsonBody } from '../_lib/request.js';
import {
  IsTurnstileConfigured,
  VerifyTurnstileToken,
} from '../_lib/turnstile.js';

const appIds = new Set(['rehabtrainerhub', 'motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer']);
const maximumRecordRequestBytes = 32 * 1024;
const maximumRecordIdLength = 128;
const maximumModuleIdLength = 120;
const maximumShortFieldLength = 160;
const defaultReadPageSize = 100;
const maximumReadPageSize = 100;

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
  if (url.searchParams.get('count') === '1') {
    const countRow = await RequireDatabase(env)
      .prepare(`
        SELECT COUNT(*) AS total
        FROM training_records
        WHERE user_id = ?
          AND app_id = ?
      `)
      .bind(session.sub, appId)
      .first();
    return JsonResponse(request, env, { count: Number(countRow?.total || 0) });
  }
  const pageSize = ParseReadPageSize(url.searchParams.get('limit'));
  const rawCursor = url.searchParams.get('cursor');
  const cursor = ParseRecordCursor(rawCursor);
  if (pageSize === null || (rawCursor && !cursor)) {
    return ErrorResponse(request, env, 'Invalid record pagination.', 400);
  }

  const db = RequireDatabase(env);
  const cursorSql = cursor
    ? 'AND (saved_at < ? OR (saved_at = ? AND id < ?))'
    : '';
  const statement = db.prepare(`
    SELECT payload_json, id, saved_at
    FROM training_records
    WHERE user_id = ?
      AND app_id = ?
      ${cursorSql}
    ORDER BY saved_at DESC, id DESC
    LIMIT ?
  `);
  const bindings = cursor
    ? [session.sub, appId, cursor.savedAt, cursor.savedAt, cursor.id, pageSize + 1]
    : [session.sub, appId, pageSize + 1];
  const result = await statement
    .bind(...bindings)
    .all();
  const rows = result.results || [];
  const pageRows = rows.slice(0, pageSize);
  const records = pageRows
    .map((row) => SafeJsonParse(row.payload_json))
    .filter(Boolean);
  const responsePayload = { records };
  if (rows.length > pageSize) {
    const lastRow = pageRows.at(-1);
    if (lastRow?.saved_at && lastRow?.id) {
      responsePayload.nextCursor = CreateRecordCursor(lastRow.saved_at, lastRow.id);
    }
  }

  return JsonResponse(request, env, responsePayload);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const transientLimit = TransientRateLimitResponse(request, env, 'training-record-siteverify', {
    identity: session.sub,
    limit: 20,
    windowSeconds: 60,
  });
  if (transientLimit) return transientLimit;

  const parsedBody = await ReadJsonBody(request, maximumRecordRequestBytes);
  if (!parsedBody.ok) {
    return ErrorResponse(
      request,
      env,
      parsedBody.reason === 'too-large'
        ? 'Training record payload is too large.'
        : 'Invalid JSON payload.',
      parsedBody.reason === 'too-large' ? 413 : 400,
    );
  }

  const input = parsedBody.value;
  if (env.TURNSTILE_RECORDS_REQUIRED === '1') {
    if (!IsTurnstileConfigured(env)) {
      return ErrorResponse(request, env, 'Human verification is not configured.', 503);
    }
    const verification = await VerifyTurnstileToken(request, env, input?.turnstileToken, 'records');
    if (!verification.success) {
      return ErrorResponse(request, env, 'Human verification failed.', 400);
    }
  }

  const rateLimitError = await RateLimitResponse(request, env, 'training-record-write', {
    identity: session.sub,
    identityOnly: true,
    limit: 10,
    windowSeconds: 60,
  });
  if (rateLimitError) return rateLimitError;

  const dailyRateLimitError = await RateLimitResponse(request, env, 'training-record-write-daily', {
    identity: session.sub,
    identityOnly: true,
    limit: 300,
    windowSeconds: 24 * 60 * 60,
  });
  if (dailyRateLimitError) return dailyRateLimitError;

  const now = new Date();
  const serverTimestamp = now.toISOString();
  const timeZone = env.REHAB_TIME_ZONE || defaultRehabTimeZone;
  const verifiedTrainingDate = GetServerDate(now, timeZone);
  const payload = NormalizeRecordPayload(input, serverTimestamp, verifiedTrainingDate);
  if (!payload) return ErrorResponse(request, env, 'Invalid training record payload.', 400);

  const db = RequireDatabase(env);
  const result = await db
    .prepare(`
      INSERT INTO training_records (
        id, user_id, app_id, module_id, game_id, saved_at, training_date, verified_training_date,
        difficulty, user_name, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        module_id = excluded.module_id,
        game_id = excluded.game_id,
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
      verifiedTrainingDate,
      payload.record.difficulty || null,
      payload.record.userName || null,
      JSON.stringify(payload.record),
      serverTimestamp,
      serverTimestamp,
    )
    .run();

  if (result?.meta?.changes === 0) {
    return ErrorResponse(request, env, 'Training record id belongs to a different account or app.', 409);
  }

  return JsonResponse(request, env, { ok: true, record: payload.record }, { status: 201 });
}

function NormalizeRecordPayload(input, serverTimestamp, verifiedTrainingDate) {
  if (!IsPlainObject(input)) return null;
  const appId = typeof input.appId === 'string' ? input.appId : '';
  const record = IsPlainObject(input.record) ? input.record : null;
  if (!appIds.has(appId) || !record || !IsSafeRecordValue(record)) return null;

  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  if (rawId.length > maximumRecordIdLength) return null;
  const id = rawId || crypto.randomUUID();
  const moduleId = NormalizeString(record.moduleId, maximumModuleIdLength);
  if (!moduleId) return null;
  const userName = NormalizeString(record.userName, maximumShortFieldLength, true);
  const gameId = NormalizeString(record.gameId, maximumShortFieldLength, true);
  const difficulty = NormalizeString(record.difficulty, maximumShortFieldLength, true);
  if (userName === null || gameId === null || difficulty === null) return null;

  return {
    appId,
    record: {
      ...record,
      id,
      savedAt: serverTimestamp,
      userName: userName || '',
      moduleId,
      gameId: gameId || undefined,
      trainingDate: verifiedTrainingDate,
      difficulty: difficulty || undefined,
    },
  };
}

function NormalizeString(value, maximumLength, optional = false) {
  if (value === undefined || value === null) return optional ? '' : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > maximumLength) return null;
  return normalized;
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function IsSafeRecordValue(value, depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > 5000 || depth > 8) return false;
  if (
    value === null
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === 'string') return value.length <= 8192;
  if (Array.isArray(value)) {
    return value.length <= 2000
      && value.every((item) => IsSafeRecordValue(item, depth + 1, state));
  }
  if (!IsPlainObject(value)) return false;

  const entries = Object.entries(value);
  return entries.length <= 250
    && entries.every(([key, item]) => (
      key.length <= 160
      && IsSafeRecordValue(item, depth + 1, state)
    ));
}

function ParseReadPageSize(value) {
  if (value === null || value === '') return defaultReadPageSize;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximumReadPageSize
    ? parsed
    : null;
}

function CreateRecordCursor(savedAt, id) {
  return btoa(JSON.stringify([savedAt, id]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function ParseRecordCursor(value) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    );
    if (
      !Array.isArray(decoded)
      || decoded.length !== 2
      || typeof decoded[0] !== 'string'
      || typeof decoded[1] !== 'string'
      || decoded[0].length > 64
      || decoded[1].length > maximumRecordIdLength
    ) {
      return null;
    }
    return { savedAt: decoded[0], id: decoded[1] };
  } catch {
    return null;
  }
}

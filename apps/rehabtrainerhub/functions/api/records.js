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

const appIds = new Set(['rehabtrainerhub']);
const runtimeIds = new Set(['hub', 'motor', 'vision', 'brain', 'mouth']);
const runtimeModuleIds = new Map([
  ['motor', new Set(['upper-limb-training', 'lower-limb-training', 'cognitive-training'])],
  ['vision', new Set([
    'moving-card',
    'oculomotor-training',
    'gabor-patching',
    'reading-training',
    'driving-rehab',
    'hart-chart',
    'ufov-assessment',
  ])],
  ['brain', new Set(['attention-training', 'memory-training', 'thinking-training'])],
  ['mouth', new Set(['oral-training'])],
]);
const maximumDefaultRecordRequestBytes = 32 * 1024;
// Eye-tracking runs store a compact, fixed-rate sample tuple for every accepted
// gaze point. Keep a bounded ceiling that fits a five-minute run without
// allowing unbounded record uploads.
const maximumRecordRequestBytes = 512 * 1024;
const maximumEyeTrackingSamples = 3500;
const maximumEyeTrackingDurationMs = 5 * 60 * 1000 + 1000;
const eyeTrackingSampleColumns = [
  't_ms',
  'gaze_x',
  'gaze_y',
  'target_x',
  'target_y',
  'distance_px',
  'pupil_size_px_estimate',
  'blink_event',
  'fixation_segment',
];
const maximumRecordIdLength = 128;
const maximumModuleIdLength = 120;
const maximumShortFieldLength = 160;
const defaultReadPageSize = 100;
const maximumReadPageSize = 100;
const maximumRawEyeTrackingReadPageSize = 5;

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
  const runtimeId = url.searchParams.get('runtimeId');
  if (!runtimeIds.has(runtimeId)) return ErrorResponse(request, env, 'Invalid runtime id.', 400);
  if (url.searchParams.get('count') === '1') {
    const countRow = await RequireDatabase(env)
      .prepare(`
        SELECT COUNT(*) AS total
        FROM training_records
        WHERE user_id = ?
          AND app_id = ?
          AND runtime_id = ?
      `)
      .bind(session.sub, appId, runtimeId)
      .first();
    return JsonResponse(request, env, { count: Number(countRow?.total || 0) });
  }
  const includeGazeSamplesValue = url.searchParams.get('includeGazeSamples');
  if (
    includeGazeSamplesValue !== null
    && includeGazeSamplesValue !== '0'
    && includeGazeSamplesValue !== '1'
  ) return ErrorResponse(request, env, 'Invalid record detail option.', 400);
  const includeGazeSamples = includeGazeSamplesValue === '1';
  if (includeGazeSamples && runtimeId !== 'vision') {
    return ErrorResponse(request, env, 'Raw gaze samples are only available for vision records.', 400);
  }
  const maximumPageSize = includeGazeSamples
    ? maximumRawEyeTrackingReadPageSize
    : maximumReadPageSize;
  const pageSize = ParseReadPageSize(url.searchParams.get('limit'), maximumPageSize);
  const rawCursor = url.searchParams.get('cursor');
  const cursor = ParseRecordCursor(rawCursor);
  if (pageSize === null || (rawCursor && !cursor)) {
    return ErrorResponse(request, env, 'Invalid record pagination.', 400);
  }

  const db = RequireDatabase(env);
  const cursorSql = cursor
    ? 'AND (saved_at < ? OR (saved_at = ? AND id < ?))'
    : '';
  const payloadSelection = includeGazeSamples
    ? 'payload_json'
    : 'COALESCE(summary_json, payload_json) AS payload_json';
  const statement = db.prepare(`
    SELECT ${payloadSelection}, id, saved_at
    FROM training_records
    WHERE user_id = ?
      AND app_id = ?
      AND runtime_id = ?
      ${cursorSql}
    ORDER BY saved_at DESC, id DESC
    LIMIT ?
  `);
  const bindings = cursor
    ? [session.sub, appId, runtimeId, cursor.savedAt, cursor.savedAt, cursor.id, pageSize + 1]
    : [session.sub, appId, runtimeId, pageSize + 1];
  const result = await statement
    .bind(...bindings)
    .all();
  const rows = result.results || [];
  const pageRows = rows.slice(0, pageSize);
  const records = pageRows
    .map((row) => SafeJsonParse(row.payload_json))
    .filter(Boolean)
    .map((record) => PrepareRecordForRead(record, includeGazeSamples));
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
  if (
    GetJsonByteLength(input) > maximumDefaultRecordRequestBytes
    && !IsBoundedOculomotorEyeTrackingRecord(input)
  ) {
    return ErrorResponse(request, env, 'Training record payload is too large.', 413);
  }
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
  const payloadJson = JSON.stringify(payload.record);
  const summaryJson = payload.runtimeId === 'vision'
    && payload.record.moduleId === 'oculomotor-training'
    ? JSON.stringify(PrepareRecordForRead(payload.record, false))
    : null;
  const result = await db
    .prepare(`
      INSERT INTO training_records (
        id, user_id, app_id, runtime_id, module_id, game_id, saved_at, training_date, verified_training_date,
        difficulty, user_name, payload_json, summary_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        runtime_id = excluded.runtime_id,
        module_id = excluded.module_id,
        game_id = excluded.game_id,
        difficulty = excluded.difficulty,
        user_name = excluded.user_name,
        payload_json = excluded.payload_json,
        summary_json = excluded.summary_json,
        updated_at = excluded.updated_at
      WHERE training_records.user_id = excluded.user_id
        AND training_records.app_id = excluded.app_id
        AND training_records.runtime_id = excluded.runtime_id
        AND training_records.module_id = excluded.module_id
    `)
    .bind(
      payload.record.id,
      session.sub,
      payload.appId,
      payload.runtimeId,
      payload.record.moduleId,
      payload.record.gameId || null,
      payload.record.savedAt,
      payload.record.trainingDate || null,
      verifiedTrainingDate,
      payload.record.difficulty || null,
      payload.record.userName || null,
      payloadJson,
      summaryJson,
      serverTimestamp,
      serverTimestamp,
    )
    .run();

  if (result?.meta?.changes === 0) {
    return ErrorResponse(request, env, 'Training record id belongs to a different record scope.', 409);
  }

  return JsonResponse(request, env, { ok: true, record: payload.record }, { status: 201 });
}

function GetJsonByteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function IsBoundedOculomotorEyeTrackingRecord(input) {
  if (
    !IsPlainObject(input)
    || input.appId !== 'rehabtrainerhub'
    || input.runtimeId !== 'vision'
    || !IsPlainObject(input.record)
    || input.record.moduleId !== 'oculomotor-training'
    || !Array.isArray(input.record.results)
    || input.record.results.length !== 1
  ) return false;

  const [result] = input.record.results;
  const nativeWebGazerSamples = result?.webgazer_data;
  if (
    !IsPlainObject(result)
    || result.trial_type !== 'pixi-oculomotor-training'
    || !Array.isArray(result.gaze_sample_columns)
    || result.gaze_sample_columns.length !== eyeTrackingSampleColumns.length
    || !result.gaze_sample_columns.every((column, index) => column === eyeTrackingSampleColumns[index])
    || !Array.isArray(result.gaze_samples)
    || result.gaze_samples.length > maximumEyeTrackingSamples
    || result.gaze_sample_count !== result.gaze_samples.length
    || !HasValidEyeTrackingSamples(result.gaze_samples)
    || (nativeWebGazerSamples !== undefined && (
      !Array.isArray(nativeWebGazerSamples)
      || nativeWebGazerSamples.length > maximumEyeTrackingSamples
      || result.webgazer_sample_count !== nativeWebGazerSamples.length
      || !HasValidNativeWebGazerSamples(nativeWebGazerSamples)
    ))
    || (result.webgazer_data_consumed === true && !Array.isArray(nativeWebGazerSamples))
  ) return false;

  const baseInput = {
    ...input,
    record: {
      ...input.record,
      results: [{ ...result, gaze_samples: [], webgazer_data: [] }],
    },
  };
  return GetJsonByteLength(baseInput) <= maximumDefaultRecordRequestBytes;
}

function HasValidEyeTrackingSamples(samples) {
  let previousTimestamp = -1;
  let previousSegment = 0;
  return samples.every((sample) => {
    if (!Array.isArray(sample) || sample.length !== eyeTrackingSampleColumns.length) return false;
    const [
      timestamp,
      gazeX,
      gazeY,
      targetX,
      targetY,
      distance,
      pupilSize,
      blinkEvent,
      fixationSegment,
    ] = sample;
    const valid = (
      Number.isInteger(timestamp)
      && timestamp >= 0
      && timestamp >= previousTimestamp
      && timestamp <= maximumEyeTrackingDurationMs
      && [gazeX, gazeY, targetX, targetY].every((value) => (
        Number.isInteger(value) && Math.abs(value) <= 100000
      ))
      && typeof distance === 'number'
      && Number.isFinite(distance)
      && distance >= 0
      && distance <= 200000
      && (
        pupilSize === null
        || (
          typeof pupilSize === 'number'
          && Number.isFinite(pupilSize)
          && pupilSize >= 0
          && pupilSize <= 1000
        )
      )
      && (blinkEvent === 0 || blinkEvent === 1)
      && Number.isInteger(fixationSegment)
      && fixationSegment >= previousSegment
      && fixationSegment <= 1000
    );
    if (valid) {
      previousTimestamp = timestamp;
      previousSegment = fixationSegment;
    }
    return valid;
  });
}

function HasValidNativeWebGazerSamples(samples) {
  return samples.every((sample) => {
    if (!IsPlainObject(sample)) return false;
    return Number.isFinite(sample.x)
      && Number.isFinite(sample.y)
      && Number.isFinite(sample.t)
      && sample.t >= 0;
  });
}

function PrepareRecordForRead(record, includeGazeSamples) {
  return includeGazeSamples ? record : RemoveGazeSamples(record);
}

function RemoveGazeSamples(value) {
  if (Array.isArray(value)) return value.map(RemoveGazeSamples);
  if (!IsPlainObject(value)) return value;

  let pairedSamplesOmitted = false;
  let nativeSamplesOmitted = false;
  const entries = [];
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'gaze_samples') {
      pairedSamplesOmitted = true;
      return;
    }
    if (key === 'webgazer_data') {
      nativeSamplesOmitted = true;
      return;
    }
    if (key === 'gaze_samples_omitted' || key === 'webgazer_data_omitted') return;
    entries.push([key, RemoveGazeSamples(item)]);
  });
  if (pairedSamplesOmitted || value.gaze_samples_omitted === true) {
    entries.push(['gaze_samples_omitted', true]);
  }
  if (nativeSamplesOmitted || value.webgazer_data_omitted === true) {
    entries.push(['webgazer_data_omitted', true]);
  }
  return Object.fromEntries(entries);
}

function NormalizeRecordPayload(input, serverTimestamp, verifiedTrainingDate) {
  if (!IsPlainObject(input)) return null;
  const appId = typeof input.appId === 'string' ? input.appId : '';
  const runtimeId = typeof input.runtimeId === 'string' ? input.runtimeId : '';
  const record = IsPlainObject(input.record) ? input.record : null;
  if (
    !appIds.has(appId)
    || !runtimeIds.has(runtimeId)
    || !record
    || !IsSafeRecordValue(record)
  ) return null;

  const rawId = typeof record.id === 'string' ? record.id.trim() : '';
  if (rawId.length > maximumRecordIdLength) return null;
  const id = rawId || crypto.randomUUID();
  const moduleId = NormalizeString(record.moduleId, maximumModuleIdLength);
  if (!moduleId || !IsRuntimeModuleId(runtimeId, moduleId)) return null;
  const userName = NormalizeString(record.userName, maximumShortFieldLength, true);
  const gameId = NormalizeString(record.gameId, maximumShortFieldLength, true);
  const difficulty = NormalizeString(record.difficulty, maximumShortFieldLength, true);
  if (userName === null || gameId === null || difficulty === null) return null;

  return {
    appId,
    runtimeId,
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

function IsRuntimeModuleId(runtimeId, moduleId) {
  if (runtimeId === 'hub') return true;
  return moduleId.startsWith(`${runtimeId}:`)
    || runtimeModuleIds.get(runtimeId)?.has(moduleId) === true;
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
  if (state.nodes > 60000 || depth > 8) return false;
  if (
    value === null
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value === 'string') return value.length <= 8192;
  if (Array.isArray(value)) {
    return value.length <= 4000
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

function ParseReadPageSize(value, maximumPageSize = maximumReadPageSize) {
  if (value === null || value === '') return Math.min(defaultReadPageSize, maximumPageSize);
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximumPageSize
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

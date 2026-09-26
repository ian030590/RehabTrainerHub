import {
  CorsHeaders,
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireSession,
  SecurityHeaders,
  TransientRateLimitResponse,
} from '../_lib/auth.js';
import { IsSubjectId } from '../_lib/gameRuns.js';
import { ReadJsonBody } from '../_lib/request.js';
import { IsTurnstileConfigured, VerifyTurnstileToken } from '../_lib/turnstile.js';

const columns = [
  'sample_index', 'trial_time_ms', 'device_timestamp_us', 'delta_t_ms', 'instant_hz',
  'gaze_valid', 'gaze_x_px', 'gaze_y_px', 'stimulus_x_px', 'stimulus_y_px',
  'distance_error_px', 'distance_error_deg', 'is_within_threshold', 'phase', 'direction',
];
const metadataKeys = [
  'mode', 'pattern', 'run_mode', 'stimulus_type', 'eye_tracking_source',
  'screen_width_px', 'screen_height_px', 'screen_width_cm', 'screen_height_cm',
  'viewing_distance_cm', 'css_px_per_cm', 'css_px_per_cm_y', 'duration_ms',
  'target_size_arcmin', 'speed_arcmin_sec', 'dwell_ms', 'hold_ms', 'vor_change_ms',
  'validation_error_deg',
  'gaze_threshold_deg', 'gaze_threshold_arcmin', 'gaze_sampling_interval_ms',
  'fixation_radius_px', 'fixation_duration_ms',
];
const textMetadataKeys = new Set(['mode', 'pattern', 'run_mode', 'stimulus_type', 'eye_tracking_source']);
const phases = new Set(['training', 'saccade_latency', 'cross', 'movement', 'dwell', 'hold', 'vor']);
const directions = new Set([
  'center', 'right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right',
]);
const recordIdPattern = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$/;
const maximumSamples = 36000;
const maximumRequestBytes = 8 * 1024 * 1024;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  const bearer = request.headers.get('Authorization');
  const session = bearer ? await RequireSession(request, env) : null;
  if (bearer && !session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);
  if (!session?.sub && env.ANONYMOUS_RECORDS_ENABLED !== '1') {
    return ErrorResponse(request, env, 'Anonymous record storage is unavailable.', 503);
  }
  if (!env.OCULOMOTOR_DATA) return ErrorResponse(request, env, 'Oculomotor storage is unavailable.', 503);
  const transientLimit = TransientRateLimitResponse(request, env, 'oculomotor-data-upload', {
    identity: session?.sub, limit: 6, windowSeconds: 60,
  });
  if (transientLimit) return transientLimit;
  const parsed = await ReadJsonBody(request, maximumRequestBytes);
  if (!parsed.ok) return ErrorResponse(request, env, parsed.reason === 'too-large'
    ? 'Oculomotor data is too large.' : 'Invalid JSON payload.', parsed.reason === 'too-large' ? 413 : 400);
  const input = parsed.value;
  if (!IsValidUpload(input)) return ErrorResponse(request, env, 'Invalid oculomotor data.', 400);

  if (env.TURNSTILE_RECORDS_REQUIRED === '1') {
    if (!IsTurnstileConfigured(env)) return ErrorResponse(request, env, 'Human verification is not configured.', 503);
    const verification = await VerifyTurnstileToken(request, env, input.turnstileToken, 'records');
    if (!verification.success) return ErrorResponse(request, env, 'Human verification failed.', 400);
  }
  const rateLimit = session?.sub
    ? await RateLimitResponse(request, env, 'oculomotor-data-upload-user', {
      identity: session.sub, identityOnly: true, limit: 20, windowSeconds: 60 * 60,
    })
    : await RateLimitResponse(request, env, 'oculomotor-data-upload-guest-ip', {
      limit: 12, windowSeconds: 60 * 60,
    }) || await RateLimitResponse(request, env, 'oculomotor-data-upload-guest-subject', {
      identity: input.subjectId, identityOnly: true, limit: 6, windowSeconds: 60 * 60,
    });
  if (rateLimit) return rateLimit;

  const prefix = session?.sub ? UserPrefix(session.sub) : `guests/${input.subjectId}/`;
  const key = `${prefix}${input.recordId}.csv`;
  const csv = BuildCsv(input);
  try {
    const written = await env.OCULOMOTOR_DATA.put(key, csv, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'text/csv; charset=utf-8' },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        ...Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [key, String(value)])),
      },
    });
    if (!written) {
      const existing = await env.OCULOMOTOR_DATA.get(key);
      if (!existing || await existing.text() !== csv) {
        return ErrorResponse(request, env, 'Oculomotor record id already exists.', 409);
      }
    }
  } catch (error) {
    console.error('Unable to store oculomotor CSV.', error);
    return ErrorResponse(request, env, 'Unable to store oculomotor CSV.', 503);
  }
  return JsonResponse(request, env, { ok: true, recordId: input.recordId }, { status: 201 });
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);
  if (!env.OCULOMOTOR_DATA) return ErrorResponse(request, env, 'Oculomotor storage is unavailable.', 503);
  const prefix = UserPrefix(session.sub);
  const url = new URL(request.url);
  if (url.searchParams.has('subjectId') || url.searchParams.has('subject_id')) {
    return ErrorResponse(request, env, 'Subject identifiers cannot be used to read records.', 400);
  }
  const recordId = url.searchParams.get('recordId');
  if (recordId !== null) {
    if (!recordIdPattern.test(recordId)) return ErrorResponse(request, env, 'Invalid record id.', 400);
    let object;
    try {
      object = await env.OCULOMOTOR_DATA.get(`${prefix}${recordId}.csv`);
    } catch (error) {
      console.error('Unable to read oculomotor CSV.', error);
      return ErrorResponse(request, env, 'Oculomotor storage is unavailable.', 503);
    }
    if (!object) return ErrorResponse(request, env, 'Oculomotor CSV not found.', 404);
    return new Response(object.body, {
      headers: {
        ...CorsHeaders(request, env),
        ...SecurityHeaders(),
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="oculomotor-${recordId}.csv"`,
      },
    });
  }
  const cursor = url.searchParams.get('cursor') || undefined;
  if (cursor && cursor.length > 1024) {
    return ErrorResponse(request, env, 'Invalid cursor.', 400);
  }
  let listed;
  try {
    listed = await env.OCULOMOTOR_DATA.list({ prefix, limit: 100, cursor });
  } catch (error) {
    console.error('Unable to list oculomotor CSVs.', error);
    return ErrorResponse(request, env, 'Oculomotor storage is unavailable.', 503);
  }
  return JsonResponse(request, env, {
    records: listed.objects.map(({ key, uploaded, size }) => ({
      recordId: key.slice(prefix.length, -4), uploadedAt: uploaded.toISOString(), size,
    })),
    cursor: listed.truncated ? listed.cursor : null,
  });
}

function UserPrefix(userId) {
  return `users/${encodeURIComponent(userId)}/`;
}

function IsValidUpload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !recordIdPattern.test(value.recordId)
    || !IsSubjectId(value.subjectId)
    || !['webgazer', 'tobii'].includes(value.source)
    || !Array.isArray(value.records) || value.records.length < 1
    || value.records.length > maximumSamples
    || !value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)
    || value.metadata.eye_tracking_source !== value.source
    || Object.entries(value.metadata).some(([key, item]) => !metadataKeys.includes(key)
      || (textMetadataKeys.has(key)
        ? typeof item !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item)
        : typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > 1e9))) return false;
  let previousTime = -1;
  return value.records.every((row, index) => {
    if (!Array.isArray(row) || row.length !== columns.length
      || row[0] !== index + 1
      || !Number.isInteger(row[1]) || row[1] < previousTime || row[1] > 1200000
      || (row[2] !== null && (!Number.isSafeInteger(row[2]) || row[2] < 0))
      || ![5, 12].every((at) => row[at] === 0 || row[at] === 1)
      || ![3, 4, 6, 7, 8, 9, 10, 11].every((at) => row[at] === null
        || (typeof row[at] === 'number' && Number.isFinite(row[at]) && row[at] >= -1e6 && row[at] <= 1e6))
      || !phases.has(row[13])
      || !directions.has(row[14])) return false;
    if (row[8] === null || row[9] === null || row[3] === null) return false;
    if ([3, 4, 10, 11].some((at) => row[at] !== null && row[at] < 0)) return false;
    if (row[5] === 1 && [6, 7, 10, 11].some((at) => row[at] === null)) return false;
    if (row[5] === 0 && (row[6] !== null || row[7] !== null || row[10] !== null || row[11] !== null || row[12] !== 0)) return false;
    previousTime = row[1];
    return true;
  });
}

function BuildCsv(input) {
  const rows = [
    ['# subject_id', input.subjectId],
    ['# record_id', input.recordId],
    ['# eye_tracking_source', input.source],
    ...metadataKeys.filter((key) => key !== 'eye_tracking_source' && input.metadata[key] !== undefined)
      .map((key) => [`# ${key}`, input.metadata[key]]),
    columns,
    ...input.records,
  ];
  return `\uFEFF${rows.map((row) => row.map((cell) => cell ?? '').join(',')).join('\r\n')}\r\n`;
}

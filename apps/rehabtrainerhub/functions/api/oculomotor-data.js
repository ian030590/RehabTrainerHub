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
import { VerifyOfficialGameSession } from '../_lib/officialGames.js';
import { IsOculomotorCsvPayload } from '../../../../packages/ui/src/oculomotorCsv.js';

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
const recordIdPattern = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64})$/;
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
  const official = input.officialGameVersion !== undefined || input.runSessionToken !== undefined;
  if (official) {
    try {
      if (!await VerifyOfficialGameSession({ officialGameVersion: input.officialGameVersion, runSessionToken: input.runSessionToken,
        record: { id: input.recordId, gameId: 'oculomotor-training', moduleId: 'oculomotor-training' } }, env, session?.sub, input.subjectId))
        return ErrorResponse(request, env, 'Invalid official eye session.', 400);
    } catch { return ErrorResponse(request, env, 'Game release verification is temporarily unavailable.', 503); }
  }

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
        ...(official ? { officialGameVersion: input.officialGameVersion, gazeSampleCount: String(input.records.length) } : {}),
        ...Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [key, String(value)])),
      },
    });
    if (!written) {
      const existing = await env.OCULOMOTOR_DATA.get(key);
      if (!existing || await existing.text() !== csv || (official && (existing.customMetadata?.officialGameVersion !== input.officialGameVersion
        || existing.customMetadata?.gazeSampleCount !== String(input.records.length)))) {
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
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && recordIdPattern.test(value.recordId) && IsSubjectId(value.subjectId) && value.source === 'webgazer'
    && IsOculomotorCsvPayload({ records: value.records, metadata: value.metadata });
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

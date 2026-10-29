import { ErrorResponse, JsonResponse, OptionsResponse, RateLimitResponse, RejectDisallowedOrigin,
  RequireDatabase, RequireSession, TransientRateLimitResponse } from '../_lib/auth.js';
import { IsSubjectId } from '../_lib/gameRuns.js';
import { EnsureAccountSubjectId } from '../_lib/subjects.js';
import { ReadVerifiedOfficialGameSession } from '../_lib/officialGames.js';
import { OfficialRecordedDate, RawCoordinateKindAllowed, RawDataKey, StoreImmutableCsv } from '../_lib/rawData.js';
import { IsTurnstileConfigured, VerifyTurnstileToken } from '../_lib/turnstile.js';
import { defaultRehabTimeZone } from '../_lib/progress.js';
import { rawCoordinateColumns, ValidateRawCoordinateCsv } from '../../../../packages/ui/src/rawCoordinateRecorder.js';

const maximumBytes = 25 * 1024 * 1024;

export function onRequestOptions({ request, env }) { return OptionsResponse(request, env); }

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  const bearer = request.headers.get('Authorization');
  const session = bearer ? await RequireSession(request, env) : null;
  if (bearer && !session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);
  if (!session?.sub && env.ANONYMOUS_RECORDS_ENABLED !== '1') return ErrorResponse(request, env, 'Anonymous storage is unavailable.', 503);
  if (!env.RAW_DATA) return ErrorResponse(request, env, 'Raw storage is unavailable.', 503);
  const transient = TransientRateLimitResponse(request, env, 'raw-data-upload', { identity: session?.sub, limit: 20, windowSeconds: 60 });
  if (transient) return transient;
  let input;
  try {
    const header = request.headers.get('X-Raw-Data');
    if (!header || header.length > 4096) throw new Error('Invalid header');
    input = JSON.parse(header);
    if (!input || typeof input.kind !== 'string' || !Object.hasOwn(rawCoordinateColumns, input.kind) || !IsSubjectId(input.subjectId)
      || !IsSubjectId(input.recordId) || typeof input.truncated !== 'boolean'
      || !/^text\/csv(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') ?? '')) throw new Error('Invalid upload');
  } catch { return ErrorResponse(request, env, 'Invalid raw data upload.', 400); }
  if (session?.sub) {
    try { input.subjectId = await EnsureAccountSubjectId(RequireDatabase(env), session.sub); }
    catch { return ErrorResponse(request, env, 'Account subject is temporarily unavailable.', 503); }
  }
  let verified, recordedDate;
  try {
    verified = await ReadVerifiedOfficialGameSession({ ...input, record: { id: input.recordId, gameId: input.gameId, moduleId: input.gameId } }, env, session?.sub, input.subjectId);
    if (!verified || !RawCoordinateKindAllowed(input.gameId, verified.release.capabilities, input.kind)) {
      return ErrorResponse(request, env, 'Invalid official input session.', 400);
    }
    recordedDate = OfficialRecordedDate(verified.claims, env.REHAB_TIME_ZONE || defaultRehabTimeZone);
  } catch { return ErrorResponse(request, env, 'Game release verification is temporarily unavailable.', 503); }
  if (env.TURNSTILE_RECORDS_REQUIRED === '1') {
    if (!IsTurnstileConfigured(env)) return ErrorResponse(request, env, 'Human verification is not configured.', 503);
    const verification = await VerifyTurnstileToken(request, env, input.turnstileToken, 'records');
    if (!verification.success) return ErrorResponse(request, env, 'Human verification failed.', 400);
  }
  const rateLimit = session?.sub
    ? await RateLimitResponse(request, env, 'raw-data-upload-user', { identity: session.sub, identityOnly: true, limit: 80, windowSeconds: 3600 })
    : await RateLimitResponse(request, env, 'raw-data-upload-guest-ip', { limit: 48, windowSeconds: 3600 })
      || await RateLimitResponse(request, env, 'raw-data-upload-guest-subject', { identity: input.subjectId, identityOnly: true, limit: 24, windowSeconds: 3600 });
  if (rateLimit) return rateLimit;
  if (Number(request.headers.get('Content-Length')) > maximumBytes) return ErrorResponse(request, env, 'Raw data is too large.', 413);
  let csv;
  try {
    if (!request.body) throw new Error('Missing body');
    const reader = request.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const chunks = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); return ErrorResponse(request, env, 'Raw data is too large.', 413); }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    csv = chunks.join('') + decoder.decode();
  } catch { return ErrorResponse(request, env, 'Invalid CSV body.', 400); }
  const rows = ValidateRawCoordinateCsv(input.kind, csv);
  if (rows === null) return ErrorResponse(request, env, 'Invalid coordinate CSV.', 400);
  const key = RawDataKey(input.kind, input.gameId, input.subjectId, recordedDate, input.recordId);
  try {
    const sha256 = await StoreImmutableCsv(env.RAW_DATA, key, csv, { kind: input.kind, gameId: input.gameId,
      version: input.officialGameVersion, recordId: input.recordId, subjectId: input.subjectId, recordedDate,
      rows: String(rows), truncated: String(input.truncated) });
    if (!sha256) return ErrorResponse(request, env, 'Raw record id already exists.', 409);
    return JsonResponse(request, env, { kind: input.kind, key, rows, sha256 }, { status: 201 });
  } catch { return ErrorResponse(request, env, 'Raw storage is unavailable.', 503); }
}

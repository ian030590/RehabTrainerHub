import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  RequireSession,
} from '../_lib/auth.js';
import {
  BuildProgressSummary,
  defaultRehabTimeZone,
  GetServerDate,
} from '../_lib/progress.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await RequireSession(request, env);
  if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);

  const timeZone = env.REHAB_TIME_ZONE || defaultRehabTimeZone;
  const serverDate = GetServerDate(new Date(), timeZone);
  const db = RequireDatabase(env);
  const result = await db
    .prepare(`
      SELECT
        COALESCE(verified_training_date, substr(created_at, 1, 10)) AS training_date,
        module_id,
        game_id
      FROM training_records
      WHERE user_id = ?
      ORDER BY verified_training_date ASC, created_at ASC
    `)
    .bind(session.sub)
    .all();

  return JsonResponse(
    request,
    env,
    BuildProgressSummary(result.results || [], serverDate, timeZone),
  );
}

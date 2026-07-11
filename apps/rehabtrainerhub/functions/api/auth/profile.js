import {
  errorResponse,
  getUserById,
  jsonResponse,
  optionsResponse,
  rejectDisallowedOrigin,
  requireDatabase,
  requireSession,
  toPublicUser,
} from '../../_lib/auth.js';

const chronicDiagnosisValues = new Set([
  'centralNervousSystem',
  'metabolic',
  'developmental',
  'psychotic',
  'neurotic',
]);

const habitStatuses = new Set(['none', 'current', 'former']);
const intervals = new Set(['week', 'month']);
const smokingUnits = new Set(['packs', 'cigarettes']);
const alcoholUnits = new Set(['bottles', 'cans', 'cups']);

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPut({ request, env }) {
  const originError = rejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const session = await requireSession(request, env);
  if (!session?.sub) return errorResponse(request, env, 'Unauthorized.', 401);

  const input = await request.json().catch(() => null);
  const profile = normalizeProfile(input);
  if (!profile) return errorResponse(request, env, 'Invalid profile payload.', 400);

  const now = new Date().toISOString();
  const db = requireDatabase(env);
  await db
    .prepare(`
      UPDATE app_users
      SET
        age_range = ?,
        gender = ?,
        nationality = ?,
        chronic_diagnoses_json = ?,
        smoking_status = ?,
        smoking_frequency_json = ?,
        alcohol_status = ?,
        alcohol_frequency_json = ?,
        profile_json = ?,
        profile_completed_at = COALESCE(profile_completed_at, ?),
        updated_at = ?
      WHERE id = ?
    `)
    .bind(
      profile.ageRange,
      profile.gender,
      profile.nationality,
      JSON.stringify(profile.chronicDiagnoses),
      profile.smokingStatus,
      profile.smokingFrequency ? JSON.stringify(profile.smokingFrequency) : null,
      profile.alcoholStatus,
      profile.alcoholFrequency ? JSON.stringify(profile.alcoholFrequency) : null,
      JSON.stringify(profile),
      now,
      now,
      session.sub,
    )
    .run();

  const user = await getUserById(env, session.sub);
  return jsonResponse(request, env, { user: toPublicUser(user) });
}

function normalizeProfile(input) {
  if (!input || typeof input !== 'object') return null;

  const ageRange = typeof input.ageRange === 'string' ? input.ageRange.trim() : '';
  const gender = typeof input.gender === 'string' ? input.gender.trim() : '';
  const nationality = typeof input.nationality === 'string' ? input.nationality.trim() : '';
  const chronicDiagnoses = Array.isArray(input.chronicDiagnoses)
    ? input.chronicDiagnoses.filter((value) => typeof value === 'string' && chronicDiagnosisValues.has(value))
    : [];
  const smokingStatus = habitStatuses.has(input.smokingStatus) ? input.smokingStatus : 'none';
  const alcoholStatus = habitStatuses.has(input.alcoholStatus) ? input.alcoholStatus : 'none';
  const smokingFrequency = smokingStatus === 'current'
    ? normalizeFrequency(input.smokingFrequency, smokingUnits)
    : undefined;
  const alcoholFrequency = alcoholStatus === 'current'
    ? normalizeFrequency(input.alcoholFrequency, alcoholUnits)
    : undefined;

  if (!ageRange || !gender || !nationality) return null;
  if (smokingStatus === 'current' && !smokingFrequency) return null;
  if (alcoholStatus === 'current' && !alcoholFrequency) return null;

  return {
    ageRange,
    gender,
    nationality,
    chronicDiagnoses,
    smokingStatus,
    smokingFrequency,
    alcoholStatus,
    alcoholFrequency,
  };
}

function normalizeFrequency(input, validUnits) {
  if (!input || typeof input !== 'object') return null;
  const interval = intervals.has(input.interval) ? input.interval : 'week';
  const unit = validUnits.has(input.unit) ? input.unit : null;
  const amount = typeof input.amount === 'string' ? input.amount.trim() : String(input.amount ?? '').trim();
  const numericAmount = Number(amount);
  if (!unit || !amount || !Number.isFinite(numericAmount) || numericAmount < 0) return null;
  return { interval, amount, unit };
}

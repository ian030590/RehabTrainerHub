import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import {
  GetAuthenticatedUser,
  IsStaffUser,
} from '../../_lib/authorization.js';

const maximumOverviewPatients = 500;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const db = RequireDatabase(env);
    const summaryRow = await db
      .prepare(`
        WITH accessible_patients AS (
          SELECT app_users.id
          FROM app_users
          WHERE app_users.role = 'patient'
            AND (
              ? = 'admin'
              OR EXISTS (
                SELECT 1
                FROM therapist_patient_assignments
                WHERE therapist_patient_assignments.therapist_id = ?
                  AND therapist_patient_assignments.patient_id = app_users.id
              )
            )
        )
        SELECT
          COUNT(DISTINCT accessible_patients.id) AS patient_count,
          COUNT(training_records.id) AS record_count,
          COUNT(DISTINCT CASE
            WHEN training_records.id IS NOT NULL THEN
              training_records.user_id || ':' || COALESCE(
                training_records.verified_training_date,
                training_records.training_date,
                substr(training_records.created_at, 1, 10)
              )
            ELSE NULL
          END) AS training_days,
          MAX(training_records.saved_at) AS latest_activity_at
        FROM accessible_patients
        LEFT JOIN training_records
          ON training_records.user_id = accessible_patients.id
      `)
      .bind(user.role, user.id)
      .first();

    const patientResult = await db
      .prepare(`
        WITH accessible_patients AS (
          SELECT app_users.id, app_users.display_name, app_users.email
          FROM app_users
          WHERE app_users.role = 'patient'
            AND (
              ? = 'admin'
              OR EXISTS (
                SELECT 1
                FROM therapist_patient_assignments
                WHERE therapist_patient_assignments.therapist_id = ?
                  AND therapist_patient_assignments.patient_id = app_users.id
              )
            )
        )
        SELECT
          accessible_patients.id,
          accessible_patients.display_name,
          accessible_patients.email,
          COUNT(training_records.id) AS record_count,
          MAX(training_records.saved_at) AS last_trained_at
        FROM accessible_patients
        LEFT JOIN training_records
          ON training_records.user_id = accessible_patients.id
        GROUP BY
          accessible_patients.id,
          accessible_patients.display_name,
          accessible_patients.email
        ORDER BY
          last_trained_at IS NULL,
          last_trained_at DESC,
          accessible_patients.display_name COLLATE NOCASE,
          accessible_patients.id
        LIMIT ?
      `)
      .bind(user.role, user.id, maximumOverviewPatients)
      .all();

    const patients = (patientResult.results || []).map((patient) => ({
      id: patient.id,
      displayName: patient.display_name || patient.email || 'Patient',
      email: patient.email || null,
      recordCount: Number(patient.record_count || 0),
      lastTrainedAt: patient.last_trained_at || null,
    }));
    const payload = {
      summary: {
        patientCount: Number(summaryRow?.patient_count || 0),
        recordCount: Number(summaryRow?.record_count || 0),
        trainingDays: Number(summaryRow?.training_days || 0),
        latestActivityAt: summaryRow?.latest_activity_at || null,
      },
      patients,
    };
    if (payload.summary.patientCount > patients.length) {
      payload.patientsTruncated = true;
    }
    return JsonResponse(request, env, payload);
  } catch (error) {
    console.error('Unable to load the therapist overview.', error);
    return ErrorResponse(request, env, 'Unable to load the therapist overview.', 500);
  }
}

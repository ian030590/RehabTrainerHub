import {
  GetCookieSession,
  RequireDatabase,
  RequireSession,
} from './auth.js';

export const userRoles = Object.freeze({
  patient: 'patient',
  therapist: 'therapist',
  admin: 'admin',
});

const staffRoles = new Set([userRoles.therapist, userRoles.admin]);

export function NormalizeUserRole(value) {
  return Object.values(userRoles).includes(value) ? value : userRoles.patient;
}

export async function GetAuthenticatedUser(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return null;

  const cookieSession = await GetCookieSession(request, env);
  const bearerSession = !cookieSession?.payload?.sub && env.ADMIN_ALLOW_BEARER === '1'
    ? await RequireSession(request, env)
    : null;
  const session = cookieSession?.payload?.sub
    ? cookieSession.payload
    : bearerSession;
  if (!session?.sub) return null;

  const user = await RequireDatabase(env)
    .prepare(`
      SELECT id, display_name, email, avatar_url, role
      FROM app_users
      WHERE id = ?
    `)
    .bind(session.sub)
    .first();
  if (!user) return null;

  return {
    ...user,
    role: NormalizeUserRole(user.role),
  };
}

export function IsStaffUser(user) {
  return Boolean(user && staffRoles.has(NormalizeUserRole(user.role)));
}

export async function CanAccessPatient(env, user, patientId) {
  if (!user || !patientId) return false;
  if (NormalizeUserRole(user.role) === userRoles.admin) return true;
  if (NormalizeUserRole(user.role) !== userRoles.therapist) return false;

  const assignment = await RequireDatabase(env)
    .prepare(`
      SELECT 1 AS allowed
      FROM therapist_patient_assignments
      INNER JOIN app_users
        ON app_users.id = therapist_patient_assignments.patient_id
       AND app_users.role = 'patient'
      WHERE therapist_patient_assignments.therapist_id = ?
        AND therapist_patient_assignments.patient_id = ?
      LIMIT 1
    `)
    .bind(user.id, patientId)
    .first();
  return Boolean(assignment?.allowed);
}

export async function WriteAdminAuditEvent(env, event) {
  const db = RequireDatabase(env);
  await CreateAdminAuditStatement(db, event).run();
}

export function CreateAdminAuditStatement(db, event) {
  const actorUserId = String(event?.actorUserId || '').trim();
  const action = String(event?.action || '').trim();
  if (!actorUserId || !action) {
    throw new Error('Audit events require actorUserId and action.');
  }

  const targetType = String(event?.targetType || '').trim() || null;
  const targetId = String(event?.targetId || '').trim() || null;
  const metadataJson = event?.metadata === undefined
    ? null
    : JSON.stringify(event.metadata);

  return db
    .prepare(`
      INSERT INTO admin_audit_events (
        id, actor_user_id, action, target_type, target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      actorUserId,
      action,
      targetType,
      targetId,
      metadataJson,
      new Date().toISOString(),
    );
}

import { IsGameSettings } from '../../../../packages/ui/src/selfContainedGame.js';
import { ErrorResponse, RejectDisallowedOrigin, RequireDatabase } from './auth.js';
import { CanAccessPatient, CreateAdminAuditStatement, GetAuthenticatedUser, IsStaffUser } from './authorization.js';
import { IsExactObject } from './gameRuns.js';
import { officialGameReleases } from './officialGames.js';
import { defaultRehabTimeZone, GetServerDate } from './progress.js';

export function TrainingPlansDisabledResponse(request, env) {
  return env.TRAINING_PLANS_ENABLED === '1'
    ? null : ErrorResponse(request, env, 'Training plans are not enabled.', 404);
}

export async function RequireTrainingPlanStaff(request, env) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return { response: originError };
  const user = await GetAuthenticatedUser(request, env);
  if (!user) return { response: ErrorResponse(request, env, 'Unauthorized.', 401) };
  if (!IsStaffUser(user)) return { response: ErrorResponse(request, env, 'Forbidden.', 403) };
  return { user };
}

export async function CheckTrainingPlanPatient(request, env, user, patientId) {
  if (!await CanAccessPatient(env, user, patientId)) return ErrorResponse(request, env, 'Forbidden.', 403);
  const patient = await RequireDatabase(env).prepare("SELECT id FROM app_users WHERE id = ? AND role = 'patient'")
    .bind(patientId).first();
  return patient ? null : ErrorResponse(request, env, 'Patient not found.', 404);
}

export function NormalizeTrainingPlanInput(input) {
  if (!IsExactObject(input, ['patientId', 'title', 'items'], ['note'])
    || typeof input.patientId !== 'string' || !input.patientId || input.patientId.length > 128
    || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 60
    || (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 300))
    || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 12) return null;
  const games = new Set();
  for (const item of input.items) {
    if (!IsExactObject(item, ['gameId', 'weeklyTarget', 'settings'])
      || typeof item.gameId !== 'string' || !Object.hasOwn(officialGameReleases, item.gameId)
      || games.has(item.gameId) || !Number.isInteger(item.weeklyTarget)
      || item.weeklyTarget < 1 || item.weeklyTarget > 14
      || (item.settings !== null && !IsGameSettings(item.settings))) return null;
    games.add(item.gameId);
  }
  return { ...input, title: input.title.trim(), note: input.note ?? '' };
}

export function TrainingPlanWeek(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const start = AddCalendarDays(dateKey, -((date.getUTCDay() + 6) % 7));
  return { start, end: AddCalendarDays(start, 6) };
}

function AddCalendarDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function CountWeekStreak(weeks, weekStart) {
  let cursor = weeks.has(weekStart) ? weekStart : AddCalendarDays(weekStart, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = AddCalendarDays(cursor, -7);
  }
  return streak;
}

export async function ReadTrainingPlan(env, patientId, planId) {
  const db = RequireDatabase(env);
  const row = await db.prepare(`SELECT p.id, p.title, p.note, p.status, p.created_at, p.updated_at,
      u.display_name AS assigned_by
    FROM training_plans p LEFT JOIN app_users u ON u.id = p.created_by_user_id
    WHERE p.patient_user_id = ? AND ${planId ? 'p.id = ?' : "p.status = 'active'"}`)
    .bind(...(planId ? [patientId, planId] : [patientId])).first();
  if (!row) return { plan: null };
  const week = TrainingPlanWeek(GetServerDate(new Date(), env.REHAB_TIME_ZONE || defaultRehabTimeZone));
  const result = await db.prepare(`SELECT i.id, i.game_id, i.weekly_target, i.settings_json,
      (SELECT COUNT(*) FROM training_plan_completions c WHERE c.plan_item_id = i.id AND c.week_start = ?) AS completed
    FROM training_plan_items i WHERE i.plan_id = ? ORDER BY i.sort_order`).bind(week.start, row.id).all();
  const items = (result.results || []).map(item => ({ id: item.id, gameId: item.game_id,
    weeklyTarget: item.weekly_target, settings: item.settings_json === null ? null : JSON.parse(item.settings_json),
    completedThisWeek: item.completed }));
  const achieved = await db.prepare(`SELECT week_start FROM training_plan_weeks
    WHERE patient_user_id = ? AND week_start <= ?`).bind(patientId, week.start).all();
  const weeks = new Set((achieved.results || []).map(row => row.week_start));
  const currentStreak = CountWeekStreak(weeks, week.start);
  const titles = await db.prepare('SELECT title_id, awarded_at FROM user_titles WHERE user_id = ? ORDER BY title_id')
    .bind(patientId).all();
  return { plan: { id: row.id, title: row.title, note: row.note, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, assignedBy: row.assigned_by || null, items,
    week: { ...week, achieved: items.length > 0 && items.every(item => item.completedThisWeek >= item.weeklyTarget) },
    achievedWeeks: weeks.size, currentStreak,
    weeksToTitle: titles.results?.length ? 0 : Math.max(0, 6 - currentStreak),
    titles: (titles.results || []).map(title => ({ id: title.title_id, awardedAt: title.awarded_at })) } };
}

export async function ReadArchivedTrainingPlans(env, patientId) {
  const result = await RequireDatabase(env).prepare(`SELECT id, title, created_at, archived_at FROM training_plans
    WHERE patient_user_id = ? AND status = 'archived' ORDER BY archived_at DESC, id DESC LIMIT 10`)
    .bind(patientId).all();
  return (result.results || []).map(row => ({ id: row.id, title: row.title,
    createdAt: row.created_at, archivedAt: row.archived_at }));
}

export async function CreateTrainingPlan(env, user, input) {
  const db = RequireDatabase(env);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE training_plans SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE patient_user_id = ? AND status = 'active'`).bind(now, now, input.patientId),
    db.prepare(`INSERT INTO training_plans
      (id, patient_user_id, created_by_user_id, title, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`).bind(id, input.patientId, user.id, input.title, input.note, now, now),
    ...input.items.map((item, index) => db.prepare(`INSERT INTO training_plan_items
      (id, plan_id, game_id, weekly_target, settings_json, sort_order) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, item.gameId, item.weeklyTarget,
        item.settings === null ? null : JSON.stringify(item.settings), index)),
    CreateAdminAuditStatement(db, { actorUserId: user.id, action: 'training-plan.create',
      targetType: 'training_plan', targetId: id, metadata: { patientId: input.patientId, itemCount: input.items.length } }),
  ]);
  return ReadTrainingPlan(env, input.patientId, id);
}

export async function ArchiveTrainingPlan(env, user, plan) {
  const db = RequireDatabase(env);
  const now = new Date().toISOString();
  const result = await db.batch([
    db.prepare(`UPDATE training_plans SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ? AND status = 'active'`).bind(now, now, plan.id),
    // changes() prevents duplicate audit events when a competing request already archived the list.
    db.prepare(`INSERT INTO admin_audit_events (id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
      SELECT ?, ?, 'training-plan.archive', 'training_plan', ?, ?, ? WHERE changes() > 0`)
      .bind(crypto.randomUUID(), user.id, plan.id, JSON.stringify({ patientId: plan.patient_user_id }), now),
  ]);
  return result[0]?.meta?.changes > 0;
}

export async function ReadTrainingPlanLaunch(env, userId, gameId, planItemId) {
  if (!userId || typeof planItemId !== 'string' || !planItemId || planItemId.length > 128) return null;
  const item = await RequireDatabase(env).prepare(`SELECT i.id, i.settings_json FROM training_plan_items i
    JOIN training_plans p ON p.id = i.plan_id
    WHERE i.id = ? AND i.game_id = ? AND p.patient_user_id = ? AND p.status = 'active'`)
    .bind(planItemId, gameId, userId).first();
  return item ? { id: item.id, settings: item.settings_json === null ? null : JSON.parse(item.settings_json) } : null;
}

export async function RecordTrainingPlanCompletion(env, claims, userId, trainingDate, completedAt) {
  if (env.TRAINING_PLANS_ENABLED !== '1' || !userId || typeof claims?.planItemId !== 'string') return;
  const db = RequireDatabase(env);
  const week = TrainingPlanWeek(trainingDate);
  const sixWeeks = Array.from({ length: 6 }, (_, index) => AddCalendarDays(week.start, -7 * index));
  // D1 serializes the completion, all-target check and title award in one transaction.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO training_plan_completions
      (record_id, plan_id, plan_item_id, patient_user_id, week_start, completed_at)
      SELECT r.id, p.id, i.id, p.patient_user_id, ?, ? FROM training_plan_items i
      JOIN training_plans p ON p.id = i.plan_id JOIN training_records r ON r.id = ?
      WHERE i.id = ? AND i.game_id = ? AND p.patient_user_id = ? AND p.status = 'active'
        AND r.user_id = p.patient_user_id AND r.game_id = i.game_id`)
      .bind(week.start, completedAt, claims.recordId, claims.planItemId, claims.gameId, userId),
    db.prepare(`INSERT OR IGNORE INTO training_plan_weeks (patient_user_id, week_start, plan_id, achieved_at)
      SELECT p.patient_user_id, ?, p.id, ? FROM training_plans p
      JOIN training_plan_completions c ON c.plan_id = p.id AND c.record_id = ?
      WHERE p.patient_user_id = ? AND p.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM training_plan_items i WHERE i.plan_id = p.id AND
          (SELECT COUNT(*) FROM training_plan_completions done
           WHERE done.plan_item_id = i.id AND done.week_start = ?) < i.weekly_target)`)
      .bind(week.start, completedAt, claims.recordId, userId, week.start),
    db.prepare(`INSERT OR IGNORE INTO user_titles (user_id, title_id, awarded_at)
      SELECT ?, 'six-week-streak', ? WHERE
        (SELECT COUNT(*) FROM training_plan_weeks WHERE patient_user_id = ? AND week_start IN (?, ?, ?, ?, ?, ?)) = 6
        AND EXISTS (SELECT 1 FROM training_plan_completions WHERE record_id = ? AND patient_user_id = ?)`)
      .bind(userId, completedAt, userId, ...sixWeeks, claims.recordId, userId),
  ]);
}

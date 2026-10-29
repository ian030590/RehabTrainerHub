import { ErrorResponse, JsonResponse, OptionsResponse, RequireDatabase } from '../../../../_lib/auth.js';
import { ArchiveTrainingPlan, CheckTrainingPlanPatient, RequireTrainingPlanStaff,
  TrainingPlansDisabledResponse } from '../../../../_lib/trainingPlans.js';

export function onRequestOptions({ request, env }) {
  return TrainingPlansDisabledResponse(request, env) || OptionsResponse(request, env);
}

export async function onRequestPost({ request, env, params }) {
  const disabled = TrainingPlansDisabledResponse(request, env);
  if (disabled) return disabled;
  try {
    const { user, response } = await RequireTrainingPlanStaff(request, env);
    if (response) return response;
    const plan = await RequireDatabase(env).prepare("SELECT id, patient_user_id FROM training_plans WHERE id = ? AND status = 'active'")
      .bind(params.planId).first();
    if (!plan) return ErrorResponse(request, env, 'Training plan not found.', 404);
    const denied = await CheckTrainingPlanPatient(request, env, user, plan.patient_user_id);
    if (denied) return denied;
    if (!await ArchiveTrainingPlan(env, user, plan)) return ErrorResponse(request, env, 'Training plan not found.', 404);
    return JsonResponse(request, env, { ok: true });
  } catch (error) {
    console.error('Unable to archive training plan.', error);
    return ErrorResponse(request, env, 'Unable to archive training plan.', 500);
  }
}

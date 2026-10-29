import { ErrorResponse, JsonResponse, OptionsResponse } from '../../_lib/auth.js';
import { ReadJsonBody } from '../../_lib/request.js';
import { CheckTrainingPlanPatient, CreateTrainingPlan, NormalizeTrainingPlanInput, ReadArchivedTrainingPlans,
  ReadTrainingPlan, RequireTrainingPlanStaff, TrainingPlansDisabledResponse } from '../../_lib/trainingPlans.js';

export function onRequestOptions({ request, env }) {
  return TrainingPlansDisabledResponse(request, env) || OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const disabled = TrainingPlansDisabledResponse(request, env);
  if (disabled) return disabled;
  try {
    const { user, response } = await RequireTrainingPlanStaff(request, env);
    if (response) return response;
    const patientId = new URL(request.url).searchParams.get('patientId');
    if (!patientId || patientId.length > 128) return ErrorResponse(request, env, 'Invalid patient id.', 400);
    const denied = await CheckTrainingPlanPatient(request, env, user, patientId);
    if (denied) return denied;
    return JsonResponse(request, env, { ...await ReadTrainingPlan(env, patientId),
      archivedPlans: await ReadArchivedTrainingPlans(env, patientId) });
  } catch (error) {
    console.error('Unable to read training plans.', error);
    return ErrorResponse(request, env, 'Unable to read training plans.', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const disabled = TrainingPlansDisabledResponse(request, env);
  if (disabled) return disabled;
  try {
    const { user, response } = await RequireTrainingPlanStaff(request, env);
    if (response) return response;
    const body = await ReadJsonBody(request, 256 * 1024);
    const input = body.ok && NormalizeTrainingPlanInput(body.value);
    if (!input) return ErrorResponse(request, env, 'Invalid training plan.', 400);
    const denied = await CheckTrainingPlanPatient(request, env, user, input.patientId);
    if (denied) return denied;
    return JsonResponse(request, env, await CreateTrainingPlan(env, user, input), { status: 201 });
  } catch (error) {
    console.error('Unable to create training plan.', error);
    return ErrorResponse(request, env, 'Unable to create training plan.', 500);
  }
}

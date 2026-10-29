import { ErrorResponse, JsonResponse, OptionsResponse, RejectDisallowedOrigin, RequireSession } from '../../_lib/auth.js';
import { ReadTrainingPlan, TrainingPlansDisabledResponse } from '../../_lib/trainingPlans.js';

export function onRequestOptions({ request, env }) {
  return TrainingPlansDisabledResponse(request, env) || OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const disabled = TrainingPlansDisabledResponse(request, env);
  if (disabled) return disabled;
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  try {
    const session = await RequireSession(request, env);
    if (!session?.sub) return ErrorResponse(request, env, 'Unauthorized.', 401);
    return JsonResponse(request, env, await ReadTrainingPlan(env, session.sub));
  } catch (error) {
    console.error('Unable to read current training plan.', error);
    return ErrorResponse(request, env, 'Unable to read current training plan.', 500);
  }
}

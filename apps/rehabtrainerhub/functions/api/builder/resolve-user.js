import { ErrorResponse, JsonResponse, RequireDatabase } from '../../_lib/auth.js';
import { CheckBuilderSecret } from '../../_lib/builderAuth.js';

export async function onRequestPost({ request, env }) {
  const denied = CheckBuilderSecret(request, env); if (denied) return denied;
  let input; try { input = await request.json(); } catch { return ErrorResponse(request, env, 'Invalid request.', 400); }
  const email = String(input?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return ErrorResponse(request, env, 'Invalid email.', 400);
  const user = await RequireDatabase(env).prepare('SELECT id,display_name,email FROM app_users WHERE lower(email)=? LIMIT 1').bind(email).first();
  if (!user) return ErrorResponse(request, env, 'Account not found.', 404);
  return JsonResponse(request, env, { user: { id: user.id, displayName: user.display_name || user.email || 'Hub user' } });
}

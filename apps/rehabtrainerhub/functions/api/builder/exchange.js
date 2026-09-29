import { ErrorResponse, JsonResponse, RequireDatabase } from '../../_lib/auth.js';
import { CheckBuilderSecret, Sha256Hex } from '../../_lib/builderAuth.js';

export async function onRequestPost({ request, env }) {
  const denied = CheckBuilderSecret(request, env); if (denied) return denied;
  let input; try { input = await request.json(); } catch { return ErrorResponse(request, env, 'Invalid request.', 400); }
  if (!/^[0-9a-f]{64}$/.test(input?.code || '') || !/^[0-9a-f]{64}$/.test(input?.code_verifier || '')) {
    return ErrorResponse(request, env, 'Invalid authorization code.', 400);
  }
  const db = RequireDatabase(env), hash = await Sha256Hex(input.code), now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT user_id,code_challenge FROM builder_auth_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>?')
    .bind(hash, now).first();
  if (!row || row.code_challenge !== await Sha256Hex(input.code_verifier)) return ErrorResponse(request, env, 'Authorization code expired.', 401);
  const used = await db.prepare('UPDATE builder_auth_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL RETURNING user_id')
    .bind(now, hash).first();
  if (!used) return ErrorResponse(request, env, 'Authorization code already used.', 401);
  const user = await db.prepare('SELECT id,display_name,email FROM app_users WHERE id=?').bind(row.user_id).first();
  if (!user) return ErrorResponse(request, env, 'Hub account unavailable.', 401);
  return JsonResponse(request, env, { user: { id: user.id, displayName: user.display_name || user.email || 'Hub user' } });
}

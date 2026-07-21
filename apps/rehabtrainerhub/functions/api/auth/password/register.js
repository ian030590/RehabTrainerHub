import {
  ErrorResponse,
  HashPassword,
  IsValidEmail,
  JsonResponse,
  NormalizeEmail,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../../_lib/auth.js';

const registerAccepted = { ok: true };

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return ErrorResponse(request, env, 'Invalid JSON payload.', 400);
  }

  const displayName = String(payload.displayName || '').trim();
  const email = NormalizeEmail(payload.email);
  const password = String(payload.password || '');
  const privacyAccepted = payload.privacyAccepted === true;

  if (!privacyAccepted) {
    return ErrorResponse(request, env, 'Privacy policy acceptance is required before account creation.', 400);
  }
  if (!displayName || displayName.length > 80 || !IsValidEmail(email) || password.length < 8 || password.length > 128) {
    return ErrorResponse(request, env, 'Invalid account details.', 400);
  }

  const limitError = await RateLimitResponse(request, env, 'password-register', { limit: 5, windowSeconds: 60 });
  if (limitError) return limitError;

  try {
    const db = RequireDatabase(env);
    const existingAccount = await db
      .prepare('SELECT user_id FROM password_accounts WHERE email = ?')
      .bind(email)
      .first();
    if (existingAccount) {
      return JsonResponse(request, env, registerAccepted, { status: 202 });
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      display_name: displayName,
      email,
      avatar_url: null,
      privacy_accepted_at: now,
      profile_completed_at: null,
      profile_json: null,
    };
    const passwordHash = await HashPassword(password);

    try {
      await db.batch([
        db.prepare(`
          INSERT INTO app_users (id, display_name, email, privacy_accepted_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(user.id, displayName, email, now, now, now),
        db.prepare(`
          INSERT INTO password_accounts (email, user_id, password_hash, display_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(email, user.id, passwordHash, displayName, now, now),
      ]);
    } catch (insertError) {
      if (String(insertError).includes('UNIQUE')) {
        return JsonResponse(request, env, registerAccepted, { status: 202 });
      }
      throw insertError;
    }

    return JsonResponse(request, env, registerAccepted, { status: 202 });
  } catch (error) {
    console.error('Password account registration failed.', error);
    return ErrorResponse(request, env, 'Unable to create account.', 500);
  }
}

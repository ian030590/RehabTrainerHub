import {
  errorResponse,
  hashPassword,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  optionsResponse,
  rateLimitResponse,
  rejectDisallowedOrigin,
  requireDatabase,
} from '../../../_lib/auth.js';

const REGISTER_ACCEPTED = { ok: true };

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = rejectDisallowedOrigin(request, env);
  if (originError) return originError;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(request, env, 'Invalid JSON payload.', 400);
  }

  const displayName = String(payload.displayName || '').trim();
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  const privacyAccepted = payload.privacyAccepted === true;

  if (!privacyAccepted) {
    return errorResponse(request, env, 'Privacy policy acceptance is required before account creation.', 400);
  }
  if (!displayName || displayName.length > 80 || !isValidEmail(email) || password.length < 8 || password.length > 128) {
    return errorResponse(request, env, 'Invalid account details.', 400);
  }

  const limitError = await rateLimitResponse(request, env, 'password-register', { limit: 5, windowSeconds: 60 });
  if (limitError) return limitError;

  try {
    const db = requireDatabase(env);
    const existingAccount = await db
      .prepare('SELECT user_id FROM password_accounts WHERE email = ?')
      .bind(email)
      .first();
    if (existingAccount) {
      return jsonResponse(request, env, REGISTER_ACCEPTED, { status: 202 });
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
    const passwordHash = await hashPassword(password);

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
        return jsonResponse(request, env, REGISTER_ACCEPTED, { status: 202 });
      }
      throw insertError;
    }

    return jsonResponse(request, env, REGISTER_ACCEPTED, { status: 202 });
  } catch (error) {
    console.error('Password account registration failed.', error);
    return errorResponse(request, env, 'Unable to create account.', 500);
  }
}

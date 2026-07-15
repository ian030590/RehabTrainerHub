import {
  createSessionCookie,
  createSessionForUser,
  errorResponse,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  optionsResponse,
  rateLimitResponse,
  rejectDisallowedOrigin,
  requireDatabase,
  toPublicUser,
  verifyPassword,
} from '../../../_lib/auth.js';

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

  const ipLimit = await rateLimitResponse(request, env, 'password-login', { limit: 6, windowSeconds: 60 });
  if (ipLimit) return ipLimit;

  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!isValidEmail(email) || !password) {
    return errorResponse(request, env, 'Invalid email or password.', 401);
  }

  const accountLimit = await rateLimitResponse(request, env, 'password-login-account', {
    identity: email,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (accountLimit) return accountLimit;

  try {
    const account = await requireDatabase(env)
      .prepare(`
        SELECT password_accounts.password_hash, app_users.*
        FROM password_accounts
        INNER JOIN app_users ON app_users.id = password_accounts.user_id
        WHERE password_accounts.email = ?
      `)
      .bind(email)
      .first();

    if (!account || !(await verifyPassword(password, account.password_hash))) {
      return errorResponse(request, env, 'Invalid email or password.', 401);
    }

    const token = await createSessionForUser(env, account);
    return jsonResponse(request, env, {
      token,
      user: toPublicUser(account),
    }, {
      headers: {
        'Set-Cookie': createSessionCookie(request, token),
      },
    });
  } catch (error) {
    console.error('Password account login failed.', error);
    return errorResponse(request, env, 'Unable to sign in.', 500);
  }
}

import {
  createSessionCookie,
  createSessionForUser,
  errorResponse,
  isValidEmail,
  jsonResponse,
  normalizeEmail,
  optionsResponse,
  requireDatabase,
  toPublicUser,
  verifyPassword,
} from '../../../_lib/auth.js';

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(request, env, 'Invalid JSON payload.', 400);
  }

  const email = normalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!isValidEmail(email) || !password) {
    return errorResponse(request, env, 'Invalid email or password.', 401);
  }

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

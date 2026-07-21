import {
  CreateSessionCookie,
  CreateSessionForUser,
  ErrorResponse,
  IsValidEmail,
  JsonResponse,
  NormalizeEmail,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
  ToPublicUser,
  VerifyPassword,
} from '../../../_lib/auth.js';

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

  const ipLimit = await RateLimitResponse(request, env, 'password-login', { limit: 6, windowSeconds: 60 });
  if (ipLimit) return ipLimit;

  const email = NormalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!IsValidEmail(email) || !password) {
    return ErrorResponse(request, env, 'Invalid email or password.', 401);
  }

  const accountLimit = await RateLimitResponse(request, env, 'password-login-account', {
    identity: email,
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (accountLimit) return accountLimit;

  try {
    const account = await RequireDatabase(env)
      .prepare(`
        SELECT password_accounts.password_hash, app_users.*
        FROM password_accounts
        INNER JOIN app_users ON app_users.id = password_accounts.user_id
        WHERE password_accounts.email = ?
      `)
      .bind(email)
      .first();

    if (!account || !(await VerifyPassword(password, account.password_hash))) {
      return ErrorResponse(request, env, 'Invalid email or password.', 401);
    }

    const token = await CreateSessionForUser(env, account);
    return JsonResponse(request, env, {
      token,
      user: ToPublicUser(account),
    }, {
      headers: {
        'Set-Cookie': CreateSessionCookie(request, token),
      },
    });
  } catch (error) {
    console.error('Password account login failed.', error);
    return ErrorResponse(request, env, 'Unable to sign in.', 500);
  }
}

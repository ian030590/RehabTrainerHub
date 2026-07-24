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
  TransientRateLimitResponse,
  VerifyPassword,
} from '../../../_lib/auth.js';
import { ReadJsonBody } from '../../../_lib/request.js';
import { VerifyTurnstileToken } from '../../../_lib/turnstile.js';

const maximumAuthBodyBytes = 32 * 1024;
const dummyPasswordHash = [
  'pbkdf2-sha256',
  '150000',
  'AAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
].join('$');

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const transientLimit = TransientRateLimitResponse(request, env, 'password-login-siteverify', {
    limit: 30,
    windowSeconds: 60,
  });
  if (transientLimit) return transientLimit;

  const parsedBody = await ReadJsonBody(request, maximumAuthBodyBytes);
  if (!parsedBody.ok) {
    return ErrorResponse(
      request,
      env,
      parsedBody.reason === 'too-large' ? 'Auth payload is too large.' : 'Invalid JSON payload.',
      parsedBody.reason === 'too-large' ? 413 : 400,
    );
  }
  const payload = parsedBody.value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ErrorResponse(request, env, 'Invalid JSON payload.', 400);
  }

  if (env.TURNSTILE_REQUIRED === '1') {
    const verification = await VerifyTurnstileToken(request, env, payload.turnstileToken, 'auth');
    if (!verification.success) {
      return ErrorResponse(request, env, 'Human verification failed.', 400);
    }
  }

  const ipLimit = await RateLimitResponse(request, env, 'password-login', { limit: 6, windowSeconds: 60 });
  if (ipLimit) return ipLimit;

  const email = NormalizeEmail(payload.email);
  const password = String(payload.password || '');
  if (!IsValidEmail(email) || !password || password.length > 128) {
    return ErrorResponse(request, env, 'Invalid email or password.', 401);
  }

  const accountLimit = await RateLimitResponse(request, env, 'password-login-account', {
    identity: email,
    identityOnly: true,
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

    const passwordMatches = await VerifyPassword(
      password,
      account?.password_hash || dummyPasswordHash,
    );
    if (!account || !passwordMatches) {
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

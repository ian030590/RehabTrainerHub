import {
  AuthPopupHtml,
  CreateOAuthNonceCookie,
  CreateSignedValue,
  ErrorResponse,
  GetAuthBaseUrl,
  GetCookieSession,
  GetStateSecret,
  GetUserById,
  IsSafeReturnTo,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
  ToPublicUser,
  TransientRateLimitResponse,
} from '../../_lib/auth.js';
import { VerifyTurnstileToken } from '../../_lib/turnstile.js';

const providers = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
  },
};

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    return await StartOAuth(request, env);
  } catch (error) {
    console.error('OAuth start failed.', error);
    return ErrorResponse(request, env, 'Unable to start OAuth login.', 500);
  }
}

async function StartOAuth(request, env) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const returnTo = url.searchParams.get('returnTo') || '';
  const privacyAccepted = url.searchParams.get('privacyAccepted') === '1';
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh-TW';
  const turnstileToken = url.searchParams.get('turnstileToken');

  if (!provider || !providers[provider]) {
    return ErrorResponse(request, env, 'Unsupported auth provider.', 400);
  }
  if (!privacyAccepted) {
    return ErrorResponse(request, env, 'Privacy policy acceptance is required before sign-in.', 400);
  }
  if (!IsSafeReturnTo(returnTo, env, request)) {
    return ErrorResponse(request, env, 'Return URL is not allowed.', 400);
  }

  try {
    const existingSession = await GetCookieSession(request, env);
    if (existingSession?.payload?.sub) {
      const existingUser = await GetUserById(env, existingSession.payload.sub);
      if (existingUser) {
        return AuthPopupHtml(returnTo, existingSession.token, ToPublicUser(existingUser));
      }
    }
  } catch (error) {
    console.warn('Existing auth session lookup failed.', error);
  }

  const transientLimit = TransientRateLimitResponse(request, env, 'oauth-start-siteverify', {
    limit: 30,
    windowSeconds: 60,
  });
  if (transientLimit) return transientLimit;

  if (env.TURNSTILE_REQUIRED === '1') {
    const verification = await VerifyTurnstileToken(request, env, turnstileToken, 'auth');
    if (!verification.success) {
      return ErrorResponse(request, env, 'Human verification failed.', 400);
    }
  }

  const limitError = await RateLimitResponse(request, env, 'oauth-start', {
    limit: 10,
    windowSeconds: 60,
  });
  if (limitError) return limitError;

  const config = providers[provider];
  const clientId = env[config.clientId];
  if (!clientId) {
    return ErrorResponse(request, env, `${config.clientId} is not configured.`, 503);
  }

  const authBaseUrl = GetAuthBaseUrl(request, env);
  const redirectUri = `${authBaseUrl}/api/auth/callback`;
  let state;
  const oauthNonce = crypto.randomUUID();
  try {
    state = await CreateSignedValue(
      {
        provider,
        returnTo,
        privacyAccepted,
        locale,
        oauthNonce,
      },
      GetStateSecret(env),
      10 * 60,
    );
  } catch (error) {
    console.error('OAuth state creation failed.', error);
    return ErrorResponse(request, env, 'Auth signing secret is not configured.', 503);
  }

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const redirectResponse = Response.redirect(authUrl.toString(), 302);
  const headers = new Headers(redirectResponse.headers);
  headers.append('Set-Cookie', CreateOAuthNonceCookie(request, oauthNonce));
  return new Response(null, {
    status: redirectResponse.status,
    headers,
  });
}

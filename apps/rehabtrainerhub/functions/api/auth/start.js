import {
  authPopupHtml,
  createSignedValue,
  errorResponse,
  getAuthBaseUrl,
  getCookieSession,
  getStateSecret,
  getUserById,
  isSafeReturnTo,
  optionsResponse,
  toPublicUser,
} from '../../_lib/auth.js';

const providers = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
  },
};

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  const returnTo = url.searchParams.get('returnTo') || '';
  const privacyAccepted = url.searchParams.get('privacyAccepted') === '1';
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'zh-TW';

  if (!provider || !providers[provider]) {
    return errorResponse(request, env, 'Unsupported auth provider.', 400);
  }
  if (!privacyAccepted) {
    return errorResponse(request, env, 'Privacy policy acceptance is required before sign-in.', 400);
  }
  if (!isSafeReturnTo(returnTo, env)) {
    return errorResponse(request, env, 'Return URL is not allowed.', 400);
  }

  const existingSession = await getCookieSession(request, env);
  if (existingSession?.payload?.sub) {
    const existingUser = await getUserById(env, existingSession.payload.sub);
    if (existingUser) {
      return authPopupHtml(returnTo, existingSession.token, toPublicUser(existingUser));
    }
  }

  const config = providers[provider];
  const clientId = env[config.clientId];
  if (!clientId) {
    return errorResponse(request, env, `${config.clientId} is not configured.`, 503);
  }

  const authBaseUrl = getAuthBaseUrl(request, env);
  const redirectUri = `${authBaseUrl}/api/auth/callback`;
  const state = await createSignedValue(
    {
      provider,
      returnTo,
      privacyAccepted,
      locale,
      nonce: crypto.randomUUID(),
    },
    getStateSecret(env),
    10 * 60,
  );

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  return Response.redirect(authUrl.toString(), 302);
}

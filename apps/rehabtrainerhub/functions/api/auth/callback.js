import {
  authPopupHtml,
  createSessionCookie,
  createSessionForUser,
  errorResponse,
  getAuthBaseUrl,
  getStateSecret,
  requireDatabase,
  toPublicUser,
  verifySignedValue,
} from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    return new Response(`OAuth error: ${oauthError}`, { status: 400 });
  }
  if (!code || !stateToken) {
    return new Response('Missing OAuth callback parameters.', { status: 400 });
  }

  let state;
  try {
    state = await verifySignedValue(stateToken, getStateSecret(env));
  } catch {
    return new Response('Invalid OAuth state.', { status: 400 });
  }

  const authBaseUrl = getAuthBaseUrl(request, env);
  const redirectUri = `${authBaseUrl}/api/auth/callback`;
  const identity = state.provider === 'google'
    ? await getGoogleIdentity(env, code, redirectUri)
    : null;

  if (!identity) {
    return errorResponse(request, env, 'Unsupported auth provider.', 400);
  }

  const db = requireDatabase(env);
  const now = new Date().toISOString();
  const existingProvider = await db
    .prepare('SELECT user_id FROM provider_accounts WHERE provider = ? AND provider_user_id = ?')
    .bind(state.provider, identity.providerUserId)
    .first();

  let userId = existingProvider?.user_id;
  if (!userId) {
    userId = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO app_users (
          id, display_name, email, avatar_url, privacy_accepted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userId,
        identity.displayName,
        identity.email,
        identity.avatarUrl,
        state.privacyAccepted ? now : null,
        now,
        now,
      )
      .run();
  } else {
    await db
      .prepare(`
        UPDATE app_users
        SET display_name = ?, email = ?, avatar_url = ?, privacy_accepted_at = COALESCE(privacy_accepted_at, ?), updated_at = ?
        WHERE id = ?
      `)
      .bind(identity.displayName, identity.email, identity.avatarUrl, state.privacyAccepted ? now : null, now, userId)
      .run();
  }

  await db
    .prepare(`
      INSERT INTO provider_accounts (
        provider, provider_user_id, user_id, email, display_name, linked_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_user_id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `)
    .bind(state.provider, identity.providerUserId, userId, identity.email, identity.displayName, now, now)
    .run();

  const userRow = await db.prepare('SELECT * FROM app_users WHERE id = ?').bind(userId).first();
  const token = await createSessionForUser(env, userRow);
  return authPopupHtml(state.returnTo, token, toPublicUser(userRow), {
    headers: {
      'Set-Cookie': createSessionCookie(request, token),
    },
  });
}

async function getGoogleIdentity(env, code, redirectUri) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials are not configured.');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) throw new Error('Google token exchange failed.');

  const tokenPayload = await tokenResponse.json();
  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  if (!userResponse.ok) throw new Error('Google userinfo request failed.');

  const profile = await userResponse.json();
  return {
    providerUserId: String(profile.sub),
    displayName: profile.name || profile.email || 'Google User',
    email: profile.email || null,
    avatarUrl: profile.picture || null,
  };
}

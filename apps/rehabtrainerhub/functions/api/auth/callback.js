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
  try {
    return await handleCallback(request, env);
  } catch (error) {
    console.error('OAuth callback failed.', error);
    return oauthFailureResponse(request, error);
  }
}

async function handleCallback(request, env) {
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
  if (!userRow) throw new Error('User row was not found after OAuth login.');

  const token = await createSessionForUser(env, userRow);
  return authPopupHtml(state.returnTo, token, toPublicUser(userRow), {
    headers: {
      'Set-Cookie': createSessionCookie(request, token),
    },
  });
}

function oauthFailureResponse(request, error) {
  const message = error instanceof Error ? error.message : '';
  const setupError = /not configured|D1 binding|must be configured/i.test(message);
  const databaseError = /D1_ERROR|SQLITE|no such table|provider_accounts|app_users/i.test(message);
  const googleError = /Google/i.test(message);
  const googleCode = message.match(/"error"\s*:\s*"([a-z_]+)"/i)?.[1];
  const status = setupError ? 503 : googleError ? 502 : 500;
  const isEnglish = request.headers.get('Accept-Language')?.toLowerCase().startsWith('en');
  const htmlLang = isEnglish ? 'en' : 'zh-Hant-TW';
  const copies = isEnglish
    ? {
        fallback: 'Sign-in failed temporarily. Please try again later.',
        setup: 'Sign-in setup is incomplete. Check Cloudflare Pages environment variables and the D1 binding.',
        database: 'The sign-in database is not initialized. Apply the D1 migrations and try again.',
        google: `Google OAuth settings do not match${googleCode ? ` (${googleCode})` : ''}. Check the client secret and redirect URI.`,
      }
    : {
        fallback: '登入暫時失敗，請稍後再試。',
        setup: '登入設定尚未完成，請檢查 Cloudflare Pages 環境變數與 D1 binding。',
        database: '登入資料庫尚未初始化，請套用 D1 migrations 後再試。',
        google: `Google OAuth 設定不一致${googleCode ? `（${googleCode}）` : ''}，請確認 client secret 與 redirect URI。`,
      };
  let copy = copies.fallback;
  if (setupError) copy = copies.setup;
  if (databaseError) copy = copies.database;
  if (googleError) copy = copies.google;

  return new Response(`<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Rehab Trainer Hub Login Error</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 700 18px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1c1e; background: #f9f9fc; }
    main { width: min(520px, calc(100% - 32px)); padding: 24px; border-radius: 8px; background: #fff; }
  </style>
</head>
<body>
  <main>
    <p>${copy}</p>
  </main>
</body>
</html>`, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
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
  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '');
    throw new Error(`Google token exchange failed (${tokenResponse.status}): ${body.slice(0, 500)}`);
  }

  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.access_token) throw new Error('Google token response did not include an access token.');

  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });
  if (!userResponse.ok) {
    const body = await userResponse.text().catch(() => '');
    throw new Error(`Google userinfo request failed (${userResponse.status}): ${body.slice(0, 500)}`);
  }

  const profile = await userResponse.json();
  if (!profile.sub) throw new Error('Google userinfo response did not include a subject.');

  return {
    providerUserId: String(profile.sub),
    displayName: profile.name || profile.email || 'Google User',
    email: profile.email || null,
    avatarUrl: profile.picture || null,
  };
}

import { ErrorResponse, RequireDatabase, SecurityHeaders } from '../../_lib/auth.js';
import { GetAuthenticatedUser } from '../../_lib/authorization.js';
import { BuilderOrigin, Sha256Hex } from '../../_lib/builderAuth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const challenge = url.searchParams.get('code_challenge');
  const redirectUri = url.searchParams.get('redirect_uri');
  if (!/^[0-9a-f]{64}$/.test(state || '') || !/^[0-9a-f]{64}$/.test(challenge || '')
    || redirectUri !== `${BuilderOrigin(env)}/api/auth/callback`) {
    return ErrorResponse(request, env, 'Invalid Builder authorization request.', 400);
  }
  const user = await GetAuthenticatedUser(request, env);
  if (!user) {
    const retry = url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return new Response(`<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8"><title>登入居家訓練網</title>
      <main style="font:16px/1.6 system-ui;max-width:36rem;margin:10vh auto;padding:1.5rem">
      <h1>請先登入居家訓練網</h1><p>登入後回到此頁，繼續開啟 Builder。</p>
      <p><a href="/developer">前往居家訓練網登入</a></p><p><a href="${retry}">登入後繼續</a></p></main></html>`,
    { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', ...SecurityHeaders() } });
  }
  const code = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const expires = Math.floor(Date.now() / 1000) + 300;
  await RequireDatabase(env).prepare('INSERT INTO builder_auth_codes (code_hash,user_id,code_challenge,expires_at) VALUES (?,?,?,?)')
    .bind(await Sha256Hex(code), user.id, challenge, expires).run();
  const callback = new URL(redirectUri); callback.searchParams.set('state', state); callback.searchParams.set('code', code);
  return new Response(null, { status: 303, headers: { Location: callback.href, ...SecurityHeaders({ 'Referrer-Policy': 'no-referrer' }) } });
}

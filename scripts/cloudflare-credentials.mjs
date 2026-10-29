import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export async function GetCloudflareCredentials({ env = process.env, readFileImpl = readFile, fetchImpl = fetch } = {}) {
  let token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    const configPath = env.WRANGLER_AUTH_CONFIG || (process.platform === 'win32' && env.APPDATA
      ? resolve(env.APPDATA, 'xdg.config/.wrangler/config/default.toml')
      : resolve(homedir(), '.config/.wrangler/config/default.toml'));
    const source = await readFileImpl(configPath, 'utf8').catch(() => '');
    token = source.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  }
  if (!token) throw new Error('Set CLOUDFLARE_API_TOKEN or sign in with Wrangler.');
  let account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) {
    let response;
    try {
      response = await fetchImpl('https://api.cloudflare.com/client/v4/accounts', {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000),
      });
    } catch { throw new Error('Cloudflare account lookup failed; refresh Wrangler login.'); }
    if (!response.ok) throw new Error(`Cloudflare account lookup failed (${response.status}); refresh Wrangler login.`);
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Cloudflare account lookup returned an invalid response.'); }
    if (data.result?.length !== 1 || typeof data.result[0]?.id !== 'string') throw new Error('Set CLOUDFLARE_ACCOUNT_ID explicitly.');
    account = data.result[0].id;
  }
  return { token, account };
}

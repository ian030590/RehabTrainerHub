import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function WranglerCommand(args, platform = process.platform, env = process.env) {
  const commandArgs = ['--yes', 'wrangler@4', ...args];
  return platform === 'win32'
    ? { file: env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'npx', ...commandArgs] }
    : { file: 'npx', args: commandArgs };
}

async function RunWrangler(args) {
  const command = WranglerCommand(args);
  const { stdout } = await execFileAsync(command.file, command.args, { timeout: 60000 });
  return stdout;
}

export async function GetCloudflareCredentials({ env = process.env, runWranglerImpl = RunWrangler, fetchImpl = fetch } = {}) {
  let token = env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    try {
      const stdout = await runWranglerImpl(['auth', 'token', '--json']);
      const result = JSON.parse(stdout);
      token = typeof result?.token === 'string' && result.token.trim();
    } catch {}
    if (!token) throw new Error('Set CLOUDFLARE_API_TOKEN or sign in with Wrangler (npx wrangler login).');
  }
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

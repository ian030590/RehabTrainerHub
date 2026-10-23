#!/usr/bin/env node
// Runs both Workers in local workerd (`wrangler dev`) with simulated D1/R2 and checks the HTTP
// behavior the Pages deployment has today. Never touches Cloudflare.
//   node scripts/check-workers-local.mjs [--skip-build] [--hub-config=<jsonc>] [--runner-config=<jsonc>]
// HUB_OUTPUT_ROOT / RUNNER_OUTPUT_ROOT point at fixed copies of out/ and dist/.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { defaultRepoRoot } from './pages-apps.mjs';
import { DiscoverWorkerApps, ParseJsonc, workerAssetIgnorePatterns } from './workers-apps.mjs';

const argument = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const apps = DiscoverWorkerApps();
const hub = apps.find((app) => app.role === 'hub');
const runner = apps.find((app) => app.role === 'gamehost');
const registry = JSON.parse(readFileSync(join(defaultRepoRoot, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
const migratedGameId = Object.keys(registry)[0];
const workRoot = mkdtempSync(join(tmpdir(), 'rehab-workers-local-'));
const processes = [];
const results = [];

try {
  if (!process.argv.includes('--skip-build')) RunNode(['scripts/build-workers.mjs']);
  const hubSite = await StartWorker({
    app: hub,
    configPath: argument('--hub-config') ?? join(hub.appDir, 'wrangler.workers.jsonc'),
    outputRoot: process.env.HUB_OUTPUT_ROOT ?? hub.assetsDirectory,
    // A legacy asset that Pages could still hold in cache; the middleware must answer 410 first.
    plant: { [`games/${migratedGameId}/settings.json`]: '{"legacy":true}' },
    variables: ['AUTH_SESSION_SECRET:local-session-secret-for-workers-check', 'AUTH_STATE_SECRET:local-state-secret-for-workers-check'],
  });
  const runnerSite = await StartWorker({
    app: runner,
    configPath: argument('--runner-config') ?? join(runner.appDir, 'wrangler.workers.jsonc'),
    outputRoot: process.env.RUNNER_OUTPUT_ROOT ?? runner.assetsDirectory,
    // A static file under /games/* must never bypass the approved-release checks.
    plant: { 'games/probe-game/1.0.0/index.html': 'planted static game bypass' },
    variables: [],
  });

  await CheckHub(hubSite);
  await CheckRunner(runnerSite);
} finally {
  for (const child of processes) StopProcess(child);
  rmSync(workRoot, { recursive: true, force: true });
}

const failed = results.filter((result) => !result.ok);
for (const result of results) console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : `\n     ${result.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} local Workers HTTP checks passed.`);
if (failed.length > 0) process.exitCode = 1;

async function CheckHub(site) {
  const home = await Get(site, '/');
  Expect('hub / serves the page with _headers and Pages defaults', home.status === 200
    && home.headers['content-security-policy'] === "frame-ancestors 'self'"
    && home.headers['strict-transport-security'] === 'max-age=31536000; includeSubDomains'
    && home.headers['access-control-allow-origin'] === '*'
    && home.headers['x-content-type-options'] === 'nosniff'
    && home.headers['referrer-policy'] === 'strict-origin-when-cross-origin', home);
  const head = await Get(site, '/', { method: 'HEAD' });
  Expect('hub HEAD / has no body', head.status === 200 && head.body === '', head);
  for (const [path, location] of [['/about', '/about/'], ['/about/index.html', '/about/']]) {
    const response = await Get(site, path);
    Expect(`hub ${path} redirects permanently (308) to ${location}`, response.status === 308 && response.headers.location === location, response);
  }
  const missing = await Get(site, '/no-such-page/');
  Expect('hub unknown page returns the 404 page with no-store', missing.status === 404
    && /<html/i.test(missing.body) && missing.headers['cache-control'] === 'no-store', missing);
  const missingApi = await Get(site, '/api/no-such-api');
  Expect('hub unknown API is not a 200 HTML page', missingApi.status === 404, missingApi);
  const legacy = await Get(site, `/games/${migratedGameId}/settings.json`);
  Expect(`hub migrated ${migratedGameId} asset is 410 before assets`, legacy.status === 410
    && legacy.headers['cache-control'] === 'no-store' && !legacy.body.includes('legacy'), legacy);
  const legacyEntry = await Get(site, `/games/${migratedGameId}/`);
  // Every official game is on R2 now, so the per-game headers are checked on a migrated entry.
  Expect(`hub migrated ${migratedGameId} entry still serves the R2 link page with per-game headers`, legacyEntry.status === 200
    && legacyEntry.headers['referrer-policy'] === 'no-referrer'
    && legacyEntry.headers['x-robots-tag'] === 'noindex, nofollow, noarchive', legacyEntry);
  const serviceWorker = await Get(site, '/sw.js');
  Expect('hub /sw.js keeps no-cache and scope headers', serviceWorker.status === 200
    && serviceWorker.headers['cache-control'] === 'no-cache, no-store, must-revalidate'
    && serviceWorker.headers['service-worker-allowed'] === '/', serviceWorker);
  const catalog = await Get(site, '/api/games');
  Expect('hub /api/games reaches Functions with D1 and R2 bindings', catalog.status === 200
    && /application\/json/.test(catalog.headers['content-type'] ?? '')
    && catalog.headers['access-control-allow-origin'] === undefined, catalog);
  const retired = await Get(site, `/games/${migratedGameId}/settings.json`, { host: 'rehabtrainerhub.pages.dev' });
  Expect('hub old Pages hostname redirects to trainerhub.cc before assets', retired.status === 301
    && retired.headers.location === 'https://trainerhub.cc/', retired);
  for (const path of ['/_headers', '/.assetsignore', '/worker/index.js', '/wrangler.workers.jsonc', '/functions/_middleware.js']) {
    const response = await Get(site, path);
    Expect(`hub ${path} is not downloadable`, response.status === 404, response);
  }
}

async function CheckRunner(site) {
  const planted = await Get(site, '/games/probe-game/1.0.0/');
  Expect('runner /games/* goes through release checks before assets', planted.status === 404
    && !planted.body.includes('planted static game bypass'), planted);
  const post = await Get(site, '/games/probe-game/1.0.0/', { method: 'POST' });
  Expect('runner rejects POST on game routes', post.status === 405 && post.headers.allow === 'GET, HEAD', post);
  const current = await Get(site, `/games/${migratedGameId}/`);
  Expect('runner refuses a game with no approved current release', current.status === 404, current);
  const runtime = await Get(site, '/runtime/trainerhub-game-bridge-1.0.0.js');
  Expect('runner runtime stays static, CORS-readable and immutable', runtime.status === 200
    && runtime.headers['access-control-allow-origin'] === '*'
    && runtime.headers['cache-control'] === 'public, max-age=31536000, immutable'
    && runtime.headers['content-type'] === 'text/javascript; charset=utf-8'
    && runtime.headers['cross-origin-resource-policy'] === 'cross-origin', runtime);
  const redirect = await Get(site, '/input/eye-tracking-1.1.0/preview.html');
  Expect('runner eye preview .html redirects permanently with the trusted referrer policy', redirect.status === 308
    && redirect.headers.location === '/input/eye-tracking-1.1.0/preview'
    && redirect.headers['referrer-policy'] === 'strict-origin-when-cross-origin', redirect);
  const preview = await Get(site, '/input/eye-tracking-1.1.0/preview');
  Expect('runner eye preview keeps its camera policy and CSP', preview.status === 200
    && /camera=\(self\)/.test(preview.headers['permissions-policy'] ?? '')
    && /script-src 'self' 'unsafe-eval'/.test(preview.headers['content-security-policy'] ?? ''), preview);
  const hand = await Get(site, '/input/hand-tracking-1.0.0/index.js');
  Expect('runner hand input stays static and CORS-readable', hand.status === 200
    && hand.headers['access-control-allow-origin'] === '*', hand);
  const home = await Get(site, '/');
  Expect('runner / keeps noindex and the locked-down CSP', home.status === 200
    && home.headers['x-robots-tag'] === 'noindex, nofollow, noarchive'
    && /default-src 'none'/.test(home.headers['content-security-policy'] ?? ''), home);
  const routes = await Get(site, '/_routes.json');
  Expect('runner /_routes.json is not published', !routes.body.includes('"include"'), routes);
  const unknown = await Get(site, '/no-such-page', { headers: { 'Sec-Fetch-Mode': 'navigate', Accept: 'text/html' } });
  Expect('runner unknown page falls back to index.html like Pages', unknown.status === 200 && /<!doctype html/i.test(unknown.body), unknown);
}

async function StartWorker({ app, configPath, outputRoot, plant, variables }) {
  const directory = join(workRoot, app.workerName);
  const assets = join(directory, 'assets');
  mkdirSync(directory, { recursive: true });
  if (!existsSync(outputRoot)) throw new Error(`${outputRoot} is missing; build ${app.appPath} first.`);
  cpSync(outputRoot, assets, { recursive: true });
  writeFileSync(join(assets, '.assetsignore'), `${workerAssetIgnorePatterns.join('\n')}\n`);
  for (const [file, source] of Object.entries(plant)) {
    mkdirSync(resolve(assets, file, '..'), { recursive: true });
    writeFileSync(join(assets, file), source);
  }

  const config = ParseJsonc(readFileSync(configPath, 'utf8'));
  const configDirectory = resolve(configPath, '..');
  config.main = resolve(configDirectory, config.main);
  config.assets = { ...config.assets, directory: assets };
  delete config.routes;
  for (const database of config.d1_databases ?? []) database.migrations_dir = resolve(configDirectory, database.migrations_dir);
  const localConfig = join(directory, 'wrangler.local.json');
  writeFileSync(localConfig, JSON.stringify(config, null, 2));
  const state = join(directory, 'state');

  for (const database of config.d1_databases ?? []) {
    RunWrangler(['d1', 'migrations', 'apply', database.database_name, '--local', `--config=${localConfig}`, `--persist-to=${state}`], directory);
  }

  const port = await FreePort();
  const log = join(directory, 'wrangler-dev.log');
  const args = ['--yes', 'wrangler@4', 'dev', `--config=${localConfig}`, '--ip=127.0.0.1', `--port=${port}`,
    `--persist-to=${state}`, '--show-interactive-dev-session=false', ...variables.flatMap((variable) => ['--var', variable])];
  const command = NpxCommand(args);
  const output = openSync(log, 'w');
  const child = spawn(command.file, command.args, {
    cwd: directory,
    detached: process.platform !== 'win32',
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', output, output],
    windowsHide: true,
  });
  processes.push(child);
  const site = { port };
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev for ${app.workerName} exited:\n${readFileSync(log, 'utf8').slice(-3000)}`);
    try {
      await Get(site, '/robots.txt');
      return site;
    } catch {
      await new Promise((done) => setTimeout(done, 1000));
    }
  }
  throw new Error(`wrangler dev for ${app.workerName} did not start:\n${readFileSync(log, 'utf8').slice(-3000)}`);
}

function Get(site, path, { method = 'GET', host, headers = {} } = {}) {
  return new Promise((done, fail) => {
    const outgoing = request({ host: '127.0.0.1', port: site.port, path, method,
      headers: { ...headers, ...(host ? { Host: host } : {}) } }, (incoming) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => done({ path, status: incoming.statusCode, headers: incoming.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    outgoing.setTimeout(30_000, () => outgoing.destroy(new Error(`timeout ${path}`)));
    outgoing.on('error', fail);
    outgoing.end();
  });
}

function Expect(name, ok, response) {
  const detail = response ? `${response.status} ${response.path} ${JSON.stringify(response.headers)} ${response.body.slice(0, 120)}` : '';
  results.push({ name, ok: Boolean(ok), detail });
}

function FreePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.on('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

function NpxCommand(args) {
  return process.platform === 'win32'
    ? { file: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'npx', ...args] }
    : { file: 'npx', args };
}

function RunWrangler(args, cwd) {
  const command = NpxCommand(['--yes', 'wrangler@4', ...args]);
  const result = spawnSync(command.file, command.args, { cwd, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
}

function RunNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: defaultRepoRoot, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`node ${args.join(' ')} failed with exit code ${result.status}.`);
}

function StopProcess(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

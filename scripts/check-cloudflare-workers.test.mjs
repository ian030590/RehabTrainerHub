import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { CreatePagesCompatibleWorker } from '../workers/shared/pagesAssetCompat.js';
import { DiscoverPagesApps, defaultRepoRoot } from './pages-apps.mjs';
import {
  CreateHubWorkerSecrets,
  DiscoverWorkerApps,
  FindForbiddenAssetFiles,
  FindProductionEntryProblems,
  FindWorkerConfigProblems,
  ParseJsonc,
  workerAssetIgnorePatterns,
} from './workers-apps.mjs';

const registry = JSON.parse(readFileSync(resolve(defaultRepoRoot, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
const runnerRoutes = JSON.parse(readFileSync(resolve(defaultRepoRoot, 'apps/usergamerunner/public/_routes.json'), 'utf8'));

function LoadApps() {
  const apps = DiscoverWorkerApps();
  return {
    apps,
    hub: apps.find((app) => app.role === 'hub'),
    runner: apps.find((app) => app.role === 'gamehost'),
  };
}

function WithConfig(app, change) {
  const config = structuredClone(app.config);
  change(config);
  return { ...app, config };
}

test('Workers use the owner-confirmed names and reuse every Pages binding unchanged', () => {
  const { apps, hub, runner } = LoadApps();
  assert.equal(apps.length, 2);
  assert.equal(hub.workerName, 'trainerhub');
  assert.equal(runner.workerName, 'trainerhubgames');
  assert.deepEqual(FindWorkerConfigProblems(apps), []);

  const pagesHub = DiscoverPagesApps().find((app) => app.role === 'hub');
  assert.equal(hub.pagesApp.projectName, pagesHub.projectName, 'Pages config stays as the rollback deployment');
  assert.deepEqual(hub.config.d1_databases, [{
    binding: 'REHAB_DB',
    database_name: 'rehab_db',
    database_id: '0f4e6bb2-cf41-4051-ad74-19bb501fe9dd',
    migrations_dir: 'migrations',
  }]);
  assert.deepEqual(hub.config.r2_buckets.map(({ binding, bucket_name: bucketName }) => [binding, bucketName]), [
    ['ASSET_BUCKET', 'rehab-storage'],
    ['OCULOMOTOR_DATA', 'oculomotor-data'],
    ['GAME_QUARANTINE_BUCKET', 'rehab-game-quarantine'],
    ['GAME_RELEASE_BUCKET', 'rehab-game-releases'],
  ]);
  assert.notEqual(hub.config.assets.binding, 'ASSET_BUCKET');
});

test('binding drift from the Pages config is reported instead of creating empty resources', () => {
  const { hub, runner } = LoadApps();
  const renamedDatabase = WithConfig(hub, (config) => { config.d1_databases[0].database_id = 'new-empty-database'; });
  assert.match(FindWorkerConfigProblems([renamedDatabase, runner]).join('\n'), /d1_databases must match wrangler\.toml/);
  const droppedBucket = WithConfig(hub, (config) => { config.r2_buckets.pop(); });
  assert.match(FindWorkerConfigProblems([droppedBucket, runner]).join('\n'), /r2_buckets must match wrangler\.toml/);
  const newDate = WithConfig(hub, (config) => { config.compatibility_date = '2026-10-19'; });
  assert.match(FindWorkerConfigProblems([newDate, runner]).join('\n'), /compatibility_date must stay 2026-07-02/);
});

test('the isolated runner never receives private bindings, variables or secrets', () => {
  const { hub, runner } = LoadApps();
  assert.deepEqual(runner.config.r2_buckets, [{ binding: 'GAME_RELEASE_BUCKET', bucket_name: 'rehab-game-releases' }]);
  for (const [label, change] of [
    ['D1', (config) => { config.d1_databases = [{ binding: 'REHAB_DB', database_name: 'rehab_db', database_id: 'x' }]; }],
    ['KV', (config) => { config.kv_namespaces = [{ binding: 'ARTICLE_CACHE', id: 'x' }]; }],
    ['private R2', (config) => { config.r2_buckets.push({ binding: 'OCULOMOTOR_DATA', bucket_name: 'oculomotor-data' }); }],
    ['vars', (config) => { config.vars = { AUTH_BASE_URL: 'https://trainerhub.cc' }; }],
    ['service', (config) => { config.services = [{ binding: 'HUB', service: 'trainerhub' }]; }],
    ['cron', (config) => { config.triggers = { crons: ['* * * * *'] }; }],
  ]) {
    const problems = FindWorkerConfigProblems([hub, WithConfig(runner, change)]).join('\n');
    assert.match(problems, /trainerhubgames/, label);
  }
});

test('asset routing reproduces the Pages Functions order for both sites', () => {
  const { hub, runner } = LoadApps();
  // Pages generated "/*" for the Hub because functions/_middleware.js sits at the root.
  assert.equal(hub.config.assets.run_worker_first, true);
  assert.equal(hub.config.assets.not_found_handling, '404-page');
  assert.deepEqual(runner.config.assets.run_worker_first, [
    ...runnerRoutes.include,
    ...runnerRoutes.exclude.map((pattern) => `!${pattern}`),
  ]);
  // The runner has no 404.html, so Pages served index.html for unknown paths.
  assert.equal(runner.config.assets.not_found_handling, 'single-page-application');
  assert.equal(hub.config.workers_dev, false);
  for (const app of [hub, runner]) {
    assert.equal(app.config.assets.binding, 'ASSETS');
    assert.equal(app.config.assets.directory, app.pagesApp.outputDir);
    assert.equal(app.config.preview_urls, false);
  }

  const assetsFirst = WithConfig(hub, (config) => { delete config.assets.run_worker_first; });
  assert.match(FindWorkerConfigProblems([assetsFirst, runner]).join('\n'), /run_worker_first/);
  const staleRunnerRoutes = WithConfig(runner, (config) => { config.assets.run_worker_first = ['/games/*']; });
  assert.match(FindWorkerConfigProblems([hub, staleRunnerRoutes]).join('\n'), /_routes\.json/);
});

test('Worker code, configs and Pages-only files never become public assets', (context) => {
  const { hub, runner } = LoadApps();
  for (const app of [hub, runner]) {
    const mainFromAssets = relative(app.assetsDirectory, app.mainPath);
    assert.ok(mainFromAssets.startsWith('..'), `${app.workerName} entry must stay outside ${app.config.assets.directory}/`);
    assert.match(readFileSync(app.mainPath, 'utf8'), /from '\.\.\/\.worker\/functions\/index\.js'/);
  }
  assert.ok(workerAssetIgnorePatterns.includes('_routes.json'));

  const fixture = mkdtempSync(join(tmpdir(), 'rehab-worker-assets-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const file of ['index.html', '_headers', 'games/x/index.html', '_worker.js', 'app.js.map',
    'wrangler.workers.jsonc', '.dev.vars', 'nested/.env.production', 'functions/api/records.js']) {
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    writeFileSync(join(fixture, file), 'x');
  }
  assert.deepEqual(FindForbiddenAssetFiles(fixture).sort(), [
    '.dev.vars', '_worker.js', 'app.js.map', 'functions/api/records.js', 'nested/.env.production', 'wrangler.workers.jsonc',
  ]);
});

test('no Worker routes the retired trainer subdomains', () => {
  const retiredHosts = ['motor', 'vision', 'brain', 'mouth'].map((name) => `${name}.trainerhub.cc`);
  for (const app of DiscoverWorkerApps()) {
    const patterns = (app.config.routes ?? []).map((route) => route.pattern);
    for (const host of retiredHosts) {
      assert.equal(patterns.some((pattern) => pattern.startsWith(host)), false, `${app.workerName} still routes ${host}`);
    }
  }
});

test('production entry points match the owner-approved C02 origins', () => {
  const { apps, hub, runner } = LoadApps();
  assert.deepEqual(FindProductionEntryProblems(apps, registry), []);
  assert.equal(runner.siteUrl, 'https://trainerhubgames.rainbowh9490.workers.dev');
  assert.equal(runner.config.workers_dev, true);
  // zone_id avoids a Zone:Read lookup with the CI token. trainerhub.cc is attached as a Worker custom domain;
  // wrangler replaces every route and custom domain of the Worker with this list on deploy.
  assert.deepEqual(hub.config.routes, [
    { pattern: hub.hostname, custom_domain: true, zone_id: '5851e45310addcd4587d15f8356340e5' },
  ]);
  // pages-apps.mjs still names the deleted Pages runner for an explicit CLOUDFLARE_DEPLOY_TARGET=pages deploy.
  assert.equal(runner.pagesApp.deploymentUrl, 'https://trainerhub-user-games.pages.dev');

  const unroutedHub = WithConfig(hub, (config) => { delete config.routes; });
  const unrouted = FindProductionEntryProblems([unroutedHub, runner], registry).join('\n');
  assert.match(unrouted, /trainerhub: no route serves trainerhub\.cc \(C02\)/);
  const pagesRunner = { ...runner, siteUrl: runner.pagesApp.deploymentUrl, hostname: new URL(runner.pagesApp.deploymentUrl).hostname };
  const pagesRegistry = Object.fromEntries(Object.entries(registry).map(([id, entry]) => [id, { ...entry, origin: pagesRunner.siteUrl }]));
  assert.match(FindProductionEntryProblems([hub, pagesRunner], pagesRegistry).join('\n'),
    /trainerhubgames: homepage https:\/\/trainerhub-user-games\.pages\.dev is a Pages origin/);

  const routedHub = WithConfig(hub, (config) => {
    config.routes = [{ pattern: `${hub.hostname}/*`, zone_name: 'trainerhub.cc' }];
  });
  const newOrigin = 'https://trainerhubgames.example.workers.dev';
  const workersDevRunner = { ...WithConfig(runner, (config) => { config.workers_dev = true; }), siteUrl: newOrigin, hostname: new URL(newOrigin).hostname };
  const movedRegistry = Object.fromEntries(Object.entries(registry).map(([id, entry]) => [id, { ...entry, origin: newOrigin }]));
  assert.deepEqual(FindProductionEntryProblems([routedHub, workersDevRunner], movedRegistry), []);

  assert.match(FindProductionEntryProblems([routedHub, workersDevRunner], registry).join('\n'),
    /officialGameReleases\.json origin .* must equal the runner homepage/);
  const hiddenRunner = WithConfig(workersDevRunner, (config) => { config.workers_dev = false; });
  assert.match(FindProductionEntryProblems([routedHub, hiddenRunner], movedRegistry).join('\n'), /workers_dev must be true/);
  const sameSiteOrigin = 'https://games.trainerhub.cc';
  const sameSiteRunner = {
    ...WithConfig(runner, (config) => { config.routes = [{ pattern: 'games.trainerhub.cc', custom_domain: true }]; }),
    siteUrl: sameSiteOrigin,
    hostname: 'games.trainerhub.cc',
  };
  const sameSiteRegistry = Object.fromEntries(Object.entries(registry).map(([id, entry]) => [id, { ...entry, origin: sameSiteOrigin }]));
  assert.match(FindProductionEntryProblems([routedHub, sameSiteRunner], sameSiteRegistry).join('\n'), /must not share the Hub site/);
});

test('Hub Worker secrets are an explicit runtime allowlist that keeps runner origins out of auth', () => {
  const { apps } = LoadApps();
  const newOrigin = 'https://trainerhubgames.example.workers.dev';
  const movedApps = apps.map((app) => (app.role === 'gamehost' ? { ...app, siteUrl: newOrigin, hostname: new URL(newOrigin).hostname } : app));
  const environment = {
    AUTH_SESSION_SECRET: 'session-secret',
    AUTH_STATE_SECRET: 'state-secret',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    TURNSTILE_SITE_KEY: 'site-key',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    TURNSTILE_REQUIRED: '1',
    TURNSTILE_RECORDS_REQUIRED: '1',
    ANONYMOUS_RECORDS_ENABLED: '1',
    GAME_RELEASE_OWNER_USER_ID: 'owner-id',
    CLOUDFLARE_API_TOKEN: 'deploy-token',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
    VITE_AI_ASSET_BASE_URL: 'https://assets.example',
    SOME_PRIVATE_TOKEN: 'unrelated',
  };
  const secrets = CreateHubWorkerSecrets(environment, movedApps);
  assert.deepEqual(Object.keys(secrets).sort(), [
    'ADMIN_ALLOW_BEARER', 'ANONYMOUS_RECORDS_ENABLED', 'AUTH_ALLOWED_ORIGINS', 'AUTH_ALLOW_LOCAL_ORIGINS',
    'AUTH_BASE_URL', 'AUTH_SESSION_SECRET', 'AUTH_STATE_SECRET', 'GAME_RELEASE_OWNER_USER_ID', 'GAME_RUNNER_ORIGIN',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TURNSTILE_RECORDS_REQUIRED', 'TURNSTILE_REQUIRED',
    'TURNSTILE_SECRET_KEY', 'TURNSTILE_SKIP_HOSTNAME_CHECK',
  ]);
  assert.equal(secrets.AUTH_BASE_URL, 'https://trainerhub.cc');
  assert.equal(secrets.AUTH_ALLOWED_ORIGINS, 'https://trainerhub.cc');
  assert.equal(secrets.GAME_RUNNER_ORIGIN, newOrigin);
  for (const name of ['ADMIN_ALLOW_BEARER', 'AUTH_ALLOW_LOCAL_ORIGINS', 'TURNSTILE_SKIP_HOSTNAME_CHECK']) assert.equal(secrets[name], '0');

  const withoutOptional = CreateHubWorkerSecrets({ ...environment, TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '',
    TURNSTILE_REQUIRED: '0', TURNSTILE_RECORDS_REQUIRED: '0', ANONYMOUS_RECORDS_ENABLED: '0', GAME_RELEASE_OWNER_USER_ID: '' }, movedApps);
  assert.equal('TURNSTILE_SECRET_KEY' in withoutOptional, false, 'empty values are not uploaded as secrets');
  assert.equal('GAME_RELEASE_OWNER_USER_ID' in withoutOptional, false);

  for (const blocked of [newOrigin, 'https://trainerhub-user-games.pages.dev']) {
    assert.throws(() => CreateHubWorkerSecrets({ ...environment, AUTH_ALLOWED_ORIGINS: blocked }, movedApps), /must not include game runner origin/);
    assert.throws(() => CreateHubWorkerSecrets({ ...environment, AUTH_API_BASE: blocked }, movedApps), /must not use a game runner origin/);
  }
  assert.throws(() => CreateHubWorkerSecrets({ ...environment, TURNSTILE_SECRET_KEY: '' }, movedApps), /configured together/);
  assert.throws(() => CreateHubWorkerSecrets({ ...environment, AUTH_SESSION_SECRET: '' }, movedApps), /AUTH_SESSION_SECRET/);
  assert.throws(() => CreateHubWorkerSecrets({ ...environment, TURNSTILE_RECORDS_REQUIRED: '0' }, movedApps), /ANONYMOUS_RECORDS_ENABLED=1 requires/);
});

test('asset responses keep Pages defaults while Function responses stay untouched', async () => {
  const assetCalls = [];
  const database = { name: 'REHAB_DB' };
  const assets = {
    async fetch(request) {
      const url = new URL(request.url);
      assetCalls.push(url.pathname);
      if (url.pathname === '/about') return new Response(null, { status: 307, headers: { Location: '/about/' } });
      if (url.pathname === '/missing/') return new Response('404 page', { status: 404, headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } });
      if (url.pathname === '/games/x/') return new Response('game', { headers: { 'Referrer-Policy': 'no-referrer', 'Access-Control-Allow-Origin': 'https://only.example' } });
      return new Response('home', { headers: { 'Content-Security-Policy': "frame-ancestors 'self'" } });
    },
  };
  let seenDatabase;
  const worker = CreatePagesCompatibleWorker({
    async fetch(request, env) {
      seenDatabase = env.REHAB_DB;
      if (new URL(request.url).pathname === '/api/fn') return new Response('fn', { headers: { 'Content-Type': 'application/json' } });
      return env.ASSETS.fetch(request);
    },
  });
  const env = { ASSETS: assets, REHAB_DB: database };
  const read = (path) => worker.fetch(new Request(`https://trainerhub.cc${path}`), env, { waitUntil() {} });

  const home = await read('/');
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('content-security-policy'), "frame-ancestors 'self'");
  assert.equal(home.headers.get('access-control-allow-origin'), '*');
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(home.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(await home.text(), 'home');
  assert.equal(seenDatabase, database);

  const redirect = await read('/about');
  assert.equal(redirect.status, 308, 'Pages answered trailing-slash redirects with 308');
  assert.equal(redirect.headers.get('location'), '/about/');

  const missing = await read('/missing/');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  assert.equal(await missing.text(), '404 page');

  const game = await read('/games/x/');
  assert.equal(game.headers.get('referrer-policy'), 'no-referrer', '_headers values win over defaults');
  assert.equal(game.headers.get('access-control-allow-origin'), 'https://only.example');

  const generated = await read('/api/fn');
  assert.equal(generated.headers.get('access-control-allow-origin'), null);
  assert.equal(generated.headers.get('referrer-policy'), null);
  assert.deepEqual(assetCalls, ['/', '/about', '/missing/', '/games/x/']);
});

test('text assets declare UTF-8 like Pages so Chinese llms.txt is not misread', async () => {
  const types = {
    '/llms.txt': 'text/plain',
    '/': 'text/html',
    '/missing/': 'text/html',
    '/legacy.css': 'text/css; charset=iso-8859-1',
    '/settings.json': 'application/json',
    '/logo.svg': 'image/svg+xml',
  };
  const assets = {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      return new Response('x', { status: pathname === '/missing/' ? 404 : 200, headers: { 'Content-Type': types[pathname] } });
    },
  };
  const worker = CreatePagesCompatibleWorker({
    async fetch(request, env) {
      if (new URL(request.url).pathname === '/api/text') return new Response('fn', { headers: { 'Content-Type': 'text/plain' } });
      return env.ASSETS.fetch(request);
    },
  });
  const read = async (path) => (await worker.fetch(new Request(`https://trainerhub.cc${path}`), { ASSETS: assets }, { waitUntil() {} }))
    .headers.get('content-type');

  assert.equal(await read('/llms.txt'), 'text/plain; charset=utf-8');
  assert.equal(await read('/'), 'text/html; charset=utf-8');
  assert.equal(await read('/missing/'), 'text/html; charset=utf-8');
  assert.equal(await read('/legacy.css'), 'text/css; charset=iso-8859-1', 'a declared charset is kept');
  assert.equal(await read('/settings.json'), 'application/json');
  assert.equal(await read('/logo.svg'), 'image/svg+xml');
  assert.equal(await read('/api/text'), 'text/plain', 'Function responses keep their own headers');
});

test('deploy dry-run migrates D1, deploys the runner before the Hub, and hands secrets over only by file', (context) => {
  const fixture = CreateDeployFixture(context);
  const environment = {
    ...process.env,
    AUTH_SESSION_SECRET: 'session-secret-value',
    AUTH_STATE_SECRET: 'state-secret-value',
    GOOGLE_CLIENT_ID: 'google-id-value',
    GOOGLE_CLIENT_SECRET: 'google-secret-value',
    GAME_RELEASE_OWNER_USER_ID: 'private-owner-id',
  };
  const result = spawnSync(process.execPath, [join(fixture, 'scripts/deploy-cloudflare-workers.mjs'), '--dry-run'],
    { cwd: fixture, encoding: 'utf8', env: environment });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);

  const markers = [
    '$ node scripts/build-workers.mjs',
    '$ npx --yes wrangler@4 d1 migrations apply rehab_db --remote --config=apps/rehabtrainerhub/wrangler.workers.jsonc',
    '$ npx --yes wrangler@4 deploy --config=apps/usergamerunner/wrangler.workers.jsonc',
    '$ npx --yes wrangler@4 deploy --config=apps/rehabtrainerhub/wrangler.workers.jsonc --secrets-file=trainerhub.secrets.json',
  ];
  let previous = -1;
  for (const marker of markers) {
    const index = output.indexOf(marker);
    assert.ok(index > previous, `expected ${JSON.stringify(marker)} in order:\n${output}`);
    previous = index;
  }
  assert.match(output, /- trainerhubgames: no secrets \(isolated runner\)/);
  assert.match(output, /- trainerhub secrets: .*AUTH_SESSION_SECRET/);
  assert.doesNotMatch(output, /deploy --config=apps\/usergamerunner\/wrangler\.workers\.jsonc --secrets-file/);
  assert.doesNotMatch(output, /session-secret-value|state-secret-value|google-secret-value|private-owner-id/);

  const runnerOnly = spawnSync(process.execPath, [join(fixture, 'scripts/deploy-cloudflare-workers.mjs'), '--dry-run', '--only=gamehost'],
    { cwd: fixture, encoding: 'utf8', env: environment });
  assert.equal(runnerOnly.status, 0, runnerOnly.stderr);
  assert.match(runnerOnly.stdout, /deploy --config=apps\/usergamerunner\/wrangler\.workers\.jsonc/);
  assert.doesNotMatch(runnerOnly.stdout, /rehabtrainerhub\/wrangler\.workers\.jsonc|d1 migrations/);
});

test('a deploy without Hub routes is refused before wrangler runs', (context) => {
  const fixture = CreateDeployFixture(context);
  const configPath = join(fixture, 'apps/rehabtrainerhub/wrangler.workers.jsonc');
  const config = ParseJsonc(readFileSync(configPath, 'utf8'));
  delete config.routes;
  writeFileSync(configPath, JSON.stringify(config));
  const result = spawnSync(process.execPath, [join(fixture, 'scripts/deploy-cloudflare-workers.mjs'), '--dry-run'],
    { cwd: fixture, encoding: 'utf8', env: { ...process.env, AUTH_SESSION_SECRET: '', AUTH_STATE_SECRET: '' } });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0);
  assert.match(output, /Refusing to deploy Cloudflare Workers/);
  assert.match(output, /no route serves trainerhub\.cc \(C02\)/);
  assert.doesNotMatch(output, /\$ npx/);
});

test('the real repository dry run deploys both Workers in order', () => {
  const result = spawnSync(process.execPath, [resolve(defaultRepoRoot, 'scripts/deploy-cloudflare-workers.mjs'), '--dry-run'],
    { cwd: defaultRepoRoot, encoding: 'utf8', env: { ...process.env, AUTH_SESSION_SECRET: '', AUTH_STATE_SECRET: '' } });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  const runner = output.indexOf('deploy --config=apps/usergamerunner/wrangler.workers.jsonc');
  const hub = output.indexOf('deploy --config=apps/rehabtrainerhub/wrangler.workers.jsonc --secrets-file=');
  assert.ok(runner > 0 && hub > runner, output);
});

test('the deploy workflow deploys Workers by default and Pages only when the repository variable asks for it', () => {
  const deploy = readFileSync(resolve(defaultRepoRoot, '.github/workflows/deploy-cloudflare-pages.yml'), 'utf8').replaceAll('\r\n', '\n');
  const ci = readFileSync(resolve(defaultRepoRoot, '.github/workflows/ci.yml'), 'utf8').replaceAll('\r\n', '\n');
  const pagesStep = StepBlock(deploy, 'Ensure and deploy Cloudflare Pages projects');
  const workersStep = StepBlock(deploy, 'Deploy Cloudflare Workers');
  // The Pages projects were deleted; removing the variable must not recreate them.
  assert.match(pagesStep, /if: \$\{\{ vars\.CLOUDFLARE_DEPLOY_TARGET == 'pages' \}\}/);
  // workflow_dispatch can run on any branch; only main may replace the production Workers.
  assert.match(workersStep, /if: \$\{\{ vars\.CLOUDFLARE_DEPLOY_TARGET != 'pages' && github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(workersStep, /run: node scripts\/deploy-cloudflare-workers\.mjs\n/);
  for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'AUTH_SESSION_SECRET', 'AUTH_STATE_SECRET',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TURNSTILE_SECRET_KEY', 'GAME_RELEASE_OWNER_USER_ID']) {
    assert.match(workersStep, new RegExp(`${name}: \\$\\{\\{ (?:secrets|vars)\\.${name} \\}\\}`), name);
  }
  assert.deepEqual(MatrixCommands(deploy), MatrixCommands(ci));
});

function StepBlock(workflow, name) {
  const start = workflow.indexOf(`- name: ${name}\n`);
  assert.ok(start >= 0, `missing workflow step ${name}`);
  const next = workflow.indexOf('\n      - name: ', start + 1);
  return workflow.slice(start, next < 0 ? undefined : next + 1);
}

function MatrixCommands(workflow) {
  return [...workflow.matchAll(/^\s+command: (.+)$/gm)].map((match) => match[1]);
}

function CreateDeployFixture(context) {
  const fixture = mkdtempSync(join(tmpdir(), 'rehab-workers-deploy-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  for (const script of ['deploy-cloudflare-workers.mjs', 'workers-apps.mjs', 'pages-apps.mjs', 'gamehost-environment.mjs']) {
    mkdirSync(join(fixture, 'scripts'), { recursive: true });
    copyFileSync(resolve(defaultRepoRoot, 'scripts', script), join(fixture, 'scripts', script));
  }
  const runnerOrigin = 'https://trainerhubgames.example.workers.dev';
  const files = {
    'packages/ui/src/officialGameReleases.json': JSON.stringify({ 'fixture-game': { origin: runnerOrigin, name: 'Fixture' } }),
    'apps/rehabtrainerhub/package.json': JSON.stringify({ name: 'hub', homepage: 'https://trainerhub.cc',
      scripts: { build: 'node -e ""' }, rehabTrainer: { role: 'hub' } }),
    'apps/rehabtrainerhub/wrangler.toml': [
      'name = "rehabtrainerhub"', 'compatibility_date = "2026-07-02"', 'pages_build_output_dir = "out"', '',
      '[[d1_databases]]', 'binding = "REHAB_DB"', 'database_name = "rehab_db"', 'database_id = "db-id"', 'migrations_dir = "migrations"', '',
      '[[r2_buckets]]', 'binding = "GAME_RELEASE_BUCKET"', 'bucket_name = "rehab-game-releases"', '',
    ].join('\n'),
    'apps/rehabtrainerhub/wrangler.workers.jsonc': `// fixture\n${JSON.stringify({
      name: 'trainerhub', main: 'worker/index.js', compatibility_date: '2026-07-02', workers_dev: false, preview_urls: false,
      routes: [{ pattern: 'trainerhub.cc/*', zone_name: 'trainerhub.cc' }],
      assets: { directory: 'out', binding: 'ASSETS', run_worker_first: true, not_found_handling: '404-page', html_handling: 'auto-trailing-slash' },
      d1_databases: [{ binding: 'REHAB_DB', database_name: 'rehab_db', database_id: 'db-id', migrations_dir: 'migrations' }],
      r2_buckets: [{ binding: 'GAME_RELEASE_BUCKET', bucket_name: 'rehab-game-releases' }],
    }, null, 2)}\n`,
    'apps/rehabtrainerhub/worker/index.js': "import pagesFunctions from '../.worker/functions/index.js';\n",
    'apps/usergamerunner/package.json': JSON.stringify({ name: 'runner', homepage: runnerOrigin,
      scripts: { build: 'node -e ""' }, rehabTrainer: { role: 'gamehost' } }),
    'apps/usergamerunner/wrangler.toml': [
      'name = "trainerhub-user-games"', 'compatibility_date = "2026-08-17"', 'pages_build_output_dir = "dist"', '',
      '[[r2_buckets]]', 'binding = "GAME_RELEASE_BUCKET"', 'bucket_name = "rehab-game-releases"', '',
    ].join('\n'),
    'apps/usergamerunner/public/_routes.json': JSON.stringify({ version: 1, include: ['/games/*'], exclude: ['/runtime/*'] }),
    'apps/usergamerunner/wrangler.workers.jsonc': JSON.stringify({
      name: 'trainerhubgames', main: 'worker/index.js', compatibility_date: '2026-08-17', workers_dev: true, preview_urls: false,
      assets: { directory: 'dist', binding: 'ASSETS', run_worker_first: ['/games/*', '!/runtime/*'],
        not_found_handling: 'single-page-application', html_handling: 'auto-trailing-slash' },
      r2_buckets: [{ binding: 'GAME_RELEASE_BUCKET', bucket_name: 'rehab-game-releases' }],
    }, null, 2),
    'apps/usergamerunner/worker/index.js': "import pagesFunctions from '../.worker/functions/index.js';\n",
  };
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(dirname(join(fixture, file)), { recursive: true });
    writeFileSync(join(fixture, file), source);
  }
  return fixture;
}

test('JSONC parsing keeps URLs inside strings and rejects trailing junk', () => {
  assert.deepEqual(ParseJsonc('// note\n{ "a": "https://x.example//y", /* block */ "b": [1, 2] }\n'), { a: 'https://x.example//y', b: [1, 2] });
  assert.throws(() => ParseJsonc('{ "a": 1 } trailing'));
});

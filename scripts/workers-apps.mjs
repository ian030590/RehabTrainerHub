import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { DiscoverPagesApps, defaultRepoRoot } from './pages-apps.mjs';

// Workers configs live next to the Pages wrangler.toml, which stays the rollback deployment
// until the owner retires Pages (docs/workers-migration-plan.md C12).
export const workerConfigFileName = 'wrangler.workers.jsonc';
export const workerNames = { hub: 'trainerhub', gamehost: 'trainerhubgames' };
// Pages consumed _routes.json itself; Workers would publish it as an ordinary file.
export const workerAssetIgnorePatterns = ['_routes.json'];

const bindingKinds = ['d1_databases', 'kv_namespaces', 'r2_buckets'];
const runnerConfigKeys = new Set([
  'name', 'main', 'compatibility_date', 'workers_dev', 'preview_urls', 'routes', 'assets', 'r2_buckets',
]);
const runnerReleaseBuckets = [{ binding: 'GAME_RELEASE_BUCKET', bucket_name: 'rehab-game-releases' }];

export function DiscoverWorkerApps(repoRoot = defaultRepoRoot) {
  return DiscoverPagesApps(repoRoot)
    .filter((pagesApp) => existsSync(join(pagesApp.appDir, workerConfigFileName)))
    .map((pagesApp) => {
      const configPath = join(pagesApp.appDir, workerConfigFileName);
      const config = ParseJsonc(readFileSync(configPath, 'utf8'));
      return {
        role: pagesApp.role,
        appPath: pagesApp.appPath,
        appDir: pagesApp.appDir,
        configFile: `${pagesApp.appPath}/${workerConfigFileName}`,
        config,
        workerName: config.name,
        assetsDirectory: resolve(pagesApp.appDir, String(config.assets?.directory ?? '')),
        mainPath: resolve(pagesApp.appDir, String(config.main ?? '')),
        siteUrl: pagesApp.siteUrl,
        hostname: pagesApp.hostname,
        pagesApp,
      };
    });
}

// Must hold for every candidate, including before C02 assigns public entry points.
export function FindWorkerConfigProblems(apps) {
  const problems = [];
  if (apps.filter((app) => app.role === 'hub').length !== 1 || apps.filter((app) => app.role === 'gamehost').length !== 1) {
    problems.push(`Exactly one hub and one gamehost app need ${workerConfigFileName}.`);
  }

  for (const app of apps) {
    const { config } = app;
    const label = workerNames[app.role] ?? app.configFile;
    const pages = ParsePagesToml(readFileSync(join(app.appDir, 'wrangler.toml'), 'utf8'));
    const assets = config.assets ?? {};

    if (config.name !== workerNames[app.role]) problems.push(`${app.configFile}: name must be ${workerNames[app.role]}.`);
    if (config.compatibility_date !== pages.compatibility_date) {
      problems.push(`${label}: compatibility_date must stay ${pages.compatibility_date} as in wrangler.toml.`);
    }
    if (config.compatibility_flags !== undefined) problems.push(`${label}: compatibility_flags are not set for Pages; keep runtime behavior unchanged.`);
    if (!existsSync(app.mainPath)) problems.push(`${label}: main ${config.main} does not exist.`);
    if (!relative(app.assetsDirectory, app.mainPath).startsWith('..')) problems.push(`${label}: main must stay outside the public assets directory.`);
    if (assets.directory !== app.pagesApp.outputDir) {
      problems.push(`${label}: assets.directory must be ${app.pagesApp.outputDir} (pages_build_output_dir).`);
    }
    if (assets.binding !== 'ASSETS') problems.push(`${label}: assets.binding must be ASSETS for the compiled next() fallback.`);
    if ((assets.html_handling ?? 'auto-trailing-slash') !== 'auto-trailing-slash') {
      problems.push(`${label}: assets.html_handling must keep the Pages trailing-slash behavior.`);
    }
    if (config.preview_urls !== false) problems.push(`${label}: preview_urls must be false; previews would reuse production bindings.`);
    for (const kind of bindingKinds) {
      if (!isDeepStrictEqual(config[kind] ?? [], pages[kind] ?? [])) problems.push(`${label}: ${kind} must match wrangler.toml.`);
    }

    if (app.role === 'hub') {
      if (config.workers_dev !== false) problems.push(`${label}: workers_dev must be false; only approved hostnames serve the Hub.`);
      // Pages generated the route "/*" because functions/_middleware.js sits at the root.
      if (assets.run_worker_first !== true) problems.push(`${label}: assets.run_worker_first must be true so _middleware.js runs before assets.`);
      if (assets.not_found_handling !== '404-page') problems.push(`${label}: assets.not_found_handling must be 404-page.`);
    }

    if (app.role === 'gamehost') {
      for (const key of Object.keys(config)) {
        if (!runnerConfigKeys.has(key)) problems.push(`${label}: ${key} is not allowed on the isolated runner.`);
      }
      if (!isDeepStrictEqual(config.r2_buckets, runnerReleaseBuckets)) {
        problems.push(`${label}: only the rehab-game-releases bucket may be bound.`);
      }
      const routes = JSON.parse(readFileSync(join(app.appDir, 'public/_routes.json'), 'utf8'));
      const expected = [...routes.include, ...routes.exclude.map((pattern) => `!${pattern}`)];
      if (!isDeepStrictEqual(assets.run_worker_first, expected)) {
        problems.push(`${label}: assets.run_worker_first must mirror public/_routes.json (${JSON.stringify(expected)}).`);
      }
      // The runner has no 404.html, so Pages served index.html for unknown paths.
      if (assets.not_found_handling !== 'single-page-application') {
        problems.push(`${label}: assets.not_found_handling must be single-page-application.`);
      }
    }
  }
  return problems;
}

// Unmet until the owner confirms the Hub routes and the runner origin (C02).
export function FindProductionEntryProblems(apps, registry, roles = ['hub', 'gamehost']) {
  const problems = [];
  const hub = apps.find((app) => app.role === 'hub');
  const runner = apps.find((app) => app.role === 'gamehost');

  if (hub && roles.includes('hub')) {
    if (!RouteServesHost(hub.config.routes, hub.hostname)) problems.push(`trainerhub: no route serves ${hub.hostname} (C02).`);
    for (const [gameId, entry] of Object.entries(registry)) {
      if (runner && entry.origin !== runner.siteUrl) {
        problems.push(`officialGameReleases.json origin for ${gameId} (${entry.origin}) must equal the runner homepage ${runner.siteUrl} (C02).`);
      }
    }
  }

  if (runner && roles.includes('gamehost')) {
    const host = runner.hostname;
    if (host.endsWith('.pages.dev')) {
      problems.push(`trainerhubgames: homepage ${runner.siteUrl} is a Pages origin; set the Worker origin in ${runner.appPath}/package.json (C02).`);
    } else if (host.endsWith('.workers.dev')) {
      if (runner.config.workers_dev !== true) problems.push(`trainerhubgames: workers_dev must be true to serve ${host} (C02).`);
      if (!host.startsWith(`${runner.config.name}.`)) problems.push(`trainerhubgames: ${host} is not this Worker's workers.dev hostname.`);
    } else if (!RouteServesHost(runner.config.routes, host)) {
      problems.push(`trainerhubgames: no route serves ${host} (C02).`);
    }
    if (hub && (host === hub.hostname || host.endsWith(`.${hub.hostname}`))) {
      problems.push(`trainerhubgames: ${host} must not share the Hub site; use a separate site for the isolated runner.`);
    }
  }
  return problems;
}

export function CreateHubWorkerSecrets(environment, apps, { dryRun = false } = {}) {
  const hub = apps.find((app) => app.role === 'hub');
  const runner = apps.find((app) => app.role === 'gamehost');
  const optional = (name) => String(environment[name] ?? '').trim();
  const required = (name) => {
    const value = optional(name);
    if (value) return value;
    if (dryRun) return `<${name}>`;
    throw new Error(`${name} must be provided as a GitHub Actions secret or environment variable.`);
  };
  const flag = (name) => {
    const value = optional(name) || '0';
    if (!['0', '1'].includes(value)) throw new Error(`${name} must be 0 or 1.`);
    return value;
  };

  const siteKey = optional('TURNSTILE_SITE_KEY');
  const secretKey = optional('TURNSTILE_SECRET_KEY');
  if (Boolean(siteKey) !== Boolean(secretKey)) throw new Error('TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must be configured together.');
  const turnstileRequired = flag('TURNSTILE_REQUIRED');
  const recordsRequired = flag('TURNSTILE_RECORDS_REQUIRED');
  if ((turnstileRequired === '1' || recordsRequired === '1') && !secretKey) {
    throw new Error('Turnstile cannot be required without both the site key and secret key.');
  }
  const anonymousRecords = flag('ANONYMOUS_RECORDS_ENABLED');
  if (anonymousRecords === '1' && recordsRequired !== '1') throw new Error('ANONYMOUS_RECORDS_ENABLED=1 requires TURNSTILE_RECORDS_REQUIRED=1.');

  // The old Pages runner keeps serving installed PWAs, so its origins stay blocked too.
  const runnerOrigins = new Set([runner.siteUrl, runner.pagesApp.siteUrl, runner.pagesApp.deploymentUrl].map(ToOrigin));
  const authBaseUrl = ToOrigin(optional('AUTH_API_BASE') || hub.siteUrl);
  if (runnerOrigins.has(authBaseUrl)) throw new Error('AUTH_API_BASE must not use a game runner origin.');
  const configuredOrigins = optional('AUTH_ALLOWED_ORIGINS').split(',').map((value) => value.trim()).filter(Boolean)
    .map((value) => { try { return ToOrigin(value); } catch { return null; } })
    .filter(Boolean);
  const blockedOrigin = configuredOrigins.find((origin) => runnerOrigins.has(origin));
  if (blockedOrigin) throw new Error(`AUTH_ALLOWED_ORIGINS must not include game runner origin ${blockedOrigin}.`);

  // Only names read by functions/ at runtime. NEXT_PUBLIC_/VITE_ values are build inputs.
  const secrets = {
    ADMIN_ALLOW_BEARER: '0',
    ANONYMOUS_RECORDS_ENABLED: anonymousRecords,
    AUTH_ALLOWED_ORIGINS: [...new Set([authBaseUrl, hub.siteUrl, ...configuredOrigins])].join(','),
    AUTH_ALLOW_LOCAL_ORIGINS: '0',
    AUTH_BASE_URL: authBaseUrl,
    AUTH_SESSION_SECRET: required('AUTH_SESSION_SECRET'),
    AUTH_STATE_SECRET: required('AUTH_STATE_SECRET'),
    GAME_RELEASE_OWNER_USER_ID: optional('GAME_RELEASE_OWNER_USER_ID'),
    GAME_RUNNER_ORIGIN: runner.siteUrl,
    GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: required('GOOGLE_CLIENT_SECRET'),
    TURNSTILE_RECORDS_REQUIRED: recordsRequired,
    TURNSTILE_REQUIRED: turnstileRequired,
    TURNSTILE_SECRET_KEY: secretKey,
    TURNSTILE_SKIP_HOSTNAME_CHECK: '0',
  };
  // --secrets-file is additive; an empty value would only add a meaningless secret.
  return Object.fromEntries(Object.entries(secrets).filter(([, value]) => value !== ''));
}

export function FindForbiddenAssetFiles(directory) {
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const relativePath = relative(directory, path).replaceAll('\\', '/');
      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.worker', '.wrangler'].includes(entry.name)) found.push(`${relativePath}/`);
        else visit(path);
        continue;
      }
      const name = basename(path);
      if (name === '_worker.js'
        || extname(name) === '.map'
        || /^wrangler(?:\.[\w-]+)?\.(?:toml|json|jsonc)$/.test(name)
        || name.startsWith('.dev.vars')
        || name === '.env' || name.startsWith('.env.')
        || relativePath.startsWith('functions/')) {
        found.push(relativePath);
      }
    }
  };
  if (existsSync(directory) && statSync(directory).isDirectory()) visit(directory);
  return found;
}

export function ParseJsonc(source) {
  let output = '';
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      output += character;
      if (character === '\\') output += source[++index] ?? '';
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
      output += character;
    } else if (character === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
    } else if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Unterminated JSONC block comment.');
      index = end + 1;
    } else {
      output += character;
    }
  }
  return JSON.parse(output);
}

// Reads the subset of wrangler.toml this repository uses; anything else fails closed.
export function ParsePagesToml(source) {
  const config = {};
  let target = config;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const table = line.match(/^\[\[([a-z0-9_]+)\]\]$/);
    if (table) {
      target = {};
      (config[table[1]] ??= []).push(target);
      continue;
    }
    const pair = line.match(/^([a-z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (!pair) throw new Error(`Unsupported wrangler.toml line: ${line}`);
    target[pair[1]] = pair[2];
  }
  return config;
}

function RouteServesHost(routes = [], host) {
  return routes.some((route) => {
    const pattern = typeof route === 'string' ? route : route?.pattern;
    return pattern === `${host}/*` || (pattern === host && route?.custom_domain === true);
  });
}

function ToOrigin(value) {
  return new URL(String(value).trim()).origin;
}

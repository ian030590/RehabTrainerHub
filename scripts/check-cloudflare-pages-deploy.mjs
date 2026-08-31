#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CreateCloudflareDeploymentEnvironment,
  CreateGamehostBuildEnvironment,
} from './gamehost-environment.mjs';
import {
  DiscoverPagesApps,
  IsAuthPagesApp,
  defaultRepoRoot,
} from './pages-apps.mjs';

const pagesApps = DiscoverPagesApps();
const deployScript = resolve(defaultRepoRoot, 'scripts/deploy-cloudflare-pages.mjs');
const retiredStandaloneProjects = [
  'braintrainer',
  'motortrainer',
  'mouthtrainer',
  'visiontrainer',
];

CheckRetiredProjectPreflight();

const result = spawnSync(
  process.execPath,
  [deployScript, '--dry-run', '--branch=deployment-test', '--production-branch=main'],
  {
    cwd: defaultRepoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTH_ALLOWED_ORIGINS: '',
      VITE_SMOKE_PUBLIC_VALUE: 'deployment-test-value',
    },
  },
);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Cloudflare Pages deployment dry-run failed with exit code ${result.status}:\n${output}`);
}

for (const app of pagesApps) {
  const createMarker = `pages project create ${app.projectName} --production-branch=main`;
  const syncMarker = `pages secret bulk ${app.projectName}.pages-env.json --project-name=${app.projectName}`;
  const deployMarker = `--cwd=${app.appPath} pages deploy ${app.outputDir} --project-name=${app.projectName} --branch=deployment-test`;
  const domainMarker = app.usesBuiltInPagesDomain
    ? `Skipping built-in Pages domain for ${app.projectName}: ${app.hostname}`
    : `cloudflare pages domain ensure ${app.projectName} ${app.hostname}`;
  const environmentMarker = IsAuthPagesApp(app)
    ? `pages secret bulk ${app.projectName}.pages-env.json --project-name=${app.projectName}`
    : `- ${app.projectName}: skipped; gamehost receives no auth environment.`;

  for (const marker of [
    `${app.projectName}: ${app.outputPath}`,
    createMarker,
    app.urlEnvName,
    `NEXT_PUBLIC_${app.urlEnvName}`,
    `VITE_${app.urlEnvName}`,
    'VITE_SMOKE_PUBLIC_VALUE',
    environmentMarker,
    deployMarker,
    domainMarker,
  ]) {
    if (!output.includes(marker)) {
      throw new Error(`Cloudflare Pages deployment dry-run is missing ${JSON.stringify(marker)}:\n${output}`);
    }
  }

  const createIndex = output.indexOf(createMarker);
  const deployIndex = output.indexOf(deployMarker);
  const domainIndex = output.indexOf(domainMarker);
  if (IsAuthPagesApp(app)) {
    const syncIndex = output.indexOf(syncMarker);
    if (!(createIndex < syncIndex && syncIndex < deployIndex && deployIndex < domainIndex)) {
      throw new Error(`Deployment order must be create -> sync variables -> deploy -> sync domain for ${app.projectName}:\n${output}`);
    }
  } else {
    if (output.includes(syncMarker)) {
      throw new Error(`Gamehost ${app.projectName} must not receive a Pages environment bulk sync:\n${output}`);
    }
    if (!(createIndex < deployIndex && deployIndex < domainIndex)) {
      throw new Error(`Gamehost deployment order must be create -> deploy -> sync domain for ${app.projectName}:\n${output}`);
    }
  }
}

const gamehosts = pagesApps.filter((app) => app.role === 'gamehost');
assert.equal(gamehosts.length, 1, 'Exactly one gamehost must be discovered for deployment.');
const [gamehost] = gamehosts;
const allowedOriginsLine = output
  .split(/\r?\n/)
  .find((line) => line.startsWith('Auth allowed origins: '));
assert.ok(allowedOriginsLine, 'Deployment dry-run must report the effective auth origin allowlist.');
for (const blockedOrigin of new Set([gamehost.siteUrl, gamehost.deploymentUrl])) {
  assert.equal(
    allowedOriginsLine.includes(blockedOrigin),
    false,
    `Gamehost origin must not be present in AUTH_ALLOWED_ORIGINS: ${blockedOrigin}`,
  );
}

const hub = pagesApps.find((app) => app.role === 'hub');
assert.deepEqual(hub.redirectHostnames.sort(), [
  'brain.trainerhub.cc',
  'motor.trainerhub.cc',
  'mouth.trainerhub.cc',
  'vision.trainerhub.cc',
]);
assert.deepEqual(hub.retiredProjectNames.sort(), [
  ...retiredStandaloneProjects,
]);
for (const projectName of hub.retiredProjectNames) {
  const pruneIndex = output.indexOf(`cloudflare pages project deployments prune ${projectName}`);
  const clearIndex = output.indexOf(`cloudflare pages project domains clear ${projectName}`);
  const retireIndex = output.indexOf(`cloudflare pages project retire ${projectName}`);
  assert.ok(pruneIndex >= 0, `Retired project deployments must be pruned: ${projectName}`);
  assert.ok(pruneIndex < clearIndex, `Deployments must be pruned before domains are cleared: ${projectName}`);
  assert.ok(clearIndex < retireIndex, `Retired project domains must be cleared before deletion: ${projectName}`);
}
for (const hostname of hub.redirectHostnames) {
  const ensureIndex = output.indexOf(`cloudflare pages domain ensure ${hub.projectName} ${hostname}`);
  assert.ok(ensureIndex >= 0, `Redirect domain must be assigned to the Hub: ${hostname}`);
  for (const projectName of hub.retiredProjectNames) {
    assert.ok(
      output.indexOf(`cloudflare pages project retire ${projectName}`) < ensureIndex,
      `Retired projects must be deleted before assigning ${hostname} to the Hub.`,
    );
  }
}
const hubEnvironmentLine = output
  .split(/\r?\n/)
  .find((line) => (
    line.startsWith(`- ${hub.projectName}: `)
    && line.includes('AUTH_ALLOWED_ORIGINS')
  ));
assert.ok(hubEnvironmentLine?.includes('GAME_RUNNER_ORIGIN'), 'Hub must receive GAME_RUNNER_ORIGIN.');

const rejectedGamehostOrigin = spawnSync(
  process.execPath,
  [resolve(defaultRepoRoot, 'scripts/sync-cloudflare-auth-env.mjs'), '--dry-run'],
  {
    cwd: defaultRepoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTH_ALLOWED_ORIGINS: gamehost.siteUrl,
    },
  },
);
const rejectedOutput = `${rejectedGamehostOrigin.stdout ?? ''}\n${rejectedGamehostOrigin.stderr ?? ''}`;
assert.notEqual(rejectedGamehostOrigin.status, 0, 'Gamehost AUTH_ALLOWED_ORIGINS must fail closed.');
assert.match(rejectedOutput, /AUTH_ALLOWED_ORIGINS must not include gamehost origin/);

const rejectedGamehostAuthBase = spawnSync(
  process.execPath,
  [resolve(defaultRepoRoot, 'scripts/sync-cloudflare-auth-env.mjs'), '--dry-run'],
  {
    cwd: defaultRepoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      AUTH_ALLOWED_ORIGINS: '',
      AUTH_API_BASE: gamehost.siteUrl,
    },
  },
);
const rejectedAuthBaseOutput = `${rejectedGamehostAuthBase.stdout ?? ''}\n${rejectedGamehostAuthBase.stderr ?? ''}`;
assert.notEqual(rejectedGamehostAuthBase.status, 0, 'Gamehost AUTH_API_BASE must fail closed.');
assert.match(rejectedAuthBaseOutput, /AUTH_API_BASE must not use a gamehost origin/);

const pagesEnvironment = spawnSync(
  process.execPath,
  [resolve(defaultRepoRoot, 'scripts/write-pages-env.mjs')],
  { cwd: defaultRepoRoot, encoding: 'utf8', env: process.env },
);
if (pagesEnvironment.error) throw pagesEnvironment.error;
assert.equal(pagesEnvironment.status, 0, pagesEnvironment.stderr || pagesEnvironment.stdout);
assert.match(pagesEnvironment.stdout, new RegExp(`^GAME_RUNNER_ORIGIN=${EscapeRegExp(gamehost.siteUrl)}$`, 'm'));
assert.doesNotMatch(pagesEnvironment.stdout, /^AUTH_ALLOWED_ORIGINS=/m);

const sanitizedGamehostEnvironment = CreateGamehostBuildEnvironment({
  PATH: 'safe-path',
  CF_PAGES: '1',
  AUTH_API_BASE: 'https://trainerhub.cc',
  NEXT_PUBLIC_AUTH_API_BASE: 'https://trainerhub.cc',
  GOOGLE_CLIENT_SECRET: 'secret',
  TURNSTILE_SECRET_KEY: 'secret',
  CLOUDFLARE_API_TOKEN: 'secret',
  SOME_PRIVATE_TOKEN: 'secret',
});
assert.deepEqual(sanitizedGamehostEnvironment, { PATH: 'safe-path', CF_PAGES: '1' });

const sanitizedDeploymentEnvironment = CreateCloudflareDeploymentEnvironment({
  PATH: 'safe-path',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_API_TOKEN: 'deployment-token',
  AUTH_SESSION_SECRET: 'auth-secret',
  GOOGLE_CLIENT_SECRET: 'oauth-secret',
  SOME_PRIVATE_TOKEN: 'unrelated-secret',
});
assert.deepEqual(sanitizedDeploymentEnvironment, {
  PATH: 'safe-path',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_API_TOKEN: 'deployment-token',
});

await CheckRetiredProjectCleanup();

async function CheckRetiredProjectCleanup() {
  const originalFetch = globalThis.fetch;
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_API_TOKEN;
  const requests = [];
  let deploymentLists = 0;
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
  process.env.CLOUDFLARE_API_TOKEN = 'test-token';
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const path = `${url.pathname.slice(url.pathname.indexOf('/pages/projects/'))}${url.search}`;
    const method = init.method ?? 'GET';
    requests.push(`${method} ${path}`);

    if (method === 'GET' && path === '/pages/projects/visiontrainer') {
      return JsonResponse({ canonical_deployment: { id: 'active-deployment' } });
    }
    if (method === 'GET' && /^\/pages\/projects\/(?:motor|brain|mouth)trainer$/.test(path)) {
      return new Response(null, { status: 404 });
    }
    if (method === 'GET' && path === '/pages/projects/visiontrainer/deployments') {
      deploymentLists += 1;
      return JsonResponse(deploymentLists === 1
        ? [{ id: 'old-deployment-1' }, { id: 'active-deployment' }]
        : deploymentLists === 2
          ? [{ id: 'old-deployment-2' }, { id: 'active-deployment' }]
          : [{ id: 'active-deployment' }]);
    }
    if (method === 'GET' && path === '/pages/projects/visiontrainer/domains') {
      return JsonResponse([{ name: 'vision.trainerhub.cc' }]);
    }
    if (method === 'GET' && path === '/pages/projects/rehabtrainerhub/domains') {
      return JsonResponse(['trainerhub.cc', ...hub.redirectHostnames].map((name) => ({ name, status: 'active' })));
    }
    if (method === 'DELETE') return JsonResponse({});
    throw new Error(`Unexpected mocked Cloudflare request: ${method} ${path}`);
  };

  try {
    await import(`./sync-cloudflare-pages-domains.mjs?test=${Date.now()}`);
  } finally {
    globalThis.fetch = originalFetch;
    RestoreEnvironment('CLOUDFLARE_ACCOUNT_ID', originalAccountId);
    RestoreEnvironment('CLOUDFLARE_API_TOKEN', originalApiToken);
  }

  const firstDelete = requests.indexOf('DELETE /pages/projects/visiontrainer/deployments/old-deployment-1?force=true');
  const secondDelete = requests.indexOf('DELETE /pages/projects/visiontrainer/deployments/old-deployment-2?force=true');
  const domainDelete = requests.indexOf('DELETE /pages/projects/visiontrainer/domains/vision.trainerhub.cc');
  const projectDelete = requests.indexOf('DELETE /pages/projects/visiontrainer');
  const hubDomainCheck = requests.indexOf('GET /pages/projects/rehabtrainerhub/domains');
  assert.equal(deploymentLists, 3, 'Deployment cleanup must relist until only production remains.');
  assert.equal(requests.some((request) => request.includes('/deployments/active-deployment')), false);
  for (const index of [firstDelete, secondDelete, domainDelete, projectDelete, hubDomainCheck]) assert.ok(index >= 0);
  assert.ok(firstDelete < secondDelete && secondDelete < domainDelete && domainDelete < projectDelete && projectDelete < hubDomainCheck);
}

function JsonResponse(result) {
  return Response.json({ success: true, result });
}

function RestoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function CheckRetiredProjectPreflight() {
  for (const projectName of retiredStandaloneProjects) {
    RunRetiredProjectFixture({ projectName });
  }
  RunRetiredProjectFixture({
    projectName: 'repo-defined-retired-project',
    retiredProjects: ['repo-defined-retired-project'],
  });
}

function RunRetiredProjectFixture({ projectName, retiredProjects }) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'rehab-pages-retired-preflight-'));
  const fixtureScripts = join(fixtureRoot, 'scripts');
  const fixtureApp = join(fixtureRoot, 'apps', 'fixture');
  mkdirSync(fixtureScripts, { recursive: true });
  mkdirSync(fixtureApp, { recursive: true });
  copyFileSync(deployScript, join(fixtureScripts, 'deploy-cloudflare-pages.mjs'));
  copyFileSync(
    resolve(defaultRepoRoot, 'scripts/gamehost-environment.mjs'),
    join(fixtureScripts, 'gamehost-environment.mjs'),
  );
  writeFileSync(
    join(fixtureApp, 'package.json'),
    `${JSON.stringify({
      name: 'retired-project-fixture',
      private: true,
      scripts: { build: 'node -e ""' },
      ...(retiredProjects ? { rehabTrainer: { retiredProjects } } : {}),
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(fixtureApp, 'wrangler.toml'),
    `name = "${projectName}"\npages_build_output_dir = "out"\n`,
  );

  try {
    const fixtureResult = spawnSync(
      process.execPath,
      [join(fixtureScripts, 'deploy-cloudflare-pages.mjs'), '--dry-run'],
      { cwd: fixtureRoot, encoding: 'utf8', env: process.env },
    );
    if (fixtureResult.error) throw fixtureResult.error;
    const fixtureOutput = `${fixtureResult.stdout ?? ''}\n${fixtureResult.stderr ?? ''}`;
    assert.notEqual(fixtureResult.status, 0, `${projectName} must fail the deployment preflight.`);
    assert.match(
      fixtureOutput,
      new RegExp(`Refusing to deploy retired Cloudflare Pages project\\(s\\): ${EscapeRegExp(projectName)}`),
    );
    assert.doesNotMatch(fixtureOutput, /\$ pnpm .*pages project create/);
    assert.doesNotMatch(fixtureOutput, /\$ pnpm .*pages deploy/);
    assert.doesNotMatch(fixtureOutput, /cloudflare pages domain ensure/);
    assert.doesNotMatch(fixtureOutput, /sync-cloudflare-auth-env/);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

console.log(`Cloudflare Pages provisioning check passed for ${pagesApps.length} discovered project(s).`);

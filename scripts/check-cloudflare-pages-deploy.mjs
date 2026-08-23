#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
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
  'braintrainer',
  'motortrainer',
  'mouthtrainer',
  'visiontrainer',
]);
for (const projectName of hub.retiredProjectNames) {
  assert.ok(output.includes(`cloudflare pages project retire ${projectName}`));
}
for (const hostname of hub.redirectHostnames) {
  assert.ok(output.includes(`cloudflare pages domain ensure ${hub.projectName} ${hostname}`));
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

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`Cloudflare Pages provisioning check passed for ${pagesApps.length} discovered project(s).`);

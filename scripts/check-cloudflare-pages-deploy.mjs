#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CreateCloudflareDeploymentEnvironment,
  CreateGamehostBuildEnvironment,
} from './gamehost-environment.mjs';
import {
  DiscoverPagesApps,
  defaultRepoRoot,
} from './pages-apps.mjs';

const pagesApps = DiscoverPagesApps();
for (const app of pagesApps) {
  const config = readFileSync(resolve(app.appPath, 'wrangler.toml'), 'utf8');
  if (app.role === 'hub') assert.match(config, /binding = "RAW_DATA"\s+bucket_name = "rehab-raw-data"/);
  else assert.doesNotMatch(config, /RAW_DATA|rehab-raw-data|OCULOMOTOR_DATA|oculomotor-data/);
}

const gamehosts = pagesApps.filter((app) => app.role === 'gamehost');
assert.equal(gamehosts.length, 1, 'Exactly one gamehost must be discovered for deployment.');
const [gamehost] = gamehosts;

const pagesEnvironment = spawnSync(
  process.execPath,
  [resolve(defaultRepoRoot, 'scripts/write-pages-env.mjs')],
  { cwd: defaultRepoRoot, encoding: 'utf8', env: process.env },
);
if (pagesEnvironment.error) throw pagesEnvironment.error;
assert.equal(pagesEnvironment.status, 0, pagesEnvironment.stderr || pagesEnvironment.stdout);
assert.match(pagesEnvironment.stdout, new RegExp(`^GAME_RUNNER_ORIGIN=${EscapeRegExp(gamehost.siteUrl)}$`, 'm'));
assert.doesNotMatch(pagesEnvironment.stdout, /^AUTH_ALLOWED_ORIGINS=/m);
for (const app of pagesApps) {
  for (const prefix of ['', 'NEXT_PUBLIC_', 'VITE_']) {
    assert.match(pagesEnvironment.stdout, new RegExp(`^${prefix}${app.urlEnvName}=${EscapeRegExp(app.siteUrl)}$`, 'm'));
  }
}
assert.doesNotMatch(pagesEnvironment.stdout, /NEXT_PUBLIC_GAME_RELEASE_OWNER|VITE_GAME_RELEASE_OWNER|private-owner-id/);

const sanitizedGamehostEnvironment = CreateGamehostBuildEnvironment({
  PATH: 'safe-path',
  CF_PAGES: '1',
  AUTH_API_BASE: 'https://trainerhub.cc',
  NEXT_PUBLIC_AUTH_API_BASE: 'https://trainerhub.cc',
  GOOGLE_CLIENT_SECRET: 'secret',
  TURNSTILE_SECRET_KEY: 'secret',
  CLOUDFLARE_API_TOKEN: 'secret',
  SOME_PRIVATE_TOKEN: 'secret',
  GAME_RELEASE_OWNER_USER_ID: 'private-owner-id',
});
assert.deepEqual(sanitizedGamehostEnvironment, { PATH: 'safe-path', CF_PAGES: '1' });

const sanitizedDeploymentEnvironment = CreateCloudflareDeploymentEnvironment({
  PATH: 'safe-path',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_API_TOKEN: 'deployment-token',
  AUTH_SESSION_SECRET: 'auth-secret',
  GOOGLE_CLIENT_SECRET: 'oauth-secret',
  SOME_PRIVATE_TOKEN: 'unrelated-secret',
  GAME_RELEASE_OWNER_USER_ID: 'private-owner-id',
});
assert.deepEqual(sanitizedDeploymentEnvironment, {
  PATH: 'safe-path',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_API_TOKEN: 'deployment-token',
});

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log(`Cloudflare app discovery and environment checks passed for ${pagesApps.length} app(s).`);

#!/usr/bin/env node
// Compiles each app's Pages Functions into .worker/functions/ for its wrangler.workers.jsonc,
// using the same compiler Pages runs during `pages deploy`. Run after the app build.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CreateGamehostBuildEnvironment } from './gamehost-environment.mjs';
import { DiscoverWorkerApps, workerAssetIgnorePatterns } from './workers-apps.mjs';

const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const apps = DiscoverWorkerApps().filter((app) => !only || app.role === only);
if (apps.length === 0) throw new Error(`No Worker app matches ${only ?? 'the repository'}.`);

for (const app of apps) {
  if (!existsSync(app.assetsDirectory)) {
    throw new Error(`${app.config.assets.directory}/ is missing for ${app.workerName}; build ${app.appPath} first.`);
  }
  const workerDirectory = join(app.appDir, '.worker');
  rmSync(workerDirectory, { recursive: true, force: true });
  mkdirSync(workerDirectory, { recursive: true });
  console.log(`\n=== Compiling ${app.appPath}/functions for Worker ${app.workerName} ===`);
  const args = [
    '--yes', 'wrangler@4', 'pages', 'functions', 'build', 'functions',
    `--outdir=${join(workerDirectory, 'functions')}`,
    `--output-routes-path=${join(workerDirectory, '_routes.json')}`,
    `--compatibility-date=${app.config.compatibility_date}`,
  ];
  const command = process.platform === 'win32'
    ? { file: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'npx', ...args] }
    : { file: 'npx', args };
  // Compiling needs no credentials; strip auth, Turnstile, Cloudflare and other secrets.
  const result = spawnSync(command.file, command.args, {
    cwd: app.appDir,
    env: CreateGamehostBuildEnvironment(process.env),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`Compiling functions for ${app.workerName} failed with exit code ${result.status}.`);
  }
  writeFileSync(join(app.assetsDirectory, '.assetsignore'), `${workerAssetIgnorePatterns.join('\n')}\n`);
  console.log(`Wrote ${app.appPath}/.worker/functions/index.js and ${app.config.assets.directory}/.assetsignore`);
}

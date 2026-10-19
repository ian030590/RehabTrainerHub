#!/usr/bin/env node
// Deploys trainerhubgames, then trainerhub, from the built outputs. It refuses to run while
// any Pages parity check or owner-confirmed entry point (C02) is missing.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { CreateCloudflareDeploymentEnvironment } from './gamehost-environment.mjs';
import { defaultRepoRoot } from './pages-apps.mjs';
import {
  CreateHubWorkerSecrets,
  DiscoverWorkerApps,
  FindForbiddenAssetFiles,
  FindProductionEntryProblems,
  FindWorkerConfigProblems,
} from './workers-apps.mjs';

const wranglerPrefix = ['--yes', 'wrangler@4'];
const assetFileLimitBytes = 25 * 1024 * 1024;
const deployTimeoutMs = 5 * 60 * 1000;
const dryRun = process.argv.includes('--dry-run');
const validateOutput = !dryRun || process.argv.includes('--validate-output');
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
if (only && !['hub', 'gamehost'].includes(only)) throw new Error('--only must be hub or gamehost.');

const apps = DiscoverWorkerApps();
const roles = only ? [only] : ['gamehost', 'hub'];
const registry = JSON.parse(readFileSync(join(defaultRepoRoot, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
const problems = [...FindWorkerConfigProblems(apps), ...FindProductionEntryProblems(apps, registry, roles)];
if (problems.length > 0) {
  throw new Error(`Refusing to deploy Cloudflare Workers:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
}

// The runner deploys first so the Hub never points at a runner that is not live yet.
const selected = roles.map((role) => apps.find((app) => app.role === role));
const hub = selected.find((app) => app.role === 'hub');
// Validate secrets before anything changes, so a missing value cannot leave a half deploy.
const hubSecrets = hub ? CreateHubWorkerSecrets(process.env, apps, { dryRun }) : null;

console.log(`Deploying Cloudflare Workers: ${selected.map((app) => `${app.workerName} (${app.configFile})`).join(', ')}`);
if (validateOutput) for (const app of selected) ValidateOutput(app);

RunNode(['scripts/build-workers.mjs', ...(only ? [`--only=${only}`] : [])]);

if (hub) {
  const database = hub.config.d1_databases[0];
  RunWrangler(['d1', 'migrations', 'apply', database.database_name, '--remote', `--config=${hub.configFile}`]);
}

for (const app of selected) {
  if (app.role === 'gamehost') {
    console.log(`- ${app.workerName}: no secrets (isolated runner)`);
    RunWrangler(['deploy', `--config=${app.configFile}`], { timeout: deployTimeoutMs, attempts: 3 });
    continue;
  }
  console.log(`- ${app.workerName} secrets: ${Object.keys(hubSecrets).sort().join(', ')}`);
  const secretDirectory = dryRun ? '' : mkdtempSync(join(tmpdir(), 'rehab-worker-secrets-'));
  const secretFile = dryRun ? `${app.workerName}.secrets.json` : join(secretDirectory, `${app.workerName}.secrets.json`);
  try {
    if (!dryRun) writeFileSync(secretFile, JSON.stringify(hubSecrets), { mode: 0o600 });
    // Secrets ride on the same version as the code, so no version runs without them.
    RunWrangler(['deploy', `--config=${app.configFile}`, `--secrets-file=${secretFile}`], { timeout: deployTimeoutMs, attempts: 3 });
  } finally {
    if (secretDirectory) rmSync(secretDirectory, { recursive: true, force: true });
  }
}

function ValidateOutput(app) {
  const output = relative(defaultRepoRoot, app.assetsDirectory).replaceAll('\\', '/');
  if (!existsSync(app.assetsDirectory)) throw new Error(`${output} does not exist. Build ${app.appPath} before deploying.`);
  const forbidden = FindForbiddenAssetFiles(app.assetsDirectory);
  if (forbidden.length > 0) throw new Error(`${output} must not publish: ${forbidden.join(', ')}`);
  const oversized = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && statSync(path).size > assetFileLimitBytes) oversized.push(relative(defaultRepoRoot, path));
    }
  };
  visit(app.assetsDirectory);
  if (oversized.length > 0) throw new Error(`Workers static assets are limited to 25 MiB per file: ${oversized.join(', ')}`);
}

function RunNode(args) {
  console.log(`$ node ${args.join(' ')}`);
  if (dryRun) return;
  const result = spawnSync(process.execPath, args, { cwd: defaultRepoRoot, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(`node ${args.join(' ')} failed with exit code ${result.status}.`);
  }
}

function RunWrangler(args, { timeout, attempts = 1 } = {}) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.join(' ')}`);
  if (dryRun) return;
  const command = process.platform === 'win32'
    ? { file: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', 'npx', ...commandArgs] }
    : { file: 'npx', args: commandArgs };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(command.file, command.args, {
      cwd: defaultRepoRoot,
      env: CreateCloudflareDeploymentEnvironment(process.env),
      stdio: 'inherit',
      timeout,
    });
    if (result.status === 0 && !result.error) return;
    const reason = result.error?.code === 'ETIMEDOUT' ? `timed out after ${timeout / 1000}s` : `exit code ${result.status}`;
    if (attempt === attempts) throw new Error(`Wrangler failed (${reason}): npx ${commandArgs.join(' ')}`);
    console.error(`Wrangler failed (${reason}); retrying in ${attempt * 10}s (attempt ${attempt + 1}/${attempts}).`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 10_000);
  }
}

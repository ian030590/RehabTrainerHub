#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DiscoverPagesApps, SelectChangedTrainers, defaultRepoRoot } from './pages-apps.mjs';

const args = ParseArgs(process.argv.slice(2));
const pagesApps = DiscoverPagesApps();
const changedFiles = args.all === 'true' ? null : GetChangedFiles(args);
const trainers = SelectChangedTrainers(pagesApps, changedFiles);
const smokeScript = resolve(defaultRepoRoot, 'scripts/check-browser-route-smoke.mjs');
const attempts = Math.max(1, Number(args.attempts ?? 3));
const timeoutMs = Math.max(1000, Number(args.timeoutMs ?? 15000));
const retryDelayMs = Math.max(0, Number(args.retryDelayMs ?? 5000));
const dryRun = args.dryRun === 'true';

if (changedFiles) {
  console.log(`Detected ${changedFiles.length} changed file(s).`);
} else {
  console.log('No reliable Git comparison was available; testing every discovered Trainer.');
}

if (trainers.length === 0) {
  console.log('No Trainer application changed; deployed Trainer smoke tests skipped.');
  process.exit(0);
}

console.log(`Testing ${trainers.length} changed Trainer(s): ${trainers.map((app) => app.appName).join(', ')}`);
for (const trainer of trainers) {
  if (dryRun) {
    console.log(`- ${trainer.appName}: ${trainer.siteUrl}`);
    continue;
  }
  await SmokeTrainer(trainer);
}

async function SmokeTrainer(trainer) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`Smoke testing ${trainer.appName} at ${trainer.siteUrl} (${attempt}/${attempts})...`);
    const result = spawnSync(
      process.execPath,
      [smokeScript, '--url', trainer.siteUrl, '--timeoutMs', String(timeoutMs)],
      { cwd: defaultRepoRoot, stdio: 'inherit' },
    );
    if (result.status === 0) return;
    if (result.error) throw result.error;
    if (attempt < attempts) await Wait(retryDelayMs);
  }
  throw new Error(`Deployed Trainer smoke test failed after ${attempts} attempts: ${trainer.appName}`);
}

function GetChangedFiles(parsedArgs) {
  const explicitFiles = parsedArgs.changedFile
    ? Array.isArray(parsedArgs.changedFile) ? parsedArgs.changedFile : [parsedArgs.changedFile]
    : [];
  if (explicitFiles.length > 0) return explicitFiles;

  const base = parsedArgs.base ?? process.env.SMOKE_BASE_SHA;
  const head = parsedArgs.head ?? process.env.SMOKE_HEAD_SHA ?? 'HEAD';
  if (!base || /^0+$/.test(base)) return null;

  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACDMRT', base, head],
    { cwd: defaultRepoRoot, encoding: 'utf8' },
  );
  if (result.error || result.status !== 0) {
    console.warn('Git comparison failed; falling back to every discovered Trainer.');
    return null;
  }
  return result.stdout.split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
}

function ParseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    const value = !next || next.startsWith('--') ? 'true' : next;
    if (parsed[key] === undefined) parsed[key] = value;
    else parsed[key] = Array.isArray(parsed[key]) ? [...parsed[key], value] : [parsed[key], value];
    if (value === next) index += 1;
  }
  return parsed;
}

function Wait(durationMs) {
  return new Promise((resolveWait) => setTimeout(resolveWait, durationMs));
}

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deployScript = resolve(repoRoot, 'scripts/deploy-cloudflare-pages.mjs');
const result = spawnSync(
  process.execPath,
  [deployScript, '--dry-run', '--branch=deployment-test', '--production-branch=main'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      MOUTHTRAINER_URL: 'https://mouth.trainerhub.cc',
      VITE_VOSK_MODEL_ZH_URL: 'https://assets.example.test/vosk-zh.tar.gz',
    },
  },
);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Cloudflare Pages deployment dry-run failed with exit code ${result.status}:\n${output}`);
}

const createMarker = 'pages project create mouthtrainer --production-branch=main';
const syncMarker = 'pages secret bulk mouthtrainer.auth-secrets.json --project-name=mouthtrainer';
const deployMarker = '--cwd=apps/mouthtrainer pages deploy dist --project-name=mouthtrainer --branch=deployment-test';

for (const marker of [
  'mouthtrainer: apps/mouthtrainer/dist',
  createMarker,
  '- mouthtrainer:',
  'MOUTHTRAINER_URL',
  'VITE_MOUTHTRAINER_URL',
  'VITE_VOSK_MODEL_ZH_URL',
  syncMarker,
  deployMarker,
]) {
  if (!output.includes(marker)) {
    throw new Error(`Cloudflare Pages deployment dry-run is missing ${JSON.stringify(marker)}:\n${output}`);
  }
}

const createIndex = output.indexOf(createMarker);
const syncIndex = output.indexOf(syncMarker);
const deployIndex = output.indexOf(deployMarker);
if (!(createIndex < syncIndex && syncIndex < deployIndex)) {
  throw new Error(`MouthTrainer deployment order must be create -> sync variables -> deploy:\n${output}`);
}

console.log('Cloudflare Pages MouthTrainer provisioning check passed.');

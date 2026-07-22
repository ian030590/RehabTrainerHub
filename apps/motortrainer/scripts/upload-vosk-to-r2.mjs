#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bucket = GetEnv('R2_BUCKET', 'motor-trainer-vosk-models');
const prefix = NormalizePrefix(GetEnv('R2_PREFIX', ''));
const publicBaseUrl = TrimTrailingSlash(process.env.R2_PUBLIC_BASE_URL ?? '');
const corsFile = path.resolve(rootDir, GetEnv('R2_CORS_FILE', 'config/r2-cors.json'));
const cacheControl = GetEnv('R2_CACHE_CONTROL', 'public,max-age=31536000,immutable');
const shouldCreateBucket = process.env.R2_CREATE_BUCKET !== '0';
const shouldApplyCors = process.env.R2_APPLY_CORS !== '0';
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const uploadTargets = [
  {
    envName: 'VITE_VOSK_MODEL_ZH_URL',
    filePath: path.join(rootDir, 'public', 'models', 'vosk-model-small-zh-tw-0.3.tar.gz'),
    key: JoinKey(prefix, 'vosk-model-small-zh-tw-0.3.tar.gz'),
    contentType: 'application/gzip',
    required: true,
  },
  {
    envName: 'VITE_VOSK_MODEL_ZH_VOCAB_URL',
    filePath: path.join(rootDir, 'public', 'models', 'vosk-model-small-zh-tw-0.3-vocabulary.txt'),
    key: JoinKey(prefix, 'vosk-model-small-zh-tw-0.3-vocabulary.txt'),
    contentType: 'text/plain;charset=utf-8',
    required: false,
  },
  {
    envName: 'VITE_VOSK_MODEL_EN_URL',
    filePath: path.join(rootDir, 'public', 'models', 'vosk-model-small-en-us-0.15.tar.gz'),
    key: JoinKey(prefix, 'vosk-model-small-en-us-0.15.tar.gz'),
    contentType: 'application/gzip',
    required: false,
  },
  {
    envName: 'VITE_VOSK_MODEL_EN_VOCAB_URL',
    filePath: path.join(rootDir, 'public', 'models', 'vosk-model-small-en-us-0.15-vocabulary.txt'),
    key: JoinKey(prefix, 'vosk-model-small-en-us-0.15-vocabulary.txt'),
    contentType: 'text/plain;charset=utf-8',
    required: false,
  },
];

console.log(`Preparing Vosk model upload to R2 bucket "${bucket}".`);

if (shouldCreateBucket) {
  const createResult = RunWrangler(['r2', 'bucket', 'create', bucket], { capture: true, allowExistingBucket: true });
  if (createResult.existingBucket) {
    console.log(`R2 bucket "${bucket}" already exists; continuing.`);
  }
} else {
  console.log('Skipping bucket creation because R2_CREATE_BUCKET=0.');
}

if (shouldApplyCors) {
  if (!existsSync(corsFile)) {
    throw new Error(`CORS file not found: ${path.relative(rootDir, corsFile)}`);
  }
  console.log(`Applying CORS policy from ${path.relative(rootDir, corsFile)}.`);
  RunWrangler(['r2', 'bucket', 'cors', 'set', bucket, '--file', corsFile], { interactive: true });
} else {
  console.log('Skipping CORS policy because R2_APPLY_CORS=0.');
}

const uploadedTargets = [];
for (const target of uploadTargets) {
  if (!existsSync(target.filePath)) {
    if (target.required) {
      throw new Error(`Required model file not found: ${path.relative(rootDir, target.filePath)}`);
    }
    console.log(`Skipping missing optional file: ${path.relative(rootDir, target.filePath)}`);
    continue;
  }

  const size = statSync(target.filePath).size;
  console.log(`Uploading ${path.relative(rootDir, target.filePath)} (${FormatMiB(size)}) to ${bucket}/${target.key}.`);
  RunWrangler([
    'r2',
    'object',
    'put',
    `${bucket}/${target.key}`,
    '--file',
    target.filePath,
    '--content-type',
    target.contentType,
    '--cache-control',
    cacheControl,
  ], { interactive: true });
  uploadedTargets.push(target);
}

console.log('\nR2 upload complete.');
if (publicBaseUrl) {
  console.log('Set these frontend build variables for Cloudflare Pages and GitHub Pages:');
  for (const target of uploadedTargets) {
    console.log(`${target.envName}=${publicBaseUrl}/${target.key}`);
  }
} else {
  console.log('Set R2_PUBLIC_BASE_URL to print exact VITE_VOSK_* URLs after upload.');
}

function RunWrangler(args, options = {}) {
  const result = spawnSync(npxBin, ['wrangler', ...args], {
    cwd: rootDir,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS ?? 'false',
    },
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32',
  });

  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return { existingBucket: false };
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (options.allowExistingBucket && /already exists|already own|bucket name is already in use/i.test(output)) {
    return { existingBucket: true };
  }

  throw new Error(`Wrangler command failed: npx wrangler ${args.join(' ')}`);
}

function GetEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function NormalizePrefix(value) {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

function JoinKey(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

function TrimTrailingSlash(value) {
  return value.trim().replace(/\/+$/g, '');
}

function FormatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

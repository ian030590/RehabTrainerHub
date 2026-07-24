#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = resolve(repoRoot, 'scripts/r2-ai-assets.manifest.json');
const wranglerPrefix = ['--yes', 'wrangler@4'];
const dryRun = process.argv.includes('--dry-run');
const maximumRemoteAssetBytes = 100 * 1024 * 1024;

function GetArg(name) {
  const prefix = `${name}=`;
  const inlineValue = process.argv.find((argument) => argument.startsWith(prefix));
  if (inlineValue) return inlineValue.slice(prefix.length);

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function ResolveManifestPath(value) {
  const manifestPath = value ? resolve(repoRoot, value) : defaultManifestPath;
  const repoRelativePath = relative(repoRoot, manifestPath);
  if (
    !repoRelativePath
    || repoRelativePath.startsWith('..')
    || isAbsolute(repoRelativePath)
  ) {
    throw new Error('Manifest path must stay inside the repository.');
  }
  return manifestPath;
}

function ShellQuote(value) {
  return /[\s"'`$]/.test(value) ? JSON.stringify(value) : value;
}

function GetCommand(file, args) {
  if (process.platform !== 'win32') return { file, args };
  return {
    file: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', file, ...args],
  };
}

function ResolveSourcePath(source) {
  if (typeof source !== 'string' || !source.trim() || isAbsolute(source)) {
    throw new Error(`Manifest source must be a repository-relative path: ${JSON.stringify(source)}`);
  }

  const sourcePath = resolve(repoRoot, source);
  const repoRelativePath = relative(repoRoot, sourcePath);
  if (!repoRelativePath || repoRelativePath.startsWith('..') || isAbsolute(repoRelativePath)) {
    throw new Error(`Manifest source resolves outside the repository: ${source}`);
  }
  return sourcePath;
}

function ValidateObjectKey(key) {
  if (
    typeof key !== 'string'
    || !key
    || key.startsWith('/')
    || key.includes('\\')
    || key.split('/').includes('..')
  ) {
    throw new Error(`Invalid R2 object key: ${JSON.stringify(key)}`);
  }
}

function GetAssetSource(asset) {
  const hasLocalSource = typeof asset.source === 'string' && Boolean(asset.source.trim());
  const hasRemoteSource =
    typeof asset.sourceUrl === 'string' && Boolean(asset.sourceUrl.trim());
  if (hasLocalSource === hasRemoteSource) {
    throw new Error(
      `Asset ${asset.key} must define exactly one of source or sourceUrl.`,
    );
  }

  if (hasLocalSource) {
    return {
      label: asset.source,
      path: ResolveSourcePath(asset.source),
    };
  }

  const sourceUrl = new URL(asset.sourceUrl);
  if (sourceUrl.protocol !== 'https:') {
    throw new Error(`Remote asset source must use HTTPS: ${asset.sourceUrl}`);
  }
  return {
    label: sourceUrl.href,
    sourceUrl,
  };
}

async function DownloadRemoteAsset(sourceUrl, temporaryDirectory, assetIndex) {
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(2 * 60 * 1000),
  });
  if (!response.ok) {
    throw new Error(
      `Unable to download ${sourceUrl.href}: HTTP ${response.status}.`,
    );
  }

  const declaredLength = Number(response.headers.get('Content-Length'));
  if (
    Number.isFinite(declaredLength)
    && declaredLength > maximumRemoteAssetBytes
  ) {
    throw new Error(`Remote asset exceeds 100 MiB: ${sourceUrl.href}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maximumRemoteAssetBytes) {
    throw new Error(`Remote asset exceeds 100 MiB: ${sourceUrl.href}`);
  }

  const sourcePath = join(temporaryDirectory, `remote-asset-${assetIndex}`);
  await writeFile(sourcePath, bytes);
  return sourcePath;
}

function RunWrangler(args) {
  const commandArgs = [...wranglerPrefix, ...args];
  console.log(`$ npx ${commandArgs.map(ShellQuote).join(' ')}`);
  if (dryRun) return;

  const command = GetCommand('npx', commandArgs);
  const result = spawnSync(command.file, command.args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler failed with exit code ${result.status}.`);
  }
}

async function ReadManifest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest?.schemaVersion !== 1) {
    throw new Error('R2 runtime asset manifest must use schemaVersion 1.');
  }
  if (typeof manifest.cacheControl !== 'string' || !manifest.cacheControl.trim()) {
    throw new Error('R2 runtime asset manifest must define cacheControl.');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error('R2 runtime asset manifest must define at least one asset.');
  }
  return manifest;
}

async function Main() {
  const manifestPath = ResolveManifestPath(GetArg('--manifest'));
  const manifest = await ReadManifest(manifestPath);
  const bucket = GetArg('--bucket')?.trim()
    || process.env.R2_AI_ASSET_BUCKET?.trim()
    || (dryRun ? '<R2_AI_ASSET_BUCKET>' : '');

  if (!bucket) {
    throw new Error('Provide --bucket=<name> or R2_AI_ASSET_BUCKET before uploading.');
  }

  const seenKeys = new Set();
  console.log(`R2 runtime asset sync (${dryRun ? 'dry run' : 'remote upload'})`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Manifest: ${relative(repoRoot, manifestPath)}`);

  let temporaryDirectory;
  try {
    for (const [assetIndex, asset] of manifest.assets.entries()) {
      ValidateObjectKey(asset.key);
      if (seenKeys.has(asset.key)) {
        throw new Error(`Duplicate R2 object key in manifest: ${asset.key}`);
      }
      seenKeys.add(asset.key);

      if (typeof asset.contentType !== 'string' || !asset.contentType.trim()) {
        throw new Error(`Asset ${asset.key} must define contentType.`);
      }
      if (!Number.isSafeInteger(asset.size) || asset.size <= 0) {
        throw new Error(`Asset ${asset.key} must define a positive integer size.`);
      }
      if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
        throw new Error(`Asset ${asset.key} must define a lowercase SHA-256 digest.`);
      }

      const source = GetAssetSource(asset);
      if (source.sourceUrl && !temporaryDirectory) {
        temporaryDirectory = await mkdtemp(join(tmpdir(), 'rehab-r2-assets-'));
      }
      const sourcePath = source.sourceUrl
        ? await DownloadRemoteAsset(
            source.sourceUrl,
            temporaryDirectory,
            assetIndex,
          )
        : source.path;
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) {
        throw new Error(`Asset source is not a file: ${source.label}`);
      }
      const digest = createHash('sha256')
        .update(await readFile(sourcePath))
        .digest('hex');
      if (sourceStat.size !== asset.size) {
        throw new Error(
          `Immutable asset size changed for ${asset.key}; expected ${asset.size}, received ${sourceStat.size}. Use a new versioned key.`,
        );
      }
      if (digest !== asset.sha256) {
        throw new Error(
          `Immutable asset digest changed for ${asset.key}; expected ${asset.sha256}, received ${digest}. Use a new versioned key.`,
        );
      }
      const details = `${sourceStat.size} bytes, sha256:${digest.slice(0, 16)}`;
      console.log(`- ${source.label} -> ${asset.key} (${details})`);

      RunWrangler([
        'r2',
        'object',
        'put',
        `${bucket}/${asset.key}`,
        `--file=${sourcePath}`,
        `--content-type=${asset.contentType}`,
        `--cache-control=${manifest.cacheControl}`,
        '--remote',
      ]);
    }
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }

  console.log(`${dryRun ? 'Validated' : 'Uploaded'} ${manifest.assets.length} R2 runtime asset(s).`);
}

await Main();

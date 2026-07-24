#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = resolve(repoRoot, 'scripts/r2-ai-assets.manifest.json');

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

function NormalizeHttpsUrl(value, label) {
  const normalizedValue = String(value || '').trim().replace(/\/+$/, '');
  if (!normalizedValue) throw new Error(`${label} is required.`);

  const parsedUrl = new URL(normalizedValue);
  if (parsedUrl.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error(`${label} must not contain credentials, a query, or a fragment.`);
  }
  return parsedUrl.href.replace(/\/+$/, '');
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

async function ReadManifest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest?.schemaVersion !== 1) {
    throw new Error('R2 runtime asset manifest must use schemaVersion 1.');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    throw new Error('R2 runtime asset manifest must define at least one asset.');
  }
  for (const asset of manifest.assets) ValidateObjectKey(asset?.key);
  return manifest;
}

async function Main() {
  const manifest = await ReadManifest(ResolveManifestPath(GetArg('--manifest')));
  const baseUrl = NormalizeHttpsUrl(
    GetArg('--base-url') || process.env.AI_ASSET_BASE_URL,
    'AI asset base URL',
  );
  const zoneId = String(GetArg('--zone-id') || process.env.CLOUDFLARE_ZONE_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!zoneId) throw new Error('Provide --zone-id=<id> or CLOUDFLARE_ZONE_ID before purging.');
  if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is required before purging.');

  const files = manifest.assets.map((asset) => new URL(asset.key, `${baseUrl}/`).href);
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(
      `Cloudflare cache purge failed with HTTP ${response.status}: ${JSON.stringify(result.errors || result)}`,
    );
  }
  console.log(`Purged ${files.length} R2 runtime asset URL(s) from Cloudflare cache.`);
}

await Main();

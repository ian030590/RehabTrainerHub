#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = resolve(repoRoot, 'scripts/r2-ai-assets.manifest.json');
const defaultCorsOrigins = [
  'https://motor.trainerhub.cc',
  'https://vision.trainerhub.cc',
  'https://brain.trainerhub.cc',
  'https://mouth.trainerhub.cc',
];
const oneYearSeconds = 365 * 24 * 60 * 60;

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
  if (!normalizedValue) {
    throw new Error(`${label} is required.`);
  }

  const parsedUrl = new URL(normalizedValue);
  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`);
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new Error(`${label} must not contain credentials, a query, or a fragment.`);
  }
  return parsedUrl.href.replace(/\/+$/, '');
}

function NormalizeCorsOrigins(value) {
  const origins = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedOrigins = origins.length > 0 ? origins : defaultCorsOrigins;
  return [...new Set(selectedOrigins.map((origin) => {
    const normalized = NormalizeHttpsUrl(origin, 'CORS origin');
    const parsed = new URL(normalized);
    if (normalized !== parsed.origin) {
      throw new Error(`CORS origin must not include a path: ${origin}`);
    }
    return parsed.origin;
  }))];
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

function ValidateCacheControl(headerValue, objectUrl) {
  if (!headerValue) {
    throw new Error(`${objectUrl} is missing Cache-Control.`);
  }

  const directives = headerValue
    .split(',')
    .map((directive) => directive.trim().toLowerCase());
  const maxAgeDirective = directives.find((directive) => directive.startsWith('max-age='));
  const maxAge = Number(maxAgeDirective?.slice('max-age='.length).replaceAll('"', ''));

  if (!directives.includes('public')) {
    throw new Error(`${objectUrl} Cache-Control must include public: ${headerValue}`);
  }
  if (!directives.includes('immutable')) {
    throw new Error(`${objectUrl} Cache-Control must include immutable: ${headerValue}`);
  }
  if (!Number.isInteger(maxAge) || maxAge < oneYearSeconds) {
    throw new Error(
      `${objectUrl} Cache-Control max-age must be at least ${oneYearSeconds}: ${headerValue}`,
    );
  }
}

function ValidateCors(response, corsOrigin, objectUrl) {
  const allowedOrigin = response.headers.get('access-control-allow-origin');
  if (allowedOrigin !== '*' && allowedOrigin !== corsOrigin) {
    throw new Error(
      `${objectUrl} does not allow CORS origin ${corsOrigin}; received ${JSON.stringify(allowedOrigin)}.`,
    );
  }
}

function ValidateAssetMetadata(response, asset, objectUrl) {
  const contentLength = Number(response.headers.get('content-length'));
  if (!Number.isSafeInteger(contentLength) || contentLength !== asset.size) {
    throw new Error(
      `${objectUrl} Content-Length must be ${asset.size}; received ${response.headers.get('content-length')}.`,
    );
  }

  const expectedContentType = asset.contentType.split(';', 1)[0].trim().toLowerCase();
  const receivedContentType = String(response.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!expectedContentType || receivedContentType !== expectedContentType) {
    throw new Error(
      `${objectUrl} Content-Type must be ${asset.contentType}; received ${response.headers.get('content-type')}.`,
    );
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

  const seenKeys = new Set();
  for (const asset of manifest.assets) {
    ValidateObjectKey(asset?.key);
    if (seenKeys.has(asset.key)) {
      throw new Error(`Duplicate R2 object key in manifest: ${asset.key}`);
    }
    seenKeys.add(asset.key);
    if (!Number.isSafeInteger(asset.size) || asset.size <= 0) {
      throw new Error(`Asset ${asset.key} must define a positive integer size.`);
    }
    if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error(`Asset ${asset.key} must define a lowercase SHA-256 digest.`);
    }
    if (typeof asset.contentType !== 'string' || !asset.contentType.trim()) {
      throw new Error(`Asset ${asset.key} must define contentType.`);
    }
  }
  return manifest;
}

async function VerifyAsset(asset, baseUrl, corsOrigin, timeoutMs) {
  const objectUrl = new URL(asset.key, `${baseUrl}/`).href;
  let response;
  try {
    response = await fetch(objectUrl, {
      method: 'HEAD',
      headers: {
        'Accept-Encoding': 'identity',
        Origin: corsOrigin,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `${objectUrl} HEAD request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`${objectUrl} HEAD returned HTTP ${response.status}.`);
  }
  ValidateCors(response, corsOrigin, objectUrl);
  ValidateCacheControl(response.headers.get('cache-control'), objectUrl);
  ValidateAssetMetadata(response, asset, objectUrl);
  return {
    cacheControl: response.headers.get('cache-control'),
    corsOrigin,
    objectUrl,
    status: response.status,
  };
}

async function Main() {
  const manifestPath = ResolveManifestPath(GetArg('--manifest'));
  const manifest = await ReadManifest(manifestPath);
  const baseUrl = NormalizeHttpsUrl(
    GetArg('--base-url') || process.env.AI_ASSET_BASE_URL,
    'AI asset base URL',
  );
  const corsOrigins = NormalizeCorsOrigins(
    GetArg('--origin') || process.env.R2_AI_ASSET_CORS_ORIGIN,
  );
  const timeoutMs = Number(
    GetArg('--timeout-ms') || process.env.R2_AI_ASSET_VERIFY_TIMEOUT_MS || 15_000,
  );
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error('--timeout-ms must be an integer between 1000 and 60000.');
  }

  console.log(`Verifying ${manifest.assets.length} R2 runtime asset(s) at ${baseUrl}`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);

  const results = await Promise.allSettled(
    manifest.assets.flatMap((asset) => (
      corsOrigins.map((corsOrigin) => VerifyAsset(asset, baseUrl, corsOrigin, timeoutMs))
    )),
  );
  const failures = [];
  for (const result of results) {
    if (result.status === 'rejected') {
      failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    console.log(
      `- ${result.value.status} ${result.value.objectUrl} for ${result.value.corsOrigin} (${result.value.cacheControl})`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `R2 runtime asset verification failed for ${failures.length} object(s):\n- ${failures.join('\n- ')}`,
    );
  }
  console.log(`Verified ${results.length} R2 runtime asset request(s).`);
}

await Main();

#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import {
  dirname,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error('Usage: check-official-game-pwa-output.mjs <hub-output-directory>');
}

const outputDirectory = resolve(process.cwd(), outputArgument);
const expectedOutputDirectory = resolve(repositoryRoot, 'apps/rehabtrainerhub/out');
if (outputDirectory !== expectedOutputDirectory) {
  throw new Error('Official game PWA output checks may only inspect apps/rehabtrainerhub/out.');
}

const gameIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hashPattern = /^[a-f0-9]{64}$/i;
const revisionPattern = /^[a-f0-9]{16}$/i;
const allowedOfflinePrefixes = ['/assets/', '/icons/', '/runtimes/', '/runtime-assets/'];
const runtimeAssetManifest = await ReadRuntimeAssetManifest();
const gamesDirectory = resolve(outputDirectory, 'games');
const offlineManifestsDirectory = resolve(outputDirectory, 'offline-manifests');
const gameDirectories = await ReadDirectories(gamesDirectory);
const offlineDirectories = await ReadDirectories(offlineManifestsDirectory);

assert.ok(gameDirectories.length > 0, 'No official game PWA directories were emitted.');
assert.deepEqual(
  offlineDirectories.sort(),
  gameDirectories.slice().sort(),
  'Every official game must have exactly one offline manifest directory.',
);

for (const gameId of gameDirectories) {
  assert.match(gameId, gameIdPattern, `Unsafe official game output directory: ${gameId}`);
  await ValidateGameOutput(gameId);
}

console.log(`Validated ${gameDirectories.length} official game PWA outputs and their offline closures.`);

async function ValidateGameOutput(gameId) {
  const basePath = `/games/${gameId}/`;
  const gameDirectory = ResolveOutputPath(basePath);
  const htmlPath = resolve(gameDirectory, 'index.html');
  const manifestPath = resolve(gameDirectory, 'manifest.webmanifest');
  const serviceWorkerPath = resolve(gameDirectory, 'sw.js');
  const html = (await ReadRequiredFile(htmlPath)).toString('utf8');
  const manifest = await ReadJsonFile(manifestPath);
  const serviceWorker = (await ReadRequiredFile(serviceWorkerPath)).toString('utf8');

  assert.match(html, /<html\b[^>]*data-official-game-pwa=["']true["']/i);
  assert.equal(
    CountMatches(html, /<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/gi),
    1,
    `${gameId} must expose exactly one web manifest link.`,
  );
  assert.match(
    html,
    new RegExp(`<link\\b(?=[^>]*\\brel=["']manifest["'])[^>]*\\bhref=["']${EscapeRegExp(basePath)}manifest\\.webmanifest["']`, 'i'),
  );
  assert.equal(
    CountMatches(html, /<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/gi),
    1,
    `${gameId} must have one noindex robots declaration.`,
  );
  assert.match(html, /<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["'][^"']*noindex/i);
  assert.doesNotMatch(html, /<link\b(?=[^>]*\brel=["']canonical["'])/i);
  assert.doesNotMatch(html, /application\/ld\+json/i);
  assert.match(html, /id=["']official-game-offline["']/i);
  assert.match(html, /install-offline-pack/);
  ValidateDocumentResourceUrls(html, gameId);

  assert.equal(manifest.id, basePath, `${gameId} manifest id`);
  assert.equal(manifest.scope, basePath, `${gameId} manifest scope`);
  assert.equal(typeof manifest.start_url, 'string', `${gameId} manifest start_url`);
  assert.ok(manifest.start_url.startsWith(`${basePath}#`), `${gameId} start_url must stay in its scope`);
  ValidateManifestUrls(manifest, gameId);

  new Script(serviceWorker, { filename: `${gameId}/sw.js` });
  assert.match(serviceWorker, /PrecacheShell\(\)/);
  assert.match(serviceWorker, /InstallOfflinePack\(event\.source\)/);
  assert.match(serviceWorker, /type !== 'install-offline-pack'/);
  assert.doesNotMatch(
    serviceWorker,
    /const precacheUrls|\.\.\.moduleUrls|moduleUrls\b/,
    `${gameId} install precache must not include the module engine closure.`,
  );
  assert.match(serviceWorker, /const shellPrecacheUrls/);
  const shellPrecacheMatch = serviceWorker.match(
    /const shellPrecacheUrls = Object\.freeze\((\[[\s\S]*?\])\);/,
  );
  assert.ok(shellPrecacheMatch, `${gameId} shell precache declaration is missing.`);
  const shellPrecacheUrls = JSON.parse(shellPrecacheMatch[1]);
  assert.equal(
    shellPrecacheUrls.some((url) => /\/offline-manifests\//i.test(url)),
    false,
    `${gameId} install must not fetch the offline manifest before explicit download.`,
  );
  assert.doesNotMatch(
    serviceWorker,
    /shellPrecacheUrls[\s\S]{0,500}(?:pixi-|mediapipe|tensorflow|webgazer|three-driving)/i,
    `${gameId} shell precache must not include a heavy engine asset.`,
  );
  assert.match(
    serviceWorker,
    new RegExp(`cachePrefix = [^;]*official-game:[^;]*:${EscapeRegExp(gameId)}:`),
  );
  assert.match(serviceWorker, new RegExp(`scopePath = [^;]*${EscapeRegExp(basePath)}`));
  assert.match(serviceWorker, /crypto\.subtle\.digest\(['"]SHA-256['"]/);
  assert.match(serviceWorker, /credentials:\s*['"]omit['"]/);
  assert.match(serviceWorker, /stagingCachePrefix/);
  assert.match(serviceWorker, /caches\.open\(stagingCacheName\)/);
  assert.match(serviceWorker, /caches\.delete\(stagingCacheName\)/);
  assert.match(serviceWorker, /resources\.length > 512/);
  assert.match(serviceWorker, /(?:256 \* 1024 \* 1024|268435456)/);
  assert.match(
    serviceWorker,
    /url\.origin === self\.location\.origin[\s\S]{0,120}runtimeDestinations\.has/,
    `${gameId} Service Worker must not cache cross-origin runtime requests.`,
  );
  assert.match(serviceWorker, /allowedRuntimePrefixes/);
  assert.match(serviceWorker, /IsAllowedRuntimePath\(url\.pathname\)/);
  assert.match(serviceWorker, /'\/runtimes\/'/);
  assert.match(serviceWorker, /'\/runtime-assets\/'/);
  assert.match(serviceWorker, /'\/assets\/'/);
  assert.match(serviceWorker, /'\/icons\/'/);
  assert.match(serviceWorker, /status === 404 \|\| response\.status === 410/);
  assert.doesNotMatch(serviceWorker, /https?:\/\//i, `${gameId} Service Worker must not hard-code an external URL.`);

  const offlineDirectory = resolve(offlineManifestsDirectory, gameId);
  const offlineFiles = (await readdir(offlineDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const versionedFiles = offlineFiles.filter((fileName) => revisionPattern.test(fileName.replace(/\.json$/i, ''))
    && fileName.toLowerCase().endsWith('.json'));
  assert.ok(versionedFiles.length > 0, `${gameId} has no versioned offline manifest.`);
  assert.ok(offlineFiles.includes('latest.json'), `${gameId} has no latest offline manifest.`);

  const latestPath = resolve(offlineDirectory, 'latest.json');
  const latestBytes = await readFile(latestPath);
  const offlineManifest = ParseOfflineManifest(JSON.parse(latestBytes.toString('utf8')), gameId, basePath);
  const versionedName = `${offlineManifest.version}.json`;
  assert.ok(versionedFiles.includes(versionedName), `${gameId} latest manifest version is not emitted.`);
  assert.deepEqual(
    latestBytes,
    await readFile(resolve(offlineDirectory, versionedName)),
    `${gameId} latest manifest must be byte-identical to its immutable version.`,
  );
  assert.match(
    serviceWorker,
    new RegExp(EscapeRegExp(`/offline-manifests/${gameId}/${offlineManifest.version}.json`)),
    `${gameId} Service Worker must reference its immutable offline manifest for explicit download.`,
  );
  await ValidateOfflineResources(offlineManifest, gameId, basePath);
}

async function ValidateOfflineResources(offlineManifest, gameId, basePath) {
  const seenUrls = new Set();
  let hasLauncher = false;
  let hasManifest = false;
  for (const resource of offlineManifest.resources) {
    assert.equal(typeof resource.url, 'string', `${gameId} offline resource URL`);
    assert.ok(resource.url.startsWith('/'), `${gameId} offline resource must be origin-relative`);
    assert.ok(!resource.url.startsWith('//'), `${gameId} offline resource cannot be protocol-relative`);
    assert.ok(!resource.url.includes('?') && !resource.url.includes('#'), `${gameId} offline resource cannot vary by query/hash`);
    assert.equal(seenUrls.has(resource.url), false, `${gameId} offline resources contain a duplicate URL`);
    seenUrls.add(resource.url);
    assert.ok(Number.isSafeInteger(resource.byteSize) && resource.byteSize >= 0, `${gameId} offline resource byteSize`);
    assert.match(resource.sha256, hashPattern, `${gameId} offline resource SHA-256`);
    assert.equal(resource.required, true, `${gameId} offline resources must be required`);

    if (resource.url === basePath) hasLauncher = true;
    if (resource.url === `${basePath}manifest.webmanifest`) hasManifest = true;
    const runtimeAssetPrefix = '/runtime-assets/';
    if (resource.url.startsWith(runtimeAssetPrefix)) {
      ValidateRuntimeAssetDescriptor(resource, gameId);
      continue;
    }
    assert.ok(
      resource.url.startsWith(basePath) || allowedOfflinePrefixes.some((prefix) => resource.url.startsWith(prefix)),
      `${gameId} offline resource escapes the approved platform prefixes: ${resource.url}`,
    );
    const filePath = resource.url === basePath
      ? resolve(outputDirectory, 'games', gameId, 'index.html')
      : ResolveOutputPath(resource.url);
    const bytes = await ReadRequiredFile(filePath);
    assert.equal(bytes.byteLength, resource.byteSize, `${gameId} offline size mismatch: ${resource.url}`);
    assert.equal(Digest(bytes), resource.sha256.toLowerCase(), `${gameId} offline hash mismatch: ${resource.url}`);
  }
  assert.equal(hasLauncher, true, `${gameId} offline manifest must include its launcher.`);
  assert.equal(hasManifest, true, `${gameId} offline manifest must include its web manifest.`);
}

function ValidateRuntimeAssetDescriptor(resource, gameId) {
  const key = resource.url.slice('/runtime-assets/'.length);
  const descriptor = runtimeAssetManifest.get(key);
  assert.ok(descriptor, `${gameId} references an unknown platform runtime asset: ${key}`);
  assert.equal(resource.byteSize, descriptor.size, `${gameId} runtime asset size mismatch: ${key}`);
  assert.equal(resource.sha256.toLowerCase(), descriptor.sha256, `${gameId} runtime asset hash mismatch: ${key}`);
  assert.equal(resource.contentType, descriptor.contentType, `${gameId} runtime asset content type mismatch: ${key}`);
}

function ParseOfflineManifest(value, gameId, basePath) {
  assert.equal(value?.schemaVersion, 1, `${gameId} offline manifest schema`);
  assert.equal(value.kind, 'official-training-offline-pack', `${gameId} offline manifest kind`);
  assert.equal(value.packId, `official-game:${gameId}`, `${gameId} offline pack id`);
  assert.equal(typeof value.moduleId, 'string', `${gameId} offline module id`);
  assert.equal(typeof value.version, 'string', `${gameId} offline version`);
  assert.match(value.version, revisionPattern, `${gameId} offline version must be immutable hex`);
  assert.equal(value.scope, basePath, `${gameId} offline scope`);
  assert.ok(Array.isArray(value.resources) && value.resources.length > 0, `${gameId} offline resources`);
  return value;
}

function ValidateManifestUrls(manifest, gameId) {
  for (const icon of manifest.icons ?? []) {
    assert.ok(icon && typeof icon.src === 'string', `${gameId} manifest icon must have a URL`);
    ValidateOriginRelativeUrl(icon.src, `${gameId} manifest icon`);
  }
  for (const field of ['scope', 'id']) {
    if (typeof manifest[field] === 'string') ValidateOriginRelativeUrl(manifest[field], `${gameId} manifest ${field}`);
  }
  ValidateOriginRelativeUrl(manifest.start_url, `${gameId} manifest start_url`, { allowHash: true });
}

function ValidateDocumentResourceUrls(html, gameId) {
  const tagPattern = /<(?:script|link|img|audio|video|source)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    ValidateOriginRelativeUrl(match[1], `${gameId} HTML resource`);
  }
}

function ValidateOriginRelativeUrl(value, label, { allowHash = false } = {}) {
  assert.ok(typeof value === 'string' && value.startsWith('/'), `${label} must be origin-relative`);
  assert.ok(!value.startsWith('//'), `${label} contains an unsafe URL`);
  const url = new URL(value, 'https://trainer-build.invalid');
  assert.equal(url.origin, 'https://trainer-build.invalid', `${label} escaped same-origin output`);
  assert.equal(url.search, '', `${label} must not contain a request query`);
  if (!allowHash) assert.equal(url.hash, '', `${label} must not contain a fragment`);
}

async function ReadRuntimeAssetManifest() {
  const value = JSON.parse(await readFile(resolve(repositoryRoot, 'scripts/r2-ai-assets.manifest.json'), 'utf8'));
  assert.equal(value?.schemaVersion, 1, 'runtime asset manifest schema');
  assert.ok(Array.isArray(value.assets), 'runtime asset manifest assets');
  const descriptors = new Map();
  for (const asset of value.assets) {
    assert.equal(typeof asset.key, 'string');
    assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0, `Invalid runtime asset size: ${asset.key}`);
    assert.match(asset.sha256, hashPattern, `Invalid runtime asset hash: ${asset.key}`);
    assert.equal(typeof asset.contentType, 'string');
    assert.equal(descriptors.has(asset.key), false, `Duplicate runtime asset: ${asset.key}`);
    descriptors.set(asset.key, asset);
  }
  return descriptors;
}

async function ReadDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const unexpected = entries.filter((entry) => !entry.isDirectory());
  assert.equal(unexpected.length, 0, `Unexpected non-directory in ${relative(repositoryRoot, directory)}.`);
  return entries.map((entry) => entry.name);
}

async function ReadRequiredFile(filePath) {
  const metadata = await stat(filePath);
  assert.ok(metadata.isFile(), `Expected a regular file: ${relative(repositoryRoot, filePath)}`);
  return readFile(filePath);
}

async function ReadJsonFile(filePath) {
  return JSON.parse((await ReadRequiredFile(filePath)).toString('utf8'));
}

function ResolveOutputPath(publicPath) {
  const url = new URL(publicPath, 'https://trainer-build.invalid');
  assert.equal(url.origin, 'https://trainer-build.invalid');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  const segments = url.pathname.split('/').slice(1);
  if (url.pathname.endsWith('/')) segments.pop();
  const decodedSegments = segments.map((segment) => decodeURIComponent(segment));
  assert.ok(decodedSegments.length > 0 && decodedSegments.every((segment) => segment && segment !== '.' && segment !== '..' && !segment.includes('\\')));
  const filePath = resolve(outputDirectory, ...decodedSegments);
  const outputRelativePath = relative(outputDirectory, filePath);
  assert.ok(outputRelativePath !== '..' && !outputRelativePath.startsWith(`..${sep}`), `Output path escaped: ${publicPath}`);
  return filePath;
}

function Digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function CountMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

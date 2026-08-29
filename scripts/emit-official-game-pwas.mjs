#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import ts from 'typescript';

const generatorRevision = '2026-08-17-official-game-pwa-v2';
const maximumShellPrecacheBytes = 12 * 1024 * 1024;
const gameIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const windowsReservedNamePattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const outputArgument = process.argv[2];
if (!outputArgument) throw new Error('Usage: emit-official-game-pwas.mjs <hub-output-directory>');

const outputDirectory = resolve(process.cwd(), outputArgument);
const appDirectory = dirname(outputDirectory);
const appName = basename(appDirectory);
const trainers = ['motor', 'vision', 'brain', 'mouth'];
const expectedOutputDirectory = resolve(repositoryRoot, 'apps/rehabtrainerhub/out');
if (appName !== 'rehabtrainerhub'
  || basename(outputDirectory) !== 'out'
  || outputDirectory !== expectedOutputDirectory) {
  throw new Error('Official game PWAs may only be emitted into the Hub output directory.');
}

const catalogPath = resolve(repositoryRoot, 'apps/rehabtrainerhub/training-modules/catalog.ts');
const catalogSource = await readFile(catalogPath, 'utf8');
const catalogGames = ReadCatalogSeeds(catalogSource);
const flowManifestSource = await readFile(
  resolve(repositoryRoot, 'apps/rehabtrainerhub/training-modules/moduleFlowManifest.ts'),
  'utf8',
);
const sourcePathsByCatalogId = ReadFlowSourcePaths(flowManifestSource);
const runtimeAssetGroupsByCatalogId = ReadFlowRuntimeAssetGroups(flowManifestSource);
const platformRuntimeAssets = await ReadPlatformRuntimeAssets();
for (const game of catalogGames) {
  const catalogId = `${game.trainer}:${game.id}`;
  game.sourcePath = sourcePathsByCatalogId.get(catalogId) ?? null;
  game.runtimeAssetGroups = runtimeAssetGroupsByCatalogId.get(catalogId) ?? [];
}
ValidateCatalogGames(catalogGames);
const gamesDirectory = resolve(outputDirectory, 'games');
if (dirname(gamesDirectory) !== outputDirectory || basename(gamesDirectory) !== 'games') {
  throw new Error('Refusing to write games outside the Hub build output.');
}
await rm(gamesDirectory, { recursive: true, force: true });
const offlineManifestsDirectory = resolve(outputDirectory, 'offline-manifests');
if (dirname(offlineManifestsDirectory) !== outputDirectory
  || basename(offlineManifestsDirectory) !== 'offline-manifests') {
  throw new Error('Refusing to write offline manifests outside the Hub build output.');
}
await rm(offlineManifestsDirectory, { recursive: true, force: true });

const rootManifest = JSON.parse(await readFile(resolve(outputDirectory, 'manifest.webmanifest'), 'utf8'));
const packageJson = JSON.parse(await readFile(resolve(appDirectory, 'package.json'), 'utf8'));
let emittedGameCount = 0;
for (const trainer of trainers) {
  const games = catalogGames.filter((game) => game.trainer === trainer);
  if (games.length === 0) throw new Error(`No catalog games found for ${trainer}.`);
  const rootHtml = await readFile(resolve(outputDirectory, 'runtimes', trainer, 'index.html'), 'utf8');
  const runtimeManifest = JSON.parse(await readFile(
    resolve(outputDirectory, 'runtimes', trainer, '.vite', 'manifest.json'),
    'utf8',
  ));
  const shellUrls = ExtractShellUrls(rootHtml, rootManifest);
  const shellFiles = shellUrls.map(ResolveOutputFile);
  const shellMetadata = await Promise.all(shellFiles.map(async (filePath) => {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error(`PWA shell resource is not a file: ${filePath}`);
    return { filePath, size: metadata.size };
  }));
  const shellPrecacheBytes = shellMetadata.reduce((total, item) => total + item.size, 0);
  if (shellPrecacheBytes > maximumShellPrecacheBytes) {
    throw new Error(`Official game shell precache exceeds ${maximumShellPrecacheBytes} bytes.`);
  }
  const baseRevision = await CreateBaseRevision(shellFiles, packageJson.version ?? '0.0.0', rootHtml);

  for (const game of games) {
    const gameDirectory = resolve(gamesDirectory, game.id);
    if (dirname(gameDirectory) !== gamesDirectory) throw new Error(`Unsafe official game output path: ${game.id}`);
    await mkdir(gameDirectory, { recursive: true });
    const basePath = `/games/${game.id}/`;
    const description = `${game.title}的單一遊戲安裝入口；結果僅為當次練習紀錄。`;
    const manifest = {
      ...rootManifest,
      id: basePath,
      name: `${game.title}｜居家訓練網`,
      short_name: Array.from(game.title).slice(0, 18).join(''),
      description,
      start_url: `${basePath}#${game.path}`,
      scope: basePath,
    };
    const html = BuildGameHtml(rootHtml, game, basePath, description);
    const runtimeAssetDescriptors = BuildRuntimeAssetDescriptors(
      game,
      trainer,
      platformRuntimeAssets,
    );
    const revision = CreateGameRevision(
      baseRevision,
      game,
      manifest,
      html,
      runtimeAssetDescriptors,
    );
    const moduleUrls = ResolveRuntimeModuleUrls(runtimeManifest, game.sourcePath, trainer);
    const offlineManifest = await BuildOfflineManifest({
      basePath,
      game,
      html,
      manifest,
      moduleUrls,
      revision,
      runtimeAssetDescriptors,
      shellUrls,
      trainer,
    });
    const offlineManifestUrl = `/offline-manifests/${game.id}/${revision}.json`;
    const latestOfflineManifestUrl = `/offline-manifests/${game.id}/latest.json`;
    const serviceWorker = BuildGameServiceWorker({
      basePath,
      gameId: game.id,
      moduleUrls,
      offlineManifestUrl,
      revision,
      shellUrls,
      trainer,
    });
    ValidateGeneratedOutput({
      basePath,
      game,
      html,
      manifest,
      offlineManifest,
      offlineManifestUrl,
      latestOfflineManifestUrl,
      serviceWorker,
      trainer,
    });
    const offlineManifestPath = resolve(outputDirectory, ...offlineManifestUrl.slice(1).split('/'));
    const latestOfflineManifestPath = resolve(outputDirectory, ...latestOfflineManifestUrl.slice(1).split('/'));
    await mkdir(dirname(offlineManifestPath), { recursive: true });
    await Promise.all([
      writeFile(resolve(gameDirectory, 'index.html'), html),
      writeFile(resolve(gameDirectory, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`),
      writeFile(resolve(gameDirectory, 'sw.js'), serviceWorker),
      writeFile(offlineManifestPath, `${JSON.stringify(offlineManifest, null, 2)}\n`),
      writeFile(latestOfflineManifestPath, `${JSON.stringify(offlineManifest, null, 2)}\n`),
    ]);
    emittedGameCount += 1;
  }

  console.log(`Emitted ${games.length} ${trainer} game PWAs (${FormatBytes(shellPrecacheBytes)} shell, ${baseRevision}).`);
}

const headersPath = resolve(outputDirectory, '_headers');
const headers = await readFile(headersPath, 'utf8');
const headerMarker = '# Official per-game PWA assets';
if (!headers.includes(headerMarker)) {
  await writeFile(headersPath, `${headers.trimEnd()}\n\n${headerMarker}\n/games/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Referrer-Policy: no-referrer\n\n/games/*/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/games/*/manifest.webmanifest\n  Cache-Control: public, max-age=300\n\n/offline-manifests/*\n  Cache-Control: public, max-age=31536000, immutable\n`);
}
if (!headers.includes('/offline-manifests/*/latest.json')) {
  const nextHeaders = await readFile(headersPath, 'utf8');
  await writeFile(
    headersPath,
    `${nextHeaders.trimEnd()}\n\n/offline-manifests/*/latest.json\n  Cache-Control: public, max-age=300\n`,
  );
}

console.log(`Emitted ${emittedGameCount} Hub-hosted official game PWAs.`);

function BuildGameHtml(source, game, basePath, description) {
  const clientConfiguration = SerializeForInlineScript({
    basePath,
    expectedHash: `#${game.path}`,
    gameId: game.id,
    serviceWorkerUrl: `${basePath}sw.js`,
  });
  const boot = `<style>
    #official-game-install { position: fixed; z-index: 2147483000; inset: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) auto auto; padding: 8px; border: 1px solid ButtonBorder; border-radius: 10px; background: Canvas; color: CanvasText; box-shadow: 0 4px 18px color-mix(in srgb, CanvasText 18%, transparent); }
    #official-game-install[hidden] { display: none; }
    #official-game-install button { min-height: 42px; padding: 8px 14px; border: 1px solid ButtonBorder; border-radius: 999px; color: ButtonText; background: ButtonFace; font: inherit; font-weight: 700; cursor: pointer; }
  </style>
  <script>
    (() => {
      'use strict';
      const config = Object.freeze(${clientConfiguration});
      let installPrompt = null;
      const enforceGameRoute = () => {
        if (window.location.hash === config.expectedHash) return;
        history.replaceState(null, '', window.location.pathname + window.location.search + config.expectedHash);
      };
      enforceGameRoute();
      window.addEventListener('hashchange', enforceGameRoute);
      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        installPrompt = event;
        const shell = document.getElementById('official-game-install');
        if (shell) shell.hidden = false;
      });
      window.addEventListener('appinstalled', () => {
        installPrompt = null;
        const shell = document.getElementById('official-game-install');
        if (shell) shell.hidden = true;
      });
      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!target) return;
        const url = new URL(target.href, window.location.href);
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) {
          event.preventDefault();
        }
      }, true);
      document.addEventListener('DOMContentLoaded', () => {
        const shell = document.getElementById('official-game-install');
        const button = shell?.querySelector('button');
        button?.addEventListener('click', async () => {
          if (!installPrompt) return;
          shell.hidden = true;
          await installPrompt.prompt();
          installPrompt = null;
        });
        if (window.matchMedia('(display-mode: standalone)').matches && shell) shell.hidden = true;
      });
      Object.defineProperty(window, '__TRAINERHUB_OFFICIAL_GAME__', {
        configurable: false,
        enumerable: false,
        value: config,
        writable: false,
      });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register(config.serviceWorkerUrl, {
          scope: config.basePath,
          updateViaCache: 'none',
        }).catch(() => undefined);
      }
    })();
  </script>`;
  const installShell = `<aside id="official-game-install" hidden aria-live="polite"><button type="button">安裝此遊戲</button></aside>`;
  let html = source
    .replace(/<html\b([^>]*)>/i, '<html$1 data-official-game-pwa="true">')
    // A standalone game PWA must not silently pull fonts, scripts, or other
    // resources from an arbitrary origin. Keep the official shell fully
    // same-origin; the platform can ship reviewed assets under /assets/.
    .replace(/<link\b(?=[^>]*\b(?:href|src)=["'](?:https?:)?\/\/)[^>]*>\s*/gi, '')
    .replace(/<script\b(?=[^>]*\bsrc=["'](?:https?:)?\/\/)[^>]*>\s*<\/script>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>\s*/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*(?:\bproperty=["']og:|\bname=["']twitter:))[^>]*>\s*/gi, '')
    .replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${EscapeHtml(game.title)}｜居家訓練網</title>`)
    .replace(
      /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,
      `<meta name="description" content="${EscapeHtml(description)}" />`,
    )
    .replace(
      /<meta\b(?=[^>]*\bname=["']apple-mobile-web-app-title["'])[^>]*>/i,
      `<meta name="apple-mobile-web-app-title" content="${EscapeHtml(game.title)}" />`,
    )
    .replace(
      /<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/i,
      `<link rel="manifest" href="${basePath}manifest.webmanifest" />`,
    );
  if (!/<link\b(?=[^>]*\brel=["']manifest["'])/i.test(html)) {
    html = html.replace('</head>', `  <link rel="manifest" href="${basePath}manifest.webmanifest" />\n</head>`);
  }
  html = html.replace(
    '</head>',
    `  <meta name="robots" content="noindex,nofollow,noarchive" />\n  ${boot}\n</head>`,
  );
  html = html.replace(/(<body\b[^>]*>)/i, `$1\n  ${installShell}`);
  return html;
}

function BuildGameServiceWorker({
  basePath,
  gameId,
  moduleUrls,
  offlineManifestUrl,
  revision,
  shellUrls,
  trainer,
}) {
  const cachePrefix = `trainerhub-official-game:${trainer}:${gameId}:`;
  const cacheName = `${cachePrefix}${revision}`;
  const precacheUrls = [...new Set([
    basePath,
    `${basePath}manifest.webmanifest`,
    offlineManifestUrl,
    ...shellUrls,
    ...moduleUrls,
  ])].sort();
  return `'use strict';
const cachePrefix = ${JSON.stringify(cachePrefix)};
const cacheName = ${JSON.stringify(cacheName)};
const scopePath = ${JSON.stringify(basePath)};
const launcherUrl = new URL(scopePath, self.location.origin).href;
const offlineManifestUrl = ${JSON.stringify(offlineManifestUrl)};
const precacheUrls = Object.freeze(${JSON.stringify(precacheUrls)});
const precachePaths = new Set(precacheUrls.map((value) => new URL(value, self.location.origin).pathname));
const runtimeDestinations = new Set(['audio', 'font', 'image', 'script', 'style', 'track', 'video', 'worker']);

self.addEventListener('install', (event) => {
  event.waitUntil(Precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(cachePrefix) && key !== cacheName).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.headers.has('range') || request.headers.has('authorization')) return;
  if (request.mode === 'navigate' && url.origin === self.location.origin && url.pathname === scopePath) {
    event.respondWith(NetworkFirstLauncher(request));
    return;
  }
  if (url.origin === self.location.origin && precachePaths.has(url.pathname) && !url.search) {
    event.respondWith(CacheFirst(request));
    return;
  }
  if (request.mode !== 'navigate' && runtimeDestinations.has(request.destination)) {
    event.respondWith(CacheFirst(request));
  }
});

async function NetworkFirstLauncher(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.status === 404 || response.status === 410) {
      await DisableGamePwa();
      return response;
    }
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(launcherUrl, response.clone());
    }
    return response;
  } catch {
    return (await caches.open(cacheName)).match(launcherUrl) || Response.error();
  }
}

async function Precache() {
  const manifestResponse = await fetch(offlineManifestUrl, { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('Offline manifest is unavailable.');
  const manifest = await manifestResponse.clone().json();
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.resources)) {
    throw new Error('Offline manifest is invalid.');
  }
  const cache = await caches.open(cacheName);
  for (const resource of manifest.resources) {
    if (!resource || typeof resource.url !== 'string' || !Number.isSafeInteger(resource.byteSize)
      || !/^[a-f0-9]{64}$/i.test(resource.sha256)) throw new Error('Offline resource metadata is invalid.');
    const url = new URL(resource.url, self.location.origin);
    if (url.origin !== self.location.origin || url.hash || !url.pathname.startsWith(scopePath)
      && !url.pathname.startsWith('/runtimes/') && !url.pathname.startsWith('/assets/')
      && !url.pathname.startsWith('/runtime-assets/') && !url.pathname.startsWith('/icons/')) {
      throw new Error('Offline resource escapes the platform scope.');
    }
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok || response.type === 'opaque') throw new Error('Offline resource fetch failed.');
    const bytes = await response.clone().arrayBuffer();
    if (bytes.byteLength !== resource.byteSize) throw new Error('Offline resource size mismatch.');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (hash !== resource.sha256.toLowerCase()) throw new Error('Offline resource hash mismatch.');
    await cache.put(url, response);
  }
  await cache.put(offlineManifestUrl, manifestResponse);
}

async function CacheFirst(request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
  return response;
}

async function DisableGamePwa() {
  await Promise.all([
    caches.delete(cacheName),
    self.registration.unregister(),
  ]);
}
`;
}

async function BuildOfflineManifest({
  basePath,
  game,
  html,
  manifest,
  moduleUrls,
  revision,
  runtimeAssetDescriptors,
  shellUrls,
  trainer,
}) {
  const resources = [
    basePath,
    `${basePath}manifest.webmanifest`,
    ...shellUrls,
    ...moduleUrls,
  ];
  const descriptors = [];
  for (const url of [...new Set(resources)].sort()) {
    const bytes = url === basePath
      ? Buffer.from(html)
      : url === `${basePath}manifest.webmanifest`
        ? Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
        : await readFile(ResolveOutputFile(url));
    descriptors.push({
      url,
      byteSize: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      required: true,
    });
  }
  return {
    schemaVersion: 1,
    kind: 'official-training-offline-pack',
    packId: `official-game:${game.id}`,
    moduleId: `${trainer}:${game.id}`,
    version: revision,
    scope: basePath,
    resources: [...descriptors, ...runtimeAssetDescriptors]
      .sort((left, right) => left.url.localeCompare(right.url)),
  };
}

function ReadCatalogSeeds(source) {
  const sourceFile = ts.createSourceFile('catalog.ts', source, ts.ScriptTarget.Latest, true);
  let seeds = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'seeds') {
        seeds = UnwrapExpression(declaration.initializer);
      }
    }
  });
  if (!seeds || !ts.isArrayLiteralExpression(seeds)) throw new Error('Unable to read training catalog seeds.');
  return seeds.elements.map((element) => {
    const object = UnwrapExpression(element);
    if (!ts.isObjectLiteralExpression(object)) throw new Error('Catalog seed must be an object literal.');
    const id = ReadStringProperty(object, 'id');
    const trainerId = ReadStringProperty(object, 'trainer');
    const path = ReadStringProperty(object, 'path');
    const localized = UnwrapExpression(ReadProperty(object, 'zh'));
    if (!ts.isArrayLiteralExpression(localized) || localized.elements.length < 1) {
      throw new Error(`Catalog game ${id} has no Traditional Chinese title.`);
    }
    return { id, trainer: trainerId, path, title: ReadString(localized.elements[0]) };
  });
}

function ReadFlowSourcePaths(source) {
  const sourceFile = ts.createSourceFile('moduleFlowManifest.ts', source, ts.ScriptTarget.Latest, true);
  let entries = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'manifestEntries') {
        entries = UnwrapExpression(declaration.initializer);
      }
    }
  });
  if (!entries || !ts.isArrayLiteralExpression(entries)) {
    throw new Error('Unable to read training module flow entries.');
  }
  const sourcePaths = new Map();
  for (const element of entries.elements) {
    const tuple = UnwrapExpression(element);
    if (ts.isSpreadElement(tuple)) {
      const spread = tuple.getText(sourceFile);
      const callbackPath = spread.match(/\[\s*catalogId\s*,\s*(['"])([^'"]+)\1/);
      const idsBlock = source.match(/const\s+referenceCognitiveIds\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
      if (!spread.startsWith('...referenceCognitiveIds.map') || !callbackPath || !idsBlock) {
        throw new Error('Unsupported spread training module flow entry.');
      }
      for (const match of idsBlock[1].matchAll(/['"]([^'"]+)['"]/g)) {
        const catalogId = match[1];
        if (sourcePaths.has(catalogId)) throw new Error(`Duplicate training flow entry: ${catalogId}`);
        sourcePaths.set(catalogId, callbackPath[2]);
      }
      continue;
    }
    if (!ts.isArrayLiteralExpression(tuple) || tuple.elements.length < 2) {
      throw new Error('Training module flow entry must be a tuple.');
    }
    const catalogId = ReadString(tuple.elements[0]);
    const sourcePath = ReadString(tuple.elements[1]);
    if (sourcePaths.has(catalogId)) throw new Error(`Duplicate training flow entry: ${catalogId}`);
    sourcePaths.set(catalogId, sourcePath);
  }
  return sourcePaths;
}

function ReadFlowRuntimeAssetGroups(source) {
  const sourceFile = ts.createSourceFile('moduleFlowManifest.ts', source, ts.ScriptTarget.Latest, true);
  let initializer = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)
        && declaration.name.text === 'runtimeAssetGroupsByCatalogId') {
        initializer = UnwrapStaticObject(declaration.initializer);
      }
    }
  });
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    throw new Error('Unable to read module runtime asset groups.');
  }
  const groupsByCatalogId = new Map();
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error('Runtime asset group map must use properties.');
    }
    const catalogId = ReadPropertyName(property.name);
    const value = UnwrapExpression(property.initializer);
    if (!catalogId || !value || !ts.isArrayLiteralExpression(value)) {
      throw new Error('Runtime asset group map contains an invalid entry.');
    }
    const groups = value.elements.map((element) => ReadString(element));
    if (groups.some((group) => !group || !/^[a-z][a-z0-9-]{1,31}$/.test(group))) {
      throw new Error(`Invalid runtime asset group for ${catalogId}.`);
    }
    if (groupsByCatalogId.has(catalogId)) {
      throw new Error(`Duplicate runtime asset groups: ${catalogId}`);
    }
    groupsByCatalogId.set(catalogId, [...new Set(groups)]);
  }
  return groupsByCatalogId;
}

function UnwrapStaticObject(node) {
  const expression = UnwrapExpression(node);
  if (expression && ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && ts.isIdentifier(expression.expression.expression)
    && expression.expression.expression.text === 'Object'
    && expression.expression.name.text === 'freeze'
    && expression.arguments.length === 1) {
    return UnwrapExpression(expression.arguments[0]);
  }
  return expression;
}

function ReadPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function ResolveRuntimeModuleUrls(runtimeManifest, sourcePath, trainer) {
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    throw new Error(`Missing runtime source path for ${trainer} module.`);
  }
  const expectedKey = `../../training-modules/${sourcePath}`;
  const sourceName = sourcePath.split('/').pop()?.replace(/\.[^.]+$/, '');
  const entryKey = runtimeManifest[expectedKey]
    ? expectedKey
    : Object.keys(runtimeManifest).find((key) => runtimeManifest[key]?.src === expectedKey)
      ?? Object.keys(runtimeManifest).find((key) => (
        runtimeManifest[key]?.name === sourceName
        && runtimeManifest[key]?.isDynamicEntry === true
      ));
  if (!entryKey) throw new Error(`Runtime manifest has no entry for ${expectedKey}.`);
  const keys = CollectManifestClosure(runtimeManifest, entryKey);
  const urls = new Set();
  for (const key of keys) {
    const entry = runtimeManifest[key];
    if (!entry) continue;
    AddManifestAssetUrl(urls, trainer, entry.file);
    for (const css of entry.css ?? []) AddManifestAssetUrl(urls, trainer, css);
    for (const asset of entry.assets ?? []) AddManifestAssetUrl(urls, trainer, asset);
  }
  return [...urls].sort();
}

function CollectManifestClosure(runtimeManifest, rootKey) {
  const visited = new Set();
  const pending = [rootKey];
  while (pending.length > 0) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const entry = runtimeManifest[key];
    if (!entry) continue;
    const dynamicImports = key === 'index.html' ? [] : (entry.dynamicImports ?? []);
    for (const importedKey of [...(entry.imports ?? []), ...dynamicImports]) {
      pending.push(importedKey);
    }
  }
  return visited;
}

function AddManifestAssetUrl(urls, trainer, file) {
  if (typeof file !== 'string' || !file.startsWith('assets/')) return;
  const url = `/runtimes/${trainer}/${file}`;
  if (!/^\/runtimes\/[a-z]+\/assets\/[A-Za-z0-9._/-]+$/.test(url)) {
    throw new Error(`Unsafe runtime manifest asset: ${url}`);
  }
  urls.add(url);
}

function ValidateCatalogGames(games) {
  const ids = new Set();
  for (const game of games) {
    if (typeof game.id !== 'string'
      || game.id.length > 64
      || !gameIdPattern.test(game.id)
      || windowsReservedNamePattern.test(game.id)
      || ids.has(game.id)) {
      throw new Error(`Unsafe or duplicate official game id: ${game.id}`);
    }
    if (!trainers.includes(game.trainer)) {
      throw new Error(`Unknown trainer for official game ${game.id}.`);
    }
    if (typeof game.path !== 'string'
      || game.path.length < 2
      || game.path.length > 256
      || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@/?%-]+$/.test(game.path)) {
      throw new Error(`Unsafe route for official game ${game.id}.`);
    }
    if (typeof game.title !== 'string'
      || game.title.trim() !== game.title
      || game.title.length < 1
      || game.title.length > 120
      || /[\u0000-\u001f\u007f]/.test(game.title)) {
      throw new Error(`Unsafe title for official game ${game.id}.`);
    }
    if (typeof game.sourcePath !== 'string' || game.sourcePath.length === 0) {
      throw new Error(`Missing runtime source path for official game ${game.id}.`);
    }
    if (!Array.isArray(game.runtimeAssetGroups)
      || game.runtimeAssetGroups.some((group) => typeof group !== 'string')) {
      throw new Error(`Invalid runtime asset groups for official game ${game.id}.`);
    }
    ids.add(game.id);
  }
}

function ExtractShellUrls(html, manifest) {
  const urls = new Set();
  const tagPattern = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) AddShellUrl(urls, match[1]);
  for (const icon of Array.isArray(manifest.icons) ? manifest.icons : []) {
    if (icon && typeof icon === 'object') AddShellUrl(urls, icon.src);
  }
  urls.delete('/manifest.webmanifest');
  urls.delete('/sw.js');
  return [...urls].sort();
}

function AddShellUrl(urls, value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return;
  const url = new URL(value, 'https://trainer-build.invalid');
  if (url.origin !== 'https://trainer-build.invalid' || url.search || url.hash || url.pathname === '/') return;
  urls.add(url.pathname);
}

function ResolveOutputFile(publicUrl) {
  const url = new URL(publicUrl, 'https://trainer-build.invalid');
  const segments = url.pathname.split('/').slice(1).map((segment) => decodeURIComponent(segment));
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error(`Unsafe shell resource URL: ${publicUrl}`);
  }
  const filePath = resolve(outputDirectory, ...segments);
  const outputRelativePath = relative(outputDirectory, filePath);
  if (outputRelativePath === '..' || outputRelativePath.startsWith(`..${sep}`)) {
    throw new Error(`Shell resource escaped the build output: ${publicUrl}`);
  }
  return filePath;
}

function ReadStringProperty(object, name) {
  return ReadString(ReadProperty(object, name));
}

function ReadProperty(object, name) {
  const property = object.properties.find((candidate) => (
    ts.isPropertyAssignment(candidate)
    && ((ts.isIdentifier(candidate.name) && candidate.name.text === name)
      || (ts.isStringLiteral(candidate.name) && candidate.name.text === name))
  ));
  if (!property || !ts.isPropertyAssignment(property)) throw new Error(`Catalog seed is missing ${name}.`);
  return property.initializer;
}

function ReadString(node) {
  const expression = UnwrapExpression(node);
  if (!ts.isStringLiteral(expression) && !ts.isNoSubstitutionTemplateLiteral(expression)) {
    throw new Error('Catalog build metadata must use string literals.');
  }
  return expression.text;
}

function UnwrapExpression(node) {
  let current = node;
  while (current && (ts.isAsExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current))) {
    current = current.expression;
  }
  return current;
}

async function CreateBaseRevision(files, version, html) {
  const hash = createHash('sha256')
    .update(generatorRevision)
    .update(String(version))
    .update(html);
  for (const filePath of files) {
    const metadata = await stat(filePath);
    hash.update(relative(outputDirectory, filePath));
    hash.update(String(metadata.size));
    hash.update(await readFile(filePath));
  }
  return hash.digest('hex').slice(0, 16);
}

function CreateGameRevision(baseRevision, game, manifest, html, runtimeAssetDescriptors = []) {
  return createHash('sha256')
    .update(generatorRevision)
    .update(baseRevision)
    .update(JSON.stringify(game))
    .update(JSON.stringify(manifest))
    .update(html)
    .update(JSON.stringify(runtimeAssetDescriptors))
    .digest('hex')
    .slice(0, 16);
}

async function ReadPlatformRuntimeAssets() {
  const manifestPath = resolve(repositoryRoot, 'scripts/r2-ai-assets.manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read platform runtime asset manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error('Platform runtime asset manifest must use schemaVersion 1 and define assets.');
  }
  const assets = manifest.assets.map((asset) => {
    if (!IsSafeRuntimeAssetKey(asset?.key)
      || !Number.isSafeInteger(asset.size)
      || asset.size <= 0
      || typeof asset.contentType !== 'string'
      || !/^[a-f0-9]{64}$/.test(asset.sha256 || '')) {
      throw new Error(`Invalid platform runtime asset descriptor: ${JSON.stringify(asset?.key)}`);
    }
    return Object.freeze({
      key: asset.key,
      size: asset.size,
      sha256: asset.sha256,
      contentType: asset.contentType,
    });
  });
  if (new Set(assets.map((asset) => asset.key)).size !== assets.length) {
    throw new Error('Platform runtime asset manifest contains duplicate keys.');
  }
  return Object.freeze(assets);
}

function BuildRuntimeAssetDescriptors(game, trainer, assets) {
  const selectedKeys = new Set();
  const addPrefix = (prefix) => assets
    .filter((asset) => asset.key.startsWith(prefix))
    .forEach((asset) => selectedKeys.add(asset.key));
  const addKey = (key) => {
    if (!assets.some((asset) => asset.key === key)) {
      throw new Error(`Platform runtime asset is missing from the manifest: ${key}`);
    }
    selectedKeys.add(key);
  };

  const groupResolvers = {
    'mediapipe-wasm': () => addPrefix('ai/mediapipe/tasks-vision/'),
    'mediapipe-hand': () => addPrefix('ai/mediapipe-models/hand_landmarker/'),
    'mediapipe-face': () => addPrefix('ai/mediapipe-models/face_landmarker/'),
    'mediapipe-pose': () => addPrefix('ai/mediapipe-models/pose_landmarker/'),
    'webgazer': () => addPrefix('ai/webgazer/'),
    'star-sky': () => addKey('game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'),
    'reference-car': () => addKey('game-assets/rehabtrainerhub/vision/reference-car/v1/car.glb'),
  };
  const groups = Array.isArray(game.runtimeAssetGroups) ? game.runtimeAssetGroups : [];
  for (const group of groups) {
    const resolveGroup = groupResolvers[group];
    if (!resolveGroup) throw new Error(`Unknown runtime asset group for ${trainer}:${game.id}: ${group}`);
    resolveGroup();
  }

  return [...selectedKeys]
    .map((key) => assets.find((asset) => asset.key === key))
    .filter(Boolean)
    .map((asset) => ({
      url: `/runtime-assets/${asset.key}`,
      byteSize: asset.size,
      sha256: asset.sha256,
      contentType: asset.contentType,
      required: true,
    }))
    .sort((left, right) => left.url.localeCompare(right.url));
}

function IsSafeRuntimeAssetKey(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    && /^[A-Za-z0-9._/-]+$/.test(value);
}
function ValidateGeneratedOutput({
  basePath,
  game,
  html,
  manifest,
  offlineManifest,
  offlineManifestUrl,
  latestOfflineManifestUrl,
  serviceWorker,
  trainer,
}) {
  if (manifest.id !== basePath || manifest.scope !== basePath || !manifest.start_url.startsWith(basePath)) {
    throw new Error(`Invalid generated manifest scope for ${game.id}.`);
  }
  if ((html.match(/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*>/gi) ?? []).length !== 1
    || /<link\b(?=[^>]*\brel=["']canonical["'])/i.test(html)
    || /application\/ld\+json/i.test(html)) {
    throw new Error(`Generated game HTML retained conflicting SEO metadata for ${game.id}.`);
  }
  if (!serviceWorker.includes(`trainerhub-official-game:${trainer}:${game.id}:`)) {
    throw new Error(`Generated service worker identity is invalid for ${game.id}.`);
  }
  if (offlineManifest?.schemaVersion !== 1
    || offlineManifest.packId !== `official-game:${game.id}`
    || offlineManifest.moduleId !== `${trainer}:${game.id}`
    || offlineManifest.scope !== basePath
    || !Array.isArray(offlineManifest.resources)
    || offlineManifest.resources.length === 0
    || !offlineManifest.resources.every((resource) => (
      typeof resource?.url === 'string'
      && Number.isSafeInteger(resource.byteSize)
      && /^[a-f0-9]{64}$/i.test(resource.sha256)
    ))) {
    throw new Error(`Generated offline manifest is invalid for ${game.id}.`);
  }
  if (!serviceWorker.includes(offlineManifestUrl)) {
    throw new Error(`Generated service worker does not precache the offline manifest for ${game.id}.`);
  }
  if (!/^\/offline-manifests\/[a-z0-9-]+\/latest\.json$/.test(latestOfflineManifestUrl)
    || latestOfflineManifestUrl !== `/offline-manifests/${game.id}/latest.json`) {
    throw new Error(`Generated latest offline manifest path is invalid for ${game.id}.`);
  }
  new Script(serviceWorker, { filename: `${game.id}/sw.js` });
}

function SerializeForInlineScript(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function EscapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function FormatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

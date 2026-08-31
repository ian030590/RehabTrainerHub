#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputArgument = process.argv[2];

if (!outputArgument) {
  throw new Error('Usage: emit-pwa-assets.mjs <output-directory>');
}

const outputDir = resolve(process.cwd(), outputArgument);
await mkdir(outputDir, { recursive: true });
const outputFiles = (await CollectFiles(outputDir))
  .filter((filePath) => {
    const outputPath = relative(outputDir, filePath);
    const outputPathParts = outputPath.split(sep);
    return !outputPathParts.some((part) => part.startsWith('.'))
      && IsRootShellFile(outputPath)
      && !['404.html', 'sw.js', '_headers'].includes(basename(filePath));
  })
  .sort();
const maximumRootShellPrecacheBytes = 8 * 1024 * 1024;
const rootShellBytes = outputFiles.reduce((total, filePath) => total + GetFileSize(filePath), 0);
if (rootShellBytes > maximumRootShellPrecacheBytes) {
  throw new Error(
    `Root Hub shell precache is ${rootShellBytes} bytes; maximum is ${maximumRootShellPrecacheBytes}. Move module assets to an offline pack.`,
  );
}
const precacheUrls = [...new Set(outputFiles.map((filePath) => ToPublicUrl(outputDir, filePath)))].sort();
const revision = createHash('sha256');
for (const filePath of outputFiles) {
  revision.update(relative(outputDir, filePath));
  revision.update(await readFile(filePath));
}

const cacheName = `rehab-trainer-${revision.digest('hex').slice(0, 12)}`;
const workerTemplate = await readFile(
  resolve(scriptDir, '../packages/ui/src/pwa-service-worker.js'),
  'utf8',
);
const worker = workerTemplate
  .replace("'__CACHE_NAME__'", JSON.stringify(cacheName))
  .replace("/* __PRECACHE_URLS__ */ ['/']", JSON.stringify(precacheUrls));
const frameAncestors = "'self'";

await writeFile(resolve(outputDir, 'sw.js'), worker);
await writeFile(
  resolve(outputDir, '_headers'),
  [
    '/*',
    `  Content-Security-Policy: frame-ancestors ${frameAncestors}`,
    '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
    '',
    '/sw.js',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    '  Service-Worker-Allowed: /',
    '',
    '/manifest.webmanifest',
    '  Cache-Control: public, max-age=3600',
    '',
  ].join('\n'),
);

async function CollectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await CollectFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function ToPublicUrl(rootDirectory, filePath) {
  const path = relative(rootDirectory, filePath)
    .split(sep)
    .map(encodeURIComponent)
    .join('/');
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

function GetFileSize(filePath) {
  // The output is already constrained to regular files by CollectFiles; using
  // statSync avoids loading a second copy of large assets just to enforce the
  // shell budget.
  return statSync(filePath).size;
}

function IsRootShellFile(outputPath) {
  const normalizedPath = outputPath.replaceAll(sep, '/');
  const [firstSegment] = normalizedPath.split('/');
  if (['runtimes', 'games', 'runtime-assets', 'offline-manifests', 'official-training-host'].includes(firstSegment)) {
    return false;
  }
  // Keep the Hub install small and deterministic. Models, WASM, and 3D scene
  // data belong to a module offline pack, never to the root shell cache.
  return !/(?:^|\/)(?:webgazer|models?|wasm|driving)(?:\/|$)/i.test(normalizedPath)
    && !/\.(?:wasm|onnx|tflite|glb|gltf)$/i.test(normalizedPath);
}

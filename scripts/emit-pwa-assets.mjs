#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
    const outputPathParts = relative(outputDir, filePath).split(sep);
    return !outputPathParts.some((part) => part.startsWith('.'))
      && !['404.html', 'sw.js', '_headers'].includes(basename(filePath));
  })
  .sort();
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
const appName = basename(dirname(outputDir));
const trainerApps = new Set(['motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer']);
const frameAncestors = trainerApps.has(appName)
  ? "'self' https://trainerhub.cc https://rehabtrainerhub.pages.dev https://*.rehabtrainerhub.pages.dev http://localhost:* http://127.0.0.1:*"
  : "'self'";

await writeFile(resolve(outputDir, 'sw.js'), worker);
await writeFile(
  resolve(outputDir, '_headers'),
  [
    '/*',
    `  Content-Security-Policy: frame-ancestors ${frameAncestors}`,
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

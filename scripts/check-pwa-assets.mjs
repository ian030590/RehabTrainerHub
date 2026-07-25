#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['rehabtrainerhub', 'motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer'];

for (const app of apps) {
  const publicDir = resolve(repoRoot, 'apps', app, 'public');
  const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8'));

  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name);

  for (const [fileName, size] of [
    ['apple-touch-icon.png', 180],
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['pwa-maskable-512.png', 512],
  ]) {
    const filePath = resolve(publicDir, 'icons', fileName);
    assert.ok(existsSync(filePath), `${filePath} is missing`);
    const png = readFileSync(filePath);
    assert.equal(png.readUInt32BE(16), size, `${filePath} width`);
    assert.equal(png.readUInt32BE(20), size, `${filePath} height`);
  }
}

const fixtureRoot = mkdtempSync(join(tmpdir(), 'rehab-pwa-check-'));
try {
  const outputDir = resolve(fixtureRoot, 'motortrainer', 'dist');
  mkdirSync(resolve(outputDir, '.hidden'), { recursive: true });
  writeFileSync(resolve(outputDir, 'index.html'), '<!doctype html><title>PWA fixture</title>');
  writeFileSync(resolve(outputDir, '.DS_Store'), 'deployment metadata');
  writeFileSync(resolve(outputDir, '.hidden', 'ignored.txt'), 'hidden deployment file');

  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, 'scripts/emit-pwa-assets.mjs'), outputDir],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const worker = readFileSync(resolve(outputDir, 'sw.js'), 'utf8');
  assert.equal(worker.includes('.DS_Store'), false);
  assert.equal(worker.includes('.hidden'), false);
  assert.match(worker, /caches\.match\(request, \{ ignoreSearch: true \}\)/);

  const headers = readFileSync(resolve(outputDir, '_headers'), 'utf8');
  assert.match(
    headers,
    /Content-Security-Policy: frame-ancestors 'self' https:\/\/trainerhub\.cc.*http:\/\/localhost:\*/,
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`Validated PWA manifests and icons for ${apps.length} apps.`);

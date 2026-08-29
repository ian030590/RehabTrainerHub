#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = resolve(repoRoot, 'apps/rehabtrainerhub/out/runtimes');
const trainers = ['motor', 'vision', 'brain', 'mouth'];
const heavyChunkPattern = /(?:experiment-runtime|pixi-runtime|tensorflow-runtime|three-runtime|vosk)/i;

for (const trainer of trainers) {
  const trainerRoot = join(runtimeRoot, trainer);
  const manifestPath = join(trainerRoot, '.vite', 'manifest.json');
  assert.ok(existsSync(manifestPath), `${trainer}: Vite build manifest is missing at ${relative(repoRoot, manifestPath)}.`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = manifest['index.html'];
  assert.ok(entry?.isEntry, `${trainer}: index.html must remain the sole Vite entry.`);
  assert.ok(typeof entry.file === 'string' && entry.file.startsWith('assets/'), `${trainer}: entry file must stay under assets/.`);
  assert.ok(Array.isArray(entry.dynamicImports) && entry.dynamicImports.length > 0, `${trainer}: entry must expose dynamic module imports.`);

  const staticClosure = CollectStaticClosure(manifest, 'index.html');
  for (const key of staticClosure) {
    const chunk = manifest[key];
    assert.ok(chunk, `${trainer}: static import ${key} is missing from the Vite manifest.`);
    assert.ok(!IsHeavyChunk(key, chunk), `${trainer}: root entry statically imports heavy chunk ${key}.`);
  }

  // Keep the assertion source-aware as well as filename-aware. Vite may
  // change a chunk's generated name, but a package source path still tells us
  // whether a future refactor accidentally moves a heavy dependency into the
  // root entry. This protects the rules-visible loading boundary from hash
  // renames and minifier changes.
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!IsHeavySource(key, chunk)) continue;
    assert.equal(
      staticClosure.has(key),
      false,
      `${trainer}: heavy source ${key} must stay outside the root static closure.`,
    );
  }

  for (const dynamicKey of entry.dynamicImports) {
    const dynamicEntry = manifest[dynamicKey];
    assert.ok(dynamicEntry?.isDynamicEntry, `${trainer}: ${dynamicKey} must be a dynamic entry.`);
    const dynamicClosure = CollectStaticClosure(manifest, dynamicKey);
    for (const key of dynamicClosure) {
      const chunk = manifest[key];
      assert.ok(chunk, `${trainer}: dynamic import ${key} is missing from the Vite manifest.`);
      AssertSafeAssetReference(trainerRoot, trainer, key, chunk.file);
    }
  }

  for (const [key, chunk] of Object.entries(manifest)) {
    AssertSafeAssetReference(trainerRoot, trainer, key, chunk.file);
  }
}

console.log(`Runtime build-manifest contract passed for ${trainers.length} runtimes.`);

function CollectStaticClosure(manifest, rootKey) {
  const visited = new Set();
  const pending = [rootKey];
  while (pending.length > 0) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) continue;
    for (const importedKey of entry.imports ?? []) pending.push(importedKey);
  }
  return visited;
}

function IsHeavyChunk(key, chunk) {
  return heavyChunkPattern.test(key) || heavyChunkPattern.test(chunk?.file ?? '') || heavyChunkPattern.test(chunk?.name ?? '');
}

function IsHeavySource(key, chunk) {
  return /(?:node_modules[\\/]?(?:jspsych|pixi\.js|three|@mediapipe|@tensorflow|webgazer)|training-modules[\\/].*(?:experiment|pages[\\/].*Training))/i
    .test(`${key} ${chunk?.src ?? ''}`);
}

function AssertSafeAssetReference(trainerRoot, trainer, key, file) {
  assert.ok(typeof file === 'string' && file.startsWith('assets/'), `${trainer}: ${key} points outside assets/.`);
  const filePath = resolve(trainerRoot, file);
  const normalizedRoot = `${resolve(trainerRoot, 'assets')}${sep}`;
  assert.ok(filePath.startsWith(normalizedRoot), `${trainer}: ${key} has an unsafe asset path.`);
  assert.ok(existsSync(filePath), `${trainer}: generated asset is missing: ${file}`);
}

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
import { platformRuntimeContract } from '../apps/usergamerunner/functions/_lib/runtime.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['rehabtrainerhub', 'motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer'];
const trainerApps = ['motortrainer', 'visiontrainer', 'braintrainer', 'mouthtrainer'];

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

for (const app of trainerApps) {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'apps', app, 'package.json'), 'utf8'));
  assert.match(
    packageJson.scripts.build,
    /emit-pwa-assets\.mjs dist.*emit-official-game-pwas\.mjs dist/,
    `${app} must generate scoped game PWAs after its root PWA`,
  );
}

const gameRunnerBuild = spawnSync(
  process.execPath,
  [resolve(repoRoot, 'apps/usergamerunner/scripts/build.mjs')],
  { cwd: repoRoot, encoding: 'utf8' },
);
assert.equal(gameRunnerBuild.status, 0, gameRunnerBuild.stderr || gameRunnerBuild.stdout);
const gameRunnerOutput = resolve(repoRoot, 'apps/usergamerunner/dist');
for (const [publicUrl, sourcePath] of [
  [platformRuntimeContract.jsPsychUrl, 'node_modules/jspsych/dist/index.browser.js'],
  [platformRuntimeContract.jsPsychCssUrl, 'node_modules/jspsych/css/jspsych.css'],
  [platformRuntimeContract.gameSdkUrl, 'packages/game-sdk/src/index.js'],
  [platformRuntimeContract.noticesUrl, 'apps/usergamerunner/THIRD_PARTY_NOTICES.txt'],
  [platformRuntimeContract.icon192Url, 'apps/rehabtrainerhub/public/icons/pwa-192.png'],
  [platformRuntimeContract.icon512Url, 'apps/rehabtrainerhub/public/icons/pwa-512.png'],
]) {
  const outputPath = resolve(gameRunnerOutput, ...publicUrl.slice(1).split('/'));
  assert.ok(existsSync(outputPath), `${outputPath} is missing from the game runner build`);
  assert.deepEqual(
    readFileSync(outputPath),
    readFileSync(resolve(repoRoot, sourcePath)),
    `${publicUrl} must be copied byte-for-byte from its reviewed workspace source`,
  );
}
const builtNotice = readFileSync(
  resolve(gameRunnerOutput, ...platformRuntimeContract.noticesUrl.slice(1).split('/')),
  'utf8',
);
assert.match(builtNotice, /Copyright \(c\) 2014-2022 Joshua R\. de Leeuw/);
assert.match(builtNotice, /MIT License/);

const pwaRegistrationSource = readFileSync(resolve(repoRoot, 'packages/ui/src/pwa.tsx'), 'utf8');
assert.ok(
  pwaRegistrationSource.includes("/^\\/games\\/[a-z0-9-]+\\//"),
  'The root PWA registration must skip generated per-game scopes.',
);
assert.match(pwaRegistrationSource, /if \(!isStandaloneGamePath\)/);

const officialGeneratorSource = readFileSync(
  resolve(repoRoot, 'scripts/emit-official-game-pwas.mjs'),
  'utf8',
);
assert.match(officialGeneratorSource, /maximumShellPrecacheBytes/);
assert.match(officialGeneratorSource, /ValidateCatalogGames/);
assert.match(officialGeneratorSource, /ValidateGeneratedOutput/);
assert.match(officialGeneratorSource, /runtimeDestinations/);
assert.match(officialGeneratorSource, /data-official-game-pwa/);
assert.doesNotMatch(officialGeneratorSource, /function CollectFiles/);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'rehab-pwa-check-'));
try {
  const outputDir = resolve(fixtureRoot, 'motortrainer', 'dist');
  mkdirSync(resolve(outputDir, '.hidden'), { recursive: true });
  writeFileSync(resolve(outputDir, 'index.html'), '<!doctype html><title>PWA fixture</title>');
  writeFileSync(resolve(outputDir, '404.html'), '<!doctype html><title>Not found</title>');
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
  assert.equal(worker.includes('/404.html'), false);
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

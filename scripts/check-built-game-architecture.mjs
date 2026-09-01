#!/usr/bin/env node

import assert from 'node:assert/strict';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const outputArgument = process.argv[2];
if (!outputArgument) {
  throw new Error('Usage: check-built-game-architecture.mjs <hub-output-directory>');
}

const repositoryRoot = resolve(import.meta.dirname, '..');
const expectedOutputDirectory = resolve(repositoryRoot, 'apps/rehabtrainerhub/out');
const outputDirectory = resolve(process.cwd(), outputArgument);
assert.equal(
  outputDirectory,
  expectedOutputDirectory,
  'Built game architecture may only be checked in apps/rehabtrainerhub/out.',
);

test('built Hub retains 26 independent game directories and no public trainer runtimes', async () => {
  const gamesOutputRoot = resolve(outputDirectory, 'games');
  const sourceGamesRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/games');
  await assert.rejects(lstat(resolve(outputDirectory, 'runtimes')), undefined, 'Public /runtimes must not exist.');
  const temporaryShellsDirectory = resolve(outputDirectory, '.official-game-shells');
  const temporaryShellsMetadata = await lstat(temporaryShellsDirectory).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (temporaryShellsMetadata) {
    assert.equal(temporaryShellsMetadata.isDirectory(), true);
    assert.deepEqual(
      await readdir(temporaryShellsDirectory),
      [],
      'Temporary official game shell files must be removed after emission.',
    );
  }

  const sourceGameIds = await ListDirectories(sourceGamesRoot);
  const outputGameIds = await ListDirectories(gamesOutputRoot);
  assert.equal(sourceGameIds.length, 26, 'The current official library must retain all 26 games.');
  assert.deepEqual(outputGameIds, sourceGameIds, 'Built and source game directories must match exactly.');

  for (const gameId of sourceGameIds) {
    const sourceDirectory = resolve(sourceGamesRoot, gameId);
    const outputGameDirectory = resolve(gamesOutputRoot, gameId);
    assert.equal(dirname(outputGameDirectory), gamesOutputRoot, `Unsafe output directory for ${gameId}.`);

    const outputMetadata = await lstat(outputGameDirectory);
    assert.equal(outputMetadata.isDirectory(), true, `${gameId} output must be a directory.`);
    assert.equal(outputMetadata.isSymbolicLink(), false, `${gameId} output cannot be a symbolic link.`);

    const sourceSettings = await readFile(resolve(sourceDirectory, 'settings.json'));
    const builtSettings = await readFile(resolve(outputGameDirectory, 'settings.json'));
    assert.deepEqual(builtSettings, sourceSettings, `${gameId} settings.json must be copied byte-for-byte.`);
    ParseGameSettingsDefinition(JSON.parse(builtSettings.toString('utf8')), gameId);

    const manifest = JSON.parse(await readFile(resolve(outputGameDirectory, 'manifest.webmanifest'), 'utf8'));
    const basePath = `/games/${gameId}/`;
    assert.equal(manifest.id, basePath, `${gameId} manifest id.`);
    assert.equal(manifest.scope, basePath, `${gameId} manifest scope.`);
    assert.equal(manifest.start_url.startsWith(basePath), true, `${gameId} manifest start_url.`);

    const html = await readFile(resolve(outputGameDirectory, 'index.html'), 'utf8');
    const serviceWorker = await readFile(resolve(outputGameDirectory, 'sw.js'), 'utf8');
    assert.match(html, /data-official-game-pwa="true"/);
    assert.match(html, new RegExp(`href="${EscapeRegex(basePath)}manifest\\.webmanifest"`));
    assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive" \/>/);
    assert.match(html, /__TRAINERHUB_OFFICIAL_GAME__/);
    assert.match(serviceWorker, new RegExp(`trainerhub-official-game:${EscapeRegex(gameId)}:`));
    assert.match(serviceWorker, new RegExp(`${EscapeRegex(basePath)}settings\\.json`));
    assert.doesNotMatch(`${html}\n${serviceWorker}\n${JSON.stringify(manifest)}`, /\/runtimes\//);

    const assetsDirectory = resolve(outputGameDirectory, 'assets');
    const assetsMetadata = await lstat(assetsDirectory);
    assert.equal(assetsMetadata.isDirectory(), true, `${gameId} must contain its own assets directory.`);
    assert.equal((await readdir(assetsDirectory)).length > 0, true, `${gameId} assets cannot be empty.`);

    for (const requiredFile of ['index.html', 'manifest.webmanifest', 'settings.json', 'sw.js']) {
      const filePath = resolve(outputGameDirectory, requiredFile);
      const relativePath = relative(outputGameDirectory, filePath);
      assert.equal(relativePath.startsWith('..'), false, `Unsafe required path for ${gameId}.`);
      assert.equal((await lstat(filePath)).isFile(), true, `${gameId}/${requiredFile} must be a file.`);
    }
  }

  console.log(`Built game architecture passed for ${outputGameIds.length} independent game directories.`);
});

async function ListDirectories(root) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function EscapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

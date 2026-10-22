#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { ParseGameSettingsDefinition } from '../packages/game-settings/src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = resolve(repoRoot, 'apps/rehabtrainerhub/games');
const sources = {
  antisaccade: ['f1af8ef0f4b095c1d2b629297a3b589d0bc4234c', '52107c81ca769c83ccf13dbf4abebfdaba69d0237dba4f4d85c0a8bc14c83ac2'],
  'letter-memory': ['4ad00df094fa370737be4d8cddfee682cd57f6b6', '846365b8fb414ac5cd38d0705945221fc6b6e088da6e6b2786ba83e066fbcfd7'],
  'keep-track': ['202b7c7bb488240341ff26fcc9b808a13683eed6', '8404699aa2a37661fab983932fbbd8792d8d106cc4d94e8c7dae7b669fb28b2c'],
  'plus-minus': ['02b36c0625d08432993b33ff214a9860b7811c78', '2aa9d088b98fb37e7dd8882c23e888801ca0d86750db46fd4b7c730161f230c8'],
};
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
const safePathPattern = /^[A-Za-z0-9_./-]+$/;

for (const [gameId, [commit, expectedHash]] of Object.entries(sources)) {
  const root = resolve(gameRoot, gameId);
  const runtimeRoot = resolve(root, 'public/runtime');
  assert.ok(!existsSync(resolve(root, 'public/legacy')), `${gameId}: legacy directory returned.`);

  const experimentSource = readFileSync(resolve(runtimeRoot, 'experiment.js'), 'utf8');
  const sourceHash = createHash('sha256')
    .update(experimentSource.replace(/\r\n/g, '\n').trimEnd())
    .digest('hex');
  assert.equal(sourceHash, expectedHash, `${gameId}: original experiment.js changed from ${commit}.`);

  const gameSourceFile = readdirSync(root).find((name) => name.endsWith('Game.tsx'));
  assert.ok(gameSourceFile, `${gameId}: game entry is missing.`);
  const gameSource = readFileSync(resolve(root, gameSourceFile), 'utf8');
  assert.ok(gameSource.includes(`sourceCommit: '${commit}'`), `${gameId}: source commit is stale.`);
  assert.ok(gameSource.includes('ExpFactoryGame'), `${gameId}: shared React/jsPsych shell is missing.`);
  assert.ok(!gameSource.includes("('rules')"), `${gameId}: pre-game rules page returned.`);

  const settings = JSON.parse(readFileSync(resolve(root, 'settings.json'), 'utf8'));
  ParseGameSettingsDefinition(settings, gameId);
  assert.ok(settings.sections.flatMap((section) => section.fields).length > 0, `${gameId}: activity grading settings are missing.`);

  const manifest = JSON.parse(readFileSync(resolve(runtimeRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1, `${gameId}: runtime manifest schema is invalid.`);
  assert.equal(manifest.gameId, gameId, `${gameId}: runtime manifest game ID is invalid.`);
  assert.match(manifest.timelineName, /^[A-Za-z_$][\w$]*$/, `${gameId}: timeline name is invalid.`);
  assert.ok(Array.isArray(manifest.styles) && manifest.styles.includes('shell.css'), `${gameId}: runtime styles are incomplete.`);
  assert.ok(Array.isArray(manifest.scripts), `${gameId}: runtime scripts are missing.`);
  assert.ok(manifest.scripts.includes('experiment.js'), `${gameId}: original timeline is missing.`);
  assert.ok(manifest.scripts.includes('localization.js'), `${gameId}: localization adapter is missing.`);
  assert.ok(manifest.scripts.includes('research.js'), `${gameId}: research adapter is missing.`);
  assert.ok(manifest.scripts.indexOf('experiment.js') < manifest.scripts.indexOf('localization.js'), `${gameId}: localization loads before its timeline.`);
  assert.ok(manifest.scripts.indexOf('localization.js') < manifest.scripts.indexOf('research.js'), `${gameId}: research adapter order is invalid.`);
  assert.ok(!manifest.scripts.includes('rehab-bridge.js'), `${gameId}: iframe message bridge returned.`);

  for (const relativePath of [...manifest.styles, ...manifest.scripts]) {
    assert.match(relativePath, safePathPattern, `${gameId}: unsafe runtime path ${relativePath}.`);
    assert.ok(!relativePath.startsWith('/') && !relativePath.includes('..'), `${gameId}: unsafe runtime path ${relativePath}.`);
    assert.ok(existsSync(resolve(runtimeRoot, relativePath)), `${gameId}: missing runtime asset ${relativePath}.`);
  }
  assert.ok(!existsSync(resolve(runtimeRoot, 'index.html')), `${gameId}: nested iframe document returned.`);
  assert.ok(!existsSync(resolve(runtimeRoot, 'rehab-bridge.js')), `${gameId}: postMessage bridge returned.`);
  assert.ok(existsSync(resolve(runtimeRoot, 'LICENSE')), `${gameId}: upstream license is missing.`);

  const localizationSource = readFileSync(resolve(runtimeRoot, 'localization.js'), 'utf8');
  const shellStyles = readFileSync(resolve(runtimeRoot, 'shell.css'), 'utf8');
  assert.ok(localizationSource.includes('window.rehabBilingualize'), `${gameId}: bilingual jsPsych instructions are missing.`);
  assert.ok(!/(?:linear|radial)-gradient|neon/i.test(shellStyles), `${gameId}: forbidden instruction styling found.`);
  assert.ok(!emojiPattern.test(localizationSource + gameSource), `${gameId}: emoji found in instruction copy.`);
  new Script(localizationSource, { filename: `${gameId}/localization.js` });

  const pagesSource = experimentSource.match(/pages:\s*\[([\s\S]*?)\n\s*\]/)?.[1];
  assert.ok(pagesSource, `${gameId}: original instruction pages are missing.`);
  const pageCount = pagesSource.split(/<div class = (?:centerbox|tol_topbox)>/).length - 1;
  const instructionPages = Array.from({ length: pageCount }, () => '<div class = centerbox><p>Original instruction</p></div>');
  const localized = { instructions_block: { pages: instructionPages }, stims: [['orange'], ['blue']] };
  new Script(localizationSource).runInNewContext({ window: localized });
  localized.rehabBilingualize();
  assert.equal(localized.instructions_block.pages.length, pageCount);
  for (const page of localized.instructions_block.pages) {
    assert.match(page, /lang="zh-TW"><p class="block-text">[^<]*[\u3400-\u9fff]/, `${gameId}: actual instruction page needs Chinese.`);
    assert.ok(page.includes('Original instruction'), `${gameId}: original instruction content must remain.`);
    assert.ok(!page.includes('undefined'), `${gameId}: missing page translation.`);
  }
}

const shellSource = readFileSync(resolve(repoRoot, 'packages/ui/src/components/ExpFactoryGame.tsx'), 'utf8');
for (const token of [
  "new URL('./runtime/', window.location.href)",
  'LoadRuntimeManifest(',
  'jsPsych.init({',
  "display_element: 'getDisplayElement'",
  'runtime.rehabResearchRows',
]) {
  assert.ok(shellSource.includes(token), `ExpFactory React shell is missing ${token}.`);
}
assert.ok(!/<iframe|postMessage|\.\/legacy\//.test(shellSource), 'ExpFactory games must run directly in their React shell.');

const tourStyles = readFileSync(resolve(repoRoot, 'packages/ui/src/tour/toutour.css'), 'utf8');
assert.ok(!/(?:linear|radial)-gradient|neon/i.test(tourStyles.replace(/\/\*[\s\S]*?\*\//g, '')), 'Toutour styles must stay free of gradients and neon effects.');

console.log(`ExpFactory React runtimes passed for ${Object.keys(sources).length} games.`);

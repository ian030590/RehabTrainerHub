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
  stroop: ['b4125f0c1f4f0383928f4cab8c04fe5a26349c95', '7b3ccb070fedfa0dd178e1495a56ec84e02143ca022a8d62cc2f0c88676629f7'],
  flanker: ['c74f2eb3b01a9d7b317cb64300db687180ad8937', 'd0be4c26cf6998526cfc2151ed8346e804427e5f061570386fa7e3bb46a5d6ac'],
  'go-nogo': ['f6d89998ad71581b30113bc9df5afa90cf010871', '773c4f2e5c9dc0d3e54b49d838213f7f778729aae274d839742cbfb05947d6c4'],
  'stop-signal': ['04796ee87b083d7a0bd5f8a9ee722ea4d60d5c8e', 'acd45ba4617aac53e1334eecf611ac8f0c0b65f91a3c5d01bd9ebdb33b193a5c'],
  'attention-network-task': ['6caac2b320cafe4b0707b3d1fdd360eb4f07dd43', 'ba8a9625e1db762860763983eb62ddb2439ad1f24c5e05a1cc26ef18ed9619ae'],
  antisaccade: ['f1af8ef0f4b095c1d2b629297a3b589d0bc4234c', '52107c81ca769c83ccf13dbf4abebfdaba69d0237dba4f4d85c0a8bc14c83ac2'],
  'n-back': ['a23052398c0151a7cceba8f558dbd3b80d0b3340', '07457ecd1ca459258181d566bd32a710e726e2db7e66b2f4fc8d3ec5dff2bd7b'],
  'digit-span': ['161a52f895396f25f83749680e253d57b6795537', '05b3ba558764b1cb4c55fc3691924704e30e41a1363949a1c3c6195aadbc987f'],
  'spatial-span': ['f81c74c80744982771fb051308105c85cf999c27', 'f14a0eb86aad34146feaceed6a43a3a7d0e7b0806adec255bb86afc617947fed'],
  'letter-memory': ['4ad00df094fa370737be4d8cddfee682cd57f6b6', '846365b8fb414ac5cd38d0705945221fc6b6e088da6e6b2786ba83e066fbcfd7'],
  'keep-track': ['202b7c7bb488240341ff26fcc9b808a13683eed6', '8404699aa2a37661fab983932fbbd8792d8d106cc4d94e8c7dae7b669fb28b2c'],
  'tower-of-london': ['79d00756e389187a4bab5cf8c2c68c728f9c4b4a', '6921ac1b3e4371f91647dd24fed638fc1e3cd64c9c3db10e91d98f4b92f57603'],
  'number-letter': ['ae91b2b1c7e4695c9b58626ef3082eb5c018a421', 'ff9ffd69c537317253bcdc9cc6f23b8c6624bb55110ea036bb8e770fc5f302ee'],
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

#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

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

for (const [gameId, [commit, expectedHash]] of Object.entries(sources)) {
  const root = resolve(gameRoot, gameId);
  const legacyRoot = resolve(root, 'public/legacy');
  const sourceHash = createHash('sha256')
    .update(readFileSync(resolve(legacyRoot, 'experiment.js'), 'utf8').replace(/\r\n/g, '\n').trimEnd())
    .digest('hex');
  assert.equal(sourceHash, expectedHash, `${gameId}: original experiment.js changed from ${commit}.`);

  const gameSourceFile = readdirSync(root).find((name) => name.endsWith('Game.tsx'));
  assert.ok(gameSourceFile, `${gameId}: game entry is missing.`);
  const gameSource = readFileSync(resolve(root, gameSourceFile), 'utf8');
  assert.ok(gameSource.includes(`sourceCommit: '${commit}'`), `${gameId}: source commit is stale.`);
  assert.ok(gameSource.includes('ExpFactoryGame'), `${gameId}: shared original-experiment shell is missing.`);
  assert.ok(!gameSource.includes("('rules')"), `${gameId}: pre-game rules page returned.`);

  const settings = JSON.parse(readFileSync(resolve(root, 'settings.json'), 'utf8'));
  assert.deepEqual(settings, { schemaVersion: 1, gameId, sections: [] }, `${gameId}: settings must be start-only.`);
  assert.ok(!existsSync(resolve(root, 'runtime')), `${gameId}: deleted custom runtime returned.`);

  const indexSource = readFileSync(resolve(legacyRoot, 'index.html'), 'utf8');
  const bridgeSource = readFileSync(resolve(legacyRoot, 'rehab-bridge.js'), 'utf8');
  assert.ok(indexSource.includes('lang="zh-TW"'), `${gameId}: bilingual copy is missing.`);
  assert.ok(indexSource.includes('window.rehabBilingualize'), `${gameId}: bilingual jsPsych instructions are missing.`);
  assert.ok(!/https?:\/\//i.test(indexSource), `${gameId}: legacy runtime must not load external assets.`);
  assert.ok(!/(?:linear|radial)-gradient|neon/i.test(indexSource), `${gameId}: forbidden tour styling found.`);
  assert.ok(!emojiPattern.test(indexSource + gameSource), `${gameId}: emoji found in tour copy.`);
  assert.ok(bridgeSource.includes('var timeline = originalTimeline.slice();'), `${gameId}: native instructions must stay in the timeline.`);
  assert.ok(bridgeSource.includes('window.jsPsych.init({'), `${gameId}: original jsPsych timeline is not started natively.`);
  assert.ok(bridgeSource.indexOf("event.data.type === startType") < bridgeSource.indexOf('startExperiment();'), `${gameId}: experiment can start before the start message.`);
  new Script(bridgeSource, { filename: `${gameId}/rehab-bridge.js` });
  const instruction = { type: 'instructions' };
  const timeline = [instruction, { type: 'task' }];
  let receive;
  let startedTimeline;
  const parent = {};
  const window = {
    parent,
    location: { origin: 'http://localhost' },
    original: timeline,
    instruction_node: instruction,
    addEventListener: (_type, callback) => { receive = callback; },
    jsPsych: { init: options => { startedTimeline = options.timeline; } },
  };
  new Script(bridgeSource).runInNewContext({
    window,
    document: { body: { dataset: { gameId, timeline: 'original' } } },
  });
  assert.equal(startedTimeline, undefined);
  receive({ origin: 'http://untrusted', source: parent, data: { type: 'rehab-expfactory:start' } });
  assert.equal(startedTimeline, undefined);
  receive({ origin: window.location.origin, source: parent, data: { type: 'rehab-expfactory:start' } });
  assert.equal(startedTimeline?.[0], instruction, `${gameId}: native instruction must run first.`);
  assert.equal(startedTimeline?.length, timeline.length);
  for (const [, inlineScript] of indexSource.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new Script(inlineScript, { filename: `${gameId}/index.html` });
  }

  for (const [, relativePath] of indexSource.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:data:|#)/.test(relativePath)) continue;
    assert.ok(existsSync(resolve(legacyRoot, relativePath)), `${gameId}: missing legacy asset ${relativePath}.`);
  }
  assert.ok(existsSync(resolve(legacyRoot, 'LICENSE')), `${gameId}: upstream license is missing.`);
}

const shellSource = readFileSync(resolve(repoRoot, 'packages/ui/src/components/ExpFactoryGame.tsx'), 'utf8');
for (const token of [
  'void beginExperiment()',
  "postToLegacy(legacyStartMessageType)",
  'event.origin !== window.location.origin',
]) {
  assert.ok(shellSource.includes(token), `ExpFactory shell is missing ${token}.`);
}
assert.ok(!shellSource.includes('StartTour(steps'), 'ExpFactory shell must not own a generic Toutour.');

const tourStyles = readFileSync(resolve(repoRoot, 'packages/ui/src/tour/toutour.css'), 'utf8');
assert.ok(!/(?:linear|radial)-gradient|neon/i.test(tourStyles.replace(/\/\*[\s\S]*?\*\//g, '')), 'Toutour styles must stay free of gradients and neon effects.');

console.log(`ExpFactory originals passed for ${Object.keys(sources).length} games.`);

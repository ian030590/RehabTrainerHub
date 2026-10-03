import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = 'apps/rehabtrainerhub/games';
const game = `${root}/connect4`;

test('Connect4 is classified as a browser-native game', async () => {
  const manifest = await readFile(`${root}/moduleFlowManifest.ts`, 'utf8');
  const entry = manifest.split('\n').find(line => line.includes("['brain:connect4'"));
  assert.ok(entry?.includes("'browser-native'"), 'the flow manifest must classify Connect4 as browser-native');

  const flow = await readFile('scripts/check-training-module-flow.mjs', 'utf8');
  assert.equal((flow.match(/ids: \['brain:connect4'\]/g) ?? []).length, 2,
    'Connect4 must have one implementation check and one browser-native lifecycle check');
  const catalog = flow.slice(flow.indexOf('function ReferenceCognitiveCatalogIds()'));
  assert.doesNotMatch(catalog, /'brain:connect4'/, 'Connect4 no longer belongs to the Pixi reference runtime group');
});

test('Connect4 entry and runtime use its native logic without Pixi or jsPsych', async () => {
  const entry = await readFile(`${game}/Connect4Game.ts`, 'utf8');
  assert.match(entry, /runtime\/cognitive\/connect4Logic/);
  assert.doesNotMatch(entry, /languageNeutralGames/);

  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  assert.doesNotMatch(runtime, /(?:from\s*['"](?:pixi\.js|jspsych)['"]|initJsPsych\s*\()/);
  assert.match(runtime, /data-connect-column/);
  assert.match(runtime, /SaveTrainingSessionRecord/);
});

test('Connect4 removes unused Pixi and jsPsych runtime files', () => {
  for (const path of [
    'runtime/cognitive/languageNeutralGames.ts',
    'runtime/cognitive/ThinkingGames.css',
    'runtime/cognitive/utils.ts',
    'runtime/jsPsychLifecycle.ts',
  ]) {
    assert.equal(existsSync(`${game}/${path}`), false, `${path} must not remain in the playable game`);
  }
});

test('training-flow runs the Connect4 behavior and architecture tests in CI', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(packageJson.scripts['test:training-flow'], /scripts\/check-connect4-core\.test\.mjs/);
  assert.match(packageJson.scripts['test:training-flow'], /scripts\/check-connect4-architecture\.test\.mjs/);
});

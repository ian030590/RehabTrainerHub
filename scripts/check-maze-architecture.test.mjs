import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const game = 'apps/rehabtrainerhub/games/maze';

test('Maze is browser-native in the manifest and training flow', async () => {
  const manifest = await readFile('apps/rehabtrainerhub/games/moduleFlowManifest.ts', 'utf8');
  const entry = manifest.split('\n').find(line => line.includes("['brain:maze'"));
  assert.ok(entry?.includes("'browser-native'"));
  const flow = await readFile('scripts/check-training-module-flow.mjs', 'utf8');
  assert.equal((flow.match(/ids: \['brain:maze'\]/g) ?? []).length, 2);
  assert.doesNotMatch(flow, /ReferenceCognitiveCatalogIds/);
});

test('Maze runtime uses native buttons and shared direction pad without Pixi or jsPsych', async () => {
  const entry = await readFile(`${game}/MazeGame.ts`, 'utf8');
  assert.match(entry, /runtime\/cognitive\/mazeLogic/);
  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  assert.doesNotMatch(runtime, /(?:from\s*['"](?:pixi\.js|jspsych)['"]|initJsPsych\s*\()/);
  assert.match(runtime, /data-maze-cell/);
  assert.match(runtime, /MobileDirectionPad/);
  assert.match(runtime, /SaveTrainingSessionRecord/);
  assert.match(runtime, /abortOnFullscreenExit: false/);
});

test('Maze removes unused Pixi and jsPsych runtime files', () => {
  for (const path of [
    'runtime/cognitive/languageNeutralGames.ts', 'runtime/cognitive/ThinkingGames.css',
    'runtime/cognitive/utils.ts', 'runtime/jsPsychLifecycle.ts',
  ]) assert.equal(existsSync(`${game}/${path}`), false, path);
});

test('training-flow runs Maze behavior and architecture tests in CI', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(pkg.scripts['test:training-flow'], /scripts\/check-maze-core\.test\.mjs/);
  assert.match(pkg.scripts['test:training-flow'], /scripts\/check-maze-architecture\.test\.mjs/);
});

test('Maze board keeps 44px touch targets in a horizontal scroller', async () => {
  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  const css = await readFile(`${game}/runtime/cognitive/MazeGame.css`, 'utf8');
  assert.match(runtime, /<button[^>]*data-maze-cell/s);
  assert.match(runtime, /aria-label=/);
  const cell = css.split('.maze-cell {')[1]?.split('}')[0] ?? '';
  assert.ok(Number(cell.match(/min-width:\s*(\d+)px/)?.[1]) >= 44);
  assert.ok(Number(cell.match(/min-height:\s*(\d+)px/)?.[1]) >= 44);
  assert.match(css, /\.maze-board-scroll[\s\S]*overflow-x: auto/);
});

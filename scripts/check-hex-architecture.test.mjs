import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const game = 'apps/rehabtrainerhub/games/hex';

test('Hex is classified as browser-native in the game manifest and flow gate', async () => {
  const manifest = await readFile('apps/rehabtrainerhub/games/moduleFlowManifest.ts', 'utf8');
  const entry = manifest.split('\n').find(line => line.includes("['brain:hex'"));
  assert.ok(entry?.includes("'browser-native'"));
  const flow = await readFile('scripts/check-training-module-flow.mjs', 'utf8');
  assert.equal((flow.match(/ids: \['brain:hex'\]/g) ?? []).length, 2);
  assert.doesNotMatch(flow.slice(flow.indexOf('function ReferenceCognitiveCatalogIds()')), /'brain:hex'/);
});

test('Hex runtime uses native controls without Pixi or jsPsych', async () => {
  const entry = await readFile(`${game}/HexGame.ts`, 'utf8');
  assert.match(entry, /runtime\/cognitive\/hexLogic/);
  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  assert.doesNotMatch(runtime, /(?:from\s*['"](?:pixi\.js|jspsych)['"]|initJsPsych\s*\()/);
  assert.match(runtime, /data-hex-cell/);
  assert.match(runtime, /SaveTrainingSessionRecord/);
  assert.match(runtime, /abortOnFullscreenExit: false/);
});

test('Hex removes unused Pixi and jsPsych runtime files', () => {
  for (const path of [
    'runtime/cognitive/languageNeutralGames.ts', 'runtime/cognitive/ThinkingGames.css',
    'runtime/cognitive/utils.ts', 'runtime/jsPsychLifecycle.ts',
  ]) assert.equal(existsSync(`${game}/${path}`), false, path);
});

test('training-flow executes Hex behavior and architecture tests in CI', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(pkg.scripts['test:training-flow'], /scripts\/check-hex-core\.test\.mjs/);
  assert.match(pkg.scripts['test:training-flow'], /scripts\/check-hex-architecture\.test\.mjs/);
});

test('Hex cells remain touchable, labeled, scrollable, and colored via theme tokens', async () => {
  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  const css = await readFile(`${game}/runtime/cognitive/HexGame.css`, 'utf8');
  assert.match(runtime, /<button[^>]*data-hex-cell/s);
  assert.match(runtime, /aria-label=/);
  assert.match(css, /\.hex-board-scroll[\s\S]*overflow-x: auto/);
  const cell = css.split('.hex-cell {')[1]?.split('}')[0] ?? '';
  assert.ok(Number(cell.match(/min-width:\s*(\d+)px/)?.[1]) >= 44);
  assert.ok(Number(cell.match(/min-height:\s*(\d+)px/)?.[1]) >= 44);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /var\(--error\)/);
});

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = 'apps/rehabtrainerhub/games';
const game = `${root}/dots-and-boxes`;

test('Dots and Boxes is classified as a browser-native game', async () => {
  const manifest = await readFile(`${root}/moduleFlowManifest.ts`, 'utf8');
  const entry = manifest.split('\n').find(line => line.includes("['brain:dots-and-boxes'"));
  assert.ok(entry?.includes("'browser-native'"), 'the flow manifest must classify Dots and Boxes as browser-native');

  const flow = await readFile('scripts/check-training-module-flow.mjs', 'utf8');
  assert.equal((flow.match(/ids: \['brain:dots-and-boxes'\]/g) ?? []).length, 2,
    'Dots and Boxes must have one implementation check and one browser-native lifecycle check');
  assert.doesNotMatch(flow, /ReferenceCognitiveCatalogIds/,
    'the retired Pixi reference runtime group must be removed');
});

test('Dots and Boxes entry and runtime use native logic without Pixi or jsPsych', async () => {
  const entry = await readFile(`${game}/DotsAndBoxesGame.ts`, 'utf8');
  assert.match(entry, /runtime\/cognitive\/dotsAndBoxesLogic/);
  assert.doesNotMatch(entry, /languageNeutralGames/);

  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  assert.doesNotMatch(runtime, /(?:from\s*['"](?:pixi\.js|jspsych)['"]|initJsPsych\s*\()/);
  assert.match(runtime, /data-dots-line/);
  assert.match(runtime, /SaveTrainingSessionRecord/);
});

test('Dots and Boxes removes unused Pixi and jsPsych runtime files', () => {
  for (const path of [
    'runtime/cognitive/languageNeutralGames.ts',
    'runtime/cognitive/ThinkingGames.css',
    'runtime/cognitive/utils.ts',
    'runtime/jsPsychLifecycle.ts',
  ]) {
    assert.equal(existsSync(`${game}/${path}`), false, `${path} must not remain in the playable game`);
  }
});

test('training-flow runs Dots and Boxes behavior and architecture tests in CI', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  assert.match(packageJson.scripts['test:training-flow'], /scripts\/check-dots-and-boxes-core\.test\.mjs/);
  assert.match(packageJson.scripts['test:training-flow'], /scripts\/check-dots-and-boxes-architecture\.test\.mjs/);
});

test('player box claims and occupied-edge errors retain their enabled sound cues', async () => {
  const runtime = await readFile(`${game}/runtime/cognitive/ReferenceCognitiveGame.tsx`, 'utf8');
  const clickHandler = runtime.split('function HandleLineClick(index: number) {')[1]?.split('function CancelGame() {')[0];
  assert.ok(clickHandler, 'the playable edge handler must exist');
  assert.match(runtime, /import\s*\{[^}]*PlaySuccessSound[^}]*PlayFailureSound|import\s*\{[^}]*PlayFailureSound[^}]*PlaySuccessSound/,
    'reuse the existing shared audio controller for both feedback cues');
  assert.match(clickHandler, /playerScore[\s\S]*PlaySuccessSound|PlaySuccessSound[\s\S]*playerScore/,
    'claiming a box must play success feedback');
  assert.match(clickHandler, /errors[\s\S]*PlayFailureSound|PlayFailureSound[\s\S]*errors/,
    'selecting a drawn edge must play failure feedback');
});

test('board edge strokes reach the neighboring dot boundaries', async () => {
  const css = await readFile(`${game}/runtime/cognitive/DotsAndBoxes.css`, 'utf8');
  const declaration = (selector, property) => {
    const block = css.split(selector + ' {')[1]?.split('}')[0] ?? '';
    return Number(block.match(new RegExp(`(?:^|;)\\s*${property}:\\s*(\\d+)px`))?.[1]);
  };
  const cell = declaration('.dots-line', 'width');
  const dot = declaration('.dots-dot span', 'width');
  const gap = declaration('.dots-board', 'gap');
  const horizontal = declaration('.dots-horizontal::before', 'width');
  const vertical = declaration('.dots-vertical::before', 'height');
  assert.ok(cell >= 44 && dot > 0 && gap >= 0,
    'the touch target, visible dot and grid gap must have measurable dimensions');
  const minimumStroke = (cell + gap) * 2 - dot;
  assert.ok(horizontal >= minimumStroke,
    `horizontal edge stroke ${horizontal}px leaves a gap before neighboring ${dot}px dots (${minimumStroke}px required)`);
  assert.ok(vertical >= minimumStroke,
    `vertical edge stroke ${vertical}px leaves a gap before neighboring ${dot}px dots (${minimumStroke}px required)`);
});

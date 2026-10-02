import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = new URL('../apps/rehabtrainerhub/games/whack-a-mole/', import.meta.url);

async function LoadWhackCore() {
  const source = await readFile(new URL('TargetClickGame.ts', gameRoot), 'utf8');
  assert.equal(/from ['"]pixi\.js['"]/.test(source), false, 'The board must work without canvas support');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('difficulty settings produce the stated boards and target deadlines', async () => {
  const { CreateWhackState } = await LoadWhackCore();
  const settings = JSON.parse(await readFile(new URL('settings.json', gameRoot), 'utf8'));
  const choices = settings.sections.flatMap(section => section.fields).find(field => field.key === 'difficulty').options;
  assert.deepEqual(choices.map(choice => choice.value), ['easy', 'medium', 'hard']);
  for (const [difficulty, gridSize, targetMs] of [
    ['Beginner', 3, 1100], ['Intermediate', 3, 850], ['Advanced', 4, 720],
  ]) {
    const state = CreateWhackState(difficulty);
    assert.equal(state.gridSize, gridSize);
    assert.equal(state.targetMs, targetMs);
  }
});

test('a visible target records one hit, ignores empty/repeated taps, and moves to a different cell', async () => {
  const { CreateWhackState, HandleWhackTap, ShowWhackTarget } = await LoadWhackCore();
  const state = CreateWhackState('Intermediate');
  assert.equal(HandleWhackTap(state, 0, 100), null);
  assert.deepEqual([state.hits, state.misses, state.taps, state.trials.length], [0, 0, 0, 0]);

  const random = Math.random;
  Math.random = () => 0;
  try {
    assert.equal(ShowWhackTarget(state, 1000), true);
    assert.equal(state.activeIndex, 0);
    assert.equal(state.targetExpiresAt, 1850);
    assert.equal(ShowWhackTarget(state, 1100), false);
    assert.deepEqual(HandleWhackTap(state, 0, 1200), {
      trial: { trialNumber: 1, outcome: 'hit', reactionTimeMs: 200, targetIndex: 0, tappedIndex: 0 },
      targetCompleted: true,
    });
    assert.equal(HandleWhackTap(state, 0, 1201), null);
    assert.deepEqual([state.hits, state.misses, state.taps, state.trials.length], [1, 0, 1, 1]);
    assert.equal(ShowWhackTarget(state, state.nextTargetAt), true);
    assert.notEqual(state.activeIndex, 0, 'Consecutive targets must not reuse the same cell');
  } finally {
    Math.random = random;
  }
});

test('wrong taps and expired targets each produce one miss with their own trial outcome', async () => {
  const { CreateWhackState, ExpireWhackTarget, HandleWhackTap, ShowWhackTarget } = await LoadWhackCore();
  const state = CreateWhackState('Beginner');
  ShowWhackTarget(state, 2000);
  const targetIndex = state.activeIndex;
  const wrongIndex = (targetIndex + 1) % 9;
  assert.deepEqual(HandleWhackTap(state, wrongIndex, 2250)?.trial, {
    trialNumber: 1, outcome: 'wrong-tap', reactionTimeMs: 250, targetIndex, tappedIndex: wrongIndex,
  });
  assert.equal(ExpireWhackTarget(state, 3100), null);
  ShowWhackTarget(state, state.nextTargetAt);
  const expired = ExpireWhackTarget(state, state.targetExpiresAt);
  assert.deepEqual({ outcome: expired?.outcome, targetIndex: expired?.targetIndex, tappedIndex: expired?.tappedIndex }, {
    outcome: 'expired', targetIndex: expired?.targetIndex, tappedIndex: null,
  });
  assert.equal(ExpireWhackTarget(state, 4000), null);
  assert.deepEqual([state.hits, state.misses, state.taps, state.trials.length], [0, 2, 1, 2]);
});

test('a tap after the target deadline is an expiry even before the timeout callback runs', async () => {
  const { CreateWhackState, ExpireWhackTarget, HandleWhackTap, ShowWhackTarget } = await LoadWhackCore();
  const state = CreateWhackState('Intermediate');
  ShowWhackTarget(state, 1000);
  const targetIndex = state.activeIndex;
  const result = HandleWhackTap(state, targetIndex, state.targetExpiresAt + 1);
  assert.equal(result?.trial.outcome, 'expired');
  assert.deepEqual([state.hits, state.misses, state.trials.length], [0, 1, 1]);
  assert.equal(ExpireWhackTarget(state, 1900), null, 'Delayed timeout must not create a second miss');
});

test('score rows and summary map to score.json with hit latency only for hits', async () => {
  const { BuildWhackResultData, CreateWhackState, ExpireWhackTarget, HandleWhackTap, ShowWhackTarget } = await LoadWhackCore();
  const score = JSON.parse(await readFile(new URL('score.json', gameRoot), 'utf8'));
  const state = CreateWhackState('Intermediate');
  ShowWhackTarget(state, 1000);
  HandleWhackTap(state, state.activeIndex, 1200);
  ShowWhackTarget(state, state.nextTargetAt);
  HandleWhackTap(state, (state.activeIndex + 1) % 9, state.targetStartedAt + 150);
  ShowWhackTarget(state, state.nextTargetAt);
  ExpireWhackTarget(state, state.targetExpiresAt);

  const result = BuildWhackResultData(state, 30, 'Victory');
  const rows = result.detailRows.map(row => Object.fromEntries(score.columns.map(column => [column.key, row[column.sources[0]]])));
  const summary = Object.fromEntries(score.summary.map(field => [field.key, result.details[field.sources[0]]]));
  assert.deepEqual(rows, [
    { trial: 1, outcome: 1, responseMs: 200, targetIndex: rows[0].targetIndex, tappedIndex: rows[0].targetIndex },
    { trial: 2, outcome: 3, responseMs: null, targetIndex: rows[1].targetIndex, tappedIndex: rows[1].tappedIndex },
    { trial: 3, outcome: 2, responseMs: null, targetIndex: rows[2].targetIndex, tappedIndex: null },
  ]);
  assert.deepEqual(summary, { duration: 30, hits: 1, misses: 2, taps: 2, meanMs: 200 });
});

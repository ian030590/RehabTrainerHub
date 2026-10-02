import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const logicPath = 'apps/rehabtrainerhub/games/memory-match/runtime/cognitive/memoryLogic.ts';

async function LoadMemoryLogic() {
  const source = await readFile(logicPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('Memory Match builds the configured pair loads without losing or duplicating cards', async () => {
  const { CreateMemoryState } = await LoadMemoryLogic();
  for (const [difficulty, rows, cols, pairs] of [
    ['Beginner', 3, 4, 6],
    ['Intermediate', 4, 4, 8],
    ['Advanced', 4, 5, 10],
  ]) {
    const state = CreateMemoryState(difficulty, () => 0.3);
    assert.equal(state.kind, 'memory-match');
    assert.deepEqual([state.rows, state.cols, state.pairs, state.cards.length], [rows, cols, pairs, rows * cols]);
    assert.equal(new Set(state.cards.map(card => card.value)).size, pairs);
    assert.ok([...new Set(state.cards.map(card => card.value))].every(value =>
      state.cards.filter(card => card.value === value).length === 2));
    assert.ok(state.cards.every(card => !card.revealed && !card.matched));
  }
});

test('Memory Match counts each pair attempt once, locks a mismatch for 750ms, and keeps matches open', async () => {
  const { CreateMemoryState, HandleMemoryTap, UpdateMemoryTimedState } = await LoadMemoryLogic();
  const state = CreateMemoryState('Beginner', () => 0);
  state.cards[0].value = 'A';
  state.cards[1].value = 'B';
  state.cards[2].value = 'A';
  let finished = null;
  const finish = result => { finished = result; };

  HandleMemoryTap(state, 0, 1, finish);
  HandleMemoryTap(state, 0, 1.1, finish);
  assert.deepEqual(state.flipped, [0], 'a second tap on one card is ignored');
  assert.equal(state.moves, 0);
  HandleMemoryTap(state, 1, 1.2, finish);
  assert.deepEqual([state.moves, state.errors, state.mismatchClearAt], [1, 1, 1.95]);
  HandleMemoryTap(state, 2, 1.3, finish);
  assert.equal(state.cards[2].revealed, false, 'a third card cannot open during mismatch feedback');
  let renders = 0;
  UpdateMemoryTimedState(state, 1.949, () => { renders += 1; });
  assert.equal(state.cards[0].revealed, true);
  UpdateMemoryTimedState(state, 1.95, () => { renders += 1; });
  assert.deepEqual(state.flipped, []);
  assert.equal(state.cards[0].revealed, false);
  assert.equal(renders, 1);

  HandleMemoryTap(state, 0, 2, finish);
  HandleMemoryTap(state, 2, 2.1, finish);
  assert.deepEqual([state.moves, state.errors, state.matchedPairs], [2, 1, 1]);
  assert.ok(state.cards[0].revealed && state.cards[0].matched);
  assert.ok(state.cards[2].revealed && state.cards[2].matched);
  HandleMemoryTap(state, 0, 2.2, finish);
  assert.equal(state.moves, 2, 'a matched card cannot start another attempt');
  assert.equal(finished, null);
});

test('Memory Match ends only when every pair is found', async () => {
  const { CreateMemoryState, HandleMemoryTap, IsMemoryAutoSuccess } = await LoadMemoryLogic();
  const state = CreateMemoryState('Beginner', () => 0);
  for (let pair = 0; pair < 6; pair += 1) {
    state.cards[pair * 2].value = String(pair);
    state.cards[pair * 2 + 1].value = String(pair);
  }
  const endings = [];
  for (let pair = 0; pair < 6; pair += 1) {
    HandleMemoryTap(state, pair * 2, pair, result => endings.push(result));
    HandleMemoryTap(state, pair * 2 + 1, pair + 0.1, result => endings.push(result));
    assert.equal(IsMemoryAutoSuccess(state), pair === 5);
  }
  assert.deepEqual(endings, ['Victory']);
  assert.deepEqual([state.moves, state.matchedPairs, state.errors], [6, 6, 0]);
});

test('Memory Match checks the absolute session deadline and maps every Hub score field', async () => {
  const { CreateMemoryState, GetMemoryTimedOutcome, BuildMemoryResultData } = await LoadMemoryLogic();
  const state = CreateMemoryState('Beginner', () => 0);
  assert.equal(GetMemoryTimedOutcome(state, 1000, 61000, 0), null, 'zero means no limit');
  assert.equal(GetMemoryTimedOutcome(state, 1000, 60999, 60), null);
  assert.equal(GetMemoryTimedOutcome(state, 1000, 61000, 60), 'Defeat');
  state.matchedPairs = state.pairs;
  assert.equal(GetMemoryTimedOutcome(state, 1000, 61000, 60), 'Victory');

  state.moves = 8;
  state.errors = 2;
  assert.deepEqual(BuildMemoryResultData(state, 34.2, 'Victory'), {
    Total_Duration_Seconds: 34.2,
    Moves: 8,
    Completed: true,
    Errors: 2,
    Matched_Pairs: 6,
    Target_Pairs: 6,
  });
  assert.equal(BuildMemoryResultData(state, 60, 'Defeat').Completed, false);
  const score = JSON.parse(await readFile('apps/rehabtrainerhub/games/memory-match/score.json', 'utf8'));
  assert.deepEqual(score.summary.map(column => column.sources[0]), [
    'Total_Duration_Seconds', 'Moves', 'Completed', 'Errors', 'Matched_Pairs', 'Target_Pairs',
  ]);
});

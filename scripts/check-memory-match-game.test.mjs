import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, GameRoot, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'memory-match';
const LoadLogic = () => LoadGameModule(gameId, 'logic/memoryMatch.ts');
const FaceUp = match => match.cards.flatMap((card, index) => card.faceUp ? [index] : []);

test('Memory Match keeps the original boards, letters, time limits and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { timeLimitSec: 30 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { memoryConfig, cardValues, mismatchHoldMs } = await LoadLogic();
  assert.deepEqual(memoryConfig, { easy: { rows: 3, cols: 4, pairs: 6 }, medium: { rows: 4, cols: 4, pairs: 8 }, hard: { rows: 4, cols: 5, pairs: 10 } });
  assert.equal(cardValues.join(''), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  assert.equal(mismatchHoldMs, 750, 'A wrong pair stays face up for 0.75 s, as in the original game.');
});

test('a deck picks random letters and deals each one twice', async () => {
  const { CreateDeck, CreateRandom, memoryConfig } = await LoadLogic();
  assert.deepEqual(CreateDeck(6, () => 0), ['C', 'D', 'E', 'F', 'G', 'B', 'C', 'D', 'E', 'F', 'G', 'B']);
  for (const [difficulty, { pairs }] of Object.entries(memoryConfig)) {
    const deck = CreateDeck(pairs, CreateRandom(7));
    assert.equal(deck.length, pairs * 2, difficulty);
    const counts = Object.values(Object.groupBy(deck, value => value)).map(group => group.length);
    assert.deepEqual([counts.length, new Set(counts).size, counts[0]], [pairs, 1, 2], `${difficulty}: every letter appears exactly twice.`);
  }
});

test('two cards make one move: a pair stays up, a wrong pair waits to turn back', async () => {
  const { PairsMatch } = await LoadLogic();
  const match = new PairsMatch('easy', 1000, () => 0);
  assert.deepEqual([match.rows, match.cols, match.pairs], [3, 4, 6]);
  assert.deepEqual(match.flip(0, 2000), { accepted: true, result: 'first', solved: false });
  assert.deepEqual(match.flip(0, 2100), { accepted: false, result: null, solved: false }, 'A face-up card cannot be picked again.');
  assert.deepEqual(match.flip(6, 2600), { accepted: true, result: 'match', solved: false });
  assert.deepEqual([match.moves, match.matchedPairs, match.errors, match.waiting], [1, 1, 0, false]);
  assert.deepEqual(match.flip(1, 3000), { accepted: true, result: 'first', solved: false });
  assert.deepEqual(match.flip(2, 3500), { accepted: true, result: 'mismatch', solved: false });
  assert.deepEqual([match.moves, match.matchedPairs, match.errors, match.waiting], [2, 1, 1, true]);
  assert.deepEqual(match.flip(3, 3700), { accepted: false, result: null, solved: false }, 'Taps wait while a wrong pair is showing, as in the original game.');
  assert.deepEqual(FaceUp(match), [0, 1, 2, 6]);
  assert.equal(match.hideMismatch(4250), true);
  assert.equal(match.hideMismatch(4300), false, 'Nothing is left to turn back.');
  assert.deepEqual(FaceUp(match), [0, 6]);
  assert.deepEqual(match.flip(0, 4400), { accepted: false, result: null, solved: false }, 'A matched card stays put.');
  assert.deepEqual(match.flip(3, 5000), { accepted: true, result: 'first', solved: false });
  assert.deepEqual(match.flip(9, 5400), { accepted: true, result: 'match', solved: false });
  assert.deepEqual(match.turns, [
    { move: 1, thinkMs: 1600, matched: 1, matchedPairs: 1 },
    { move: 2, thinkMs: 900, matched: 0, matchedPairs: 1 },
    { move: 3, thinkMs: 1150, matched: 1, matchedPairs: 2 },
  ], 'Think time runs from when the board is ready to the second card.');
});

test('the last pair wins the game and the time limit cannot undo it', async () => {
  const { PairsMatch } = await LoadLogic();
  const match = new PairsMatch('easy', 0, () => 0);
  for (let index = 0; index < 5; index++) {
    match.flip(index, index * 1000 + 100);
    assert.equal(match.flip(index + 6, index * 1000 + 600).solved, false);
  }
  assert.deepEqual(match.flip(5, 6000), { accepted: true, result: 'first', solved: false });
  assert.deepEqual(match.flip(11, 6500), { accepted: true, result: 'match', solved: true });
  assert.deepEqual([match.outcome, match.matchedPairs, match.moves, match.errors], ['Victory', 6, 6, 0]);
  assert.equal(match.expire(), null);
  assert.equal(match.cards.every(card => card.matched && card.faceUp), true);
});

test('the time limit ends an unfinished board and stops further flips', async () => {
  const { PairsMatch } = await LoadLogic();
  const match = new PairsMatch('medium', 0, () => 0);
  match.flip(0, 500);
  assert.equal(match.expire(), 'TimeUp');
  assert.deepEqual([match.outcome, match.matchedPairs, match.moves], ['TimeUp', 0, 0]);
  assert.deepEqual(match.flip(1, 600), { accepted: false, result: null, solved: false });
});

test('the summary keeps the original fields and adds the mean think time', async () => {
  const logic = await LoadLogic();
  const match = new logic.PairsMatch('easy', 1000, () => 0);
  match.flip(0, 2000); match.flip(6, 2600);
  match.flip(1, 3000); match.flip(2, 3500); match.hideMismatch(4250);
  assert.deepEqual(logic.SummarizeMemory(match, 3549), { duration: 3.5, completed: 0, moves: 2, errors: 1, matchedPairs: 1, pairs: 6, meanThinkMs: 1250 });
  const untouched = new logic.PairsMatch('hard', 0, () => 0);
  untouched.expire();
  assert.deepEqual(logic.SummarizeMemory(untouched, 60000), { duration: 60, completed: 0, moves: 0, errors: 0, matchedPairs: 0, pairs: 10, meanThinkMs: null });
});

test('Memory Match results save one numeric row per move through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/memoryMatch': logic });
  const match = new logic.PairsMatch('easy', 0, () => 0);
  match.flip(0, 1000); match.flip(6, 1200);
  const score = BuildGameScore(match, 1200);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, thinkMs: 1200, matched: 1, matchedPairs: 1 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', timeLimitSec: 0, soundEnabled: true }, score));
});

test('a found pair and a wrong pair each play their own sound, as in the original game', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'MemoryMatchGame.tsx'), 'utf8');
  assert.match(source, /result === 'match'[^\n]*PlaySuccessSound\(\)/);
  assert.match(source, /result === 'mismatch'[^\n]*PlayFailureSound\(\)/);
  assert.match(source, /mismatchHoldMs/, 'A wrong pair turns back after the original delay.');
});

test('Memory Match owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'MemoryMatchGame', category: 'memory', version: '2.0.0' });
});

test('Memory Match private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

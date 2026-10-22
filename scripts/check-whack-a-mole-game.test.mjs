import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, GameRoot, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'whack-a-mole';
const LoadLogic = () => LoadGameModule(gameId, 'logic/whackAMole.ts');
const Sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

test('Target Click keeps the original boards, mole times, gaps, session lengths and sound setting', async () => {
  const { defaultSettings, durationRange, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', durationSec: 60, soundEnabled: true });
  assert.deepEqual(durationRange, { min: 30, max: 300, step: 15 });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { durationSec: 30 }, { durationSec: 45 }, { durationSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { durationSec: 15 }, { durationSec: 50 }, { durationSec: 315 }, { durationSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { whackConfig, firstTargetMs } = await LoadLogic();
  assert.deepEqual(whackConfig, {
    easy: { gridSize: 3, targetMs: 1100, minDelayMs: 350, maxDelayMs: 900 },
    medium: { gridSize: 3, targetMs: 850, minDelayMs: 250, maxDelayMs: 720 },
    hard: { gridSize: 4, targetMs: 720, minDelayMs: 180, maxDelayMs: 580 },
  });
  assert.equal(firstTargetMs, 600, 'The first mole appears 0.6 s after the start, as in the original game.');
});

test('a mole is a hit, a miss when it ducks, or a miss when another hole is tapped', async () => {
  const { WhackMatch } = await LoadLogic();
  const match = new WhackMatch('easy', Sequence(0.5, 0.1, 0.95, 0));
  assert.deepEqual([match.gridSize, match.targetMs], [3, 1100]);
  assert.deepEqual(match.tap(4, 900), { accepted: false, outcome: null }, 'A tap with no mole up is ignored, as in the original game.');
  assert.equal(match.show(1000), 4);
  assert.equal(match.show(1100), null, 'Only one mole is up at a time.');
  assert.deepEqual(match.tap(2, 1300), { accepted: true, outcome: 'wrong' });
  assert.equal(match.active, null, 'A wrong tap sends the mole down.');
  assert.equal(match.show(2000), 0);
  match.stampOnset(2016);
  assert.deepEqual(match.tap(0, 2366), { accepted: true, outcome: 'hit' });
  assert.equal(match.show(3000), 8);
  assert.equal(match.expire(4100), true);
  assert.equal(match.expire(4200), false, 'A mole that is already down cannot expire again.');
  assert.deepEqual(match.rows, [
    { trial: 1, outcome: 3, responseMs: null, targetIndex: 4, tappedIndex: 2 },
    { trial: 2, outcome: 1, responseMs: 350, targetIndex: 0, tappedIndex: 0 },
    { trial: 3, outcome: 2, responseMs: null, targetIndex: 8, tappedIndex: null },
  ], 'Response time runs from when the mole is drawn.');
  assert.deepEqual([match.hits, match.misses, match.taps, match.expired, match.wrongTaps, match.shown], [1, 2, 2, 1, 1, 3]);
});

test('the gap before the next mole is drawn from the level range', async () => {
  const { WhackMatch } = await LoadLogic();
  assert.equal(new WhackMatch('easy', () => 0).nextDelay(), 350);
  assert.equal(new WhackMatch('medium', () => 0.5).nextDelay(), 485);
  assert.equal(new WhackMatch('hard', () => 0.999999).nextDelay(), 580);
  assert.equal(new WhackMatch('hard', () => 0.99).show(0), 15, 'The hard board has 16 holes.');
});

test('the summary keeps the original fields and adds the best time, ducked moles and wrong taps', async () => {
  const logic = await LoadLogic();
  const match = new logic.WhackMatch('medium', Sequence(0, 0.5, 0.9));
  match.show(0); match.tap(0, 400);
  match.show(1000); match.tap(4, 1300);
  match.show(2000); match.tap(0, 2100);
  match.show(3000); match.expire(3850);
  assert.deepEqual(logic.SummarizeWhack(match, 60049), { duration: 60, hits: 2, misses: 2, taps: 3, meanMs: 350, bestMs: 300, expired: 1, wrongTaps: 1 });
  const untouched = new logic.WhackMatch('hard', () => 0);
  assert.deepEqual(logic.SummarizeWhack(untouched, 30000), { duration: 30, hits: 0, misses: 0, taps: 0, meanMs: null, bestMs: null, expired: 0, wrongTaps: 0 });
});

test('Target Click results save one numeric row per mole through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/whackAMole': logic });
  const match = new logic.WhackMatch('easy', () => 0);
  match.show(0); match.tap(0, 420);
  const score = BuildGameScore(match, 30000);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ trial: 1, outcome: 1, responseMs: 420, targetIndex: 0, tappedIndex: 0 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', durationSec: 30, soundEnabled: true }, score));
});

test('hits and misses each play their own sound, and taps use the pointer-down time', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'WhackAMoleGame.tsx'), 'utf8');
  assert.match(source, /outcome === 'hit'[^\n]*PlaySuccessSound\(\)/);
  assert.match(source, /outcome === 'wrong'[^\n]*PlayFailureSound\(\)/);
  assert.match(source, /onPointerDown=\{event => tapHole\(index, event\.timeStamp\)\}/);
  assert.match(source, /flushSync\(/, 'The onset is stamped once the mole is in the page.');
});

test('Target Click owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'WhackAMoleGame', category: 'attention', version: '2.0.0' });
});

test('Target Click private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

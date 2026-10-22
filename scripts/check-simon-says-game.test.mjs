import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, GameRoot, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'simon-says';
const LoadLogic = () => LoadGameModule(gameId, 'logic/simonSays.ts');
const Sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

test('Simon Says keeps the original target lengths, lives, timing and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', lives: 3, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { lives: 1 }, { lives: 5 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { lives: 2 }, { lives: '3' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { targetLengths, timing } = await LoadLogic();
  assert.deepEqual(targetLengths, { easy: 5, medium: 7, hard: 9 });
  assert.deepEqual(timing, { leadInMs: 350, lightMs: 360, gapMs: 140 }, 'Each pad lights for 0.36 s with 0.14 s gaps, as in the original game.');
});

test('a correct repeat adds one pad and a wrong pad costs a life and replays the same sequence', async () => {
  const { SimonMatch } = await LoadLogic();
  const match = new SimonMatch('easy', 3, Sequence(0, 0.3, 0.6, 0.9));
  assert.deepEqual([match.sequence, match.status, match.lives, match.targetLength], [[0], 'showing', 3, 5]);
  assert.deepEqual(match.tap(0, 500), { accepted: false, result: null, outcome: null }, 'Taps wait while the sequence plays.');
  match.beginInput(1000);
  assert.deepEqual(match.tap(4, 1100), { accepted: false, result: null, outcome: null }, 'Only the four pads count.');
  assert.deepEqual(match.tap(0, 1400), { accepted: true, result: 'sequence', outcome: null });
  assert.deepEqual([match.sequence, match.status], [[0, 1], 'showing']);
  match.beginInput(2000);
  assert.deepEqual(match.tap(0, 2300), { accepted: true, result: 'step', outcome: null });
  assert.deepEqual(match.tap(2, 2700), { accepted: true, result: 'wrong', outcome: null });
  assert.deepEqual([match.sequence, match.status, match.lives], [[0, 1], 'showing', 2], 'The same sequence plays again.');
  match.beginInput(3500);
  match.tap(0, 3800);
  assert.deepEqual(match.tap(1, 4100), { accepted: true, result: 'sequence', outcome: null });
  assert.deepEqual(match.sequence, [0, 1, 2]);
  assert.deepEqual(match.trials, [
    { trial: 1, length: 1, correct: 1, correctTaps: 1, recallMs: 400 },
    { trial: 2, length: 2, correct: 0, correctTaps: 1, recallMs: 700 },
    { trial: 3, length: 2, correct: 1, correctTaps: 2, recallMs: 600 },
  ]);
});

test('the last life ends the game and the target length wins it', async () => {
  const { SimonMatch } = await LoadLogic();
  const lost = new SimonMatch('easy', 1, () => 0);
  lost.beginInput(0);
  assert.deepEqual(lost.tap(3, 200), { accepted: true, result: 'wrong', outcome: 'Defeat' });
  assert.deepEqual([lost.status, lost.lives], ['over', 0]);
  lost.beginInput(300);
  assert.deepEqual(lost.tap(0, 400), { accepted: false, result: null, outcome: 'Defeat' });

  const won = new SimonMatch('easy', 3, () => 0);
  for (let length = 1; length <= 5; length++) {
    won.beginInput(length * 1000);
    for (let step = 1; step < length; step++) assert.equal(won.tap(0, length * 1000 + step * 100).result, 'step');
    const last = won.tap(0, length * 1000 + length * 100);
    assert.deepEqual(last, { accepted: true, result: 'sequence', outcome: length === 5 ? 'Victory' : null });
  }
  assert.deepEqual([won.status, won.sequence.length, won.trials.length], ['over', 5, 5], 'No pad is added after the target length.');
});

test('the summary keeps the original fields and adds the longest correct sequence', async () => {
  const logic = await LoadLogic();
  const match = new logic.SimonMatch('medium', 3, Sequence(0, 0.3));
  match.beginInput(0); match.tap(0, 400);
  match.beginInput(1000); match.tap(0, 1200); match.tap(3, 1500);
  assert.deepEqual(logic.SummarizeSimon(match, 2049), { duration: 2, completed: 0, trials: 2, correctTrials: 1, remainingLives: 2, maxLives: 3, longestCorrect: 1, targetLength: 7 });
  const untouched = new logic.SimonMatch('hard', 5, () => 0);
  assert.deepEqual(logic.SummarizeSimon(untouched, 500), { duration: 0.5, completed: 0, trials: 0, correctTrials: 0, remainingLives: 5, maxLives: 5, longestCorrect: 0, targetLength: 9 });
});

test('Simon Says results save one numeric row per attempt through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/simonSays': logic });
  const match = new logic.SimonMatch('easy', 3, () => 0);
  match.beginInput(0); match.tap(0, 900);
  const score = BuildGameScore(match, 900);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ trial: 1, length: 1, correct: 1, correctTaps: 1, recallMs: 900 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', lives: 3, soundEnabled: true }, score));
});

test('correct and wrong pads each play their own sound, and number keys press the pads', async () => {
  const source = await readFile(resolve(GameRoot(gameId), 'SimonSaysGame.tsx'), 'utf8');
  assert.match(source, /result === 'step'[^\n]*PlaySuccessSound\(\)/);
  assert.match(source, /result === 'wrong'[^\n]*PlayFailureSound\(\)/);
  assert.match(source, /\['1', '2', '3', '4'\]\.indexOf\(event\.key\)/);
});

test('Simon Says owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'SimonSaysGame', category: 'memory', version: '2.0.0' });
});

test('Simon Says private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

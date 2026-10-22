import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'lights-out';
const LoadLogic = () => LoadGameModule(gameId, 'logic/lightsOut.ts');
const On = lights => lights.flatMap((on, index) => on ? [index] : []);
const Sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

test('Lights Out keeps the original boards, scramble lengths, time limits and sound setting', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { difficulty: 'medium', timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { timeLimitSec: 30 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  const { lightsConfig } = await LoadLogic();
  assert.deepEqual(lightsConfig, { easy: { size: 3, shuffles: 8 }, medium: { size: 4, shuffles: 14 }, hard: { size: 5, shuffles: 24 } });
});

test('a press flips the cell and the four cells touching it', async () => {
  const { Toggle } = await LoadLogic();
  const lights = Array(9).fill(false);
  Toggle(lights, 3, 4);
  assert.deepEqual(On(lights), [1, 3, 4, 5, 7]);
  Toggle(lights, 3, 0);
  assert.deepEqual(On(lights), [0, 4, 5, 7], 'A corner flips three cells.');
  Toggle(lights, 3, 4);
  assert.deepEqual(On(lights), [0, 1, 3]);
});

test('a puzzle is the original random presses from an all-dark board, so it can always be solved', async () => {
  const { CreateLightsPuzzle } = await LoadLogic();
  assert.deepEqual(On(CreateLightsPuzzle(3, 1, () => 0)), [0, 1, 3], 'One press at row 1, column 1.');
  assert.deepEqual(On(CreateLightsPuzzle(3, 2, Sequence(0, 0, 0.5, 0.9))), [0, 1, 2, 3, 4, 5, 8], 'Presses at row 1 column 1, then row 2 column 3.');
  assert.deepEqual(On(CreateLightsPuzzle(3, 8, () => 0)), [1, 3, 4, 5, 7], 'Presses that cancel out fall back to the center press.');
});

test('a match records each press and ends when every light is off', async () => {
  const { LightsMatch } = await LoadLogic();
  const match = new LightsMatch('easy', 1000, () => 0);
  assert.deepEqual(On(match.lights), [1, 3, 4, 5, 7]);
  assert.deepEqual(match.press(0, 2500), { accepted: true, lightsOn: 4, solved: false });
  assert.deepEqual(match.press(0, 3100), { accepted: true, lightsOn: 5, solved: false });
  assert.deepEqual(match.press(4, 4000), { accepted: true, lightsOn: 0, solved: true });
  assert.equal(match.outcome, 'Victory');
  assert.deepEqual(match.press(4, 4500), { accepted: false, lightsOn: 0, solved: true }, 'A solved board takes no presses.');
  assert.equal(match.expire(5000), null, 'The time limit cannot undo a solved board.');
  assert.deepEqual(match.rows, [
    { move: 1, row: 1, col: 1, thinkMs: 1500, lightsOn: 4 },
    { move: 2, row: 1, col: 1, thinkMs: 600, lightsOn: 5 },
    { move: 3, row: 2, col: 2, thinkMs: 900, lightsOn: 0 },
  ]);
});

test('the time limit ends an unsolved board and stops further presses', async () => {
  const { LightsMatch } = await LoadLogic();
  const timed = new LightsMatch('medium', 0, () => 0);
  assert.deepEqual(On(timed.lights), [6, 9, 10, 11, 14], 'Fourteen presses at one cell cancel out; the 4 x 4 center press is row 3, column 3.');
  timed.press(0, 500);
  assert.equal(timed.expire(60000), 'TimeUp');
  assert.deepEqual([timed.outcome, timed.lightsLeft], ['TimeUp', 8]);
  assert.deepEqual(timed.press(1, 60100), { accepted: false, lightsOn: 8, solved: false });
});

test('the summary keeps the original fields and adds the lights left and the mean press time', async () => {
  const logic = await LoadLogic();
  const solved = new logic.LightsMatch('easy', 1000, () => 0);
  solved.press(0, 2500);
  solved.press(0, 3100);
  solved.press(4, 4000);
  assert.deepEqual(logic.SummarizeLights(solved, 3049), { duration: 3, completed: 1, moves: 3, boardSize: 3, lightsLeft: 0, meanThinkMs: 1000 });
  const timed = new logic.LightsMatch('medium', 0, () => 0);
  timed.press(0, 500);
  timed.expire(60000);
  assert.deepEqual(logic.SummarizeLights(timed, 60000), { duration: 60, completed: 0, moves: 1, boardSize: 4, lightsLeft: 8, meanThinkMs: 500 });
  const untouched = new logic.LightsMatch('hard', 0, () => 0);
  assert.equal(logic.SummarizeLights(untouched, 1000).meanThinkMs, null);
});

test('Lights Out results save one numeric row per press through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/lightsOut': logic });
  const match = new logic.LightsMatch('easy', 0, () => 0);
  match.press(4, 1200);
  const score = BuildGameScore(match, 1200);
  assert.equal(score.gameId, gameId);
  assert.deepEqual(score.rounds, [{ move: 1, row: 2, col: 2, thinkMs: 1200, lightsOn: 0 }]);
  assert.equal(score.summary.completed, 1);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { difficulty: 'easy', timeLimitSec: 0, soundEnabled: true }, score));
});

test('Lights Out owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'LightsOutGame', category: 'higher-cognition', version: '2.0.0' });
});

test('Lights Out private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

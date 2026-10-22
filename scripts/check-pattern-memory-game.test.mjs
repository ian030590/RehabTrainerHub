import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'pattern-memory';
const LoadLogic = async () => LoadGameModule(gameId, 'logic/patterns.ts');
const Key = item => `${item.cell}:${item.color}:${item.shape}`;

test('pattern memory settings default to 30 adaptive trials and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { trials: 30, studyMs: 1500, startLoad: 3, adaptive: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const change of [{ trials: 20 }, { trials: 60 }, { studyMs: 500 }, { studyMs: 3000 }, { startLoad: 2 }, { startLoad: 6 }, { adaptive: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ trials: 15 }, { trials: 32 }, { studyMs: 400 }, { studyMs: 1600 }, { startLoad: 1 }, { startLoad: 7 }, { adaptive: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('each board holds distinct shapes in distinct cells, and a changed board differs by exactly one feature', async () => {
  const { CreatePatternTrial, CreateRandom } = await LoadLogic();
  const random = CreateRandom(5);
  const kinds = new Set();
  for (let index = 0; index < 400; index++) {
    const load = 2 + index % 7;
    const trial = CreatePatternTrial(load, random);
    kinds.add(trial.change);
    for (const board of [trial.study, trial.test]) {
      assert.equal(board.length, load);
      assert.equal(new Set(board.map(item => item.cell)).size, load, 'One shape per cell.');
      assert.equal(new Set(board.map(item => `${item.color}:${item.shape}`)).size, load, 'No two shapes look alike.');
      assert.ok(board.every(item => item.cell >= 0 && item.cell <= 8 && item.color >= 0 && item.color <= 3 && item.shape >= 0 && item.shape <= 3));
    }
    const before = trial.study.map(Key), after = trial.test.map(Key);
    if (trial.change === 0) { assert.deepEqual(after, before); continue; }
    const changed = trial.test.filter((item, position) => Key(item) !== before[position]);
    assert.equal(changed.length, 1, 'Exactly one shape changes.');
    const [item] = changed, original = trial.study[trial.test.indexOf(item)];
    const differences = ['color', 'shape', 'cell'].filter(feature => item[feature] !== original[feature]);
    assert.deepEqual(differences, [['color', 'shape', 'cell'][trial.change - 1]]);
  }
  assert.deepEqual([...kinds].sort(), [0, 1, 2, 3]);
  const changes = Array.from({ length: 1000 }, () => CreatePatternTrial(4, random).change !== 0).filter(Boolean).length;
  assert.ok(changes > 400 && changes < 600, `About half the boards change: ${changes}`);
});

test('the board size rises after two right answers in a row and drops after a miss, within 2 to 8', async () => {
  const { LoadStaircase } = await LoadLogic();
  const staircase = new LoadStaircase(3, true);
  for (const correct of [true, true, true, true, false, false, true, true]) staircase.record(correct);
  assert.equal(staircase.load, 4);
  assert.equal(staircase.maxLoad, 5);
  const low = new LoadStaircase(2, true);
  low.record(false); low.record(false);
  assert.equal(low.load, 2);
  const high = new LoadStaircase(6, true);
  for (let index = 0; index < 10; index++) high.record(true);
  assert.equal(high.load, 8);
  const fixed = new LoadStaircase(4, false);
  for (const correct of [true, true, false]) fixed.record(correct);
  assert.equal(fixed.load, 4);
});

test('the summary reports hits, false alarms and an estimated number of shapes held', async () => {
  const { ScorePatternTrial, SummarizePattern } = await LoadLogic();
  const trial = (load, change) => ({ load, change, study: [], test: [] });
  const rows = [
    ScorePatternTrial(1, trial(4, 1), true, 900),
    ScorePatternTrial(2, trial(4, 2), true, 1100),
    ScorePatternTrial(3, trial(4, 3), false, 1300),
    ScorePatternTrial(4, trial(4, 0), false, 700),
    ScorePatternTrial(5, trial(4, 0), true, 1000),
    ScorePatternTrial(6, trial(5, 1), true, 1200),
  ];
  assert.deepEqual(rows[2], { trial: 3, load: 4, change: 3, saidChanged: false, correct: false, rtMs: 1300 });
  assert.deepEqual(SummarizePattern(rows), { trials: 6, correct: 4, accuracyPercent: 66.7, hitRatePercent: 75, falseAlarmRatePercent: 50,
    cowanK: 1, maxLoad: 5, finalLoad: 5, meanLoad: 4.2, meanRtMs: 1033 });
  assert.deepEqual(SummarizePattern([]), { trials: 0, correct: 0, accuracyPercent: null, hitRatePercent: null, falseAlarmRatePercent: null,
    cowanK: null, maxLoad: null, finalLoad: null, meanLoad: null, meanRtMs: null });
});

test('pattern memory results save bounded numeric rows through the private channel', async () => {
  const logic = await LoadLogic();
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/patterns': logic });
  const score = BuildGameScore([logic.ScorePatternTrial(1, { load: 3, change: 2, study: [], test: [] }, true, 800)]);
  assert.deepEqual(score.rounds, [{ trial: 1, load: 3, change: 2, saidChanged: 1, correct: 1, rtMs: 800 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { trials: 30, studyMs: 1500, startLoad: 3, adaptive: true }, score));
});

test('pattern memory owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'PatternMemoryGame', category: 'memory' });
});

test('pattern memory private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

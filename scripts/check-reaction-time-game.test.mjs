import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'reaction-time';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/reactionTrials.ts');

test('Reaction time keeps the original settings: wait range, success target, time limit and sound', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts', { './logic/reactionTrials': await LoadTrials() });
  assert.deepEqual(defaultSettings, { difficulty: 'medium', rounds: 10, timeLimitSec: 0, soundEnabled: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 41);
  assert.equal(EstimatedSeconds({ difficulty: 'easy', rounds: 50, timeLimitSec: 0, soundEnabled: false }), 165);
  assert.equal(EstimatedSeconds({ difficulty: 'hard', rounds: 50, timeLimitSec: 60, soundEnabled: true }), 60);
  for (const change of [{ difficulty: 'easy' }, { difficulty: 'hard' }, { rounds: 5 }, { rounds: 50 }, { timeLimitSec: 60 }, { timeLimitSec: 180 }, { timeLimitSec: 300 }, { soundEnabled: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ difficulty: 'expert' }, { rounds: 0 }, { rounds: 7 }, { rounds: 55 }, { rounds: '10' }, { timeLimitSec: 120 }, { timeLimitSec: '60' }, { soundEnabled: 'yes' }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the random wait keeps the original ranges for each setting', async () => {
  const { foreperiods, DrawForeperiod } = await LoadTrials();
  assert.deepEqual(foreperiods, { easy: [1400, 3200], medium: [1800, 4400], hard: [2200, 5200] });
  assert.equal(DrawForeperiod('medium', () => 0), 1800);
  assert.equal(DrawForeperiod('medium', () => 0.5), 3100);
  assert.equal(DrawForeperiod('easy', () => 0.25), 1850);
  const top = DrawForeperiod('hard', () => 0.999999);
  assert.ok(top >= 5199 && top < 5200 && Number.isInteger(top));
});

test('a press starts the wait, a press while waiting is a false start, and a press after the signal is timed', async () => {
  const { CreateSession, Press, ShowGo, Successes } = await LoadTrials();
  let session = CreateSession();
  assert.equal(session.status, 'idle');
  session = Press(session, 1000, 3000).session;
  assert.equal(session.status, 'wait');
  const early = Press(session, 2250, 2000);
  assert.deepEqual(early.row, { trial: 1, falseStart: true, responseMs: null, earlyMs: 1250, waitMs: 3000 });
  assert.equal(early.session.status, 'early');
  assert.equal(ShowGo(early.session, 4000), early.session, 'The signal never shows after a false start.');
  session = Press(early.session, 3000, 2000).session;
  assert.equal(session.status, 'wait');
  assert.equal(Press(session, 3000, 2000).row?.falseStart, true, 'Pressing right away is still early.');
  session = ShowGo(session, 5000.4);
  assert.equal(session.status, 'go');
  const timed = Press(session, 5312.6, 1900);
  assert.deepEqual(timed.row, { trial: 2, falseStart: false, responseMs: 312, earlyMs: null, waitMs: 2000 });
  assert.equal(timed.session.status, 'result');
  assert.equal(timed.session.lastMs, 312);
  assert.equal(Successes(timed.session), 1);
  assert.equal(timed.session.rows.length, 2);
  assert.equal(CreateSession().rows.length, 0, 'Sessions never share rows.');
  const next = Press(timed.session, 6000, 1900);
  assert.equal(next.session.status, 'wait');
  assert.equal(next.row, null);
});

test('the summary keeps the original fields and adds the median, the fastest response and the spread', async () => {
  const { SummarizeReaction } = await LoadGameModule(gameId, 'logic/reactionScore.ts');
  const success = (trial, responseMs) => ({ trial, falseStart: false, responseMs, earlyMs: null, waitMs: 2000 });
  const rows = [success(1, 300), { trial: 2, falseStart: true, responseMs: null, earlyMs: 900, waitMs: 3000 }, success(3, 250), success(4, 400), success(5, 290)];
  assert.deepEqual(SummarizeReaction(rows, 42.37), { duration: 42.4, attempts: 5, successes: 4, falseStarts: 1, meanMs: 310, medianMs: 295, bestMs: 250, sdMs: 64 });
  assert.deepEqual(SummarizeReaction([], 3), { duration: 3, attempts: 0, successes: 0, falseStarts: 0, meanMs: null, medianMs: null, bestMs: null, sdMs: null });
  assert.deepEqual(SummarizeReaction([success(1, 280)], 5), { duration: 5, attempts: 1, successes: 1, falseStarts: 0, meanMs: 280, medianMs: 280, bestMs: 280, sdMs: null });
});

test('reaction rows keep the original columns, add the planned wait and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/reactionScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/reactionScore': scoreModule });
  const settings = { difficulty: 'medium', rounds: 10, timeLimitSec: 0, soundEnabled: true };
  const score = BuildGameScore([
    { trial: 1, falseStart: true, responseMs: null, earlyMs: 640, waitMs: 2500 },
    { trial: 2, falseStart: false, responseMs: 287, earlyMs: null, waitMs: 3100 }], 12.5);
  assert.deepEqual(score.rounds, [
    { trial: 1, falseStart: 1, responseMs: null, earlyMs: 640, waitMs: 2500 },
    { trial: 2, falseStart: 0, responseMs: 287, earlyMs: null, waitMs: 3100 }]);
  assert.equal(score.gameId, gameId);
  assert.equal(score.summary.duration, 12.5);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Reaction time owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'ReactionSignal', category: 'attention', version: '2.0.1' });
});

test('Reaction time private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

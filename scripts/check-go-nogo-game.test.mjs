import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'go-nogo';
const LoadTrials = async () => LoadGameModule(gameId, 'logic/goNoGoTrials.ts');

test('Go/No-go keeps the original exposure and length, and practice can be turned off', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { exposureMs: 750, rounds: 350, practice: true });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 467);
  assert.equal(EstimatedSeconds({ exposureMs: 250, rounds: 50, practice: false }), 39);
  for (const change of [{ exposureMs: 250 }, { exposureMs: 1000 }, { rounds: 50 }, { rounds: 200 }, { practice: false }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ exposureMs: 200 }, { exposureMs: 775 }, { exposureMs: 1050 }, { rounds: 40 }, { rounds: 75 }, { rounds: 400 },
    { rounds: '350' }, { practice: 'no' }, { exposureMs: Infinity }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('each block of ten holds exactly one hold-back square; practice shows five of each', async () => {
  const { CreateGoNoGoTrials, CreateRandom, PickGoColor } = await LoadTrials();
  for (const seed of [1, 6, 50]) {
    const trials = CreateGoNoGoTrials(350, CreateRandom(seed));
    assert.equal(trials.length, 350);
    assert.deepEqual(CreateGoNoGoTrials(350, CreateRandom(seed)), trials, 'The same seed repeats the sequence.');
    for (let block = 0; block < 35; block++) assert.equal(trials.slice(block * 10, block * 10 + 10).filter(trial => trial.noGo).length, 1);
    const practice = CreateGoNoGoTrials(10, CreateRandom(seed), true);
    assert.equal(practice.filter(trial => trial.noGo).length, 5);
    assert.ok(practice.every(trial => trial.practice));
  }
  const colors = new Set(Array.from({ length: 40 }, (_, seed) => PickGoColor(CreateRandom(seed))));
  assert.deepEqual([...colors].sort(), ['blue', 'orange'], 'Either color can be the press color.');
});

test('practice ends on a press with feedback; counted squares run on a fixed clock without feedback', async () => {
  const { CreateGoNoGoSteps, CreateRandom } = await LoadTrials();
  const steps = CreateGoNoGoSteps({ exposureMs: 600, rounds: 50, practice: true }, CreateRandom(8));
  assert.equal(steps.length, 60);
  for (const [index, step] of steps.entries()) {
    const practice = index < 10;
    assert.equal(step.trial.practice, practice);
    const { windowMs, ...timing } = step.timing;
    assert.ok(windowMs >= 850 && windowMs < 1350 && Number.isInteger(windowMs), `window ${windowMs}`);
    assert.deepEqual(timing, practice ? { lead: [], exposureMs: 600, endOnResponse: true, feedbackMs: 1000, gapMs: 250 }
      : { lead: index === 10 ? [{ state: 'break', ms: 3000 }] : [], exposureMs: 600, endOnResponse: false, feedbackMs: 0, gapMs: 0 });
  }
  assert.equal(CreateGoNoGoSteps({ exposureMs: 750, rounds: 100, practice: false }, CreateRandom(8)).length, 100);
});

test('a counted square keeps its full window after a press, and the square hides at the exposure time', async () => {
  const { TrialRun } = await LoadGameModule(gameId, 'logic/trialRun.ts');
  const clock = FakeClock();
  const events = [];
  let finished = null;
  const timing = { lead: [], exposureMs: 750, windowMs: 1200, endOnResponse: false, feedbackMs: 0, gapMs: 0 };
  const run = new TrialRun(2, () => ({ trial: 'go', timing }), {
    lead() {}, show: (_step, index) => events.push(['show', index, clock.now()]), hide: () => events.push(['hide', clock.now()]), signal() {},
    end: (outcome, feedback) => events.push(['end', outcome.response, outcome.rtMs, feedback, clock.now()]), clear: () => events.push(['clear', clock.now()]),
  }, clock, outcomes => { finished = outcomes; }, 1000);
  run.start();
  clock.advance(1000 + 300);
  assert.equal(run.respond('press'), true);
  assert.equal(run.respond('press'), false);
  clock.advance(900 + 1000);
  assert.equal(run.respond('press'), true, 'A press after the square hides still counts inside the window.');
  clock.advance(500);
  assert.deepEqual(events, [['show', 0, 1000], ['hide', 1750], ['end', 'press', 300, false, 2200], ['clear', 2200], ['show', 1, 2200], ['hide', 2950],
    ['end', 'press', 1000, false, 3400], ['clear', 3400]]);
  assert.equal(finished.length, 2);
  assert.equal(clock.pending(), 0);
});

test('the summary counts only counted squares and separates missed presses from wrong presses', async () => {
  const { SummarizeGoNoGo } = await LoadGameModule(gameId, 'logic/goNoGoScore.ts');
  const row = (noGo, responded, rtMs, practice = false) => ({ trial: 0, practice, noGo, color: 0, responded, rtMs });
  const rows = [row(true, true, 200, true), row(false, true, 400), row(false, true, 500), row(false, false, null), row(false, true, 600),
    row(true, true, 300), row(true, false, null)];
  assert.deepEqual(SummarizeGoNoGo(rows), { trials: 6, scored: 6, correct: 4, accuracy: 66.7, meanResponseMs: 450, goTrials: 4, noGoTrials: 2,
    omissionErrors: 1, commissionErrors: 1, meanGoRtMs: 500, goRtSdMs: 100 });
  assert.deepEqual(SummarizeGoNoGo([]), { trials: 0, scored: 0, correct: 0, accuracy: null, meanResponseMs: null, goTrials: 0, noGoTrials: 0,
    omissionErrors: 0, commissionErrors: 0, meanGoRtMs: null, goRtSdMs: null });
});

test('Go/No-go rows keep the original columns, include practice items and save through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/goNoGoScore.ts');
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/goNoGoScore': scoreModule });
  const settings = { exposureMs: 750, rounds: 50, practice: true };
  const score = BuildGameScore([{ trial: 1, practice: true, noGo: true, color: 1, responded: true, rtMs: 320 },
    { trial: 2, practice: false, noGo: false, color: 0, responded: false, rtMs: null }], settings);
  assert.deepEqual(score.rounds, [
    { trial: 1, practice: 1, noGo: 1, color: 1, responded: 1, correct: 0, responseMs: 320, omission: 0, commission: 1, setting: 750 },
    { trial: 2, practice: 0, noGo: 0, color: 0, responded: 0, correct: 0, responseMs: null, omission: 1, commission: 0, setting: 750 }]);
  assert.equal(score.gameId, gameId);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, settings, score));
});

test('Go/No-go owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'GoNoGoGame', category: 'attention', version: '2.0.0' });
});

test('Go/No-go private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

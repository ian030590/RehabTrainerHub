import assert from 'node:assert/strict';
import test from 'node:test';
import { AcceptsResult, CheckGameBridge, CheckGamePackaging, FakeClock, LoadGameModule } from './brain-r2-game-checks.mjs';

const gameId = 'continuous-performance';

test('CPT settings default to the single-letter version and reject values outside each range', async () => {
  const { defaultSettings, ValidateSettings, EstimatedSeconds } = await LoadGameModule(gameId, 'settings.ts');
  assert.deepEqual(defaultSettings, { variant: 'x', trials: 150, targetPercent: 20, letterMs: 200, isiMs: 1000 });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(EstimatedSeconds(defaultSettings), 180);
  for (const change of [{ variant: 'ax' }, { trials: 100 }, { trials: 400 }, { targetPercent: 10 }, { targetPercent: 30 }, { letterMs: 100 }, { letterMs: 500 }, { isiMs: 800 }, { isiMs: 2000 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), true, JSON.stringify(change));
  }
  for (const change of [{ variant: 'ab' }, { trials: 50 }, { trials: 175 }, { trials: 450 }, { targetPercent: 5 }, { targetPercent: 12 }, { targetPercent: 35 },
    { letterMs: 50 }, { letterMs: 120 }, { isiMs: 700 }, { isiMs: 1050 }, { isiMs: 2100 }, { trials: '150' }, { letterMs: NaN }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
});

test('the X version shows the planned share of X letters and never two X in a row', async () => {
  const { CreateCptTrials, CreateRandom, trialKinds } = await LoadGameModule(gameId, 'logic/cptTrials.ts');
  for (const seed of [1, 5, 42]) {
    const trials = CreateCptTrials({ variant: 'x', trials: 150, targetPercent: 20 }, CreateRandom(seed));
    assert.equal(trials.length, 150);
    assert.deepEqual(CreateCptTrials({ variant: 'x', trials: 150, targetPercent: 20 }, CreateRandom(seed)), trials, 'The same seed repeats the stream.');
    assert.equal(trials.filter(trial => trial.letter === 'X').length, 30);
    assert.ok(trials.every(trial => (trial.kind === trialKinds.target) === (trial.letter === 'X')));
    assert.ok(trials.every(trial => /^[A-Z]$/.test(trial.letter) && !'IOQ'.includes(trial.letter)), 'Letters easily mistaken for others are left out.');
    for (let index = 1; index < trials.length; index++) {
      assert.ok(!(trials[index].letter === 'X' && trials[index - 1].letter === 'X'), 'Targets stay separated.');
      assert.notEqual(trials[index].letter, trials[index - 1].letter, 'No letter repeats back to back.');
    }
  }
});

test('the A-then-X version marks only an X that follows an A as a target and includes both kinds of near-miss', async () => {
  const { CreateCptTrials, CreateRandom, trialKinds } = await LoadGameModule(gameId, 'logic/cptTrials.ts');
  for (const seed of [2, 9]) {
    const trials = CreateCptTrials({ variant: 'ax', trials: 200, targetPercent: 15 }, CreateRandom(seed));
    assert.equal(trials.length, 200);
    for (const [index, trial] of trials.entries()) {
      const afterA = trials[index - 1]?.letter === 'A';
      assert.equal(trial.kind === trialKinds.target, trial.letter === 'X' && afterA, `trial ${index}`);
      if (trial.letter === 'A') assert.equal(trial.kind, trialKinds.cue);
      if (trial.letter === 'X' && !afterA) assert.equal(trial.kind, trialKinds.bx);
      if (afterA && trial.letter !== 'X') assert.equal(trial.kind, trialKinds.ay);
      if (index && trial.letter !== 'X' && trial.letter !== 'A' && !afterA) assert.equal(trial.kind, trialKinds.filler);
    }
    assert.equal(trials.filter(trial => trial.kind === trialKinds.target).length, 30);
    assert.equal(trials.filter(trial => trial.kind === trialKinds.ay).length, 10);
    assert.equal(trials.filter(trial => trial.kind === trialKinds.bx).length, 10);
  }
});

test('the run shows each letter for its display time and keeps the first press inside each letter window', async () => {
  const { CptRun } = await LoadGameModule(gameId, 'logic/cptRun.ts', { './cptTrials': await LoadGameModule(gameId, 'logic/cptTrials.ts') });
  const clock = FakeClock();
  const events = [];
  let finished = null;
  const trials = [{ letter: 'B', kind: 0 }, { letter: 'X', kind: 1 }, { letter: 'C', kind: 0 }];
  const run = new CptRun(trials, { letterMs: 200, isiMs: 1000, leadInMs: 1000 },
    { show: (trial, index) => events.push(['show', trial.letter, index, clock.now()]), blank: () => events.push(['blank', clock.now()]) },
    clock, rows => { finished = rows; });
  run.start();
  run.respond();
  clock.advance(1000);
  clock.advance(150);
  clock.advance(1050 + 300);
  run.respond();
  run.respond();
  clock.advance(1200 - 300 + 900);
  run.respond();
  assert.equal(finished, null);
  clock.advance(300);
  assert.deepEqual(events, [['show', 'B', 0, 1000], ['blank', 1200], ['show', 'X', 1, 2200], ['blank', 2400], ['show', 'C', 2, 3400], ['blank', 3600]]);
  assert.deepEqual(finished, [
    { trial: 1, letterCode: 66, kind: 0, target: false, responded: false, rtMs: null },
    { trial: 2, letterCode: 88, kind: 1, target: true, responded: true, rtMs: 300 },
    { trial: 3, letterCode: 67, kind: 0, target: false, responded: true, rtMs: 900 },
  ]);
  assert.equal(clock.pending(), 0);
});

test('stopping the run cancels every timer and ignores later presses', async () => {
  const { CptRun } = await LoadGameModule(gameId, 'logic/cptRun.ts', { './cptTrials': await LoadGameModule(gameId, 'logic/cptTrials.ts') });
  const clock = FakeClock();
  let finished = false;
  const run = new CptRun([{ letter: 'X', kind: 1 }, { letter: 'B', kind: 0 }], { letterMs: 200, isiMs: 1000, leadInMs: 1000 },
    { show() {}, blank() {} }, clock, () => { finished = true; });
  run.start();
  clock.advance(1100);
  run.stop();
  run.respond();
  clock.advance(10000);
  assert.equal(finished, false);
  assert.equal(clock.pending(), 0);
});

test('the summary separates hits, misses and false presses and reports sensitivity', async () => {
  const { SummarizeCpt } = await LoadGameModule(gameId, 'logic/cptScore.ts', { './cptTrials': await LoadGameModule(gameId, 'logic/cptTrials.ts') });
  const row = (kind, responded, rtMs = null) => ({ trial: 0, letterCode: 66, kind, target: kind === 1, responded, rtMs });
  const rows = [row(1, true, 400), row(1, true, 500), row(1, true, 600), row(1, false),
    row(0, true, 300), row(0, false), row(0, false), row(0, false), row(0, false), row(0, false), row(3, true, 350), row(4, false)];
  const summary = SummarizeCpt(rows);
  assert.deepEqual({ ...summary, dPrime: undefined }, { trials: 12, targets: 4, hits: 3, omissions: 1, commissions: 2,
    hitPercent: 75, falseAlarmPercent: 25, dPrime: undefined, meanHitRtMs: 500, hitRtSdMs: 100, nearMissPresses: 1, accuracyPercent: 75 });
  // Log-linear corrected rates: hits (3 + .5) / 5 and false presses (2 + .5) / 9.
  assert.ok(Math.abs(summary.dPrime - 1.11) < .01, String(summary.dPrime));
  assert.deepEqual(SummarizeCpt([]), { trials: 0, targets: 0, hits: 0, omissions: 0, commissions: 0, hitPercent: null, falseAlarmPercent: null,
    dPrime: null, meanHitRtMs: null, hitRtSdMs: null, nearMissPresses: 0, accuracyPercent: null });
});

test('CPT results save bounded numeric rows through the private channel', async () => {
  const scoreModule = await LoadGameModule(gameId, 'logic/cptScore.ts', { './cptTrials': await LoadGameModule(gameId, 'logic/cptTrials.ts') });
  const { BuildGameScore } = await LoadGameModule(gameId, 'score.ts', { './logic/cptScore': scoreModule });
  const rows = [{ trial: 1, letterCode: 88, kind: 1, target: true, responded: true, rtMs: 420 },
    { trial: 2, letterCode: 66, kind: 0, target: false, responded: true, rtMs: 380 }];
  const score = BuildGameScore(rows);
  assert.deepEqual(score.rounds, [{ trial: 1, letterCode: 88, kind: 1, target: 1, responded: 1, correct: 1, rtMs: 420 },
    { trial: 2, letterCode: 66, kind: 0, target: 0, responded: 1, correct: 0, rtMs: 380 }]);
  assert.ok(Object.keys(score.summary).length <= 12);
  assert.ok(AcceptsResult(gameId, { variant: 'x', trials: 150, targetPercent: 20, letterMs: 200, isiMs: 1000 }, score));
});

test('CPT owns its runtime, catalogue entry and results without Hub dependencies', async () => {
  await CheckGamePackaging(gameId, { component: 'ContinuousPerformanceGame', category: 'attention', version: '1.0.1' });
});

test('CPT private bridge accepts only its own parent and replays settings and language', async () => {
  await CheckGameBridge(gameId);
});

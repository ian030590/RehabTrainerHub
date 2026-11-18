import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

// Match Vite and TypeScript's .js-to-.ts resolution for the source modules.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.startsWith('./') && specifier.endsWith('.js')
      ? specifier.slice(0, -3) + '.ts' : specifier, context);
  },
});
const { options, defaults, RestoreSettings } = await import('./settings.ts');
const { ModelFor, NeedD, Simulate, Severity, budgets } = await import('./src/physics.ts');
const { RandomFrom, ScenarioFor, MakeRound, Judge, LaneAt } = await import('./src/round.ts');
const { BuildGameScore } = await import('./score.ts');
const { BuildResult } = await import('./src/score.ts');
hooks.deregister();

test('every setting combination and round is solvable at 0.55 s', () => {
  for (const speedKmh of options.speedKmh)
    for (const ownType of options.ownType)
      for (const leadType of options.leadType)
        for (const road of options.road) {
          const model = ModelFor({ ...defaults, speedKmh, ownType, leadType, road });
          for (const [index, budget] of budgets.entries()) {
            const boundary = NeedD(model, budget);
            assert.equal(Simulate(model, boundary + .01, budget).contact, false);
            if (boundary > .01) assert.equal(Simulate(model, boundary - .01, budget).contact, true);
            for (const scenario of options.scenario)
              for (const traffic of options.traffic) {
                const settings = { ...defaults, speedKmh, ownType, leadType, road, scenario, traffic };
                const round = MakeRound(settings, ScenarioFor(scenario, index, 'plain', RandomFrom(14)), index, RandomFrom(15));
                assert.equal(round.gap, Math.ceil(boundary) + 2);
                assert.ok(round.gap <= 120);
                assert.equal(Simulate(model, round.gap, .75).contact, false);
              }
          }
        }
});

test('contact boundaries use the unrounded relative speed', () => {
  assert.deepEqual([11.99, 12, 29.99, 30].map(Severity), ['light', 'moderate', 'moderate', 'severe']);
});

test('decoys, anticipation, valid reaction and timeout use one time axis', () => {
  assert.deepEqual(Judge(4500, 4000), { kind: 'falseStart' });
  assert.deepEqual(Judge(4500, 4599), { kind: 'falseStart' });
  assert.deepEqual(Judge(4500, 4600), { kind: 'response', r: .1 });
  assert.deepEqual(Judge(4500, 6999), { kind: 'response', r: 2.499 });
  assert.deepEqual(Judge(4500, 7000), { kind: 'timeout', r: 2.5 });
});

test('signals are linked to actual lane changes and the correct target brakes', () => {
  for (const scenario of ['swerve-away', 'out-and-back']) {
    const round = MakeRound(defaults, scenario, 2, RandomFrom(37));
    assert.equal(round.moves.length, scenario === 'swerve-away' ? 1 : 2);
    for (const move of round.moves) {
      assert.equal(move.start - move.signal, 800);
      assert.equal(move.end - move.start, 1200);
      assert.equal(LaneAt(round.moves, move.signal), move.from);
      assert.notEqual(LaneAt(round.moves, move.start + 600), move.from);
      assert.equal(LaneAt(round.moves, move.end), move.to);
    }
    assert.equal(round.target, scenario === 'swerve-away' ? 'far' : 'lead');
    const last = round.moves.at(-1);
    assert.ok(round.onset >= last.end);
    if (scenario === 'out-and-back') assert.equal(round.onset, last.end);
    else assert.ok(round.leadGap >= 8);
  }
});

test('seed reproduces rounds; busy decoys stay adjacent and pre-cue input is invalid', () => {
  const generate = () => MakeRound({ ...defaults, traffic: 'busy' }, 'swerve-away', 5, RandomFrom(88));
  const round = generate();
  assert.deepEqual(round, generate());
  for (const lane of [-1, 1]) {
    const traffic = round.decoys.filter(car => car.lane === lane);
    assert.ok(traffic.length >= 2 && traffic.length <= 4);
    for (const car of traffic) {
      assert.ok(car.brakes.length >= 1 && car.brakes.length <= 2);
      for (const [start, end] of car.brakes) {
        assert.ok(end - start >= 400 && end - start <= 800);
        if (start < round.onset) assert.equal(Judge(round.onset, start).kind, 'falseStart');
      }
    }
  }
  const rng = RandomFrom(7);
  let previous = 'plain';
  for (let index = 0; index < 6; index++) {
    const scenario = ScenarioFor('mixed', index, previous, rng);
    if (index < 2) assert.equal(scenario, 'plain');
    else if (index < 5) assert.notEqual(scenario, previous);
    else assert.ok(['plain', 'swerve-away'].includes(scenario));
    previous = scenario;
  }
});

test('score encodes scenarios and counts with finite numeric round data', () => {
  const rows = [.2, .4, .6, .8, 2.5, 1].map((r, index) => ({
    scenario: index === 1 ? 'out-and-back' : 'plain', r, gap: 40, falseStarts: index === 0 ? 2 : 0,
    timedOut: index === 4, answered: index === 5 ? 1 : 0,
    outcome: Simulate(ModelFor(defaults), 40, r + .2),
  }));
  const result = BuildResult(defaults, rows);
  assert.deepEqual(BuildGameScore(defaults, rows), result);
  assert.throws(() => BuildGameScore(defaults, rows.slice(0, 5)), RangeError);
  for (const r of [0.099, 2.501, NaN]) {
    assert.throws(() => BuildGameScore(defaults, [{ ...rows[0], r }, ...rows.slice(1)]), RangeError);
  }
  assert.equal(result.score.schema, 'rehab-trainer.game-score/v1');
  assert.equal(result.score.gameId, 'brake-reaction');
  assert.equal(result.score.summary.avg, .9);
  assert.equal(result.score.summary.best, .2);
  assert.equal(result.score.summary.falseStarts, 2);
  assert.equal(result.score.summary.lateCount, 1);
  assert.equal(result.score.summary.distractionAnswered, 1);
  assert.deepEqual(result.config, defaults);
  assert.equal(result.score.rounds[1].scenario, 2);
  assert.equal(result.score.rounds.length, 6);
  for (const row of [result.score.summary, ...result.score.rounds]) {
    assert.ok(Object.keys(row).length <= 12);
    assert.ok(Object.values(row).every(value => value === null || Number.isFinite(value)));
  }
  assert.deepEqual(RestoreSettings({ speedKmh: 110, traffic: 'invalid', extra: true }), { ...defaults, speedKmh: 110 });
});

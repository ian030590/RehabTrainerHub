import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { AcceptGameMessage, IsGameResult, IsGameSettings } from '../packages/ui/src/selfContainedGame.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/seagull-flight');
const nonce = 'a'.repeat(64);
const capabilities = ['audio', 'fullscreen', 'head-tracking', 'keyboard', 'pointer', 'settings-storage', 'touch'];

async function Load(path, dependencies = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(await readFile(resolve(gameRoot, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

// Pulls one `const name = useCallback(...)` body out of the component so its ordering can be checked alone.
async function LoadFunction(path, name, context) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let functionSource;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      const value = node.initializer;
      functionSource = `const ${name} = ${ts.isCallExpression(value) ? value.arguments[0].getText(tree) : value.getText(tree)};`;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(functionSource, `${path} provides ${name}`);
  const code = ts.transpileModule(functionSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return runInNewContext(`${code}\n${name}`, context);
}

// A small seeded generator, so ring draws repeat exactly between runs.
function Seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function LoadFlight() {
  const settings = await Load('settings.ts');
  const logic = await Load('logic/flight.ts');
  return { settings, logic, config: settings.ToPlayConfig(settings.defaultSettings) };
}
const Input = patch => ({ dt: 0.05, tracking: true, targetX: null, keyboardDirection: 0, flap: false, head: null, ...patch });
function Run(logic, session, config, seconds, patch = {}) {
  const events = [];
  for (let time = 0; time < seconds - 1e-9; time += 0.05) events.push(logic.StepFlight(session, Input(patch), config));
  return events;
}
function SkipCountdown(logic, session, config) { Run(logic, session, config, session.countdown); }

test('settings: head or keyboard control, session length, turn reach, nod size, glide time and ring spacing', async () => {
  const { defaultSettings, rangeSettings, inputModes, ValidateSettings, ToPlayConfig } = await Load('settings.ts');
  assert.deepEqual(Object.keys(defaultSettings), ['inputMode', 'durationSec', 'turnRangeDeg', 'nodRangeDeg', 'glideSec', 'ringIntervalSec']);
  assert.deepEqual([...inputModes], ['head', 'keyboard']);
  assert.deepEqual(rangeSettings.map(({ key, min, max, step }) => [key, min, max, step]), [
    ['durationSec', 60, 600, 30], ['turnRangeDeg', 10, 45, 5], ['nodRangeDeg', 5, 25, 1], ['glideSec', 4, 20, 1], ['ringIntervalSec', 3, 8, 0.5],
  ]);
  assert.deepEqual({ ...defaultSettings }, { inputMode: 'head', durationSec: 180, turnRangeDeg: 20, nodRangeDeg: 10, glideSec: 10, ringIntervalSec: 4.5 });
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(IsGameSettings(defaultSettings), true, 'The container may store the full settings.');
  assert.ok(Object.keys(defaultSettings).every(key => !/phone|name|user|token|auth/i.test(key)), 'Saved keys avoid words the record checks treat as personal.');
  for (const range of rangeSettings) {
    const steps = Math.round((range.max - range.min) / range.step);
    for (let index = 0; index <= steps; index++) {
      const value = Number((range.min + index * range.step).toFixed(1));
      assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: value }), true, `${range.key} ${value}`);
    }
    for (const value of [range.min - range.step, range.max + range.step, range.min + range.step / 2, NaN, Infinity, String(range.min)]) {
      assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: value }), false, `${range.key} ${value}`);
    }
  }
  assert.equal(ValidateSettings({ ...defaultSettings, inputMode: 'keyboard' }), true);
  for (const inputMode of ['camera', '', 1, null]) assert.equal(ValidateSettings({ ...defaultSettings, inputMode }), false, String(inputMode));
  assert.deepEqual({ ...ToPlayConfig(defaultSettings) }, { headControl: true, durationSec: 180, turnRangeDeg: 20, nodRangeDeg: 10, glideSec: 10, ringIntervalSec: 4.5 });
  assert.equal(ToPlayConfig({ ...defaultSettings, inputMode: 'keyboard' }).headControl, false);
});

test('ring reach follows a normal curve cut to the set turn range: middle reaches are common, the nearest and farthest rare', async () => {
  const { logic } = await LoadFlight();
  const { minReach, maxReach } = logic.flight;
  assert.deepEqual([minReach, maxReach], [0.3, 1]);
  const random = Seeded(7);
  const bins = new Array(10).fill(0);
  let sum = 0;
  const draws = 20000;
  for (let index = 0; index < draws; index++) {
    const reach = logic.SampleRingReach(random);
    assert.ok(reach >= minReach && reach <= maxReach, `reach ${reach} stays inside the turn range`);
    sum += reach;
    bins[Math.min(9, Math.floor((reach - minReach) / (maxReach - minReach) * 10))]++;
  }
  assert.ok(Math.abs(sum / draws - (minReach + maxReach) / 2) < 0.01, 'The curve is centred on the middle of the range.');
  const middle = Math.min(bins[4], bins[5]);
  assert.ok(bins.every((count, index) => index === 4 || index === 5 || count < middle), `middle bins are the most common: ${bins}`);
  assert.ok(bins[0] < bins[2] && bins[2] < bins[4] && bins[9] < bins[7] && bins[7] < bins[5], `counts fall away from the middle: ${bins}`);
  assert.ok(Math.max(bins[0], bins[9]) < Math.min(...bins.slice(1, 9)), `the nearest and farthest tenths are the rarest: ${bins}`);
  assert.ok(Math.max(bins[0], bins[9]) / middle < 0.2, `edges stay well below the middle: ${bins}`);
});

test('rings alternate left and right, need at most the set head turn, and only come while the session runs', async () => {
  const { settings, logic } = await LoadFlight();
  for (const turnRangeDeg of [10, 20, 45]) {
    const config = settings.ToPlayConfig({ ...settings.defaultSettings, turnRangeDeg, durationSec: 60, ringIntervalSec: 3 });
    const planner = logic.CreateRingPlanner(config, Seeded(turnRangeDeg));
    const rings = [];
    for (let ring = planner.Next(); ring; ring = planner.Next()) rings.push(ring);
    assert.ok(rings.length > 10);
    assert.deepEqual(rings.map(ring => ring.index), rings.map((_, index) => index));
    rings.forEach((ring, index) => {
      assert.equal(ring.side, index % 2 === 0 ? rings[0].side : -rings[0].side, 'Sides alternate.');
      assert.equal(ring.x, ring.side * ring.reach);
      assert.ok(Math.abs(ring.x) <= 1, 'The ring centre is inside the reachable lane.');
      assert.ok(ring.headAngle >= 0.3 * turnRangeDeg - 0.05 && ring.headAngle <= turnRangeDeg, `${ring.headAngle} within ${turnRangeDeg}`);
      assert.equal(ring.at, logic.flight.firstRingSec + index * 3);
      assert.ok(ring.at <= 60, 'No ring arrives after the session ends.');
    });
  }
  const firstSides = new Set(Array.from({ length: 20 }, (_, seed) => logic.CreateRingPlanner(settings.ToPlayConfig(settings.defaultSettings), Seeded(seed)).Next().side));
  assert.deepEqual([...firstSides].sort(), [-1, 1], 'The first ring may come on either side.');
});

test('one nod (up past the set angle, then down past it, or the reverse) is one wing flap', async () => {
  const { CreateFlapDetector } = await Load('logic/headInput.ts', { './oneEuroFilter': {} });
  const Count = (pitches, nodRangeDeg = 10, step = 0.1) => {
    const detector = CreateFlapDetector(nodRangeDeg);
    return pitches.map((pitch, index) => detector.Update(pitch, index * step)).flatMap((flap, index) => flap ? [index] : []);
  };
  assert.deepEqual(Count([0, 5, 11, 4, -11]), [4], 'Up then down flaps when the second extreme is reached.');
  assert.deepEqual(Count([0, -11, 0, 11]), [3], 'Down then up counts too.');
  assert.deepEqual(Count([0, 11, -11, 11, -11, 11, -11]), [2, 4, 6], 'Continuous nodding flaps once per full nod.');
  assert.deepEqual(Count([0, 8, -8, 8, -8]), [], 'Nods smaller than the setting do not flap.');
  assert.deepEqual(Count([0, 8, -8, 8, -8], 7), [2, 4], 'A smaller setting accepts the same nods.');
  assert.deepEqual(Count([0, 10.1, 9.9, 10.1, 9.9, 10.1, -10.1]), [6], 'Jitter at the threshold does not count twice.');
  assert.deepEqual(Count([11, 0, 11, 0, -11]), [4], 'Looking up twice is still half a nod.');
  assert.deepEqual(Count([11, -11], 10, 5), [], 'A half nod older than the cycle limit is dropped.');
  assert.deepEqual(Count([11, -11, 11], 10, 5).length, 0);
  assert.deepEqual(Count([11, null, -11]), [], 'Losing the face starts the nod over.');
  const detector = CreateFlapDetector(10);
  detector.Update(11, 0);
  detector.Reset();
  assert.equal(detector.Update(-11, 0.2), false, 'Reset forgets the first half of a nod.');
});

test('the neutral head position is the median of 2 s of steady samples, and moving, losing the face or 15 s without rest are handled', async () => {
  const { CreateNeutralCalibration, neutralCalibration } = await Load('logic/headInput.ts', { './oneEuroFilter': {} });
  assert.deepEqual({ ...neutralCalibration }, { windowMs: 2000, minSamples: 20, maxSpreadDeg: 2.5, timeoutMs: 15000 });
  const steady = CreateNeutralCalibration(0);
  let state;
  for (let time = 0; time <= 2100; time += 33) state = steady.Add({ yaw: 2 + Math.sin(time) * 0.5, pitch: -3 + Math.cos(time) * 0.4 }, time);
  assert.equal(state.status, 'done');
  assert.equal(state.progress, 1);
  assert.ok(Math.abs(state.neutral.yaw - 2) < 0.4 && Math.abs(state.neutral.pitch + 3) < 0.4, JSON.stringify(state.neutral));
  const moving = CreateNeutralCalibration(0);
  for (let time = 0; time <= 2100; time += 33) state = moving.Add({ yaw: time / 100, pitch: 0 }, time);
  assert.equal(state.status, 'collecting', 'A turning head is not a neutral position.');
  assert.ok(state.progress < 0.6, `the window restarts while the head moves (${state.progress})`);
  const lost = CreateNeutralCalibration(0);
  for (let time = 0; time <= 1500; time += 33) lost.Add({ yaw: 0, pitch: 0 }, time);
  assert.ok(lost.State().progress > 0.7);
  assert.equal(lost.Add(null, 1533).progress, 0, 'Losing the face starts the window again.');
  const late = CreateNeutralCalibration(0);
  for (let time = 0; time <= 15100; time += 33) state = late.Add({ yaw: time % 2000 / 50, pitch: 0 }, time);
  assert.equal(state.status, 'failed');
  assert.equal(late.Add({ yaw: 0, pitch: 0 }, 15200).status, 'failed', 'A failed calibration stays failed until it is restarted.');
});

test('head angles are smoothed with the One Euro filter before they steer or flap', async () => {
  const { OneEuroFilter } = await Load('logic/oneEuroFilter.ts');
  const { CreateHeadSmoother, HeadTargetX } = await Load('logic/headInput.ts', { './oneEuroFilter': { OneEuroFilter } });
  const smoother = CreateHeadSmoother();
  const jitter = [];
  for (let time = 0; time < 1000; time += 33) jitter.push(smoother.Filter({ yaw: time % 66 ? 1 : -1, pitch: 0 }, time).yaw);
  assert.ok(Math.max(...jitter.slice(10).map(Math.abs)) < 1, 'Frame-to-frame jitter is reduced.');
  let turned;
  for (let time = 1000; time < 1600; time += 33) turned = smoother.Filter({ yaw: 20, pitch: 10 }, time);
  assert.ok(turned.yaw > 19 && turned.pitch > 9.5, 'A real turn comes through within a fraction of a second.');
  smoother.Reset();
  assert.deepEqual(smoother.Filter({ yaw: -5, pitch: 3 }, 2000), { yaw: -5, pitch: 3 }, 'After a reset the first sample passes unchanged.');
  assert.equal(HeadTargetX(10, 20), 0.5);
  assert.equal(HeadTargetX(-20, 20), -1);
  assert.equal(HeadTargetX(35, 20), 1, 'Turning past the setting keeps the gull at the edge.');
});

test('a 3 s countdown holds altitude and the clock, then the gull sinks faster the longer it does not flap and crashes into the sea', async () => {
  const { logic, config } = await LoadFlight();
  const session = logic.CreateFlightSession(config, Seeded(1));
  assert.equal(session.countdown, 3);
  assert.equal(session.altitude, logic.flight.startAltitude);
  Run(logic, session, config, 2.9, { flap: true });
  assert.equal(session.elapsed, 0);
  assert.equal(session.altitude, logic.flight.startAltitude);
  assert.equal(session.flaps, 0, 'Flaps during the countdown do not count.');
  SkipCountdown(logic, session, config);
  assert.ok(session.countdown <= 0);
  session.altitude = 1;
  const half = config.glideSec / 2;
  Run(logic, session, config, half);
  const firstHalf = 1 - session.altitude;
  let crash;
  for (let time = half; time < config.glideSec + 1 && !crash; time += 0.05) {
    const events = logic.StepFlight(session, Input(), config);
    if (events.crashed) crash = session.elapsed;
  }
  assert.ok(firstHalf < 0.5 - 0.1, `the first half of a glide loses less height (${firstHalf})`);
  assert.ok(Math.abs(crash - config.glideSec) < 0.08, `crash after ${crash} s of flight`);
  assert.equal(session.crashed, true);
  assert.equal(session.ended, true);
  assert.equal(session.altitude, 0);
  const frozen = session.elapsed;
  assert.deepEqual(logic.StepFlight(session, Input({ flap: true }), config), { passed: [], missed: [], flapped: false, crashed: false, finished: false });
  assert.equal(session.elapsed, frozen, 'Nothing happens after the run ended.');
});

test('the glide time is the fall from the top to the sea whatever the frame rate, and shorter glides fall faster', async () => {
  const { settings, logic } = await LoadFlight();
  for (const glideSec of [4, 10, 20]) {
    for (const dt of [1 / 30, 1 / 144]) {
      const config = settings.ToPlayConfig({ ...settings.defaultSettings, glideSec });
      const session = logic.CreateFlightSession(config, Seeded(2));
      session.countdown = 0;
      session.altitude = 1;
      let time = 0;
      while (!session.ended && time < 30) { logic.StepFlight(session, Input({ dt }), config); time += dt; }
      assert.ok(Math.abs(session.elapsed - glideSec) <= dt + 1e-6, `${glideSec} s glide at ${dt}: ${session.elapsed}`);
    }
  }
});

test('a flap lifts the gull over a short rise, resets the sinking and never goes above the top', async () => {
  const { logic, config } = await LoadFlight();
  const session = logic.CreateFlightSession(config, Seeded(3));
  SkipCountdown(logic, session, config);
  session.altitude = 0.5;
  Run(logic, session, config, 2);
  const beforeFlap = session.altitude;
  assert.ok(session.sinceFlap > 1.9);
  const events = logic.StepFlight(session, Input({ flap: true }), config);
  assert.equal(events.flapped, true);
  assert.equal(session.flaps, 1);
  assert.ok(session.sinceFlap < 0.06);
  Run(logic, session, config, logic.flight.flapRiseSec);
  assert.ok(session.altitude > beforeFlap + logic.flight.flapLift * 0.75, `a flap lifts (${beforeFlap} to ${session.altitude})`);
  for (let index = 0; index < 40; index++) logic.StepFlight(session, Input({ flap: true }), config);
  Run(logic, session, config, 1);
  assert.ok(session.altitude <= 1);
  assert.equal(session.flaps, 41);
  let steady = 0.6;
  session.altitude = steady;
  for (let cycle = 0; cycle < 20; cycle++) { logic.StepFlight(session, Input({ flap: true }), config); Run(logic, session, config, 2.5); }
  assert.ok(session.altitude > steady - 0.1, 'A nod every 2.5 s keeps the default glide in the air.');
});

test('head yaw places the gull across the lane, the keyboard glides it, and lost tracking freezes the clock and the height', async () => {
  const { logic, config } = await LoadFlight();
  const session = logic.CreateFlightSession(config, Seeded(4));
  SkipCountdown(logic, session, config);
  Run(logic, session, config, 1, { targetX: 1 });
  assert.ok(session.x > 0.99, `follows the head (${session.x})`);
  Run(logic, session, config, 1, { targetX: -0.5 });
  assert.ok(Math.abs(session.x + 0.5) < 0.01);
  const keyboard = logic.CreateFlightSession({ ...config, headControl: false }, Seeded(4));
  SkipCountdown(logic, keyboard, config);
  Run(logic, keyboard, keyboard.config, 0.5, { keyboardDirection: 1 });
  assert.ok(Math.abs(keyboard.targetX - logic.flight.keyboardGlideSpeed * 0.5) < 0.06, `keyboard glide ${keyboard.targetX}`);
  Run(logic, keyboard, keyboard.config, 3, { keyboardDirection: 1 });
  assert.equal(keyboard.targetX, 1);
  const { elapsed, altitude } = session;
  Run(logic, session, config, 1, { tracking: false, flap: true, targetX: 1 });
  assert.equal(session.elapsed, elapsed);
  assert.equal(session.altitude, altitude);
  assert.equal(session.frozen, true);
  assert.equal(session.flaps, 0);
  Run(logic, session, config, 0.05, { head: { yaw: -14, pitch: 6 } });
  assert.equal(session.frozen, false);
  Run(logic, session, config, 0.05, { head: { yaw: 9, pitch: -11 } });
  assert.deepEqual([session.maxTurnDeg, session.maxNodDeg], [14, 11], 'The largest turn and nod are kept for the results.');
  assert.deepEqual([keyboard.maxTurnDeg, keyboard.maxNodDeg], [null, null], 'Keyboard play has no head angles.');
});

test('a ring counts as passed when the gull crosses it inside the ring, otherwise as missed', async () => {
  const { logic, config } = await LoadFlight();
  const session = logic.CreateFlightSession(config, Seeded(5));
  const [first, second] = session.rings;
  assert.equal(first.at, logic.flight.firstRingSec);
  assert.ok(session.rings.every(ring => ring.at <= config.durationSec));
  SkipCountdown(logic, session, config);
  session.altitude = logic.flight.ringAltitude;
  let passed = [];
  while (!passed.length) {
    session.altitude = logic.flight.ringAltitude;
    const events = logic.StepFlight(session, Input({ targetX: first.x, flap: false }), config);
    passed = events.passed;
    assert.equal(events.missed.length, 0);
  }
  assert.equal(passed[0].index, 0);
  assert.ok(passed[0].offset < 0.1);
  assert.ok(Math.abs(session.elapsed - first.at) < 0.06);
  let missed = [];
  while (!missed.length) {
    session.altitude = logic.flight.ringAltitude;
    missed = logic.StepFlight(session, Input({ targetX: -second.x }), config).missed;
  }
  assert.equal(missed[0].index, 1);
  assert.ok(missed[0].offset > 1);
  assert.equal(session.results.length, 2);
  assert.ok(session.rings.every(ring => ring.at > session.elapsed), 'Crossed rings leave the queue.');
  const summary = logic.SummarizeFlight(session);
  assert.equal(summary.passed, 1);
  assert.equal(summary.missed, 1);
  assert.equal(summary.passRate, 50);
});

test('the run ends at the set flight time without a crash', async () => {
  const { settings, logic } = await LoadFlight();
  const config = settings.ToPlayConfig({ ...settings.defaultSettings, durationSec: 60 });
  const session = logic.CreateFlightSession(config, Seeded(6));
  SkipCountdown(logic, session, config);
  let finished = false;
  for (let index = 0; index < 2000 && !finished; index++) {
    session.altitude = 0.9;
    finished = logic.StepFlight(session, Input({ dt: 0.05 }), config).finished;
  }
  assert.equal(finished, true);
  assert.equal(session.crashed, false);
  assert.ok(Math.abs(session.elapsed - 60) < 0.06);
  const summary = logic.SummarizeFlight(session);
  assert.equal(summary.crashed, 0);
  assert.equal(summary.durationSeconds, 60);
  assert.equal(summary.passed + summary.missed, Math.floor((60 - logic.flight.firstRingSec) / 4.5) + 1);
});

test('results keep the ring, reach and flap numbers, and pass the container result check', async () => {
  const { settings, logic } = await LoadFlight();
  const { BuildGameScore } = await Load('score.ts');
  const config = settings.ToPlayConfig(settings.defaultSettings);
  const session = logic.CreateFlightSession(config, Seeded(8));
  SkipCountdown(logic, session, config);
  Run(logic, session, config, 0.05, { head: { yaw: 12.34, pitch: -10.26 } });
  for (let step = 0; step < 400 && session.results.length < 3; step++) {
    session.altitude = logic.flight.ringAltitude;
    logic.StepFlight(session, Input({ targetX: session.rings[0]?.x ?? 0, flap: step % 50 === 0 }), config);
  }
  const summary = logic.SummarizeFlight(session);
  const score = BuildGameScore(summary, config);
  assert.equal(score.schema, 'rehab-trainer.game-score/v1');
  assert.equal(score.gameId, 'seagull-flight');
  assert.deepEqual(Object.keys(score.summary), ['duration', 'passed', 'missed', 'passRate', 'flaps', 'crashed', 'maxTurnDeg', 'maxNodDeg', 'turnRangeDeg', 'nodRangeDeg']);
  assert.deepEqual([score.summary.passed, score.summary.passRate, score.summary.maxTurnDeg, score.summary.maxNodDeg, score.summary.turnRangeDeg], [3, 100, 12.3, 10.3, 20]);
  assert.equal(score.rounds.length, 3);
  assert.deepEqual(Object.keys(score.rounds[0]), ['ring', 'passed', 'side', 'headAngle', 'offset', 'altitude']);
  score.rounds.forEach((round, index) => {
    const ring = session.results[index];
    assert.deepEqual([round.ring, round.passed, round.side], [index + 1, 1, ring.side < 0 ? 0 : 1]);
    assert.equal(round.headAngle, Math.round(ring.reach * 20 * 10) / 10);
    assert.ok(Number.isInteger(round.offset) && Number.isInteger(round.altitude));
  });
  assert.equal(IsGameResult({ config: { ...settings.defaultSettings }, score }, 'seagull-flight'), true);
  const keyboard = BuildGameScore({ ...summary, maxTurnDeg: null, maxNodDeg: null, passed: 0, missed: 0, rounds: [] }, config);
  assert.equal(keyboard.summary.passRate, null, 'No ring crossed means no pass share.');
  assert.equal(keyboard.summary.maxTurnDeg, null);
});

const HeadFrame = patch => ({ timestamp: 40, videoWidth: 960, videoHeight: 720, face: true, yaw: 12.5, pitch: -3, roll: 1, ...patch });

test('only well-formed head frames from the container reach the game', async () => {
  const { AcceptSensorInput } = await Load('runtime/sensorInput.ts');
  const state = { sessionNonce: nonce, sequence: -1 };
  let sequence = 0;
  const message = (type, payload, patch = {}) => ({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: sequence++, type, payload, ...patch });
  for (const payload of [HeadFrame(), HeadFrame({ yaw: -180, pitch: 90, roll: 180 }), HeadFrame({ face: false, yaw: null, pitch: null, roll: null })]) {
    assert.equal(AcceptSensorInput(message('frame', payload), state), true, JSON.stringify(payload));
  }
  assert.equal(AcceptSensorInput(message('ready', {}), state), true);
  for (const reason of ['permission', 'unsupported', 'disconnected', 'initialization']) assert.equal(AcceptSensorInput(message('error', { reason }), state), true);
  for (const payload of [
    { ...HeadFrame(), extra: 1 }, HeadFrame({ yaw: NaN }), HeadFrame({ yaw: 181 }), HeadFrame({ pitch: '3' }), HeadFrame({ yaw: null }),
    HeadFrame({ face: false }), HeadFrame({ face: 'yes' }), HeadFrame({ videoWidth: 0 }), HeadFrame({ timestamp: -1 }),
    (({ roll, ...rest }) => rest)(HeadFrame()),
    { timestamp: 3, videoWidth: 960, videoHeight: 720, face: true, mouth: { x: 0.5, y: 0.6 }, label: null, confidence: 0, samples: { Rest: 0, Tongue_Left: 0, Tongue_Right: 0 } },
  ]) assert.equal(AcceptSensorInput(message('frame', payload), state), false, JSON.stringify(payload));
  assert.equal(AcceptSensorInput(message('error', { reason: 'other' }), state), false);
  assert.equal(AcceptSensorInput(message('frame', HeadFrame(), { sessionNonce: 'b'.repeat(64) }), state), false, 'Another session is ignored.');
  const replay = message('ready', {});
  assert.equal(AcceptSensorInput(replay, state), true);
  assert.equal(AcceptSensorInput(replay, state), false, 'A repeated sequence is ignored.');
});

async function LoadBridge({ referrer = 'https://trainerhub.cc/', senderOrigin = 'https://trainerhub.cc', senderIsParent = true } = {}) {
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = {
    parent, addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener)),
    dispatchEvent: event => { events.push(event.type); for (const listener of listeners.get(event.type) ?? []) listener(event); },
    setTimeout, clearTimeout,
  };
  const document = { referrer, fullscreenElement: null, exitFullscreen: async () => events.push('document-exit') };
  const sent = [];
  const module = { exports: {} };
  const sensorInput = await Load('runtime/sensorInput.ts');
  new Function('require', 'module', 'exports', 'window', 'document', 'CustomEvent', 'Event', ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => ({ '../package.json': { version: '1.0.0' }, './soundManager': { DisposeAudioFeedback: () => sent.push('stop-audio') }, './sensorInput': sensorInput })[name],
  module, module.exports, window, document, CustomEvent, Event);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  for (const listener of listeners.get('message')) listener({ source: senderIsParent ? parent : {}, origin: senderOrigin, ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'seagull-flight', version: '1.0.0', sessionNonce: nonce, language: 'zh' } });
  let inputSequence = 0;
  const deliver = data => port.onmessage({ data });
  return {
    api, sent, events, deliver,
    input: (type, payload) => deliver({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: inputSequence++, type, payload }),
    fullscreen: active => deliver({ schema: 'trainerhub.game/v1', type: 'fullscreen', sessionNonce: nonce, active }),
    types: () => sent.map(message => typeof message === 'string' ? message : message.type),
  };
}

test('the bridge asks for the head proxy, the camera area and fullscreen, and every message passes the container check', async () => {
  const fallback = await LoadBridge({ referrer: '' });
  assert.deepEqual(fallback.types(), ['ready'], 'The trusted Hub can initialize when the browser strips the referrer.');
  for (const options of [{ referrer: '', senderOrigin: 'https://other.example' }, { referrer: '', senderIsParent: false }]) {
    assert.deepEqual((await LoadBridge(options)).types(), [], 'The fallback still rejects a different origin or source.');
  }
  const bridge = await LoadBridge();
  const { api, sent } = bridge;
  assert.equal(api.SetInputCapture, undefined, 'The head proxy keeps no calibration samples, so there is nothing to capture.');
  const starting = api.StartSensorInput();
  assert.deepEqual(sent.at(-1).payload, { input: 'head' });
  bridge.input('ready', {});
  await starting;
  bridge.input('frame', HeadFrame());
  api.SetInputPreview({ x: 0, y: 0, width: 0.6, height: 1 });
  assert.deepEqual(sent.at(-1).payload, { visible: true, x: 0, y: 0, width: 0.6, height: 1 });
  assert.deepEqual(api.ToPreviewRect({ left: 0, top: 0, width: 760, height: 800 }, 1200, 800), { x: 0, y: 0, width: 0.6333, height: 1 });
  api.SetInputPreview(null);
  assert.deepEqual(sent.at(-1).payload, { visible: false, x: 0, y: 0, width: 0, height: 0 });
  const failing = api.StartSensorInput();
  bridge.input('error', { reason: 'permission' });
  await assert.rejects(failing, /permission/);
  const entering = api.RequestContainerFullscreen();
  assert.equal(sent.at(-1).type, 'fullscreen-request');
  bridge.fullscreen(true);
  assert.equal(await entering, true);
  api.StopSensorInput();
  api.SaveGameSettings({ inputMode: 'keyboard', durationSec: 60 });
  const state = { gameId: 'seagull-flight', version: '1.0.0', sessionNonce: nonce, sequence: -1, complete: false, capabilities };
  for (const message of sent.filter(item => typeof item === 'object')) assert.equal(AcceptGameMessage(message, state), true, message.type);
  assert.ok(bridge.events.includes('game:input'), 'Valid head frames are passed on to the game.');
});

test('leaving the game stops audio and the camera, waits for the container to leave fullscreen, then exits', async () => {
  const bridge = await LoadBridge();
  bridge.fullscreen(true);
  const leaving = bridge.api.ExitGame();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(bridge.types().slice(1), ['stop-audio', 'input-stop', 'fullscreen-exit'], 'The container stays mounted until fullscreen ends.');
  bridge.fullscreen(false);
  await leaving;
  assert.equal(bridge.types().at(-1), 'exit');
});

function Deferred() {
  let resolvePromise;
  const promise = new Promise(done => { resolvePromise = done; });
  return { promise, resolve: resolvePromise };
}

test('head control turns the camera on windowed, then a fresh Start click enters fullscreen before the neutral position; keyboard play skips the camera', async () => {
  const sensor = Deferred();
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false },
    settings: { inputMode: 'head' }, ValidateSettings: () => true, labels: {},
    setPhase: phase => { context.phaseRef.current = phase; actions.push(`phase:${phase}`); }, setError() {},
    setSensorReady: ready => actions.push(`ready:${ready}`),
    StartSensorInput: () => { actions.push('sensor'); return sensor.promise; },
    RequestContainerFullscreen: () => { actions.push('fullscreen'); return fullscreen.promise; },
    ExitContainerFullscreen: async () => actions.push('exit-fullscreen'),
    PrepareAudioFeedback: () => actions.push('audio'), beginCalibration: () => actions.push('calibration'), beginPlay: () => actions.push('play'),
    showConfiguration() {}, InputErrorMessage: () => '',
  };
  const start = await LoadFunction('SeagullFlightGame.tsx', 'startTraining', context);
  const enabling = start();
  assert.deepEqual(actions, ['phase:initializing', 'sensor'], 'The permission prompt appears outside fullscreen.');
  sensor.resolve();
  await enabling;
  assert.deepEqual(actions.slice(2), ['ready:true', 'phase:rules'], 'Loading ends on the confirmation so the next click has user activation.');
  const starting = start();
  assert.deepEqual(actions.slice(4), ['audio', 'fullscreen']);
  fullscreen.resolve(true);
  await starting;
  assert.deepEqual(actions.slice(6), ['calibration']);

  const keyboardActions = [];
  const keyboard = { ...context, settings: { inputMode: 'keyboard' }, phaseRef: { current: 'rules' }, sensorReadyRef: { current: false },
    StartSensorInput: () => { keyboardActions.push('sensor'); return Promise.resolve(); },
    PrepareAudioFeedback: () => keyboardActions.push('audio'), RequestContainerFullscreen: async () => { keyboardActions.push('fullscreen'); return true; },
    beginCalibration: () => keyboardActions.push('calibration'), beginPlay: () => keyboardActions.push('play') };
  await (await LoadFunction('SeagullFlightGame.tsx', 'startTraining', keyboard))();
  assert.deepEqual(keyboardActions, ['audio', 'fullscreen', 'play'], 'Keyboard play never asks for the camera.');

  const cancelled = { ...context, phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false } };
  const pending = Deferred();
  const cancelledActions = [];
  Object.assign(cancelled, { StartSensorInput: () => pending.promise, setPhase: phase => { cancelled.phaseRef.current = phase; },
    setSensorReady: () => cancelledActions.push('ready'), RequestContainerFullscreen: async () => cancelledActions.push('fullscreen') });
  const cancelledStart = await LoadFunction('SeagullFlightGame.tsx', 'startTraining', cancelled);
  const waiting = cancelledStart();
  cancelled.generationRef.current++;
  pending.resolve();
  await waiting;
  assert.deepEqual(cancelledActions, [], 'Going back during the permission prompt cannot mark the camera ready or enter fullscreen.');
});

test('Seagull Flight owns its 3D runtime, catalogue entry and results without Hub, camera or model code', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@rehab-trainer/game-seagull-flight');
  assert.equal(pkg.version, '1.0.0');
  for (const name of ['react', 'react-dom', 'jspsych', 'three', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.ok(pkg.devDependencies['@types/three']);
  assert.equal(pkg.dependencies['@rehab-trainer/ui'], undefined);
  assert.deepEqual(pkg.rehabTrainer.capabilities, capabilities);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|localStorage|SaveTrainingRecord|react-router-dom|GetAuth|subjectId|getActiveUser/, file);
    assert.doesNotMatch(source, /getUserMedia|mediaDevices|tasks-vision|@tensorflow|<video/, `${file}: the container owns the camera and the face model.`);
    // The fixed Hub URL is only the origin fallback; all network APIs and other URLs stay forbidden.
    const networkSource = file.replaceAll('\\', '/') === 'runtime/hubBridge.ts'
      ? source.replace("const parentOrigin = new URL(document.referrer || 'https://trainerhub.cc').origin;", '') : source;
    assert.doesNotMatch(networkSource, /\bfetch\(|new Worker|https?:\/\//, `${file}: the runner blocks network access for game packages.`);
    if (/\.tsx?$/.test(file)) assert.doesNotMatch(source, /#[0-9a-f]{3,6}\b|rgba?\(\s*\d|0x[0-9a-f]{6}/i, `${file}: colors come from CSS tokens.`);
    assert.doesNotMatch(source, /評估|測驗|診斷|治療|療效|改善|[Aa]ssessment|[Dd]iagnos|[Tt]reat|[Ii]mprove|practise/, `${file}: practice wording only.`);
    assert.doesNotMatch(source, /\u2014/, `${file}: no em dash.`);
  }
  for (const name of ['settings.json', 'score.json']) await assert.rejects(access(resolve(gameRoot, name)), name);
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.schemaVersion, metadata.gameId, metadata.trainer, metadata.category, metadata.preview], [1, 'seagull-flight', 'vision', 'vision', 'preview.webp']);
  assert.equal(metadata.copy['zh-TW'].title, '海鷗飛行');
  assert.equal(metadata.copy.en.title, 'Seagull Flight');
  for (const copy of Object.values(metadata.copy)) assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|評估|測驗|treat|diagnos|improve|assess|practise/i);
  const preview = await readFile(resolve(gameRoot, 'public', metadata.preview));
  assert.deepEqual([preview.subarray(0, 4).toString(), preview.subarray(8, 12).toString()], ['RIFF', 'WEBP']);
  const notices = await readFile(resolve(gameRoot, 'public/THIRD-PARTY-NOTICES.txt'), 'utf8');
  for (const text of ['FlyingMoo', 'MIT License', 'OneEuroFilter', 'Inria', 'BSD-3-Clause', 'three.js']) assert.ok(notices.includes(text), text);
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  assert.match(css, /color-scheme: light/, 'The transparent camera area needs the same color scheme as the container.');
  for (const token of ['--seagull-sky', '--seagull-sea', '--seagull-body', '--seagull-wing', '--seagull-wingtip', '--seagull-beak', '--seagull-ring', '--seagull-ring-passed', '--seagull-fixation']) {
    assert.match(css, new RegExp(`${token}:`), token);
  }
  const scene = await readFile(resolve(gameRoot, 'scene.ts'), 'utf8');
  assert.match(scene, /from 'three'/);
  assert.match(scene, /flatShading: true/, 'Low-poly faces are shaded flat.');
  assert.match(scene, /getPropertyValue\(`--seagull-\$\{name\}`\)/, 'The 3D scene reads its colors from the CSS tokens.');
  assert.match(scene, /\.dispose\(\)/);
  const source = await readFile(resolve(gameRoot, 'SeagullFlightGame.tsx'), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /SetInputPreview\(/);
  assert.match(source, /RequestContainerFullscreen\(/);
  assert.match(source, /SampleRingReach|CreateFlightSession/);
  assert.doesNotMatch(source, /requestFullscreen\(/, 'The container enters fullscreen so the camera image stays visible.');
  assert.doesNotMatch(source, /SetInputCapture/);
});

test('spotlights cover the flap, the glide toward the rings, the sea below and the flight HUD', async () => {
  const { GetSeagullTutorialSteps } = await Load('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) {
    const steps = GetSeagullTutorialSteps(language);
    assert.deepEqual(steps.map(step => step.target), ['.seagull-preview-flap', '.seagull-preview-glide', '.seagull-preview-sea', '.seagull-hud']);
    assert.equal(new Set(steps.map(step => step.text)).size, steps.length);
    assert.ok(steps.every(step => step.title && step.text && step.place));
  }
});

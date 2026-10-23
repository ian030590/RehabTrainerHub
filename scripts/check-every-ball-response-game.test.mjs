import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { AcceptGameMessage, IsGameResult, IsGameSettings } from '../packages/ui/src/selfContainedGame.js';

const root = resolve(import.meta.dirname, '..');
const gameRoot = resolve(root, 'apps/rehabtrainerhub/games/every-ball-response');
const legacy = JSON.parse(await readFile(resolve(import.meta.dirname, 'fixtures/every-ball-response-legacy.json'), 'utf8'));
const nonce = 'a'.repeat(64);

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

async function LoadLogic() {
  const core = await Load('logic/everyBallResponse.ts');
  const run = await Load('logic/everyBallRun.ts', { './everyBallResponse': core });
  const window = await Load('logic/responseWindow.ts');
  const detection = await Load('logic/responseDetection.ts');
  return { ...core, ...run, ...window, ...detection };
}

// Pulls one function or `const name = useCallback(...)` body out of a component so its ordering can be checked alone.
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

function FakeClock() {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const flush = () => new Promise(done => setImmediate(done));
  return {
    now: () => now,
    setTimeout: (callback, delay) => { timers.set(++id, { at: now + delay, callback }); return id; },
    clearTimeout: key => { timers.delete(key); },
    async advance(milliseconds) {
      const target = now + milliseconds;
      await flush();
      for (;;) {
        const next = [...timers.entries()].sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
        if (!next || next[1].at > target) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
}

const Plan = (levelId, ball, trialNumber, fixationMs = 2000) => ({
  levelId, ball, trialNumber, fixationMs, xRatio: 0.5, yRatio: 0.47,
  expectedAction: ball === 'basketball' ? 'clap' : ball === 'soccer' && levelId === 3 ? 'thigh' : 'none',
});
// A hand whose 21 points sit on one spot, so its palm center is that spot.
const Hand = (x, y) => Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
const PoseFrame = (timestamp, hands, pose = []) => ({ timestamp, videoWidth: 960, videoHeight: 720, hands, pose });

test('Every Ball keeps the Hub settings and brings back the input, fixation and sound options in its own form', async () => {
  const { defaultSettings, listSettings, rangeSettings, ValidateSettings, LevelFromDifficulty } = await Load('settings.ts');
  assert.deepEqual(Object.keys(defaultSettings), ['difficulty', 'rounds', 'inputMode', 'fixationStyle', 'soundSensitivity']);
  for (const field of legacy.settings) {
    assert.equal(defaultSettings[field.key], field.default, field.key);
    if (field.type === 'list') assert.deepEqual(listSettings.find(item => item.key === field.key).options, field.options, field.key);
    else {
      const range = rangeSettings.find(item => item.key === field.key);
      assert.deepEqual([range.min, range.max, range.step], [field.min, field.max, field.step], field.key);
    }
  }
  const [inputMode, fixationStyle, sensitivity] = legacy.hiddenSettings;
  assert.equal(defaultSettings.inputMode, inputMode.default);
  assert.deepEqual(listSettings.find(item => item.key === 'inputMode').options, inputMode.options);
  assert.equal(defaultSettings.fixationStyle, fixationStyle.default);
  assert.deepEqual(listSettings.find(item => item.key === 'fixationStyle').options, fixationStyle.options);
  const sound = rangeSettings.find(item => item.key === 'soundSensitivity');
  assert.deepEqual([defaultSettings.soundSensitivity / 100, sound.min / 100, sound.max / 100], [sensitivity.default, sensitivity.min, sensitivity.max]);
  assert.equal(ValidateSettings(defaultSettings), true);
  assert.equal(IsGameSettings(defaultSettings), true, 'The container may store the full settings.');
  assert.ok(Object.keys(defaultSettings).every(key => !/phone|name|user/i.test(key)), 'Saved keys avoid words the record checks treat as personal.');
  for (const range of rangeSettings) {
    assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: range.min }), true, `${range.key} min`);
    assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: range.max }), true, `${range.key} max`);
    for (const value of [range.min - range.step, range.max + range.step, range.min + range.step / 2, NaN, Infinity, String(range.min)]) {
      assert.equal(ValidateSettings({ ...defaultSettings, [range.key]: value }), false, `${range.key} ${value}`);
    }
  }
  for (const change of [{ difficulty: 'expert' }, { inputMode: 'touch' }, { fixationStyle: 'dot' }, { inputMode: 1 }]) {
    assert.equal(ValidateSettings({ ...defaultSettings, ...change }), false, JSON.stringify(change));
  }
  for (const level of legacy.levels) assert.equal(LevelFromDifficulty(level.difficulty), level.level, level.difficulty);
});

test('the legacy timing, ball proportions and pass marks stay the same', async () => {
  const { everyBallTiming, levelPassAccuracy, SummarizeEveryBallTrials, GradeEveryBallTrial } = await LoadLogic();
  assert.deepEqual(everyBallTiming, legacy.timing);
  for (const level of legacy.levels) {
    assert.equal(levelPassAccuracy[level.level], level.passAccuracy);
    const total = 20;
    const needed = Math.ceil(total * level.passAccuracy / 100);
    const rows = correct => Array.from({ length: total }, (_, index) => GradeEveryBallTrial(Plan(level.level, 'basketball', index + 1),
      index < correct ? { action: 'clap', rtMs: 300, source: 'touch' } : null));
    assert.equal(SummarizeEveryBallTrials(rows(needed), level.level).passed, true, `level ${level.level}`);
    assert.equal(SummarizeEveryBallTrials(rows(needed - 1), level.level).passed, false, `level ${level.level}`);
  }
});

test('each trial shows the fixation, a 900 ms ball, then feedback after the 1800 ms window or the response', async () => {
  const { RunEveryBall, CreateResponseWindow } = await LoadLogic();
  const clock = FakeClock();
  const responses = CreateResponseWindow(clock);
  const shown = [];
  const run = RunEveryBall([Plan(3, 'basketball', 1, 1200), Plan(3, 'tennis', 2, 2500), Plan(3, 'soccer', 3, 1000)], {
    fixationStyle: 'cross',
    wait: milliseconds => new Promise(done => clock.setTimeout(done, milliseconds)),
    waitForResponse: milliseconds => responses.WaitForResponse(milliseconds),
    notify: visual => shown.push([clock.now(), visual.phase, visual.trialNumber ?? null, visual.feedbackCorrect ?? null, visual]),
    cancelled: () => false,
  });
  await clock.advance(1600);
  assert.equal(responses.Emit('clap', 'keyboard'), true, 'A response 400 ms after the ball appears is taken.');
  await clock.advance(20000);
  const result = await run;
  assert.deepEqual(shown.map(item => item.slice(0, 4)), [
    [0, 'fixation', 1, null], [1200, 'stimulus', 1, null], [2100, 'blank', 1, null], [2100, 'feedback', 1, true],
    [2650, 'fixation', 2, null], [5150, 'stimulus', 2, null], [6050, 'blank', 2, null], [6950, 'feedback', 2, true],
    [7500, 'fixation', 3, null], [8500, 'stimulus', 3, null], [9400, 'blank', 3, null], [10300, 'feedback', 3, false],
    [10850, 'idle', null, null],
  ]);
  assert.equal(shown[0][4].fixationStyle, 'cross');
  const stimulus = shown.find(item => item[1] === 'stimulus')[4];
  assert.deepEqual(Object.keys(stimulus).sort(), ['ball', 'phase', 'totalTrials', 'trialNumber', 'xRatio', 'yRatio'],
    'The screen never learns the expected action, so the HUD cannot give the answer away.');
  assert.equal(result.aborted, false);
  assert.deepEqual(result.trials.map(trial => [trial.Outcome, trial.Reaction_Time_ms, trial.Response_Source]),
    [['hit', 400, 'keyboard'], ['correct_reject', null, ''], ['miss', null, '']]);
});

test('stopping during a trial ends the run without grading the rest', async () => {
  const { RunEveryBall, CreateResponseWindow } = await LoadLogic();
  const clock = FakeClock();
  const responses = CreateResponseWindow(clock);
  let cancelled = false;
  const shown = [];
  const run = RunEveryBall([Plan(1, 'basketball', 1), Plan(1, 'basketball', 2)], {
    fixationStyle: 'blank', wait: milliseconds => new Promise(done => clock.setTimeout(done, milliseconds)),
    waitForResponse: milliseconds => responses.WaitForResponse(milliseconds), notify: visual => shown.push(visual.phase), cancelled: () => cancelled,
  });
  await clock.advance(500);
  cancelled = true;
  await clock.advance(10000);
  const result = await run;
  assert.equal(result.aborted, true);
  assert.deepEqual(result.trials, []);
  assert.deepEqual(shown, ['fixation', 'idle']);
});

test('the response window times each response once and ignores responses outside it', async () => {
  const { CreateResponseWindow } = await LoadLogic();
  const clock = FakeClock();
  const responses = CreateResponseWindow(clock);
  assert.equal(responses.Emit('clap', 'touch'), false, 'No window is open yet.');
  await clock.advance(100);
  const first = responses.WaitForResponse(1800);
  await clock.advance(250);
  responses.Emit('thigh', 'camera');
  responses.Emit('clap', 'camera');
  assert.deepEqual(await first, { action: 'thigh', rtMs: 250, source: 'camera' });
  const timedOut = responses.WaitForResponse(1800);
  await clock.advance(1800);
  assert.equal(await timedOut, null);
  const replaced = responses.WaitForResponse(1800);
  const next = responses.WaitForResponse(1800);
  assert.equal(await replaced, null, 'A new window closes the previous one.');
  responses.Cancel();
  assert.equal(await next, null);
});

test('camera claps and thigh taps follow the legacy distances, zones and 480 ms cooldown', async () => {
  const { CreateCameraGestureDetector, cameraDetection } = await LoadLogic();
  assert.deepEqual([cameraDetection.closeDistance, cameraDetection.openDistance, cameraDetection.cooldownMs, cameraDetection.thighFallbackY],
    [legacy.camera.clapCloseDistance, legacy.camera.clapOpenDistance, legacy.camera.cooldownMs, legacy.camera.thighFallbackY]);
  const detector = CreateCameraGestureDetector();
  const pair = distance => [Hand(0.5 - distance / 2, 0.3), Hand(0.5 + distance / 2, 0.3)];
  const claps = [[1000, 0.3], [1070, 0.1], [1140, 0.1], [1210, 0.25], [1280, 0.1], [1400, 0.25], [1600, 0.1]]
    .map(([time, distance]) => detector.Update(PoseFrame(time, pair(distance))).action);
  assert.deepEqual(claps, [null, 'clap', null, null, null, null, 'clap'], 'Hands must open again and the cooldown must pass.');
  const zone = [{ x: 0.4, y: 0.5, z: 0 }, { x: 0.6, y: 0.5, z: 0 }, { x: 0.42, y: 0.75, z: 0 }, { x: 0.58, y: 0.75, z: 0 }];
  const thigh = CreateCameraGestureDetector();
  const taps = [[1000, 0.4, 0.3], [1100, 0.41, 0.6], [1200, 0.41, 0.6], [1300, 0.41, 0.3], [1400, 0.41, 0.6], [1700, 0.41, 0.3], [1800, 0.41, 0.6]]
    .map(([time, x, y]) => thigh.Update(PoseFrame(time, [Hand(x, y)], zone)).action);
  assert.deepEqual(taps, [null, 'thigh', null, null, null, null, 'thigh']);
  const outside = CreateCameraGestureDetector();
  assert.equal(outside.Update(PoseFrame(1000, [Hand(0.9, 0.6)], zone)).action, null, 'A hand beside the legs is not a tap.');
  const noBody = CreateCameraGestureDetector();
  assert.equal(noBody.Update(PoseFrame(1000, [Hand(0.5, 0.6)])).action, null);
  assert.equal(noBody.Update(PoseFrame(1100, [Hand(0.5, 0.7)])).action, 'thigh', 'Without a body the lower part of the image counts.');
  const both = CreateCameraGestureDetector();
  assert.deepEqual(both.Update(PoseFrame(1000, [Hand(0.45, 0.7), Hand(0.5, 0.7)])), { action: 'clap', tracking: true }, 'A clap wins over a tap in the same frame.');
  assert.deepEqual(both.Update(PoseFrame(1600, [])), { action: null, tracking: false });
  assert.equal(both.Update(PoseFrame(1700, pair(0.1))).action, null, 'Hands still together when tracking returns are not a new clap.');
  assert.equal(both.Update(PoseFrame(1770, pair(0.3))).action, null);
  assert.equal(both.Update(PoseFrame(1840, pair(0.1))).action, 'clap', 'Opening and closing in view is a clap again.');
});

// Tracking often drops a hand for a frame or two, most of all a hand resting low on the thigh.
// The legacy game counted each return as a new tap or clap.
test('camera tracking dropouts do not count as new thigh taps or claps', async () => {
  const { CreateCameraGestureDetector, cameraDetection } = await LoadLogic();
  assert.equal(cameraDetection.thighRearmMs, 250);
  const zone = [{ x: 0.4, y: 0.5, z: 0 }, { x: 0.6, y: 0.5, z: 0 }, { x: 0.42, y: 0.75, z: 0 }, { x: 0.58, y: 0.75, z: 0 }];
  const run = frames => {
    const detector = CreateCameraGestureDetector();
    return frames.map(([time, hands]) => detector.Update(PoseFrame(time, hands, zone)).action);
  };
  const on = Hand(0.41, 0.6);
  const off = Hand(0.41, 0.3);
  const raised = Hand(0.8, 0.2);
  // Every dropout below ends after the 480 ms cooldown, so only the dropout handling decides.
  assert.deepEqual(run([[1000, [off]], [1070, [on]], [1600, [on]], [1670, []], [1740, []], [1810, [on]], [1880, []], [2900, [on]]]),
    [null, 'thigh', null, null, null, null, null, null], 'A hand that stays on the thigh while tracking loses it taps once.');
  assert.deepEqual(run([[1000, [off, raised]], [1070, [on, raised]], [1600, [on, raised]], [1670, [raised]], [1740, [raised]], [1810, [on, raised]]]),
    [null, 'thigh', null, null, null, null], 'Losing only the hand on the thigh for 210 ms is not a second tap.');
  assert.deepEqual(run([[1000, [on]], [1300, [on]], [1370, [off]], [1440, [off]], [1510, [off]], [1580, [on]]]),
    ['thigh', null, null, null, null, 'thigh'], 'Lifting the hand for 280 ms and tapping again counts.');
  // The body model drops the hips and knees more often than the hands; a still hand must not switch rules and tap.
  assert.equal(cameraDetection.poseHoldMs, 1000);
  const body = CreateCameraGestureDetector();
  const high = Hand(0.41, 0.55);
  const bodyTaps = [[1000, off, zone], [1070, high, zone], [1600, high, zone], [1670, high, []], [1810, high, []], [1880, high, []], [1950, high, zone],
    [3000, high, []], [3070, Hand(0.41, 0.7), []]].map(([time, hand, pose]) => body.Update(PoseFrame(time, [hand], pose)).action);
  assert.deepEqual(bodyTaps, [null, 'thigh', null, null, null, null, null, null, 'thigh'],
    'A missing body keeps the last hip and knee zone for one second, then the lower part of the image counts again.');
});

test('microphone taps keep the legacy threshold, re-arm level, 320 ms cooldown and clap or thigh split', async () => {
  const { CreateMicrophoneTapDetector, MicrophoneThreshold, ToMeterLevel, microphoneDetection } = await LoadLogic();
  assert.deepEqual([microphoneDetection.cooldownMs, microphoneDetection.rearmRatio, microphoneDetection.clapHighRatio],
    [legacy.microphone.cooldownMs, legacy.microphone.rearmRatio, legacy.microphone.clapHighRatio]);
  const threshold = sensitivity => legacy.microphone.thresholdBase - Math.min(Math.max(sensitivity, 0.35), 0.9) * legacy.microphone.thresholdSlope;
  for (const percent of [35, 65, 90]) assert.ok(Math.abs(MicrophoneThreshold(percent) - threshold(percent / 100)) < 1e-12, `${percent}%`);
  assert.equal(ToMeterLevel(0.05), 0.05 * legacy.microphone.meterGain);
  assert.equal(ToMeterLevel(0.5), 1);
  const detector = CreateMicrophoneTapDetector(65);
  const level = MicrophoneThreshold(65);
  const frames = [[1000, 0.01, 0.5], [1016, level + 0.01, 0.4], [1032, level + 0.01, 0.4], [1100, level * 0.5, 0.2],
    [1200, level + 0.01, 0.2], [1340, level + 0.01, 0.2], [1356, level * 0.5, 0.2], [1700, level + 0.02, 0.2]];
  assert.deepEqual(frames.map(([timestamp, rms, highRatio]) => detector.Update({ timestamp, rms, highRatio })),
    [null, { onset: true }, null, { action: 'clap', delayMs: 84 }, null, { onset: true }, { action: 'thigh', delayMs: 16 }, { onset: true }],
    'One loud sound counts once; it re-arms below 62% of the threshold and waits out the cooldown.');
});

test('a sound is sorted by its dullest frame near peak loudness in the first 50 ms and timed from where it started', async () => {
  const { CreateMicrophoneTapDetector, MicrophoneThreshold, microphoneDetection } = await LoadLogic();
  assert.equal(microphoneDetection.decisionMs, 50);
  assert.equal(microphoneDetection.loudRatio, 0.7);
  const level = MicrophoneThreshold(70);
  const sound = frames => {
    const detector = CreateMicrophoneTapDetector(70);
    return frames.map(([timestamp, rms, highRatio]) => detector.Update({ timestamp, rms, highRatio }));
  };
  // Recorded in the Brave check: the first frame of a low thud holds only its start, which reads as bright.
  assert.deepEqual(sound([[42570, 0.274, 0.534], [42578, 0.461, 0.375], [42595, 0.466, 0.083], [42612, 0.347, 0], [42620, 0.271, 0]]),
    [{ onset: true }, null, null, null, { action: 'thigh', delayMs: 50 }]);
  // Also recorded: the proxy smooths the spectrum but not the level, so the loudest frame of this 110 Hz thud still
  // read 0.353 (over the clap line) while the next frame, nearly as loud, read 0.044.
  assert.deepEqual(sound([[42865, 0.253, 0.597], [42874, 0.253, 0.597], [42882, 0.422, 0.496], [42890, 0.47, 0.353], [42899, 0.413, 0.044],
    [42907, 0.361, 0], [42915, 0.298, 0]]), [{ onset: true }, null, null, null, null, null, { action: 'thigh', delayMs: 50 }]);
  assert.deepEqual(sound([[39170, 0.215, 0.612], [39187, 0.329, 0.618], [39195, 0.338, 0.617], [39220, 0.193, 0.622]]),
    [{ onset: true }, null, null, { action: 'clap', delayMs: 50 }]);
  assert.deepEqual(sound([[1000, level * 2, 0.6], [1016, level * 3, 0.1], [1032, level * 0.5, 0.1], [1500, level * 2, 0.6]]),
    [{ onset: true }, null, { action: 'thigh', delayMs: 32 }, { onset: true }], 'A sound that fades early is sorted as soon as it ends.');
});

test('a sound that starts inside the response window still counts after the window closes', async () => {
  const { CreateResponseWindow } = await LoadLogic();
  const clock = FakeClock();
  const responses = CreateResponseWindow(clock);
  const timed = responses.WaitForResponse(1800);
  await clock.advance(300);
  responses.Emit('clap', 'microphone', 25);
  assert.deepEqual(await timed, { action: 'clap', rtMs: 275, source: 'microphone' });
  const late = responses.WaitForResponse(1800);
  await clock.advance(1790);
  responses.Hold(50);
  await clock.advance(40);
  assert.equal(responses.Emit('clap', 'keyboard'), false, 'A key press after 1800 ms is still too late.');
  assert.equal(responses.Emit('thigh', 'microphone', 40), true);
  assert.deepEqual(await late, { action: 'thigh', rtMs: 1790, source: 'microphone' });
  const unsorted = responses.WaitForResponse(1800);
  await clock.advance(1790);
  responses.Hold(50);
  await clock.advance(49);
  let settled = false;
  void unsorted.then(() => { settled = true; });
  await clock.advance(0);
  assert.equal(settled, false, 'The window stays open while the sound is being sorted.');
  await clock.advance(1);
  assert.equal(await unsorted, null);
  let earlySettled = false;
  const early = responses.WaitForResponse(1800);
  void early.then(() => { earlySettled = true; });
  responses.Hold(50);
  await clock.advance(1799);
  assert.equal(earlySettled, false, 'A sound early in the window does not shorten it.');
  await clock.advance(1);
  assert.equal(await early, null);
});

test('results keep the legacy summary and round keys and add the ball, action, outcome and source codes', async () => {
  const core = await Load('logic/everyBallResponse.ts');
  const { BuildGameScore } = await Load('score.ts');
  const response = (action, rtMs) => ({ action, rtMs, source: 'touch' });
  const rows = [
    core.GradeEveryBallTrial(Plan(2, 'basketball', 1), response('clap', 123.8)),
    core.GradeEveryBallTrial(Plan(2, 'soccer', 2), response('clap', 212)),
    core.GradeEveryBallTrial(Plan(2, 'tennis', 3), null),
    core.GradeEveryBallTrial(Plan(2, 'basketball', 4), null),
  ];
  const score = BuildGameScore(core.SummarizeEveryBallTrials(rows, 2));
  assert.equal(score.schema, 'rehab-trainer.game-score/v1');
  assert.equal(score.gameId, 'every-ball-response');
  assert.deepEqual(Object.keys(score.summary), legacy.score.summary.map(field => field.key));
  assert.deepEqual(score.summary, { trials: 4, correct: 2, accuracy: 50, misses: 1, falseAlarms: 1, wrongActions: 0, responseMs: 124 });
  assert.deepEqual(Object.keys(score.rounds[0]).slice(0, legacy.score.columns.length), legacy.score.columns.map(field => field.key));
  assert.deepEqual(score.rounds.map(row => ({ ...row })), [
    { trial: 1, level: 2, correct: 1, responseMs: 124, fixationMs: 2000, ball: 0, expected: 1, response: 1, outcome: 0, source: 4 },
    { trial: 2, level: 2, correct: 0, responseMs: 212, fixationMs: 2000, ball: 1, expected: 0, response: 1, outcome: 3, source: 4 },
    { trial: 3, level: 2, correct: 1, responseMs: null, fixationMs: 2000, ball: 2, expected: 0, response: 0, outcome: 1, source: 0 },
    { trial: 4, level: 2, correct: 0, responseMs: null, fixationMs: 2000, ball: 0, expected: 1, response: 0, outcome: 2, source: 0 },
  ]);
  assert.ok(score.rounds.every(row => Object.keys(row).length <= 12));
  assert.equal(IsGameResult({ config: { difficulty: 'medium', rounds: 20, inputMode: 'camera', fixationStyle: 'cross', soundSensitivity: 65 },
    score: { schema: score.schema, gameId: score.gameId, summary: score.summary, rounds: score.rounds } }, 'every-ball-response'), true);
});

test('only well-formed pose and sound frames from the container reach the game', async () => {
  const { AcceptSensorInput } = await Load('runtime/sensorInput.ts');
  const state = { sessionNonce: nonce, sequence: -1 };
  let sequence = 0;
  const message = (type, payload, patch = {}) => ({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: sequence++, type, payload, ...patch });
  const body = [0, 1, 2, 3].map(index => ({ x: 0.4 + index / 10, y: 0.6, z: 0 }));
  for (const payload of [PoseFrame(1, [Hand(0.2, 0.3), Hand(0.6, 0.3)], body), PoseFrame(2, [], []), { timestamp: 3, rms: 0.04, highRatio: 0.31 }]) {
    assert.equal(AcceptSensorInput(message('frame', payload), state), true, JSON.stringify(payload).slice(0, 60));
  }
  assert.equal(AcceptSensorInput(message('ready', {}), state), true);
  for (const reason of ['permission', 'unsupported', 'disconnected', 'initialization']) assert.equal(AcceptSensorInput(message('error', { reason }), state), true);
  for (const payload of [
    PoseFrame(4, [Hand(0.2, 0.3), Hand(0.3, 0.3), Hand(0.4, 0.3)]), PoseFrame(4, [Hand(0.2, 0.3).slice(1)]), PoseFrame(4, [], body.slice(2)),
    { ...PoseFrame(4, []), extra: 1 }, PoseFrame(4, [[...Hand(0.2, 0.3).slice(1), { x: NaN, y: 0, z: 0 }]]), { ...PoseFrame(4, []), videoWidth: 0 },
    { timestamp: 5, rms: -0.1, highRatio: 0.3 }, { timestamp: 5, rms: 0.1, highRatio: 1.2 }, { timestamp: -1, rms: 0.1, highRatio: 0.2 },
  ]) assert.equal(AcceptSensorInput(message('frame', payload), state), false, JSON.stringify(payload).slice(0, 80));
  assert.equal(AcceptSensorInput(message('error', { reason: 'other' }), state), false);
  assert.equal(AcceptSensorInput(message('frame', PoseFrame(6, []), { sessionNonce: 'b'.repeat(64) }), state), false, 'Another session is ignored.');
  const replay = message('ready', {});
  assert.equal(AcceptSensorInput(replay, state), true);
  assert.equal(AcceptSensorInput(replay, state), false, 'A repeated sequence is ignored.');
});

async function LoadBridge() {
  const listeners = new Map();
  const events = [];
  const parent = {};
  const window = {
    parent, addEventListener: (name, listener) => listeners.set(name, [...(listeners.get(name) ?? []), listener]),
    removeEventListener: (name, listener) => listeners.set(name, (listeners.get(name) ?? []).filter(item => item !== listener)),
    dispatchEvent: event => { events.push(event.type); for (const listener of listeners.get(event.type) ?? []) listener(event); },
    setTimeout, clearTimeout,
  };
  const document = { referrer: 'https://trainerhub.cc/', fullscreenElement: null, exitFullscreen: async () => events.push('document-exit') };
  const sent = [];
  const module = { exports: {} };
  const sensorInput = await Load('runtime/sensorInput.ts');
  new Function('require', 'module', 'exports', 'window', 'document', 'CustomEvent', 'Event', ts.transpileModule(await readFile(resolve(gameRoot, 'runtime/hubBridge.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => ({ '../package.json': { version: '2.0.0' }, './soundManager': { DisposeAudioFeedback: () => sent.push('stop-audio') }, './sensorInput': sensorInput })[name],
  module, module.exports, window, document, CustomEvent, Event);
  const api = module.exports;
  api.InstallHubBridge();
  const port = { start() {}, postMessage: message => sent.push(message) };
  for (const listener of listeners.get('message')) listener({ source: parent, origin: 'https://trainerhub.cc', ports: [port], data: {
    schema: 'trainerhub.game/v1', type: 'init', gameId: 'every-ball-response', version: '2.0.0', sessionNonce: nonce, language: 'zh' } });
  let inputSequence = 0;
  const deliver = data => port.onmessage({ data });
  return {
    api, sent, events, deliver,
    input: (type, payload) => deliver({ schema: 'trainerhub.input/v1', sessionNonce: nonce, sequence: inputSequence++, type, payload }),
    fullscreen: active => deliver({ schema: 'trainerhub.game/v1', type: 'fullscreen', sessionNonce: nonce, active }),
    types: () => sent.map(message => typeof message === 'string' ? message : message.type),
  };
}

test('the bridge asks the container for one sensor, its preview window and fullscreen, and every message passes the container check', async () => {
  const bridge = await LoadBridge();
  const { api, sent } = bridge;
  const starting = api.StartSensorInput('pose');
  assert.deepEqual(sent.at(-1).payload, { input: 'pose' });
  bridge.input('ready', {});
  await starting;
  const failing = api.StartSensorInput('microphone');
  bridge.input('error', { reason: 'permission' });
  await assert.rejects(failing, /permission/);
  // Both edges are rounded, so the window can never reach past the frame and fail the container check.
  assert.deepEqual(api.ToPreviewRect({ left: 900, top: 540, width: 300, height: 225 }, 1200, 800), { x: 0.75, y: 0.675, width: 0.25, height: 0.2813 });
  assert.deepEqual(api.ToPreviewRect({ left: 1190, top: -10, width: 300, height: 40 }, 1200, 800), { x: 0.9917, y: 0, width: 0.0083, height: 0.0375 },
    'A window partly outside the frame is clipped to it.');
  api.SetInputPreview({ x: 0.75, y: 0.675, width: 0.25, height: 0.28125 });
  assert.deepEqual(sent.at(-1).payload, { visible: true, x: 0.75, y: 0.675, width: 0.25, height: 0.28125 });
  api.SetInputPreview(null);
  assert.deepEqual(sent.at(-1).payload, { visible: false, x: 0, y: 0, width: 0, height: 0 });
  const entering = api.RequestContainerFullscreen();
  assert.equal(sent.at(-1).type, 'fullscreen-request');
  bridge.deliver({ schema: 'trainerhub.game/v1', type: 'fullscreen', sessionNonce: 'b'.repeat(64), active: true });
  assert.equal(api.IsContainerFullscreen(), false, 'Another session cannot change the fullscreen state.');
  bridge.fullscreen(true);
  assert.equal(await entering, true);
  assert.equal(api.IsContainerFullscreen(), true);
  api.StopSensorInput();
  const state = { gameId: 'every-ball-response', version: '2.0.0', sessionNonce: nonce, sequence: -1, complete: false,
    capabilities: ['audio', 'fullscreen', 'keyboard', 'microphone-level', 'pointer', 'pose-tracking', 'settings-storage', 'touch'] };
  for (const message of sent.filter(item => typeof item === 'object')) assert.equal(AcceptGameMessage(message, state), true, message.type);
});

test('leaving the game stops audio and the sensor, waits for the container to leave fullscreen, then exits', async () => {
  const bridge = await LoadBridge();
  bridge.fullscreen(true);
  const leaving = bridge.api.ExitGame();
  await new Promise(done => setImmediate(done));
  assert.deepEqual(bridge.types().slice(1), ['stop-audio', 'input-stop', 'fullscreen-exit'], 'The container stays mounted until fullscreen ends.');
  bridge.fullscreen(false);
  await leaving;
  assert.equal(bridge.types().at(-1), 'exit');
});

test('the camera or microphone is enabled windowed, and a fresh Start click enters fullscreen before the run', async () => {
  const sensor = Deferred();
  const fullscreen = Deferred();
  const actions = [];
  const context = {
    phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false },
    settings: { inputMode: 'microphone' }, ValidateSettings: () => true, labels: {},
    setPhase: phase => { context.phaseRef.current = phase; actions.push(`phase:${phase}`); }, setError() {},
    setSensorReady: ready => actions.push(`ready:${ready}`),
    StartSensorInput: input => { actions.push(`sensor:${input}`); return sensor.promise; },
    RequestContainerFullscreen: () => { actions.push('fullscreen'); return fullscreen.promise; },
    ExitContainerFullscreen: async () => actions.push('exit-fullscreen'),
    PrepareAudioFeedback: () => actions.push('audio'), beginRun: () => actions.push('run'),
    showConfiguration() {}, InputErrorMessage: () => '',
  };
  const start = await LoadFunction('EveryBallGame.tsx', 'startTraining', context);
  const enabling = start();
  assert.deepEqual(actions, ['phase:initializing', 'sensor:microphone'], 'The permission prompt appears outside fullscreen.');
  sensor.resolve();
  await enabling;
  assert.deepEqual(actions.slice(2), ['ready:true', 'phase:rules'], 'Loading ends on the confirmation so the next click has user activation.');
  const starting = start();
  assert.deepEqual(actions.slice(4), ['audio', 'fullscreen']);
  fullscreen.resolve(true);
  await starting;
  assert.deepEqual(actions.slice(6), ['run']);

  const cancelled = { ...context, phaseRef: { current: 'rules' }, generationRef: { current: 0 }, sensorReadyRef: { current: false } };
  const pending = Deferred();
  const cancelledActions = [];
  Object.assign(cancelled, { StartSensorInput: () => pending.promise, setPhase: phase => { cancelled.phaseRef.current = phase; },
    setSensorReady: () => cancelledActions.push('ready'), RequestContainerFullscreen: async () => cancelledActions.push('fullscreen') });
  const cancelledStart = await LoadFunction('EveryBallGame.tsx', 'startTraining', cancelled);
  const waiting = cancelledStart();
  cancelled.generationRef.current++;
  pending.resolve();
  await waiting;
  assert.deepEqual(cancelledActions, [], 'Going back during the permission prompt cannot mark the sensor ready or enter fullscreen.');
});

function Deferred() {
  let resolvePromise;
  const promise = new Promise(done => { resolvePromise = done; });
  return { promise, resolve: resolvePromise };
}

test('the ball sits where the legacy stage put it on wide, tall and short screens', async () => {
  const { BallPlacement } = await Load('scenePlacement.ts');
  assert.deepEqual(BallPlacement(1200, 800, 0.5, 0.47), { x: 600, y: 376, radius: 104 });
  assert.deepEqual(BallPlacement(390, 844, 0.5, 0.3), { x: 195, y: 844 * 0.42, radius: 390 * 0.13 }, 'Phones keep the ball below the HUD.');
  assert.deepEqual(BallPlacement(844, 390, 0.5, 0.3), { x: 422, y: 390 * 0.38, radius: 390 * 0.13 });
  assert.equal(BallPlacement(1200, 800, 0.5, 0.99).y, 800 - 104 * 1.5, 'The label below the ball stays on screen.');
});

test('Every Ball owns its runtime, catalogue entry and results without Hub or camera code', async () => {
  const pkg = JSON.parse(await readFile(resolve(gameRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@rehab-trainer/game-every-ball-response');
  assert.equal(pkg.version, '2.0.0');
  for (const name of ['react', 'react-dom', 'jspsych', 'pixi.js', 'tone']) assert.ok(pkg.dependencies[name], name);
  assert.equal(pkg.dependencies['@rehab-trainer/ui'], undefined);
  assert.deepEqual(pkg.rehabTrainer.capabilities, ['audio', 'fullscreen', 'keyboard', 'microphone-level', 'pointer', 'pose-tracking', 'settings-storage', 'touch']);
  for (const file of await readdir(gameRoot, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(file) || /^(dist|node_modules)[\\/]/.test(file)) continue;
    const source = await readFile(resolve(gameRoot, file), 'utf8');
    assert.doesNotMatch(source, /@rehab-trainer\/|packages\/ui|localStorage|SaveTrainingRecord|react-router-dom|GetAuth|subjectId/, file);
    assert.doesNotMatch(source, /getUserMedia|mediaDevices|tasks-vision|createAnalyser|<video/, `${file}: the container owns the camera and microphone.`);
    if (/\.tsx?$/.test(file)) assert.doesNotMatch(source, /#[0-9a-f]{3,6}\b|rgba?\(\s*\d|0x[0-9a-f]{6}/i, `${file}: colors come from CSS tokens.`);
    assert.doesNotMatch(source, /評估|測驗|診斷|治療|療效|[Aa]ssessment|[Dd]iagnos|[Tt]reat/, `${file}: practice wording only.`);
  }
  for (const name of ['settings.json', 'score.json', 'EveryBallResponsePage.tsx', 'styles/EveryBallResponsePage.css']) {
    await assert.rejects(access(resolve(gameRoot, name)), name);
  }
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  assert.equal(registry['every-ball-response'].origin, 'https://trainerhubgames.rainbowh9490.workers.dev');
  const metadata = JSON.parse(await readFile(resolve(gameRoot, 'public/game.json'), 'utf8'));
  assert.deepEqual([metadata.gameId, metadata.trainer, metadata.category], ['every-ball-response', 'brain', 'attention']);
  assert.equal(metadata.copy['zh-TW'].title, '有球必應');
  assert.equal(metadata.copy.en.title, 'Every Ball Gets a Response');
  assert.equal(createHash('sha256').update(await readFile(resolve(gameRoot, 'public', metadata.preview))).digest('hex'), legacy.previewSha256);
  for (const copy of Object.values(metadata.copy)) assert.doesNotMatch(`${copy.title} ${copy.description}`, /治療|診斷|療效|改善|評估|測驗|treat|diagnos|improve|assess/i);
  const css = await readFile(resolve(gameRoot, 'game.css'), 'utf8');
  assert.match(css, /color-scheme: light/, 'The transparent camera window needs the same color scheme as the container.');
  for (const token of ['--every-ball-field', '--every-ball-basketball', '--every-ball-soccer', '--every-ball-tennis', '--every-ball-correct', '--every-ball-wrong', '--every-ball-hand']) {
    assert.match(css, new RegExp(`${token}:`), token);
  }
  const source = await readFile(resolve(gameRoot, 'EveryBallGame.tsx'), 'utf8');
  assert.match(source, /<ScoreAnalysis rounds=\{score\.rounds\}/);
  assert.match(source, /SetInputPreview\(/);
  assert.match(source, /RequestContainerFullscreen\(/);
  assert.doesNotMatch(source, /requestFullscreen\(/, 'The container enters fullscreen so the camera window stays visible.');
});

test('spotlights cover the ball rules, the trial timing, the camera window or sound meter, the buttons and the progress bar', async () => {
  const { GetEveryBallTutorialSteps } = await Load('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) {
    assert.deepEqual(GetEveryBallTutorialSteps(language, 'camera', 2).map(step => step.target),
      ['.every-ball-rule-cards', '.every-ball-trial-preview', '.every-ball-camera', '.every-ball-actions', '.every-ball-hud']);
    assert.deepEqual(GetEveryBallTutorialSteps(language, 'microphone', 2).map(step => step.target),
      ['.every-ball-rule-cards', '.every-ball-trial-preview', '.every-ball-meter', '.every-ball-actions', '.every-ball-hud']);
    const texts = [1, 2, 3].map(level => GetEveryBallTutorialSteps(language, 'camera', level)[0].text);
    assert.equal(new Set(texts).size, 3, 'Each level explains its own rule.');
    const steps = GetEveryBallTutorialSteps(language, 'microphone', 3);
    assert.equal(new Set(steps.map(step => step.text)).size, steps.length);
    assert.ok(steps.every(step => step.title && step.text && step.place));
  }
});

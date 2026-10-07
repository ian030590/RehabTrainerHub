import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = new URL('../apps/rehabtrainerhub/games/every-ball-response/', import.meta.url);

async function ImportCore() {
  const source = await readFile(new URL('logic/everyBallResponse.ts', gameRoot), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const plan = (levelId, ball, trialNumber = 1) => ({
  levelId, ball, trialNumber, expectedAction: ball === 'basketball' ? 'clap' : ball === 'soccer' && levelId === 3 ? 'thigh' : 'none',
  fixationMs: 2000, xRatio: 0.5, yRatio: 0.47,
});
const response = (action, rtMs = 321.5, source = 'touch') => ({ action, rtMs, source });

test('Every Ball keeps its fixation, visible stimulus, blank response, and feedback timing', async () => {
  const { everyBallTiming } = await ImportCore();
  assert.deepEqual(everyBallTiming, {
    fixationMinMs: 1000, fixationMaxMs: 3000, stimulusMs: 900,
    responseWindowMs: 1800, feedbackMs: 550,
  });
  assert.ok(everyBallTiming.responseWindowMs > everyBallTiming.stimulusMs,
    'responses remain allowed during the blank interval after the ball disappears');
});

test('Every Ball level 1 uses only basketballs with clap response', async () => {
  const { CreateEveryBallPlans } = await ImportCore();
  const plans = CreateEveryBallPlans(1, 5, () => 0.5);
  assert.deepEqual(plans.map(item => item.trialNumber), [1, 2, 3, 4, 5]);
  assert.ok(plans.every(item => item.levelId === 1 && item.ball === 'basketball' && item.expectedAction === 'clap'));
  assert.ok(plans.every(item => item.fixationMs === 2000 && item.xRatio === 0.5 && item.yRatio === 0.47));
  assert.deepEqual(CreateEveryBallPlans(1, 5, () => 0.5), plans, 'seeded random input must be reproducible');
});

test('Every Ball levels 2 and 3 keep target proportions, distractors, and action mappings', async () => {
  const { CreateEveryBallPlans, GetExpectedAction } = await ImportCore();
  const countBalls = plans => Object.fromEntries(['basketball', 'soccer', 'tennis', 'beach']
    .map(ball => [ball, plans.filter(item => item.ball === ball).length]));
  assert.deepEqual(countBalls(CreateEveryBallPlans(2, 20, () => 0.5)), {
    basketball: 11, soccer: 3, tennis: 3, beach: 3,
  });
  assert.deepEqual(countBalls(CreateEveryBallPlans(3, 20, () => 0.5)), {
    basketball: 6, soccer: 6, tennis: 4, beach: 4,
  });
  assert.equal(CreateEveryBallPlans(2, 5, () => 0.5).filter(item => item.ball === 'basketball').length, 3);
  assert.equal(CreateEveryBallPlans(3, 60, () => 0.5).filter(item => item.expectedAction !== 'none').length, 37);
  for (const levelId of [1, 2, 3]) {
    assert.equal(GetExpectedAction(levelId, 'basketball'), 'clap');
    assert.equal(GetExpectedAction(levelId, 'soccer'), levelId === 3 ? 'thigh' : 'none');
    assert.equal(GetExpectedAction(levelId, 'tennis'), 'none');
    assert.equal(GetExpectedAction(levelId, 'beach'), 'none');
  }
});

test('Every Ball keeps 1–3 second fixation and a safe ball position for all configured round limits', async () => {
  const { CreateEveryBallPlans } = await ImportCore();
  for (const levelId of [1, 2, 3]) {
    for (const rounds of [5, 20, 60]) {
      const plans = CreateEveryBallPlans(levelId, rounds, () => 0.99);
      assert.equal(plans.length, rounds);
      assert.ok(plans.every(item => item.fixationMs >= 1000 && item.fixationMs <= 3000));
      assert.ok(plans.every(item => item.xRatio >= 0.28 && item.xRatio <= 0.72));
      assert.ok(plans.every(item => item.yRatio >= 0.3 && item.yRatio <= 0.64));
      assert.deepEqual(plans.map(item => item.trialNumber), Array.from({ length: rounds }, (_, index) => index + 1));
    }
  }
});

test('Every Ball grades hit, correct reject, miss, false alarm, and wrong action', async () => {
  const { GradeEveryBallTrial } = await ImportCore();
  const hit = GradeEveryBallTrial(plan(3, 'basketball'), response('clap'));
  assert.deepEqual(hit, {
    Trial_Number: 1, Level: 3, Ball: 'basketball', Expected_Action: 'clap',
    Response_Action: 'clap', Response_Source: 'touch', Outcome: 'hit',
    Correct: true, Reaction_Time_ms: 322, Fixation_ms: 2000,
  });
  const reject = GradeEveryBallTrial(plan(2, 'tennis'), null);
  assert.equal(reject.Outcome, 'correct_reject');
  assert.equal(reject.Reaction_Time_ms, null);
  assert.equal(reject.Response_Action, '');
  assert.equal(GradeEveryBallTrial(plan(1, 'basketball'), null).Outcome, 'miss');
  assert.equal(GradeEveryBallTrial(plan(2, 'beach'), response('clap')).Outcome, 'false_alarm');
  assert.equal(GradeEveryBallTrial(plan(3, 'soccer'), response('clap')).Outcome, 'wrong_action');
  assert.equal(GradeEveryBallTrial(plan(3, 'soccer'), response('thigh')).Outcome, 'hit');
});

test('Every Ball summary counts outcomes, times only correct actions, and applies level pass marks', async () => {
  const { GradeEveryBallTrial, SummarizeEveryBallTrials } = await ImportCore();
  const rows = [
    GradeEveryBallTrial(plan(3, 'basketball', 1), response('clap', 100)),
    GradeEveryBallTrial(plan(3, 'soccer', 2), response('thigh', 301)),
    GradeEveryBallTrial(plan(3, 'tennis', 3), null),
    GradeEveryBallTrial(plan(3, 'beach', 4), response('clap', 40)),
    GradeEveryBallTrial(plan(3, 'soccer', 5), response('clap', 80)),
    GradeEveryBallTrial(plan(3, 'basketball', 6), null),
  ];
  const summary = SummarizeEveryBallTrials(rows, 3);
  assert.equal(summary.total, 6);
  assert.equal(summary.correct, 3);
  assert.equal(summary.accuracy, 50);
  assert.equal(summary.averageRtMs, 201, 'correct rejects and incorrect actions have no correct-action latency');
  assert.equal(summary.misses, 1);
  assert.equal(summary.falseAlarms, 1);
  assert.equal(summary.wrongActions, 1);
  assert.equal(summary.passed, false);
  for (const [levelId, correctCount, pass] of [[1, 5, true], [1, 4, false], [2, 17, true], [2, 16, false], [3, 4, true], [3, 3, false]]) {
    const total = levelId === 2 ? 20 : 5;
    const sample = Array.from({ length: total }, (_, index) => GradeEveryBallTrial(
      plan(levelId, 'basketball', index + 1), index < correctCount ? response('clap', 100) : null,
    ));
    assert.equal(SummarizeEveryBallTrials(sample, levelId).passed, pass, `${levelId}: ${correctCount}/${total}`);
  }
  assert.equal(SummarizeEveryBallTrials([GradeEveryBallTrial(plan(2, 'beach'), null)], 2).averageRtMs, null);
});

test('Every Ball score maps all five trial and seven summary fields from real records', async () => {
  const { GradeEveryBallTrial, SummarizeEveryBallTrials, BuildEveryBallScore } = await ImportCore();
  const scoreJson = JSON.parse(await readFile(new URL('score.json', gameRoot), 'utf8'));
  const scoreSource = await readFile(new URL('../packages/ui/src/gameScore.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(scoreSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { ParseGameScoreDefinition, BuildGameScore } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
  const rows = [
    GradeEveryBallTrial(plan(2, 'basketball', 1), response('clap', 123.8)),
    GradeEveryBallTrial(plan(2, 'soccer', 2), response('clap', 212)),
    GradeEveryBallTrial(plan(2, 'tennis', 3), null),
    GradeEveryBallTrial(plan(2, 'basketball', 4), null),
  ];
  const summary = SummarizeEveryBallTrials(rows, 2);
  const score = BuildGameScore(ParseGameScoreDefinition(scoreJson), BuildEveryBallScore(summary));
  assert.deepEqual(score.rounds.map(row => ({ ...row })), [
    { trial: 1, level: 2, correct: 1, responseMs: 124, fixationMs: 2000 },
    { trial: 2, level: 2, correct: 0, responseMs: 212, fixationMs: 2000 },
    { trial: 3, level: 2, correct: 1, responseMs: null, fixationMs: 2000 },
    { trial: 4, level: 2, correct: 0, responseMs: null, fixationMs: 2000 },
  ]);
  assert.deepEqual({ ...score.summary }, {
    trials: 4, correct: 2, accuracy: 50, misses: 1,
    falseAlarms: 1, wrongActions: 0, responseMs: 124,
  });
});

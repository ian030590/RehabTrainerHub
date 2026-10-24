import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const gamesRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games');
const cases = [
  { id: 'seagull-flight', defaultMetric: 'passed', alternate: 'headAngle', row: { ring: 1, passed: 2, side: 1, headAngle: 14, offset: 40, altitude: 60 } },
  { id: 'hart-chart', defaultMetric: 'accuracy', alternate: 'attempts', row: { accuracy: 2, durationMs: 1000, targets: 10, attempts: 12, hints: 0 } },
  { id: 'driving-rehab', defaultMetric: 'rt', alternate: 'avoided', row: { rt: 2, avoided: 1, responded: 1, collision: 0, distance: 12, otherCollision: 0 } },
  { id: 'reading-training', defaultMetric: 'responseMs', alternate: 'correct',
    row: { question: 1, correct: 1, responseMs: 2, choice: 0, expectedChoice: 0, options: 4 } },
  { id: 'gabor-patching', defaultMetric: 'reactionMs', alternate: 'points',
    row: { patch: 1, type: 0, outcome: 1, spawnedMs: 0, endedMs: 2, reactionMs: 2, points: 4, lifetimeMs: 4000 } },
  { id: 'moving-card', defaultMetric: 'searchMs', alternate: 'errors',
    row: { completed: 1, searchMs: 2, attempts: 1, errors: 0 } },
  { id: 'motor-cortex-rehab', defaultMetric: 'accuracy', alternate: 'holdSeconds',
    row: { event: 1, outcome: 1, atSeconds: 1, holdSeconds: .8, targetSize: 132, level: 1, accuracy: 2 } },
  { id: 'drawing-defense', defaultMetric: 'reactionSeconds', alternate: 'defeated',
    row: { enemyNumber: 1, shape: 0, reactionSeconds: 2, defeated: 1 } },
  { id: 'asteroid-shield', defaultMetric: 'elapsed', alternate: 'score',
    row: { object: 1, type: 0, outcome: 0, elapsed: 2, damage: 0, hp: 10, speedLevel: 1, spawnedAt: 0, score: 10, controlSource: 0 } },
  { id: 'gesture-battler', defaultMetric: 'similarityPercent', alternate: 'enemyHpAfter',
    row: { kind: 1, castNumber: 1, gesture: 1, targetGesture: null, similarityPercent: 2, castTimeSeconds: 3, enemyHpAfter: 4 } },
  { id: 'sart', defaultMetric: 'rtMs', alternate: 'correct', row: { trial: 1, digit: 3, noGo: 0, responded: 1, correct: 1, rtMs: 2 } },
  { id: 'schulte-grid', defaultMetric: 'timeMs', alternate: 'errors', row: { round: 1, gridSize: 5, timeMs: 2, errors: 0, meanStepMs: 3 } },
  { id: 'hex-schulte', defaultMetric: 'timeMs', alternate: 'errors', row: { round: 1, rings: 2, timeMs: 2, errors: 1, centerChecks: 3, centerHits: 2, centerMissed: 1 } },
  { id: 'continuous-performance', defaultMetric: 'rtMs', alternate: 'correct', row: { trial: 1, letterCode: 88, kind: 1, target: 1, responded: 1, correct: 1, rtMs: 2 } },
  { id: 'simon-task', defaultMetric: 'rtMs', alternate: 'correct', row: { trial: 1, shape: 0, side: 1, congruent: 0, response: 0, correct: 1, rtMs: 2 } },
  { id: 'card-sorting', defaultMetric: 'rtMs', alternate: 'correct', row: { trial: 1, rule: 0, cardColor: 1, cardShape: 2, cardCount: 3, chosen: 1, correct: 1, perseverative: 0, category: 1, rtMs: 2 } },
  { id: 'attentional-blink', defaultMetric: 't2Correct', alternate: 't1Correct', row: { trial: 1, lag: 3, t1Position: 6, t1: 3, t2: 7, t1Response: 3, t2Response: 7, t1Correct: 1, t2Correct: 2 } },
  { id: 'time-perception', defaultMetric: 'targetMs', alternate: 'correct', row: { trial: 1, task: 0, targetMs: 2, comparisonMs: null, answerMs: 2300, errorMs: 300, correct: 1 } },
  { id: 'divided-attention', defaultMetric: 'rtMs', alternate: 'correct', row: { problem: 1, a: 3, b: 4, operation: 0, answer: 7, chosen: 7, correct: 1, rtMs: 2, trackingPercent: 80 } },
  { id: 'pattern-memory', defaultMetric: 'load', alternate: 'correct', row: { trial: 1, load: 2, change: 1, saidChanged: 1, correct: 1, rtMs: 900 } },
  { id: 'stroop', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, condition: 1, word: 0, color: 2, response: 2, correct: 1, responseMs: 2, setting: 1500 } },
  { id: 'flanker', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, condition: 1, target: 1, response: 1, correct: 1, responseMs: 2, setting: 1500 } },
  { id: 'go-nogo', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, noGo: 0, color: 0, responded: 1, correct: 1, responseMs: 2, omission: 0, commission: 0, setting: 750 } },
  { id: 'stop-signal', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, shape: 0, target: 0, response: 0, correct: 1, responseMs: 2, stop: 0, stopDelayMs: null, condition: 1, omission: 0, setting: 1850 } },
  { id: 'attention-network-task', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, cue: 0, location: 0, condition: 0, target: 0, response: 0, correct: 1, responseMs: 2, setting: 1700 } },
  { id: 'n-back', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, load: 1, letter: 0, match: 0, response: 1, correct: 1, responseMs: 2, setting: 500 } },
  { id: 'number-letter', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, condition: 2, top: 1, switched: 1, letter: 0, number: 9, response: 0, correct: 1, responseMs: 2, setting: 0 } },
  { id: 'digit-span', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, reverse: 0, load: 3, entered: 3, correct: 1, responseMs: 2, setting: 800 } },
  { id: 'spatial-span', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, reverse: 0, load: 3, entered: 3, correct: 1, responseMs: 2, setting: 1000, board: 5 } },
  { id: 'tower-of-london', defaultMetric: 'problemMs', alternate: 'correct', row: { trial: 1, practice: 0, problem: 0, correct: 1, problemMs: 2, moves: 2, minimumMoves: 2, firstMoveMs: 1500, setting: 20000 } },
  { id: 'reaction-time', defaultMetric: 'responseMs', alternate: 'falseStart', row: { trial: 1, falseStart: 0, responseMs: 2, earlyMs: null, waitMs: 3100 } },
  { id: 'tic-tac-toe', defaultMetric: 'thinkMs', alternate: 'invalidTaps', row: { move: 1, row: 1, col: 2, thinkMs: 2, invalidTaps: 0 } },
  { id: 'connect4', defaultMetric: 'thinkMs', alternate: 'invalidTaps', row: { move: 1, col: 4, height: 1, thinkMs: 2, invalidTaps: 0 } },
  { id: 'hex', defaultMetric: 'thinkMs', alternate: 'invalidTaps', row: { move: 1, row: 2, col: 3, thinkMs: 2, invalidTaps: 0 } },
  { id: 'dots-and-boxes', defaultMetric: 'thinkMs', alternate: 'invalidTaps', row: { move: 1, thinkMs: 2, invalidTaps: 0, boxes: 1 } },
  { id: 'lights-out', defaultMetric: 'thinkMs', alternate: 'lightsOn', row: { move: 1, row: 2, col: 2, thinkMs: 2, lightsOn: 0 } },
  { id: 'sliding-puzzle', defaultMetric: 'thinkMs', alternate: 'misplaced', row: { move: 1, tile: 7, thinkMs: 2, invalidTaps: 1, misplaced: 5 } },
  { id: 'maze', defaultMetric: 'thinkMs', alternate: 'distanceLeft', row: { move: 1, row: 1, col: 2, thinkMs: 2, invalidTaps: 0, distanceLeft: 7 } },
  { id: 'sudoku', defaultMetric: 'thinkMs', alternate: 'blanksLeft', row: { move: 1, row: 1, col: 2, value: 1, thinkMs: 2, blanksLeft: 5 } },
  { id: 'memory-match', defaultMetric: 'thinkMs', alternate: 'matchedPairs', row: { move: 1, thinkMs: 2, matched: 1, matchedPairs: 1 } },
  { id: 'simon-says', defaultMetric: 'length', alternate: 'correct', row: { trial: 1, length: 2, correct: 1, correctTaps: 2, recallMs: 900 } },
  { id: 'whack-a-mole', defaultMetric: 'responseMs', alternate: 'outcome', row: { trial: 1, outcome: 1, responseMs: 2, targetIndex: 4, tappedIndex: 4 } },
  { id: 'minesweeper', defaultMetric: 'thinkMs', alternate: 'opened', row: { move: 1, action: 1, row: 1, col: 1, thinkMs: 2, opened: 9, safeLeft: 23 } },
  { id: 'antisaccade', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, practice: 0, location: 1, arrow: 1, response: 1, correct: 1, omission: 0, responseMs: 2, setting: 150 } },
  { id: 'keep-track', defaultMetric: 'responseMs', alternate: 'correctItems', row: { trial: 1, practice: 0, correct: 1, responseMs: 2, setting: 1500, load: 3, correctItems: 3, requiredItems: 3 } },
  { id: 'letter-memory', defaultMetric: 'responseMs', alternate: 'correctItems', row: { trial: 1, practice: 0, correct: 1, responseMs: 2, setting: 2000, load: 7, correctItems: 4, requiredItems: 4 } },
  { id: 'plus-minus', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, question: 1, practice: 0, setting: 30, condition: 0, correct: 1, responseMs: 2, number: 27, response: 30 } },
  { id: 'ufov', defaultMetric: 'exposureMs', alternate: 'responseMs', row: { trial: 1, correct: 1, subtest: 2, axis: 4, exposureMs: 2, requestedMs: 50, responseMs: 800, syncValid: 1, dropped: 0, contrast: 100, angle: 15 } },
  { id: 'every-ball-response', defaultMetric: 'responseMs', alternate: 'correct', row: { trial: 1, level: 2, correct: 1, responseMs: 2, fixationMs: 2000, ball: 0, expected: 1, response: 1, outcome: 0, source: 4 } },
  { id: 'tongue-catch', defaultMetric: 'caught', alternate: 'position', row: { object: 1, caught: 2, position: -62 } },
];

for (const fixture of cases) {
  test(`${fixture.id}: results show statistics, an accessible chart and localized round details`, async () => {
    for (const language of ['zh', 'en']) {
      const view = await LoadAnalysis(fixture.id, {
        language, rounds: [fixture.row, { ...fixture.row, [fixture.defaultMetric]: 4 }],
      });
      const markup = view.render();
      if (fixture.id === 'driving-rehab') assert.doesNotMatch(markup, /答對|題目|煮車/, 'Driving results use event and avoidance labels.');
      assert.match(markup, /<svg[^>]*role="img"[^>]*aria-label=/);
      assert.match(markup, /<h3[^>]*>.*(?:逐回合細節|Round details)/);
      assert.match(markup, /(?:中位數|Median)/);
      assert.match(markup, /(?:樣本標準差|Sample standard deviation)/);
      assert.match(markup, /<dd>3(?:<| )/);
      assert.match(markup, /<table[^>]*aria-label=/);
      assert.equal(RoundCount(markup), 2);
      assert.ok(!markup.includes('undefined') && !markup.includes('NaN'));
      view.find('select').props.onChange({ target: { value: fixture.alternate } });
      assert.match(view.render(), new RegExp(`value="${fixture.alternate}" selected=""`));
    }
  });

  test(`${fixture.id}: chart and table paginate together and metric selection resets to the first page`, async () => {
    const rounds = Array.from({ length: 51 }, (_, index) => ({ ...fixture.row,
      enemyNumber: index + 1, object: index + 1, castNumber: index + 1 }));
    const view = await LoadAnalysis(fixture.id, { language: 'en', rounds });
    assert.equal(RoundCount(view.render()), 50);
    assert.equal(view.find('button', element => element.props.children === 'Previous').props.disabled, true);
    view.find('button', element => element.props.children === 'Next').props.onClick();
    assert.equal(RoundCount(view.render()), 1);
    assert.match(view.render(), /51–51 \/ 51/);
    assert.equal(view.find('button', element => element.props.children === 'Next').props.disabled, true);
    view.find('select').props.onChange({ target: { value: fixture.alternate } });
    assert.equal(RoundCount(view.render()), 50);
    assert.match(view.render(), /1–50 \/ 51/);
  });

  test(`${fixture.id}: missing and zero values remain distinct in the chart, statistics and table`, async () => {
    const view = await LoadAnalysis(fixture.id, { language: 'en', rounds: [
      { ...fixture.row, [fixture.defaultMetric]: 0 },
      { ...fixture.row, [fixture.defaultMetric]: null },
      { ...fixture.row, [fixture.defaultMetric]: 4 },
    ] });
    const markup = view.render();
    assert.match(markup, /<dd>2(?:<| )/);
    assert.match(markup, /<td[^>]*>N\/A<\/td>/);
    const zh = await LoadAnalysis(fixture.id, { language: 'zh', rounds: [{ ...fixture.row, [fixture.defaultMetric]: null }] });
    assert.match(zh.render(), /<td[^>]*>無<\/td>/);
    assert.ok(!markup.includes('\u2014') && !zh.render().includes('\u2014'));
    assert.equal((markup.match(/<circle /g) ?? []).length, 2);
    assert.match(markup, /class="chart-trend" d="M[^L]* M/);
    const empty = await LoadAnalysis(fixture.id, { language: 'en', rounds: [] });
    assert.match(empty.render(), /No numeric values/);
    assert.match(empty.render(), /No round records/);
    assert.doesNotMatch(empty.render(), /<svg|NaN|Infinity/);
    const single = await LoadAnalysis(fixture.id, { language: 'en', rounds: [fixture.row] });
    assert.match(single.render(), /Sample standard deviation<\/dt><dd>N\/A</);
  });
}

test('drawing results use the same numeric rows as the private saved result', async () => {
  const { BuildGameScore } = await LoadModule('drawing-defense', 'score.ts');
  const score = BuildGameScore({ Total_Duration_Seconds: 30, Enemies_Spawned: 2, Enemies_Defeated: 1,
    HP_Remaining: 2, Game_Result: 'Victory', Enemy_Results: [
      { Enemy_Number: 1, Shape: 'circle', Reaction_Time_Seconds: 0, Defeated: true },
      { Enemy_Number: 2, Shape: 'cross', Reaction_Time_Seconds: null, Defeated: false },
    ] });
  assert.equal(score.summary.defeated, 1);
  assert.deepEqual(score.rounds, [
    { enemyNumber: 1, shape: 0, reactionSeconds: 0, defeated: 1 },
    { enemyNumber: 2, shape: 1, reactionSeconds: null, defeated: 0 },
  ]);
});

test('gesture results retain gesture aggregates for saving and chart only individual casts', async () => {
  const { BuildGameScore } = await LoadModule('gesture-battler', 'score.ts');
  const score = BuildGameScore({ Total_Duration_Seconds: 12, Successful_Casts: 1, Interrupted_Holds: 2,
    Enemy_Max_HP: 10, Hold_Duration_Seconds: 2, Strictness_Threshold: 0.7,
    Gesture_Stats: [{ Gesture: 1, Attempts: 3, Successful_Casts: 1, Interrupted_Holds: 2,
      Success_Rate_Percent: 33.3, Average_Similarity_Percent: 88 }],
    Cast_Records: [{ Cast_Number: 1, Gesture: 1, Target_Gesture: null,
      Similarity_Percent: 91, Cast_Time_Seconds: 12, Enemy_HP_After: 9 }] });
  assert.equal(score.rounds[0].kind, 0);
  assert.equal(score.rounds[1].kind, 1);
  const view = await LoadAnalysis('gesture-battler', { language: 'en', rounds: score.rounds });
  assert.equal(RoundCount(view.render()), 1);
  assert.match(view.render(), /<dd>91(?:<| )/);
  assert.doesNotMatch(view.render(), /<td[^>]*>88<\/td>/);
});

async function LoadModule(gameId, file, react = React) {
  const module = { exports: {} };
  const source = await readFile(resolve(gamesRoot, gameId, file), 'utf8');
  const dependencies = { react };
  if (file.endsWith('.tsx')) dependencies['./scoreStatistics'] = await LoadModule(gameId, 'scoreStatistics.ts');
  new Function('require', 'module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText)(name => {
    if (name === 'react/jsx-runtime') return reactRuntime;
    assert.ok(dependencies[name], `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const reactRuntime = await import('react/jsx-runtime');

async function LoadAnalysis(gameId, props) {
  const state = [];
  let cursor = 0;
  let tree;
  const { ScoreAnalysis } = await LoadModule(gameId, 'ScoreAnalysis.tsx', { ...React, useState: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = value; }];
  } });
  return {
    render: () => { cursor = 0; tree = ScoreAnalysis(props); return renderToStaticMarkup(tree); },
    find: (type, predicate = () => true) => {
      const find = element => {
        if (!React.isValidElement(element)) return null;
        if (element.type === type && predicate(element)) return element;
        return React.Children.toArray(element.props.children).map(find).find(Boolean);
      };
      const element = find(tree);
      assert.ok(element, `Missing ${type}`);
      return element;
    },
  };
}

function RoundCount(markup) {
  return (markup.match(/<tbody>(.*?)<\/tbody>/s)?.[1].match(/<tr>/g) ?? []).length;
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const gamesRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games');
const cases = [
  { id: 'motor-cortex-rehab', defaultMetric: 'accuracy', alternate: 'holdSeconds',
    row: { event: 1, outcome: 1, atSeconds: 1, holdSeconds: .8, targetSize: 132, level: 1, accuracy: 2 } },
  { id: 'drawing-defense', defaultMetric: 'reactionSeconds', alternate: 'defeated',
    row: { enemyNumber: 1, shape: 0, reactionSeconds: 2, defeated: 1 } },
  { id: 'asteroid-shield', defaultMetric: 'elapsed', alternate: 'score',
    row: { object: 1, type: 0, outcome: 0, elapsed: 2, damage: 0, hp: 10, speedLevel: 1, spawnedAt: 0, score: 10, controlSource: 0 } },
  { id: 'gesture-battler', defaultMetric: 'similarityPercent', alternate: 'enemyHpAfter',
    row: { kind: 1, castNumber: 1, gesture: 1, targetGesture: null, similarityPercent: 2, castTimeSeconds: 3, enemyHpAfter: 4 } },
];

for (const fixture of cases) {
  test(`${fixture.id}: results show statistics, an accessible chart and localized round details`, async () => {
    for (const language of ['zh', 'en']) {
      const view = await LoadAnalysis(fixture.id, {
        language, rounds: [fixture.row, { ...fixture.row, [fixture.defaultMetric]: 4 }],
      });
      const markup = view.render();
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
    assert.match(markup, /<td[^>]*>—<\/td>/);
    assert.equal((markup.match(/<circle /g) ?? []).length, 2);
    assert.match(markup, /class="chart-trend" d="M[^L]* M/);
    const empty = await LoadAnalysis(fixture.id, { language: 'en', rounds: [] });
    assert.match(empty.render(), /No numeric values/);
    assert.match(empty.render(), /No round records/);
    assert.doesNotMatch(empty.render(), /<svg|NaN|Infinity/);
    const single = await LoadAnalysis(fixture.id, { language: 'en', rounds: [fixture.row] });
    assert.match(single.render(), /Sample standard deviation<\/dt><dd>—/);
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

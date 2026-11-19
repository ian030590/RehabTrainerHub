import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire, registerHooks } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Match Vite and TypeScript's .js-to-.ts resolution for the source modules.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(context.parentURL?.startsWith(new URL('./', import.meta.url).href) &&
      /^\.\.?\//.test(specifier) && specifier.endsWith('.js')
      ? specifier.slice(0, -3) + '.ts' : specifier, context);
  },
});
const { options, defaults, RestoreSettings, ValidateSettings } = await import('./settings.ts');
const { RestoreSettings: RestoreLastSettings } = await import('./runtime/settingsMemory.ts');
const { ModelFor, NeedD, Simulate, Severity, budgets } = await import('./src/physics.ts');
const { RandomFrom, ScenarioFor, ScenarioPlan, MakeRound, Judge, LaneAt } = await import('./src/round.ts');
const { BuildGameScore } = await import('./score.ts');
const { BuildResult } = await import('./src/score.ts');
test.after(() => hooks.deregister());

test('mixed is the default and explicitly saved scenarios still restore', () => {
  assert.equal(defaults.scenario, 'mixed');
  for (const scenario of options.scenario) {
    assert.equal(RestoreLastSettings({ scenario }, defaults, ValidateSettings).scenario, scenario);
  }
});

test('one seeded mixed plan guarantees at least two scored signal rounds', () => {
  const plans = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const plan = ScenarioPlan('mixed', RandomFrom(seed));
    assert.deepEqual(plan, ScenarioPlan('mixed', RandomFrom(seed)));
    assert.equal(plan.length, 6);
    assert.deepEqual(plan.slice(0, 2), ['plain', 'plain']);
    assert.ok(['plain', 'swerve-away'].includes(plan[5]));
    const scored = plan.slice(0, 5);
    assert.ok(scored.filter(scenario => ['swerve-away', 'out-and-back'].includes(scenario)).length >= 2);
    for (let index = 2; index < scored.length; index++) {
      assert.ok(['plain', 'swerve-away', 'out-and-back'].includes(scored[index]));
      assert.notEqual(scored[index], scored[index - 1]);
    }
    plans.add(plan.join(','));
  }
  assert.ok(plans.size > 1);
  for (const scenario of ['plain', 'swerve-away', 'out-and-back']) {
    assert.deepEqual(ScenarioPlan(scenario, RandomFrom(1)), Array(6).fill(scenario));
  }
});

test('projection keeps the measured car size on full-width desktop and phone screens', async () => {
  const { SceneMetrics, ProjectPoint, laneDividers, eyeOffset } = await import('./src/projection.ts');
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= expected * .12, `${actual} vs ${expected}`);
  for (const [width, height, sedanWidth] of [[1280, 800, 53], [390, 844, 52]]) {
    const scene = SceneMetrics(width, height);
    assert.equal(scene.horizon, .445 * height);
    assert.equal(scene.focal, Math.min(2.1 * height, 4.3 * width));
    const z = 55 + eyeOffset;
    const car = ProjectPoint(scene, 0, z);
    near(car.scale * 1.8, sedanWidth);
    assert.ok(car.y - scene.horizon >= 27 && car.y - scene.horizon <= 31);
    const [left, right] = laneDividers.map(lane => ProjectPoint(scene, lane, z).x);
    near(car.x - left, 1.875 * car.scale);
    assert.equal(left + right, width);
  }
  const phone = SceneMetrics(390, 844);
  const nearCarRatio = ProjectPoint(phone, 0, 6.1 + eyeOffset).scale * 1.8 / 390;
  assert.ok(nearCarRatio >= .85 && nearCarRatio <= .95);
  assert.equal(eyeOffset, 2.5);
});

test('the road, shoulders, roadside rows, mountains and dashboard span the ultrawide view', async () => {
  const { SceneMetrics, SceneGeometry, ProjectPoint } = await import('./src/projection.ts');
  const scene = SceneMetrics(2560, 1080);
  const { roadEdge, shoulderEdge, nearZ, railX, railStart, lampStart, mountain, dashboard } = SceneGeometry(scene);
  for (const [distance, depth] of [[roadEdge, nearZ], [shoulderEdge, nearZ], [railX, railStart], [railX, lampStart]]) {
    assert.ok(ProjectPoint(scene, -distance, depth).x <= .001);
    assert.ok(ProjectPoint(scene, distance, depth).x >= scene.width - .001);
  }
  assert.deepEqual([Math.min(...mountain.map(point => point.x)), Math.max(...mountain.map(point => point.x))], [0, scene.width]);
  assert.equal(dashboard.left.x, 0);
  assert.equal(dashboard.right.x, scene.width);
  assert.ok(dashboard.left.y < scene.height && dashboard.right.y < scene.height);
  const middleY = (dashboard.left.y + 2 * dashboard.control.y + dashboard.right.y) / 4;
  assert.ok(Math.abs(middleY - .86 * scene.height) < 1);
  assert.ok(Math.abs(dashboard.centerY - middleY) < .001);
});

test('the sedan grows to 105 percent of the reference scene width and holds its contact size', async () => {
  const { SceneMetrics, ProjectTargetCar, eyeOffset } = await import('./src/projection.ts');
  const { frames } = JSON.parse(readFileSync(new URL('./sprites/cars.json', import.meta.url), 'utf8'));
  const { sedan } = frames;
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const scene = SceneMetrics(width, height);
    const expected = 1.05 * Math.min(width, .7 * height);
    let lastWidth = 0;
    for (const gap of [55, 30, 20, 12, 10, 8, 6.1, 4, 2, 1, 0]) {
      const depth = gap + eyeOffset;
      const car = ProjectTargetCar(scene, 0, depth, sedan.widthMeters, sedan.h / sedan.w, .82 * height);
      const trueWidth = sedan.widthMeters * (scene.focal / depth);
      assert.ok(Math.abs(car.width - Math.min(expected, trueWidth)) < .001);
      assert.ok(car.width >= lastWidth);
      lastWidth = car.width;
    }
    assert.ok(Math.abs(lastWidth - expected) <= expected * .02);
  }
});

test('each possible contact target keeps its lamps in view while the dashboard covers the bumper', async () => {
  const { SceneMetrics, SceneGeometry, ProjectTargetCar, ProjectLamp, VisibleCarRect, eyeOffset } = await import('./src/projection.ts');
  const { frames } = JSON.parse(readFileSync(new URL('./sprites/cars.json', import.meta.url), 'utf8'));
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800],
    [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [667, 375]]) {
    const scene = SceneMetrics(width, height);
    const footer = height < 500 ? 76 : width <= height ? 150 : 105;
    const { dashboard } = SceneGeometry(scene, height - footer);
    for (const key of options.leadType) {
      const frame = frames[key];
      const car = ProjectTargetCar(scene, 0, eyeOffset, frame.widthMeters, frame.h / frame.w, dashboard.centerY);
      const [left, top, visibleWidth] = VisibleCarRect(car, width, height, dashboard);
      assert.ok(car.y + car.height > dashboard.centerY, `${width}x${height} ${key} bumper`);
      const referenceWidth = Math.min(width, .7 * height);
      assert.ok(visibleWidth >= .9 * referenceWidth && visibleWidth <= 1.1 * referenceWidth);
      for (const fractions of Object.values(frame.lamps)) {
        const [x, y, lampWidth, lampHeight] = ProjectLamp(car, fractions);
        assert.ok(x >= left && x + lampWidth <= left + visibleWidth);
        assert.ok(y >= top && y + lampHeight <= dashboard.centerY, `${width}x${height} ${key} lamp`);
      }
    }
  }
});

test('the entire dashboard arc clears the bottom controls with a margin', async () => {
  const { SceneMetrics, SceneGeometry, DashboardTopAt } = await import('./src/projection.ts');
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800],
    [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [667, 375]]) {
    const controlsTop = h - (h < 500 ? 72 : 105);
    const { dashboard } = SceneGeometry(SceneMetrics(w, h), controlsTop);
    assert.equal(DashboardTopAt(dashboard, w / 2), dashboard.centerY);
    assert.ok(dashboard.centerY < dashboard.left.y);
    assert.ok(dashboard.centerY / h >= .77 && dashboard.centerY / h <= .86, `${w}x${h} dashboard height`);
    for (const x of [0, w / 4, w / 2, .75 * w, w]) {
      assert.ok(DashboardTopAt(dashboard, x) <= controlsTop - 5, `${w}x${h} clearance at ${x}`);
    }
  }
});

test('full-width road sits behind a grid with a reserved target row', () => {
  const style = readFileSync(new URL('./game.css', import.meta.url), 'utf8');
  const view = readFileSync(new URL('./RunningView.tsx', import.meta.url), 'utf8');
  assert.match(style, /\.driving\s*\{[^}]*\bwidth:\s*100%;[^}]*\bgrid-template-rows:\s*auto minmax\(0, 1fr\) auto;/);
  assert.match(view, /className="drive-top"[\s\S]+id="banner"[\s\S]+className="drive-stimulus"[\s\S]+className="drive-bottom"/);
});

test('world dashes slide continuously and each road surface has one token', async () => {
  const { BuildSegments, LaneDashes, roadSurfaces } = await import('./src/projection.ts');
  const dashes = LaneDashes(0, 0, 34);
  assert.deepEqual(dashes, [[0, 4], [10, 14], [20, 24], [30, 34]]);
  assert.deepEqual(LaneDashes(10, 0, 34), dashes);
  assert.deepEqual(LaneDashes(.5, 0, 34), [[0, 3.5], [9.5, 13.5], [19.5, 23.5], [29.5, 33.5]]);
  const segments = BuildSegments(26.5, 1, 100);
  assert.ok(segments.length > 2);
  const length = segments[0].far - segments[0].near;
  for (const [index, segment] of segments.entries()) {
    assert.equal(segment.far - segment.near, length);
    if (index) assert.equal(segment.near, segments[index - 1].far);
    assert.deepEqual(segment.surfaces, roadSurfaces);
  }
  assert.deepEqual(roadSurfaces, { grass: 'grass', shoulder: 'shoulder', dry: 'road', wet: 'wet-road' });
});

test('all selected sprites have atlas frames with valid lamp rectangles', async () => {
  const { CarFrames } = await import('./src/carFrames.ts');
  const { width, height, frames } = JSON.parse(readFileSync(new URL('./sprites/cars.json', import.meta.url), 'utf8'));
  const keys = new Set();
  for (const lead of options.leadType) {
    for (let seed = 0; seed < 100; seed++) {
      const cars = CarFrames(lead, seed, 8);
      assert.equal(cars.lead, lead);
      assert.ok(options.leadType.includes(cars.far));
      assert.notEqual(cars.far, lead);
      assert.equal(cars.decoys.length, 8);
      assert.ok(cars.decoys.every(key => key.startsWith('decoy-')));
      assert.deepEqual(cars, CarFrames(lead, seed, 8));
      for (const key of [cars.lead, cars.far, ...cars.decoys]) keys.add(key);
    }
  }
  assert.deepEqual([...keys].sort(), Object.keys(frames).sort());
  for (const key of keys) {
    const frame = frames[key];
    assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.w <= width && frame.y + frame.h <= height);
    assert.ok(frame.w > 0 && frame.h > 0 && frame.widthMeters > 0);
    for (const lamp of ['tailLeft', 'tailRight', 'third']) {
      const [x, y, w, h] = frame.lamps[lamp];
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, `${key} ${lamp}`);
    }
  }
});

test('settings group six labeled fields and keep Back before Confirm', async () => {
  const { en } = await import('./i18n/en.ts');
  const { zh } = await import('./i18n/zh.ts');
  const source = readFileSync(new URL('./BrakeReactionGame.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const require = createRequire(import.meta.url);
  for (const [lang, copy, back, confirm] of [
    ['en', en, 'Back to entry', 'Confirm settings'],
    ['zh', zh, '返回入口', '確認設定'],
  ]) {
    const exports = {};
    const window = {};
    window.parent = window;
    const modules = {
      jspsych: {},
      './i18n/useT': { useT: () => ({ lang, copy }) },
      './settings': { defaultSettings: defaults, options },
      './runtime/hubBridge': { IsHubGame: () => false },
      './src/round': { RandomFrom, ScenarioFor, ScenarioPlan },
      './rules/BrakeReactionTutorial': { BrakeReactionTutorial: () => null },
    };
    runInNewContext(outputText, { exports, window, require: id => modules[id] ?? (id.startsWith('.') ? {} : require(id)) });
    const markup = renderToStaticMarkup(createElement(exports.BrakeReactionGame));
    assert.match(markup, /<dialog class="game-settings-dialog brake-reaction-phase-menu"/);
    const cards = [...markup.matchAll(/<section class="training-setting"><h3>([^<]+)<\/h3><p>[^<]+<\/p>(.*?)<\/section>/g)];
    assert.deepEqual(cards.map(card => card[1]), lang === 'en' ? ['Practice settings', 'Vehicles'] : ['練習設定', '車輛']);
    assert.deepEqual(cards.map(card => [...card[2].matchAll(/<label>[^<]+<select[^>]+name="([^"]+)"/g)].map(field => field[1])),
      [['traffic', 'scenario', 'speedKmh', 'road'], ['leadType', 'ownType']]);
    const buttons = [...markup.matchAll(/<button[^>]+>([^<]+)<\/button>/g)].map(button => button[1]);
    assert.deepEqual(buttons, [back, confirm]);
  }
});

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

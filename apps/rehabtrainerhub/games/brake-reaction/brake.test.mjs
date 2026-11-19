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
  const { roadEdge, shoulderEdge, nearZ, railX, railStart, mountain, dashboard } = SceneGeometry(scene);
  for (const [distance, depth] of [[roadEdge, nearZ], [shoulderEdge, nearZ], [railX, railStart]]) {
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
  const { vehicleStyles: { sedan } } = await import('./src/vehicles.ts');
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const scene = SceneMetrics(width, height);
    const expected = 1.05 * Math.min(width, .7 * height);
    let lastWidth = 0;
    for (const gap of [55, 30, 20, 12, 10, 8, 6.1, 4, 2, 1, 0]) {
      const depth = gap + eyeOffset;
      const car = ProjectTargetCar(scene, 0, depth, sedan.widthMeters, sedan.aspect, .82 * height);
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
  const { vehicleStyles } = await import('./src/vehicles.ts');
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1280, 800],
    [1440, 900], [1920, 1080], [2560, 1080], [844, 390], [667, 375]]) {
    const scene = SceneMetrics(width, height);
    const footer = height < 500 ? 76 : width <= height ? 150 : 105;
    const { dashboard } = SceneGeometry(scene, height - footer);
    for (const key of options.leadType) {
      const frame = vehicleStyles[key];
      const car = ProjectTargetCar(scene, 0, eyeOffset, frame.widthMeters, frame.aspect, dashboard.centerY);
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

test('world dashes slide continuously and road segments stay joined', async () => {
  const { BuildSegments, LaneDashes } = await import('./src/projection.ts');
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
  }
});

test('canvas cars provide four distinct rear profiles with valid lamp rectangles', async () => {
  const { VehicleTypes, vehicleStyles, LampGlow } = await import('./src/vehicles.ts');
  const road = readFileSync(new URL('./src/road.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(road, /LoadCarAtlas|cars\.json|cars\.webp|drawImage\(/);
  assert.match(road, /PaintVehicle\(/);
  assert.equal(new Set(Object.values(vehicleStyles).map(style => style.aspect)).size, 4);
  assert.equal(vehicleStyles.ev.lightBar, true);
  assert.equal(vehicleStyles.sport.spoiler, true);
  assert.equal(LampGlow(1200, 200), 12);
  assert.equal(LampGlow(1200, 2), 90);
  assert.equal(LampGlow(1200, 24), 40);
  for (const lead of options.leadType) {
    for (let seed = 0; seed < 100; seed++) {
      const cars = VehicleTypes(lead, seed, 8);
      assert.equal(cars.lead, lead);
      assert.ok(options.leadType.includes(cars.far));
      assert.notEqual(cars.far, lead);
      assert.equal(cars.decoys.length, 8);
      assert.ok(cars.decoys.every(key => options.leadType.includes(key)));
      assert.deepEqual(cars, VehicleTypes(lead, seed, 8));
    }
    const frame = vehicleStyles[lead];
    assert.ok(frame.widthMeters > 0);
    for (const lamp of ['tailLeft', 'tailRight', 'third']) {
      const [x, y, w, h] = frame.lamps[lamp];
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1, `${lead} ${lamp}`);
    }
  }
});

test('roadside fixtures use world spacing and share the car depth order', async () => {
  const { BuildRoadside, CompareDepth } = await import('./src/projection.ts');
  const fixtures = BuildRoadside(10, 5, 150, 5);
  assert.deepEqual(fixtures.filter(item => item.kind === 'reflector').map(item => item.z), [15, 40, 65, 90, 115, 140]);
  assert.deepEqual(fixtures.filter(item => item.kind === 'lamp' && item.side === 1).map(item => item.z), [40, 90, 140]);
  assert.deepEqual(BuildRoadside(13, 5, 150, 5).filter(item => item.kind === 'lamp' && item.side === 1).map(item => item.z), [37, 87, 137]);
  assert.ok(fixtures.filter(item => item.kind === 'rail').every(item => item.far - item.z <= 5));
  assert.deepEqual([{ z: 25, kind: 'car' }, { z: 25, kind: 'rail' }, { z: 14, kind: 'post' }, { z: 40, kind: 'lamp' }]
    .sort(CompareDepth).map(item => item.kind), ['lamp', 'rail', 'car', 'post']);
});

test('world travel comes from simulated distance and stops when the car stops', async () => {
  const { DrivingFrame } = await import('./src/drivePresentation.ts');
  const model = ModelFor(defaults);
  const cruise = DrivingFrame(model, 80, 4500, undefined, 0, 10, Infinity);
  assert.equal(cruise.distance, model.speed * 4.5);
  const waiting = DrivingFrame(model, 80, 4600, 4500, .1, 10, Infinity);
  assert.equal(waiting.speed, model.speed);
  assert.ok(waiting.motion.gap < 80);
  const braking = DrivingFrame(model, 80, 5500, 4500, 1, .45, Infinity);
  assert.ok(braking.speed < model.speed && braking.pitch > 0);
  const stopped = DrivingFrame(model, 80, 12000, 4500, 7.5, .45, Infinity);
  assert.equal(stopped.speed, 0);
  assert.equal(stopped.pitch, 0);
  assert.equal(DrivingFrame(model, 80, 14000, 4500, 9.5, .45, Infinity).distance, stopped.distance);
});

test('impact tiers settle at different depths and reduced motion uses a still end state', async () => {
  const { impactProfiles, ImpactAt } = await import('./src/impact.ts');
  for (const [grade, shake, gap, zoom, count, delay] of [
    ['light', 5, .5, .5, 8, 1], ['moderate', 14, 1.2, .46, 26, 1.5], ['severe', 30, 2.4, .42, 60, 2.1],
  ]) {
    const profile = impactProfiles[grade];
    assert.deepEqual([profile.shake, profile.push, profile.zoom, profile.debris, profile.feedbackDelay], [shake, gap, zoom, count, delay]);
    assert.equal(ImpactAt(grade, .1, false).zoom, 1);
    assert.ok(ImpactAt(grade, .4, false).push > 0);
    const settled = ImpactAt(grade, delay, false);
    assert.equal(settled.zoom, zoom);
    assert.equal(settled.push, gap);
    assert.equal(settled.flash, 0);
    const reduced = ImpactAt(grade, .1, true);
    assert.deepEqual(reduced, ImpactAt(grade, delay, true));
    assert.equal(reduced.push, gap);
    assert.equal(reduced.shake, 0);
    assert.equal(reduced.flash, 0);
    assert.equal(reduced.airbag, 0);
    assert.equal(reduced.debris, 0);
  }
  assert.ok(ImpactAt('severe', .08, false).airbag > .8);
  for (const time of [.25, .52]) assert.equal(ImpactAt('severe', time, false).airbag, 1);
  assert.ok(ImpactAt('severe', .60, false).airbag < 1);
  assert.equal(ImpactAt('severe', 1.8, false).airbag, 0);
  assert.equal(ImpactAt('light', .1, false).smoke, 0);
});

test('the canvas draws visible braking lamps and retains a reduced-motion damaged scene', async () => {
  const { MakeRoad } = await import('./src/road.ts');
  const { DrivingFrame } = await import('./src/drivePresentation.ts');
  const { ImpactAt } = await import('./src/impact.ts');
  const { palette } = await import('./src/scenePalette.ts');
  const dpr = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
  try {
    const model = ModelFor(defaults);
    const round = MakeRound(defaults, 'plain', 0, RandomFrom(5));
    const paints = [];
    const methods = ['beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'clip', 'rect', 'save', 'restore',
      'translate', 'scale', 'rotate', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'setTransform', 'fillText'];
    const context = {
      ...Object.fromEntries(methods.map(name => [name, () => undefined])),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() { paints.push(this.fillStyle); },
    };
    const canvas = { dataset: {}, getContext: () => context, getBoundingClientRect: () => ({ x: 0, y: 0, width: 390, height: 844 }) };
    const controls = { getBoundingClientRect: () => ({ top: 748 }) };
    const draw = MakeRoad(canvas, round, defaults, controls);
    const frame = { time: round.onset, elapsed: 0, reducedMotion: true };
    const drive = DrivingFrame(model, round.gap, round.onset, round.onset, 0, 10, Infinity);
    draw(drive, frame);
    assert.equal(paints.filter(color => color === palette.brakeCore).length, 3);
    assert.equal(JSON.parse(canvas.dataset.targetLamps).length, 3);
    const before = Number(canvas.dataset.targetRect.split(',')[2]);
    const impact = ImpactAt('severe', 0, true);
    paints.length = 0;
    draw(drive, { ...frame, impact });
    assert.equal(canvas.dataset.impact, 'severe');
    assert.equal(canvas.dataset.cameraZoom, '0.42');
    assert.ok(Number(canvas.dataset.targetRect.split(',')[2]) > before);
    assert.ok(paints.includes(palette.brokenLamp));
    assert.ok(!paints.some(color => typeof color === 'string' && color.startsWith('rgb(' + palette.flash)));
  } finally {
    if (dpr) Object.defineProperty(globalThis, 'devicePixelRatio', dpr);
    else delete globalThis.devicePixelRatio;
  }
});

test('the target brake-light onset leaves the localized banner and live status unchanged', async () => {
  const { en } = await import('./i18n/en.ts');
  const { zh } = await import('./i18n/zh.ts');
  const presentation = await import('./src/drivePresentation.ts');
  const physics = await import('./src/physics.ts');
  const source = readFileSync(new URL('./RunningView.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const require = createRequire(import.meta.url);
  for (const [lang, copy] of [['en', en], ['zh', zh]]) {
    for (const scenario of ['plain', 'swerve-away', 'out-and-back']) {
      const round = MakeRound(defaults, scenario, 0, RandomFrom(5));
      const sound = [];
      const banner = { textContent: copy.ready };
      const canvas = { dataset: {} };
      const nodes = { canvas, '#banner': banner, '#speed': {}, '#brake': new EventTarget() };
      const root = { querySelector: selector => nodes[selector], querySelectorAll: () => [] };
      let now = 100;
      let paint;
      let mount;
      let lights;
      const exports = {};
      const modules = {
        react: { useEffect: effect => { mount = effect; }, useRef: value => ({ current: value === null ? root : value }) },
        './i18n/useT': { useT: () => ({ lang, copy }) },
        './src/road': { MakeRoad: () => drive => { lights = Boolean(drive.motion); } },
        './src/drivePresentation': presentation,
        './src/impact': {},
        './src/physics': physics,
        './src/round': { RandomFrom, distractionRoundIndex: 5, sessionRoundCount: 6 },
        './runtime/soundManager': { PlayBrakeCue: name => sound.push(name) },
      };
      runInNewContext(outputText, {
        exports, require: id => Object.hasOwn(modules, id) ? modules[id] : require(id), AbortController,
        document: new EventTarget(), window: new EventTarget(), matchMedia: () => ({ matches: false }),
        performance: { now: () => now }, requestAnimationFrame: callback => { paint = callback; return 1; },
        cancelAnimationFrame() {},
      });
      const markup = renderToStaticMarkup(createElement(exports.RunningView, { round, settings: defaults, index: 0 }));
      assert.match(markup, /<canvas aria-hidden="true"/);
      assert.ok(markup.includes(`role="status">${copy.ready}</p>`));
      const unmount = mount();
      const start = now;
      now = start + round.onset - 1;
      paint();
      assert.equal(lights, false);
      assert.equal(banner.textContent, '');
      const previousBanner = banner.textContent;
      now = start + round.onset;
      paint();
      assert.equal(lights, true);
      assert.equal(banner.textContent, previousBanner, `${lang} ${scenario} banner at onset`);
      assert.equal(Number(canvas.dataset.brakeLitAt), now);
      assert.deepEqual(sound, ['brake']);
      unmount();
    }
  }
});

test('Space always brakes from focused controls while Enter remains native', async () => {
  const { IsBrakeKey } = await import('./src/drivePresentation.ts');
  const view = readFileSync(new URL('./RunningView.tsx', import.meta.url), 'utf8');
  assert.ok(IsBrakeKey({ code: 'Space', target: { tagName: 'BUTTON' } }));
  assert.ok(!IsBrakeKey({ code: 'Enter' }));
  assert.ok(!IsBrakeKey({ code: 'Space', repeat: true }));
  assert.ok(!IsBrakeKey({ code: 'Space', ctrlKey: true }));
  assert.match(view, /addEventListener\('keydown',[\s\S]*?event\.preventDefault\(\)[\s\S]*?capture: true/);
  assert.match(view, /className="drive-notification messages"/);
});

test('the distraction card centers the heading above three equally sized answers', async () => {
  const { en } = await import('./i18n/en.ts');
  const { zh } = await import('./i18n/zh.ts');
  const css = readFileSync(new URL('./game.css', import.meta.url), 'utf8');
  assert.equal(en.messageSender, 'Message · now');
  assert.equal(zh.messageSender, '訊息 · 現在');
  assert.match(css, /\.drive-notification\s*\{[^}]*align-self:\s*center;[^}]*width:\s*min\(35rem,/);
  assert.match(css, /\.drive-notification\s*\{[^}]*border:\s*2px solid var\(--text\)/);
  assert.match(css, /\.notification-question\s*\{[^}]*font-size:\s*1\.5rem;[^}]*font-weight:\s*900/);
  assert.match(css, /--notification-heavy-font:\s*"Arial Black", "Segoe UI Black", Arial, sans-serif;/);
  assert.match(css, /\.notification-question\s*\{[^}]*font-family:\s*var\(--notification-heavy-font\)/);
  assert.match(css, /\.notification-sender\s*\{[^}]*color:\s*var\(--text\);[^}]*font-family:\s*Arial, "Microsoft JhengHei", sans-serif;[^}]*font-weight:\s*700/);
  assert.match(css, /\.answers\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.answers \.btn\s*\{[^}]*min-height:\s*48px;[^}]*border:\s*2px solid var\(--text\)/);
  assert.match(css, /\.answers \.btn\s*\{[^}]*font-family:\s*var\(--notification-heavy-font\);[^}]*font-weight:\s*900/);
});

test('round feedback uses a frozen scene, a bottom card and a shared scale for both distances', async () => {
  const { FeedbackVerdict, DistanceBars } = await import('./src/drivePresentation.ts');
  const game = readFileSync(new URL('./BrakeReactionGame.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./game.css', import.meta.url), 'utf8');
  assert.equal(FeedbackVerdict('early'), 'earlyPress');
  assert.equal(FeedbackVerdict({ outcome: { rel: null, remaining: 2.99 } }), 'closeCall');
  assert.equal(FeedbackVerdict({ outcome: { rel: null, remaining: 3 } }), 'stopped');
  assert.equal(FeedbackVerdict({ outcome: { rel: 30 } }), 'severe');
  assert.deepEqual(DistanceBars(60, 30), [1, .5]);
  assert.deepEqual(DistanceBars(30, 60), [.5, 1]);
  assert.match(game, /frozen=\{phase === 'feedback'\}/);
  assert.match(css, /\.round-feedback\s*\{[^}]*bottom:/);
  assert.match(css, /\.round-feedback \.training-config-body\s*\{[^}]*display:\s*grid;[^}]*overscroll-behavior:\s*contain/);
  assert.match(css, /@media \(min-width: 640px\)\s*\{\s*\.round-feedback \.training-config-body\s*\{[^}]*grid-template-columns:/);
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

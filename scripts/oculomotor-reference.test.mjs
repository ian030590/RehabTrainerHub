import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { IsReferenceCsvPayload, IsOculomotorCsvPayload } from '../packages/ui/src/oculomotorCsv.js';
import { createHash } from 'node:crypto';

const base = new URL('../apps/rehabtrainerhub/games/oculomotor-training/', import.meta.url);
const source = readFileSync(new URL('public/reference/experiment.js', base), 'utf8');

test('all 22 OcuTrain geometry, scoring, TFF and stimulus functions retain exact source', () => {
  const reference = JSON.parse(readFileSync(new URL('./fixtures/ocutrain-reference.json', import.meta.url), 'utf8'));
  const ast = ts.createSourceFile('experiment.js', source.replaceAll('\r\n','\n'), ts.ScriptTarget.Latest, true);
  const found = new Set();
  const visit = node => {
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && reference.functions[node.name.getText(ast)]) {
      const name = node.name.getText(ast); found.add(name);
      assert.equal(createHash('sha256').update(node.getText(ast)).digest('hex'), reference.functions[name], name);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(found.size, Object.keys(reference.functions).length);
});

function LoadExperiment({ cameraAvailable = false } = {}) {
  let now = 1000;
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  const downloads = [];
  const events = new EventTarget();
  const schedule = (callback, delay) => { timers.set(++id, { callback, delay }); return id; };
  const document = { fullscreenElement: {}, addEventListener() {}, removeEventListener() {}, exitFullscreen: async () => {} };
  const window = { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1, screen: { width: 1920, height: 1080 },
    oculomotorLanguage: 'en', setInterval: schedule, clearInterval: key => timers.delete(key),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events), setTimeout: schedule, clearTimeout: key => timers.delete(key),
    OculomotorDownload: (filename, content) => downloads.push({ filename, content }), webgazer: { resume() {}, pause() {} } };
  if (cameraAvailable) Object.assign(window, { jsPsychExtensionWebgazer: class {}, jsPsychWebgazerInitCamera: true, jsPsychWebgazerCalibrate: class {}, OculomotorInput: {} });
  const jsPsych = { extensions: {}, run() { return Promise.resolve(); }, finishTrial() {}, pluginAPI: { setTimeout: schedule, clearAllTimeouts() {}, getKeyboardResponse() {}, cancelKeyboardResponse() {} } };
  const context = vm.createContext({ window, document, console, AbortController, Event, CustomEvent, performance: { now: () => now },
    setTimeout: schedule, clearTimeout: key => timers.delete(key), setInterval: schedule, clearInterval: key => timers.delete(key),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: key => frames.delete(key),
    jsPsychModule: { ParameterType: {} }, initJsPsych: () => jsPsych });
  vm.runInContext(source.replace('  window.oculomotorExperiment = {',
    '  window.testApi = { AppState, EyeTrainingPlugin, GazeValidationPlugin, OptionalWebGazerCameraPlugin, createCalibration, stimulusPixels, currentScreenPixels, currentViewportSignature, viewportSignaturesMatch, gazeErrorDegrees };\n  window.oculomotorExperiment = {'), context);
  return { window, document, jsPsych, downloads, frames, timers, api: window.testApi,
    setNow: value => { now = value; },
    frame(time) { now = time; const [key, callback] = frames.entries().next().value; frames.delete(key); callback(time); },
    timer(delay) { const entry = [...timers].find(([, timer]) => timer.delay === delay); assert.ok(entry, `Expected ${delay} ms timer`); timers.delete(entry[0]); entry[1].callback(); } };
}

function StartTraining(app, { module = 'vor', settings = {}, source = 'webgazer' } = {}) {
  const stage = { getBoundingClientRect: () => ({ width: 1920, height: 1080 }) };
  const stimulus = { style: { setProperty() {}, removeProperty() {} } };
  const number = { style: { setProperty() {} } };
  const display = { querySelector: selector => ({ '#training-stage': stage, '#training-stimulus': stimulus, '#stimulus-number': number })[selector] };
  let result;
  let onGaze;
  app.api.AppState.eyeTracking.source = source;
  app.jsPsych.extensions.webgazer = { onGazeUpdate: callback => { onGaze = callback; return () => {}; } };
  app.jsPsych.finishTrial = value => { result = value; };
  new app.api.EyeTrainingPlugin(app.jsPsych).trial(display, { module,
    settings: { ballArcmin: 60, changeMs: 500, totalSec: 20, mode: 'predictable', directions: ['rightMiddle'], ...settings },
    calibration: app.api.createCalibration({ screenWidthCm: 53, screenHeightCm: 30, viewingDistanceCm: 60 }),
    eye_tracking: { source, enabled: source !== 'off' }, fullscreen_entered: true });
  app.frame(1000);
  return { sample(time, x = 960, y = 540, received = time) { app.setNow(received); onGaze(x === null ? null : { x, y, sample_performance_ms: time }); },
    finish() { app.timer(20000); return result; },
    get capture() { return app.api.AppState.webgazerActiveTrial; } };
}

for (const [name, settings, validation, threshold] of [
  ['default', {}, null, 3.5],
  ['precise validation retains allowance', {}, { source: 'webgazer', dynamicThresholdDeg: 0.5 }, 3.5],
  ['validation is not counted twice', {}, { source: 'webgazer', dynamicThresholdDeg: 4 }, 4],
  ['edited setting still applies', { distanceThresholdArcmin: 120 }, { source: 'webgazer', dynamicThresholdDeg: 3.5 }, 4],
  ['other source validation is ignored', {}, { source: 'other', dynamicThresholdDeg: 8 }, 3.5],
]) test(`OcuTrain threshold: ${name}`, () => {
  const app = LoadExperiment();
  app.api.AppState.eyeTracking.lastValidation = validation;
  const run = StartTraining(app, { settings });
  for (const [index, degrees] of [threshold - 0.1, threshold + 0.1].entries()) {
    const dx = 2 * 60 * Math.tan(degrees * Math.PI / 360) * 1920 / 53;
    run.sample(1040 + index * 40, 960 + dx);
  }
  assert.deepEqual(Array.from(run.capture.synchronousRecords, row => row.is_within_threshold), [1, 0]);
  const result = run.finish();
  assert.equal(result.threshold_deg, threshold);
  assert.equal(result.tracker_error_allowance_deg, 2);
  assert.match(app.downloads[0].content, new RegExp(`Hit Distance Threshold: ${threshold} deg`));
});

test('OcuTrain pursuit excludes the cross, moves visibly back to center and scores both legs', () => {
  const app = LoadExperiment(); const run = StartTraining(app, { module: 'pursuit', settings: { speedArcminSec: 6000 } });
  run.sample(1040); assert.equal(run.capture.totalValidMs, 0);
  app.frame(2000); run.sample(2020); assert.equal(run.capture.totalValidMs, 20);
  app.frame(2300); run.sample(2310, 1900);
  const edge = run.capture.synchronousRecords.at(-1);
  assert.equal(edge.phase, 'return'); assert.ok(edge.stimulus_x_px > 1800);
  app.frame(2400); run.sample(2410);
  const returning = run.capture.synchronousRecords.at(-1);
  assert.ok(returning.stimulus_x_px < edge.stimulus_x_px && returning.stimulus_x_px > 960);
  assert.ok(returning.accuracy_delta_t_ms > 0);
  app.frame(2600); run.sample(2600); assert.equal(run.capture.synchronousRecords.at(-1).stimulus_x_px, 960);
  assert.equal(run.finish().completed_targets, 1);
  const csv = app.downloads[0];
  assert.equal(IsReferenceCsvPayload({ fileName: csv.filename, text: csv.content }), true, 'Full OcuTrain CSV reaches the download bridge');
  const malicious = csv.content.split('\r\n');
  const cells = malicious.at(-1).split(','); cells[24] = '=1+1'; malicious[malicious.length - 1] = cells.join(',');
  assert.equal(IsReferenceCsvPayload({ fileName: csv.filename, text: malicious.join('\r\n') }), false, 'CSV formula content remains forbidden');
  const row = [1, 20, 1040000, 30, 33, 1, 960, 540, 960, 540, 0, 0, 1, 'return', 'right'];
  assert.equal(IsOculomotorCsvPayload({ records: [row], metadata: { eye_tracking_source: 'webgazer' } }), true, 'Return samples can be saved');
});

test('OcuTrain fixation scores only edge hold and clips intervals at hold onset', () => {
  const app = LoadExperiment(); const run = StartTraining(app, { module: 'fixation', settings: { speedArcminSec: 6000, holdSec: 1 } });
  run.sample(1040); app.frame(2000); app.frame(2200); run.sample(2270, 100);
  assert.equal(run.capture.totalValidMs, 0);
  app.frame(2300); run.sample(2320, 1900);
  assert.equal(run.capture.totalValidMs, 20);
  assert.equal(run.capture.synchronousRecords.at(-1).accuracy_delta_t_ms, 20);
  run.sample(2350, 1900); app.frame(3300); run.sample(3320, 100);
  assert.equal(run.finish().accuracy_rate, 100);
});

test('OcuTrain delayed samples use acquisition frames; duplicate and reversed times add no scoring time', () => {
  const app = LoadExperiment(); const run = StartTraining(app, { module: 'saccade', settings: { dwellMs: 1000 } });
  app.frame(2000); app.frame(2300);
  run.sample(2100, 960, 540, 2400);
  assert.equal(run.capture.synchronousRecords[0].phase, 'saccade_latency');
  assert.equal(run.capture.totalValidMs, 0);
  run.sample(2300, 960, 540, 2410);
  const duration = run.capture.totalValidMs;
  run.sample(2300, 960, 540, 2420); run.sample(2200, 960, 540, 2430);
  assert.equal(run.capture.totalValidMs, duration);
  assert.equal(run.capture.synchronousRecords.length, 2);
});

test('OcuTrain saccade TFF detects an off-target fixation before the 200 ms accuracy window', () => {
  const app = LoadExperiment(); const run = StartTraining(app, { module: 'saccade', settings: { dwellMs: 1000 } });
  app.frame(2000); app.frame(2300);
  [1980, 2020, 2050, 2080, 2110, 2140, 2180].forEach((time, index) => run.sample(time, time >= 2080 ? 1248 : 960, 540, 2400 + index));
  const result = run.finish();
  assert.equal(result.tff_mean_ms, 80); assert.equal(result.tff_detected_targets, 1);
  assert.match(app.downloads[0].content, /TFF Target 1: 80 ms/);
});

test('OcuTrain no samples and only invalid samples report missing accuracy', () => {
  for (const invalid of [false, true]) {
    const app = LoadExperiment(); const run = StartTraining(app);
    if (invalid) run.sample(1040, null);
    assert.equal(run.finish().accuracy_rate, null);
  }
});

test('OcuTrain validation without enough data cannot proceed or invent a threshold', () => {
  const app = LoadExperiment();
  app.api.AppState.eyeTracking.source = 'webgazer';
  app.api.AppState.pending = { eyeTrackingSource: 'webgazer', settings: {} };
  app.jsPsych.extensions.webgazer = { hideVideo() {}, hidePredictions() {}, resume() {}, pause() {}, onGazeUpdate: () => () => {} };
  const display = { innerHTML: '', querySelector: () => ({ addEventListener() {} }) };
  new app.api.GazeValidationPlugin(app.jsPsych).trial(display, {});
  for (let i = 0; i < 5; i++) { app.timer(350); app.timer(1050); }
  assert.doesNotMatch(display.innerHTML, /data-val-action="proceed"/);
  assert.match(display.innerHTML, /N\/A/);
});

test('stopping after validation removes its auto-start countdown before returning to settings', () => {
  const app = LoadExperiment(); let onGaze;
  app.api.AppState.eyeTracking.source = 'webgazer';
  app.api.AppState.pending = { eyeTrackingSource: 'webgazer', settings: {} };
  app.jsPsych.extensions.webgazer = { hideVideo() {}, hidePredictions() {}, resume() {}, pause() {}, onGazeUpdate: callback => { onGaze = callback; return () => {}; } };
  const display = { innerHTML: '', querySelector: () => ({ addEventListener() {} }) };
  new app.api.GazeValidationPlugin(app.jsPsych).trial(display, {});
  for (const [x,y] of [[960,540],[384,216],[1536,216],[384,864],[1536,864]]) {
    app.timer(350); for(let i=0;i<3;i++) onGaze({x,y}); app.timer(1050);
  }
  assert.ok([...app.timers.values()].some(timer => timer.delay === 1000));
  app.window.dispatchEvent(new Event('oculomotor:stop'));
  assert.equal(app.timers.size, 0);
});

test('OcuTrain settings offer synchronized 10–600 arcmin threshold controls and module-specific inputs', async () => {
  const settingsModule = await import(new URL('settings.ts', base));
  const { defaultSettings, settingsSections, ValidateSettings } = settingsModule;
  const fields = settingsSections.flatMap(section => section.fields);
  for (const [key, min, max] of [['ballArcmin', 1, 600], ['distanceThresholdArcmin', 10, 600]]) {
    const field = fields.find(field => field.key === key);
    assert.equal(field.min, min); assert.equal(field.max, max); assert.equal(field.step, 1);
    assert.equal(ValidateSettings({ ...defaultSettings, [key]: max }), true);
  }
  const module = { exports: {} }; const require = createRequire(import.meta.url);
  const code = ts.transpileModule(readFileSync(new URL('OculomotorSettingsFields.tsx', base), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports,
    name => name === './settings' ? settingsModule : require(name));
  for (const activity of ['vor', 'pursuit', 'saccade', 'fixation']) {
    const markup = renderToStaticMarkup(React.createElement(module.exports.OculomotorSettingsFields,
      { settings: { ...defaultSettings, module: activity }, language: 'en', onChange() {} }));
    assert.match(markup, /id="slider-threshold-arcmin"/);
    assert.match(markup, /id="threshold-arcmin"[^>]*type="number"/);
    assert.match(markup, /90.*1\.50°/);
    assert.equal(markup.includes('name="speedArcminSec"'), ['pursuit', 'fixation'].includes(activity));
    assert.equal(markup.includes('name="dwellMs"'), activity === 'saccade');
    assert.equal(markup.includes('name="holdSec"'), activity === 'fixation');
    assert.equal(markup.includes('data-center-btn'), activity !== 'vor');
    const activeFields = settingsModule.GetActiveSettingFields({ ...defaultSettings, module: activity });
    assert.deepEqual(activeFields.filter(field => field.key.endsWith('TotalSec')).map(field => field.key), [`${activity}TotalSec`], 'Confirmation and results describe the selected module only');
  }
});

test('screen measurements independently control both axes: correct aspect is round and incorrect aspect deforms', () => {
  const app = LoadExperiment();
  for (const screen of [{ width: 1920, height: 1080 }, { width: 1440, height: 960 }, { width: 1920, height: 1200 }, { width: 390, height: 844 }]) {
    const measurements = { screenWidthCm: 48, screenHeightCm: 48 * screen.height / screen.width, viewingDistanceCm: 60 };
    const calibration = app.api.createCalibration(measurements);
    for (const arcmin of [1, 60, 600]) {
      const size = app.api.stimulusPixels(arcmin, calibration, screen);
      assert.ok(Math.abs(size.width - size.height) < 1e-10, `Correct measurements render a circle at ${screen.width}×${screen.height}`);
      assert.ok(Math.abs(size.width - 2 * 60 * Math.tan(arcmin * Math.PI / 21600) * screen.width / measurements.screenWidthCm) < 1e-10,
        'The measured horizontal visual angle is preserved');
      for (const field of ['screenWidthCm', 'screenHeightCm']) {
        const wrong = app.api.stimulusPixels(arcmin, app.api.createCalibration({ ...measurements, [field]: measurements[field] * 2 }), screen);
        assert.ok(Math.abs(wrong.width - wrong.height) > .01, `Wrong ${field} must deform the target`);
        assert.equal(wrong.width, field === 'screenWidthCm' ? size.width / 2 : size.width);
        assert.equal(wrong.height, field === 'screenHeightCm' ? size.height / 2 : size.height);
      }
    }
  }
});

test('equally mis-scaled screen measurements preserve shape but change the physical target size', () => {
  const app = LoadExperiment();
  const screen = { width: 1920, height: 1080 };
  const size = app.api.stimulusPixels(60, app.api.createCalibration({ screenWidthCm: 48, screenHeightCm: 27, viewingDistanceCm: 60 }), screen);
  const wrong = app.api.stimulusPixels(60, app.api.createCalibration({ screenWidthCm: 96, screenHeightCm: 54, viewingDistanceCm: 60 }), screen);
  assert.ok(Math.abs(wrong.width - wrong.height) < 1e-10);
  assert.equal(wrong.width, size.width / 2);
});

test('3:2 screens preserve round targets at uniform display scales and expose stale 16:9 measurements', () => {
  const app = LoadExperiment(); let physicalPixelDiameter;
  for (const scale of [1, 1.25, 1.5, 2]) {
    app.window.screen = { width: 1440 / scale, height: 960 / scale };
    app.window.innerWidth = app.window.screen.width; app.window.innerHeight = app.window.screen.height;
    app.window.devicePixelRatio = scale;
    const calibration = app.api.createCalibration({ screenWidthCm: 48, screenHeightCm: 32, viewingDistanceCm: 60 });
    const size = app.api.stimulusPixels(60, calibration);
    assert.ok(Math.abs(size.width - size.height) < 1e-10, `3:2 at scale ${scale}`);
    physicalPixelDiameter ??= size.width * scale;
    assert.ok(Math.abs(size.width * scale - physicalPixelDiameter) < 1e-10);
    const stale = app.api.stimulusPixels(60, app.api.createCalibration({ screenWidthCm: 48, screenHeightCm: 27, viewingDistanceCm: 60 }));
    assert.ok(Math.abs(stale.width / stale.height - 27 / 32) < 1e-10, '16:9 measurements deform a target on a 3:2 screen');
  }
});

test('fullscreen calibration uses the real 3:2 viewport when screen metadata reports another aspect', () => {
  const app = LoadExperiment();
  app.window.screen = { width: 1280, height: 800 };
  app.window.innerWidth = 1440; app.window.innerHeight = 960;
  const calibration = app.api.createCalibration({ screenWidthCm: 48, screenHeightCm: 32, viewingDistanceCm: 60 });
  assert.equal(calibration.screenWidthPx, 1440);
  assert.equal(calibration.screenHeightPx, 960);
  const size = app.api.stimulusPixels(60, calibration);
  assert.ok(Math.abs(size.width - size.height) < 1e-10);
  const pixels = app.api.currentScreenPixels();
  assert.equal(app.api.gazeErrorDegrees(30, 0, calibration, pixels), app.api.gazeErrorDegrees(0, 30, calibration, pixels));
  const initial = app.api.currentViewportSignature();
  app.window.innerWidth = 1600; app.window.innerHeight = 900;
  assert.equal(app.api.viewportSignaturesMatch(initial, app.api.currentViewportSignature()), false,
    'Moving to another aspect requires recalibration even if reported screen metadata is unchanged');
});

test('windowed calibration keeps whole-screen dimensions instead of treating a small iframe as the monitor', () => {
  const app = LoadExperiment(); app.document.fullscreenElement = null;
  app.window.screen = { width: 1440, height: 960 };
  app.window.innerWidth = 700; app.window.innerHeight = 500;
  const calibration = app.api.createCalibration({ screenWidthCm: 48, screenHeightCm: 32, viewingDistanceCm: 60 });
  assert.equal(calibration.screenWidthPx, 1440); assert.equal(calibration.screenHeightPx, 960);
});

test('camera readiness refreshes settled fullscreen geometry before calibration and still rejects changes during calibration', async () => {
  const { defaultSettings } = await import(new URL('settings.ts', base));
  for (const fullscreenStillActive of [true, false]) {
    const app = LoadExperiment({ cameraAvailable: true }); let timeline;
    app.jsPsych.run = value => { timeline = value; return Promise.resolve(); };
    app.window.oculomotorExperiment.Start({ ...defaultSettings, language: 'en' });
    app.window.innerWidth = 1440; app.window.innerHeight = 960;
    if (!fullscreenStillActive) app.document.fullscreenElement = null;
    timeline[0].on_finish({ ready: true });
    assert.equal(app.api.AppState.pending.eyeTrackingSource, fullscreenStillActive ? 'webgazer' : 'off');
    if (!fullscreenStillActive) continue;
    assert.equal(app.api.AppState.pending.calibration.screenWidthPx, 1440);
    assert.equal(app.api.AppState.pending.calibration.screenHeightPx, 960);
    assert.equal(app.api.AppState.eyeTracking.initialized, true);
    const calibrate = timeline[1].timeline[0].timeline[0];
    calibrate.on_start();
    app.window.innerWidth = 1600; app.window.innerHeight = 900;
    calibrate.on_finish({});
    assert.equal(app.api.AppState.pending.eyeTrackingSource, 'off', 'Geometry changes during calibration still invalidate tracking');
  }
});

test('setup errors use the selected language before calibration begins', () => {
  for (const language of ['zh', 'en']) for (const [config, expected] of [
    [{ module: 'unknown' }, language === 'en' ? /Invalid activity/ : /活動模式無效/],
    [{ module: 'pursuit' }, language === 'en' ? /Choose at least one/ : /至少選擇一個方位/],
    [{ module: 'vor', eyeTrackingSource: 'off', ballArcmin: 600, screenWidthCm: .01, screenHeightCm: .01, viewingDistanceCm: 60 }, language === 'en' ? /too large/ : /超過螢幕/],
  ]) {
    const app = LoadExperiment(); let message;
    app.window.addEventListener('oculomotor:event', event => { message = event.detail.message; });
    app.window.oculomotorExperiment.Start({ ...config, language });
    assert.match(message, expected);
  }
});

for (const language of ['zh', 'en']) test(`camera positioning shows live eye readiness and blocks lost tracking (${language})`, async () => {
  const app = LoadExperiment(); app.window.oculomotorLanguage = language;
  let detected = false; let result;
  const elements = new Map();
  const display = { innerHTML: '', querySelector: selector => {
    if (!elements.has(selector)) elements.set(selector, { disabled: false, textContent: '', dataset: {},
      setAttribute(name, value) { this[name] = value; }, addEventListener(name, listener) { this[name] = listener; } });
    return elements.get(selector);
  } };
  app.jsPsych.extensions.webgazer = { isInitialized: () => true, showVideo() {}, resume() {}, pause() {}, hideVideo() {}, hidePredictions() {}, faceDetected: () => detected };
  app.jsPsych.finishTrial = value => { result = value; };
  new app.api.OptionalWebGazerCameraPlugin(app.jsPsych).trial(display, {});
  await Promise.resolve(); await Promise.resolve();
  assert.match(display.innerHTML, /class="app-page webgazer-camera-page"/);
  assert.match(display.innerHTML, /id="webgazer-eye-status"[^>]*role="status"[^>]*aria-live="polite"/);
  const status = elements.get('#webgazer-eye-status');
  const button = elements.get('#webgazer-camera-continue');
  const update = [...app.timers.values()].find(timer => timer.delay === 200).callback;
  assert.equal(button.disabled, true);
  assert.match(status.textContent, language === 'en' ? /not detected/i : /尚未偵測/);
  detected = true; update(); assert.equal(button.disabled, false);
  assert.match(status.textContent, language === 'en' ? /detected.*ready/i : /已偵測.*就緒/);
  detected = false; button.click(); assert.equal(result, undefined, 'A lost frame cannot enter calibration between status updates');
  update(); assert.equal(button.disabled, true);
  detected = true; update(); button.click(); assert.equal(result.ready, true);
  assert.equal(app.timers.size, 0, 'Readiness polling stops when the screen closes');
});

for (const language of ['zh', 'en']) test(`validation instructions and all outcomes are localized (${language})`, () => {
  for (const outcome of ['insufficient', 'pass', 'high-error']) {
    const app = LoadExperiment(); app.window.oculomotorLanguage = language; let onGaze;
    app.api.AppState.eyeTracking.source = 'webgazer';
    app.api.AppState.pending = { eyeTrackingSource: 'webgazer', settings: {} };
    app.jsPsych.extensions.webgazer = { hideVideo() {}, hidePredictions() {}, resume() {}, pause() {}, onGazeUpdate: callback => { onGaze = callback; return () => {}; } };
    const display = { innerHTML: '', querySelector: () => ({ addEventListener() {} }) };
    new app.api.GazeValidationPlugin(app.jsPsych).trial(display, {});
    assert.match(display.innerHTML, language === 'en' ? /Look directly at the target/ : /請注視目標/);
    for (const [x,y] of [[960,540],[384,216],[1536,216],[384,864],[1536,864]]) {
      app.timer(350);
      if (outcome !== 'insufficient') for (let index=0;index<3;index++) onGaze({ x: x + (outcome === 'high-error' ? 500 : 0), y });
      app.timer(1050);
    }
    assert.match(display.innerHTML, language === 'en' ? /Mean Angular Error/ : /平均角度誤差/);
    assert.match(display.innerHTML, language === 'en' ? /Center/ : /中央/);
    assert.match(display.innerHTML, language === 'en' ? /Recalibrate|Re-validate/ : /重新校正|重新驗證/);
    if (language === 'zh') assert.doesNotMatch(display.innerHTML, /Gaze Tracking Accuracy|Needs Attention|Top-Left|Proceed Anyway/);
    assert.equal(display.innerHTML.includes('data-val-action="proceed"'), outcome !== 'insufficient');
  }
});

test('results prioritize original Accuracy and TFF, localize target rows and move metadata below statistics', async () => {
  const scoreModule = await import(new URL('score.ts', base));
  let hub = true;
  const module = { exports: {} }; const require = createRequire(import.meta.url);
  new Function('module', 'exports', 'require', ts.transpileModule(readFileSync(new URL('OculomotorResults.tsx', base), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(module, module.exports,
    name => name === './score' ? scoreModule : name === './runtime/hubBridge' ? { IsHubGame: () => hub } : require(name));
  for (const language of ['zh', 'en']) for (const missing of [false, true]) {
    const result = { actual_duration_ms: 5000, completed_targets: 5, accuracy_rate: missing ? null : 80,
      valid_sec: missing ? null : 4, in_threshold_sec: missing ? null : 3.2, blink_sec: missing ? null : 1,
      gaze_sample_count: missing ? null : 120, threshold_deg: 3.5, validation_error_deg: 1, estimated_refresh_hz: 60,
      module: 'saccade', eye_tracking_source: missing ? 'off' : 'webgazer', end_reason: 'duration_complete',
      tff_mean_ms: missing ? null : 0, tff_detected_targets: missing ? null : 1, tff_total_targets: missing ? null : 2,
      tff_analysis: missing ? null : { targets: [{ target_number: 1, direction: 'rightUp', tff_ms: 0, status: 'detected' },
        { target_number: 2, direction: 'leftDown', tff_ms: null, status: 'no_confirmed_fixation' }] } };
    const markup = renderToStaticMarkup(React.createElement(module.exports.OculomotorResults, { result, language,
      summaryItems: [{ label: 'Metadata fixture', value: '53 cm' }], saveState: 'local', onRetry() {}, onExit() {} }));
    const priority = markup.slice(markup.indexOf('class="score-priority"'), markup.indexOf('class="score-analysis"'));
    assert.match(priority, /Accuracy/); assert.match(priority, /TFF/);
    assert.match(priority, missing ? (language === 'en' ? /Missing/ : /缺測/) : /80 %/);
    if (!missing) { assert.match(priority, /0 ms/); assert.match(priority, /1 \/ 2/); }
    assert.ok(markup.indexOf('Metadata fixture') > markup.indexOf('class="score-analysis"'));
    assert.ok(markup.indexOf('Metadata fixture') > markup.indexOf('class="score-tff"'));
    assert.match(markup, /value="accuracy" selected=""/);
    assert.doesNotMatch(markup, /rightUp|leftDown|no_confirmed_fixation|undefined|NaN/);
    hub = false;
    const standalone = renderToStaticMarkup(React.createElement(module.exports.OculomotorResults, { result, language,
      summaryItems: [], saveState: 'local', onRetry() {}, onExit() {} }));
    assert.match(standalone, /class="experiment-container results-container results-standalone"/);
    hub = true;
  }
});

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

test('the original OcuTrain geometry, scoring, TFF and four stimulus loops retain their exact source', () => {
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

function LoadExperiment() {
  let now = 1000;
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  const downloads = [];
  const events = new EventTarget();
  const schedule = (callback, delay) => { timers.set(++id, { callback, delay }); return id; };
  const document = { fullscreenElement: {}, addEventListener() {}, removeEventListener() {}, exitFullscreen: async () => {} };
  const window = { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1, screen: { width: 1920, height: 1080 },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events), setTimeout: schedule, clearTimeout: key => timers.delete(key),
    OculomotorDownload: (filename, content) => downloads.push({ filename, content }), webgazer: { resume() {}, pause() {} } };
  const jsPsych = { extensions: {}, run() {}, finishTrial() {}, pluginAPI: { setTimeout: schedule, clearAllTimeouts() {}, getKeyboardResponse() {}, cancelKeyboardResponse() {} } };
  const context = vm.createContext({ window, document, console, AbortController, Event, CustomEvent, performance: { now: () => now },
    setTimeout: schedule, clearTimeout: key => timers.delete(key), setInterval: schedule, clearInterval: key => timers.delete(key),
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: key => frames.delete(key),
    jsPsychModule: { ParameterType: {} }, initJsPsych: () => jsPsych });
  vm.runInContext(source.replace('  window.oculomotorExperiment = {',
    '  window.testApi = { AppState, EyeTrainingPlugin, GazeValidationPlugin, createCalibration };\n  window.oculomotorExperiment = {'), context);
  return { window, jsPsych, downloads, frames, timers, api: window.testApi,
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

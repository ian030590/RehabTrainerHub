import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import './oculomotor-reference.test.mjs';

const base = new URL('../apps/rehabtrainerhub/games/oculomotor-training/', import.meta.url);
const read = file => readFile(new URL(file, base), 'utf8');
const legacy = JSON.parse(await readFile(new URL('./fixtures/oculomotor-legacy.json', import.meta.url), 'utf8'));

test('an untracked activity cannot display a previous session validation result', async () => {
  const source=(await read('public/reference/experiment.js')).replaceAll('\r\n','\n');
  const body=source.slice(source.indexOf('  function run(config)')).match(/on_finish\(data\) \{([\s\S]*?)\n      }\n    };/)[1];
  const messages=[];
  new Function('AppState','post','data',body)({eyeTracking:{lastValidation:{meanErrorDeg:1.2}},pending:{}},(_type,payload)=>messages.push(payload),{
    eye_tracking:{enabled:false,source:'off'},actual_duration_ms:5000,completed_targets:4,timing:{estimated_refresh_hz:60},end_reason:'duration_complete',module:'pursuit',gaze_records:[],
    tff_mean_ms:80,tff_analysis:{targets:[]},
  });
  assert.equal(messages[0].result.validation_error_deg,null);
  assert.equal(messages[0].result.tff_mean_ms,null);
  assert.equal(messages[0].result.tff_analysis,null);
});

test('eye practice retains every original setting, default and boundary in its own form', async () => {
  const { settingsSections, defaultSettings, ValidateSettings } = await import(new URL('settings.ts', base));
  assert.deepEqual(settingsSections.flatMap(section => section.fields).map(field => field.key), legacy.settings.sections.flatMap(section => section.fields).map(field => field.key));
  assert.deepEqual(defaultSettings, Object.fromEntries(legacy.settings.sections.flatMap(section => section.fields).map(field => [field.key, field.default])));
  assert.equal(ValidateSettings(defaultSettings), true);
  for (const field of settingsSections.flatMap(section => section.fields)) {
    if (field.type === 'number') {
      assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: 0.1 }), true, field.key);
      for (const value of [0, -1, Infinity, NaN, String(field.default)])
        assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: value }), false, field.key);
    }
    if (field.type === 'slider') {
      assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: field.min }), true, field.key);
      assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: field.max }), true, field.key);
      for (const value of [field.min - 1, field.max + 1, Infinity, NaN, String(field.default)])
        assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: value }), false, field.key);
    }
    if (field.type === 'list') assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: 'invalid' }), false);
    if (field.type === 'checkbox') assert.equal(ValidateSettings({ ...defaultSettings, [field.key]: 'false' }), false);
  }
  const noDirections = { ...defaultSettings, ...Object.fromEntries(Array.from({ length: 8 }, (_, index) => [`axis${index}Enabled`, false])) };
  assert.equal(ValidateSettings(noDirections), false);
  assert.equal(ValidateSettings({ ...noDirections, module: 'vor' }), true);
});

test('results preserve all original numeric metrics, zero and absent gaze, on the private result contract', async () => {
  const { BuildGameScore, IsExperimentResult } = await import(new URL('score.ts', base));
  const result = { actual_duration_ms: 30000, completed_targets: 0, accuracy_rate: 0, valid_sec: 25,
    in_threshold_sec: 0, blink_sec: 5, gaze_sample_count: 900, threshold_deg: 2.4,
    validation_error_deg: 1.2, estimated_refresh_hz: 60, end_reason: 'duration_complete', module: 'pursuit', eye_tracking_source: 'webgazer' };
  assert.equal(IsExperimentResult(result), true);
  const score = BuildGameScore(result);
  for (const field of legacy.score.summary) assert.equal(score.summary[field.key], result[field.sources[0]], field.key);
  for (const field of legacy.score.columns) assert.equal(score.rounds[0][field.key], result[field.sources[0]], field.key);
  const untracked = { ...result, eye_tracking_source: 'off', accuracy_rate: null, valid_sec: null,
    in_threshold_sec: null, blink_sec: null, gaze_sample_count: null, threshold_deg: null, validation_error_deg: null };
  assert.equal(IsExperimentResult(untracked), true);
  assert.equal(BuildGameScore(untracked).summary.accuracy, null);
  assert.equal(BuildGameScore(untracked).summary.targets, 0);
  for (const patch of [{ actual_duration_ms: -1 }, { gaze_sample_count: 36001 }, { accuracy_rate: 101 }, { module: 'bad' }, { valid_sec: Infinity }])
    assert.equal(IsExperimentResult({ ...result, ...patch }), false);
  const { IsGameResult } = await import('../packages/ui/src/selfContainedGame.js');
  assert.equal(IsGameResult({ config: { module: 'pursuit' }, score }, 'oculomotor-training'), true);
});

test('the candidate owns UI and assets, retains vendor bytes, and exposes no camera, identity or network in the game', async () => {
  for (const file of ['main.tsx', 'OculomotorTrainingGame.tsx', 'runtime/hubBridge.ts', 'vite.config.ts'])
    assert.doesNotMatch(await read(file), /@rehab-trainer\/|packages\/ui|GetAuthToken|subjectId|getUserMedia|SaveRemoteTrainingRecord/);
  for (const file of ['settings.json', 'score.json', 'uploadOculomotorCsv.ts']) await assert.rejects(access(new URL(file, base)));
  const metadata = JSON.parse(await read('public/game.json'));
  assert.equal(metadata.trainer, 'vision'); assert.equal(metadata.category, 'vision');
  assert.equal(metadata.copy['zh-TW'].title, '眼動練習');
  assert.equal(metadata.author, '居家訓練網');
  assert.equal(metadata.copy['zh-TW'].description, '選擇中央目標辨識、平滑追蹤、跳視或凝視，依設定進行目標活動。');
  assert.equal(createHash('sha256').update(await readFile(new URL('public/' + metadata.preview, base))).digest('hex'), legacy.previewSha256);
  assert.equal(createHash('sha256').update(await readFile(new URL('public/reference/jspsych.js', base))).digest('hex'), '0ec03e513351fd0f2b59a192fea85aafe6ef1b21e0e2648f5ded475acdcc418c');
  assert.doesNotMatch(await read('public/reference/index.html'), /webgazer\.js|allow-same-origin|camera/);
  assert.doesNotMatch(await read('public/reference/experiment.js'), /window\.parent\.document|window\.parent\.postMessage|navigator\.mediaDevices/);
});

test('spotlight instructions identify target, directions, calibration and ending in both languages', async () => {
  const { GetOculomotorTutorialSteps } = await import(new URL('rules/tutorialSteps.ts', base));
  for (const language of ['zh', 'en']) for (const module of ['vor', 'pursuit', 'saccade', 'fixation']) {
    const steps = GetOculomotorTutorialSteps(language, module);
    assert.deepEqual(steps.map(step => step.target), ['.oculomotor-preview-target', '.oculomotor-preview-directions', '.oculomotor-preview-calibration', '.oculomotor-preview-stop']);
    assert.equal(new Set(steps.map(step => step.text)).size, 4);
    assert.ok(steps.every(step => step.title && step.text && step.place));
  }
  assert.notEqual(GetOculomotorTutorialSteps('en', 'pursuit')[0].text, GetOculomotorTutorialSteps('en', 'saccade')[0].text);
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFile(resolve(repoRoot, relativePath), 'utf8');
const readBytes = (relativePath) => readFile(resolve(repoRoot, relativePath));

const visionRuntime = 'apps/rehabtrainerhub/training-runtimes/vision';
const calibration = await read(`${visionRuntime}/src/utils/webgazerCalibration.ts`);
const loader = await read(`${visionRuntime}/src/utils/webgazerLoader.ts`);
const home = await read('apps/rehabtrainerhub/training-modules/vision/pages/HomePage.tsx');
const training = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/TrainingPage.tsx');
const oculomotorTimeline = await read('apps/rehabtrainerhub/training-modules/vision/experiment/timelines/oculomotorTimeline.ts');
const oculomotorPlugin = await read('apps/rehabtrainerhub/training-modules/vision/experiment/plugins/pixi-oculomotor-training.ts');
const oculomotorResults = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/results/OculomotorResults.tsx');
const oculomotorResultData = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/oculomotor/resultData.ts');
const trainingResultCsv = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/exportCsv.ts');
const trainingRecords = await read(`${visionRuntime}/src/utils/trainingRecords.ts`);
const zh = await read(`${visionRuntime}/src/i18n/zh.ts`);
const en = await read(`${visionRuntime}/src/i18n/en.ts`);
const visionCss = await read(`${visionRuntime}/src/index.css`);
const manifest = JSON.parse(await read('scripts/r2-ai-assets.manifest.json'));
const runtimePath = `${visionRuntime}/public/assets/webgazer/3.5.3/webgazer.js`;
const runtime = await read(runtimePath);
const gitAttributes = await read('.gitattributes');

const expectedOfficialFlowOrder = [
  'preload',
  'camera_instructions',
  'init_camera',
  'calibration_instructions',
  'calibration',
  'validation_instructions',
  'validation',
  'recalibrate',
  'calibration_done',
  'begin',
  'trial',
  'show_data',
];
const flowOrderBlock = calibration.match(
  /export const officialWebGazerFlowOrder\s*=\s*\[([\s\S]*?)\]\s*as const;/,
);
assert.ok(flowOrderBlock, 'officialWebGazerFlowOrder must be declared as a readonly array');
assert.deepEqual(
  [...flowOrderBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]),
  expectedOfficialFlowOrder,
  'the public WebGazer flow order must exactly match the official 12-node example',
);

const implementationFlowBlock = calibration.match(/const flow\s*=\s*\[([\s\S]*?)\];/);
assert.ok(implementationFlowBlock, 'the complete WebGazer flow must be assembled in one timeline');
assert.deepEqual(
  implementationFlowBlock[1].split(',').map((entry) => entry.trim()).filter(Boolean),
  [
    'preload',
    'cameraInstructions',
    'initCamera',
    'calibrationInstructions',
    'calibration',
    'validationInstructions',
    'validation',
    'recalibrate',
    'calibrationDone',
    'begin',
    'formalTrial',
    'showData',
  ],
  'the executable timeline must use the exact official 12-node order',
);

for (const pluginPackage of [
  '@jspsych/plugin-preload',
  '@jspsych/plugin-html-button-response',
  '@jspsych/plugin-html-keyboard-response',
  '@jspsych/plugin-webgazer-init-camera',
  '@jspsych/plugin-webgazer-calibrate',
  '@jspsych/plugin-webgazer-validate',
]) {
  assert.ok(
    calibration.includes(`from '${pluginPackage}'`),
    `official WebGazer flow must use the native plugin: ${pluginPackage}`,
  );
}
assert.equal(
  calibration.includes('class WebGazerInitCameraPlugin'),
  false,
  'the camera initialization plugin must not be forked locally',
);
for (const marker of [
  'type: PreloadPlugin',
  'type: HtmlButtonResponsePlugin',
  'type: HtmlKeyboardResponsePlugin',
  'type: WebGazerInitCameraPlugin',
  'type: WebGazerCalibratePlugin',
  'type: WebGazerValidatePlugin',
  "calibration_mode: 'click'",
  'repetitions_per_point: 2',
  'randomize_calibration_order: true',
  'roi_radius: 200',
  'time_to_saccade: 1000',
  'validation_duration: 2000',
  'post_trial_gap: 1000',
  "task: 'validate'",
  'CleanupWebGazerRuntime',
]) {
  assert.ok(calibration.includes(marker), `official WebGazer flow contract missing: ${marker}`);
}

const pointsStart = calibration.indexOf('const officialCalibrationPoints = [');
const pointsEnd = calibration.indexOf('] as const;', pointsStart);
assert.ok(pointsStart >= 0 && pointsEnd > pointsStart, 'official calibration points must be declared');
const calibrationPoints = [...calibration.slice(pointsStart, pointsEnd).matchAll(/\[(\d+),\s*(\d+)\]/g)]
  .map((match) => [Number(match[1]), Number(match[2])]);
assert.deepEqual(
  calibrationPoints,
  [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  'calibration and validation must use the official five-point layout',
);
assert.ok(
  calibration.includes('calibration_points: officialCalibrationPoints.map'),
  'the native calibration plugin must receive the official five points',
);
assert.ok(
  calibration.includes('validation_points: officialCalibrationPoints.map'),
  'the native validation plugin must receive the same official five points',
);

const recalibrationBlock = calibration.match(
  /const recalibrate\s*=\s*\{[\s\S]*?timeline:\s*\[([\s\S]*?)\],\s*conditional_function:/,
);
assert.ok(recalibrationBlock, 'the conditional recalibration timeline must exist');
assert.deepEqual(
  recalibrationBlock[1].split(',').map((entry) => entry.trim()).filter(Boolean),
  ['recalibrateInstructions', 'calibration', 'validationInstructions', 'validation'],
  'failed validation must repeat instructions, calibration, and validation',
);
for (const marker of [
  'const minimumPercentInRoi = 50',
  'value < minimumPercentInRoi',
  'conditional_function: () => ShouldRecalibrate(jsPsych)',
]) {
  assert.ok(calibration.includes(marker), `conditional recalibration contract missing: ${marker}`);
}
for (const forbidden of [
  'StartHeadPositionGuidance',
  'StartInitCameraFailureRecovery',
  'ClassifyHeadDistance',
  'GetHeadDistanceStatus',
  'StartValidationResultsPresentation',
  'show_validation_data: true',
]) {
  assert.equal(
    calibration.includes(forbidden),
    false,
    `camera positioning and validation UI must stay owned by official jsPsych plugins: ${forbidden}`,
  );
}
assert.ok(
  visionCss.includes('.webgazer-flow-instructions'),
  'module-owned instruction panels must keep their scoped presentation styles',
);
for (const forbiddenSelector of [
  '#webgazer-init-container',
  '#webgazer-calibrate-container',
  '#webgazer-validate-container',
  '#webgazerVideoContainer',
  '#calibration-point',
  '#validation-point',
  '.webgazer-jspsych-instructions',
  '.webgazer-cancel-btn',
]) {
  assert.equal(
    visionCss.includes(forbiddenSelector),
    false,
    `CSS must not override native jsPsych WebGazer UI: ${forbiddenSelector}`,
  );
}
assert.ok(loader.includes('Timed out loading WebGazer'), 'script loading must have a timeout');
assert.ok(loader.includes("webGazerRuntimeVersion = '3.5.3'"), 'WebGazer must use a pinned runtime version');
assert.ok(loader.includes('ConfigureWebGazerAssetPath'), 'the MediaPipe path must follow the loaded script origin');
assert.ok(loader.includes('EnsurePredictionTimestamp'), 'WebGazer predictions must be timestamped for native validation');
assert.equal(loader.includes('local-v1'), false, 'the obsolete WebGazer runtime must not be a fallback');
assert.ok(runtime.includes('faceMeshSolutionPath:"./mediapipe/face_mesh"'), 'the self-hosted runtime must default to local MediaPipe assets');
assert.ok(
  gitAttributes.includes(`${visionRuntime}/public/assets/webgazer/3.5.3/** -text`),
  'vendored WebGazer assets must be protected from line-ending conversion',
);

const runtimeAssets = [
  ['webgazer.js', 'text/javascript; charset=utf-8'],
  ['mediapipe/face_mesh/face_mesh.binarypb', 'application/octet-stream'],
  ['mediapipe/face_mesh/face_mesh.js', 'text/javascript; charset=utf-8'],
  ['mediapipe/face_mesh/face_mesh_solution_packed_assets.data', 'application/octet-stream'],
  ['mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js', 'text/javascript; charset=utf-8'],
  ['mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js', 'text/javascript; charset=utf-8'],
  ['mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm', 'application/wasm'],
  ['mediapipe/face_mesh/face_mesh_solution_wasm_bin.js', 'text/javascript; charset=utf-8'],
  ['mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm', 'application/wasm'],
];
for (const [relativePath, contentType] of runtimeAssets) {
  const source = `${visionRuntime}/public/assets/webgazer/3.5.3/${relativePath}`;
  const key = `ai/webgazer/3.5.3/${relativePath}`;
  const asset = manifest.assets.find((candidate) => candidate.key === key);
  assert.ok(asset, `R2 manifest is missing ${key}`);
  assert.equal(asset.source, source, `R2 manifest source mismatch for ${key}`);
  assert.equal(asset.contentType, contentType, `R2 manifest content type mismatch for ${key}`);
  const bytes = await readBytes(source);
  assert.equal(asset.size, bytes.byteLength, `R2 manifest size mismatch for ${key}`);
  assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'), `R2 manifest hash mismatch for ${key}`);
}
for (const host of [training]) {
  assert.ok(host.includes('CleanupWebGazerRuntime'), 'every WebGazer host must clean up the runtime');
}
assert.equal(
  home.includes('useMediaPermissionPreflight'),
  false,
  'HomePage must not request camera permission before the native init_camera trial',
);
assert.equal(
  /mediaDevices\s*\.\s*getUserMedia/.test(home),
  false,
  'HomePage must leave camera acquisition exclusively to the native init_camera trial',
);
const oculomotorConfigStart = home.indexOf(
  "expandedModule === 'oculomotor-training' && rulesModule !== 'oculomotor-training'",
);
assert.ok(oculomotorConfigStart >= 0, 'oculomotor training config must remain present');
const webGazerConfigIndex = home.indexOf("title={t('settings.train.wgToggle')}", oculomotorConfigStart);
const trainingModeConfigIndex = home.indexOf("title={t('home.config.trainingMode')}", oculomotorConfigStart);
const durationConfigIndex = home.indexOf("title={t('home.config.durationSec')}", oculomotorConfigStart);
assert.ok(
  webGazerConfigIndex > oculomotorConfigStart
    && webGazerConfigIndex < trainingModeConfigIndex,
  'WebGazer analysis settings must be the first oculomotor config section',
);
const trainingModeConfig = home.slice(trainingModeConfigIndex, durationConfigIndex);
assert.ok(
  trainingModeConfig.includes('<select') && trainingModeConfig.includes('value={oculomotorMode}'),
  'oculomotor training mode must use a select control',
);
const durationConfig = home.slice(durationConfigIndex, home.indexOf("title={t('home.config.speedAndSize')}", durationConfigIndex));
assert.ok(
  durationConfig.includes('type="range"')
    && durationConfig.includes('min="15"')
    && durationConfig.includes('max="300"'),
  'oculomotor duration must use a bounded range slider',
);
assert.ok(oculomotorTimeline.includes('show_gaze_point'), 'the timeline must forward the gazepoint display setting');
assert.ok(oculomotorTimeline.includes("import WebGazerExtension from '@jspsych/extension-webgazer'"), 'the formal trial must use the official WebGazer extension');
assert.ok(oculomotorTimeline.includes('extensions: enableWebGazer'), 'the formal trial must activate the official WebGazer extension');
assert.ok(
  /params:\s*\{\s*targets:\s*\['\.oculomotor-training-trial(?: canvas)?'\]\s*\}/.test(oculomotorTimeline),
  'the official extension must measure the formal Pixi trial target',
);
assert.ok(
  oculomotorTimeline.includes('on_finish: enableWebGazer ? ConsumeOfficialWebGazerTrialData : undefined'),
  'the formal trial must consume native extension data before persistence',
);
assert.ok(
  oculomotorPlugin.includes('webGazerExtension?.onGazeUpdate?.bind(webGazerExtension)')
    && oculomotorPlugin.includes('subscribeToOfficialGazeUpdates!(handleGazePrediction)'),
  'formal gaze coordinates must come from the official WebGazer extension callback',
);
assert.equal(
  oculomotorPlugin.includes('onGazeUpdate?.(handleGazePrediction)'),
  false,
  'the formal trial must fail loudly instead of silently skipping an unavailable extension callback',
);
assert.ok(oculomotorPlugin.includes('setGazeListener?.(handleEyeFeatures)'), 'raw eye features must only feed pupil and blink estimates');
assert.ok(oculomotorPlugin.includes('hideVideo'), 'the formal trial must hide the camera preview');
assert.ok(oculomotorPlugin.includes('showPredictions'), 'the training plugin must support visible gazepoints');
assert.ok(oculomotorPlugin.includes('gaze_sample_columns'), 'the training plugin must store the raw sample schema');
assert.ok(oculomotorPlugin.includes('gaze_samples'), 'the training plugin must store every accepted gaze/target sample');
assert.ok(oculomotorPlugin.includes('time_to_first_fixation_ms'), 'the training plugin must calculate TTFF');
assert.equal(oculomotorPlugin.includes("wgState === 'calibration'"), false, 'training must not overwrite native calibration data');
assert.equal(oculomotorPlugin.includes('recordScreenPosition'), false, 'training must not inject fake center calibration clicks');
assert.ok(training.includes("item.trial_type === 'pixi-oculomotor-training'"), 'calibration trials must not replace the training result');
assert.ok(
  calibration.includes('export function ConsumeOfficialWebGazerTrialData'),
  'native extension data must have a dedicated formal-trial consumer',
);
const consumerStart = calibration.indexOf('export function ConsumeOfficialWebGazerTrialData');
const consumerEnd = calibration.indexOf('\n}\n\nexport async function ResetWebGazerCalibrationData', consumerStart);
assert.ok(consumerStart >= 0 && consumerEnd > consumerStart, 'native extension data consumer must be complete');
const consumer = calibration.slice(consumerStart, consumerEnd);
for (const marker of [
  'CountOfficialWebGazerSamples(data)',
  'officialSampleCount > 0 && pairedSampleCount > 0',
  'data.webgazer_sample_count = officialSampleCount',
  'data.webgazer_data_consumed = consumedNativeData',
  "'jspsych-webgazer-extension'",
  'if (!consumedNativeData)',
  'data.aoi_score = undefined',
  'data.mean_target_distance_px = undefined',
  'data.target_distance_sd_px = undefined',
  'data.time_to_first_fixation_ms = undefined',
  'data.average_pupil_size_px = undefined',
  'data.pupil_size_sd_px = undefined',
  'data.blink_count = undefined',
]) {
  assert.ok(consumer.includes(marker), `native extension data consumer contract missing: ${marker}`);
}
assert.equal(
  /\bdelete\s+[^;\n]*webgazer_data/.test(consumer),
  false,
  'the canonical jsPsych webgazer_data payload must remain in the saved formal trial',
);
assert.ok(
  calibration.includes('trialData?.webgazer_data_consumed === true'),
  'show_data must only report captured gaze samples after native and paired data were consumed',
);
assert.equal(
  training.includes('StripRedundantWebGazerExtensionData'),
  false,
  'TrainingPage must not strip native extension data before the formal trial consumes it',
);
assert.equal(
  /\bdelete\s+[^;\n]*webgazer_data/.test(training),
  false,
  'TrainingPage must not directly delete native extension data',
);
assert.ok(oculomotorResults.includes('FindOculomotorResult'), 'results must use the canonical trial selector');
assert.ok(oculomotorResultData.includes("oculomotorTrialType = 'pixi-oculomotor-training'"), 'results must identify the Pixi training trial');
assert.ok(oculomotorResultData.includes('result.trial_type === oculomotorTrialType'), 'results must select the Pixi training trial');
for (const exportSource of [trainingResultCsv, trainingRecords]) {
  for (const marker of [
    'exp.csv.meanTargetDistance',
    'exp.csv.targetDistanceSd',
    'exp.csv.timeToFirstFixation',
    'exp.csv.pupilSizeEstimate',
    'exp.csv.pupilSizeSd',
    'exp.csv.blinkCountEstimate',
    'exp.csv.gazeSampleCount',
    'exp.csv.gazeTimestamp',
    'exp.csv.gazeX',
    'exp.csv.gazeY',
    'exp.csv.targetX',
    'exp.csv.targetY',
  ]) {
    assert.ok(exportSource.includes(marker), `eye-tracking CSV contract missing: ${marker}`);
  }
}
for (const dictionary of [zh, en]) {
  for (const key of [
    'exp.res.meanTargetDistance',
    'exp.res.targetDistanceSd',
    'exp.res.timeToFirstFixation',
    'exp.res.pupilSizeEstimate',
    'exp.res.pupilSizeSd',
    'exp.res.blinkCountEstimate',
  ]) {
    assert.ok(dictionary.includes(`'${key}'`), `translation key missing: ${key}`);
  }
}

console.log('WebGazer calibration contract passed.');

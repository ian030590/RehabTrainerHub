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
const training = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/TrainingPage.tsx');
const oculomotorTimeline = await read('apps/rehabtrainerhub/training-modules/vision/experiment/timelines/oculomotorTimeline.ts');
const oculomotorPlugin = await read('apps/rehabtrainerhub/training-modules/vision/experiment/plugins/pixi-oculomotor-training.ts');
const oculomotorResults = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/results/OculomotorResults.tsx');
const oculomotorResultData = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/oculomotor/resultData.ts');
const trainingResultCsv = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/exportCsv.ts');
const trainingRecords = await read(`${visionRuntime}/src/utils/trainingRecords.ts`);
const zh = await read(`${visionRuntime}/src/i18n/zh.ts`);
const en = await read(`${visionRuntime}/src/i18n/en.ts`);
const manifest = JSON.parse(await read('scripts/r2-ai-assets.manifest.json'));
const runtimePath = `${visionRuntime}/public/assets/webgazer/3.5.3/webgazer.js`;
const runtime = await read(runtimePath);
const gitAttributes = await read('.gitattributes');

assert.ok(
  calibration.includes("@jspsych/plugin-webgazer-init-camera"),
  'calibration must use the native jsPsych WebGazer init-camera plugin',
);
assert.ok(
  calibration.includes("@jspsych/plugin-webgazer-calibrate"),
  'calibration must use the native jsPsych WebGazer calibrate plugin',
);
assert.ok(
  calibration.includes("@jspsych/plugin-webgazer-validate"),
  'calibration must use the native jsPsych WebGazer validate plugin',
);
assert.equal(
  calibration.includes('class WebGazerInitCameraPlugin'),
  false,
  'the camera initialization plugin must not be forked locally',
);
for (const marker of [
  'StartHeadPositionGuidance',
  'StartInitCameraFailureRecovery',
  "'too-far'",
  "'too-close'",
  'button.dataset.headPositionReady',
  'stopImmediatePropagation',
  'WebGazerValidatePlugin',
  'show_validation_data: true',
  'StartValidationResultsPresentation',
  'ResumeWebGazerForValidation',
  'CleanupWebGazerRuntime',
  'activeInitCameraCleanup',
  'activeInitFailureCleanup',
  'activeValidationCleanup',
]) {
  assert.ok(calibration.includes(marker), `native WebGazer flow contract missing: ${marker}`);
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
assert.ok(oculomotorTimeline.includes('show_gaze_point'), 'the timeline must forward the gazepoint display setting');
assert.ok(oculomotorPlugin.includes('setGazeListener'), 'the training plugin must consume live WebGazer samples');
assert.ok(oculomotorPlugin.includes('showPredictions'), 'the training plugin must support visible gazepoints');
assert.ok(oculomotorPlugin.includes('gaze_sample_columns'), 'the training plugin must store the raw sample schema');
assert.ok(oculomotorPlugin.includes('gaze_samples'), 'the training plugin must store every accepted gaze/target sample');
assert.ok(oculomotorPlugin.includes('time_to_first_fixation_ms'), 'the training plugin must calculate TTFF');
assert.equal(oculomotorPlugin.includes("wgState === 'calibration'"), false, 'training must not overwrite native calibration data');
assert.equal(oculomotorPlugin.includes('recordScreenPosition'), false, 'training must not inject fake center calibration clicks');
assert.ok(training.includes("item.trial_type === 'pixi-oculomotor-training'"), 'calibration trials must not replace the training result');
assert.ok(oculomotorResults.includes('FindOculomotorResult'), 'results must use the canonical trial selector');
assert.ok(oculomotorResultData.includes("oculomotorTrialType = 'pixi-oculomotor-training'"), 'results must identify the Pixi training trial');
assert.ok(oculomotorResultData.includes('result.trial_type === oculomotorTrialType'), 'results must select the Pixi training trial');
for (const exportSource of [trainingResultCsv, trainingRecords]) {
  for (const marker of [
    'exp.csv.meanTargetDistance',
    'exp.csv.targetDistanceSd',
    'exp.csv.timeToFirstFixation',
    'exp.csv.pupilSizeEstimate',
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
    'settings.wg.moveCloser',
    'settings.wg.moveFarther',
    'settings.wg.validationResultTitle',
    'settings.wg.validationButton',
    'exp.res.meanTargetDistance',
    'exp.res.targetDistanceSd',
    'exp.res.timeToFirstFixation',
    'exp.res.pupilSizeEstimate',
    'exp.res.blinkCountEstimate',
  ]) {
    assert.ok(dictionary.includes(`'${key}'`), `translation key missing: ${key}`);
  }
}

console.log('WebGazer calibration contract passed.');

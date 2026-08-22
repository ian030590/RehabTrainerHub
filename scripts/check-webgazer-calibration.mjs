import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const read = (relativePath) => readFile(resolve(repoRoot, relativePath), 'utf8');
const readBytes = (relativePath) => readFile(resolve(repoRoot, relativePath));

const calibration = await read('apps/visiontrainer/src/utils/webgazerCalibration.ts');
const loader = await read('apps/visiontrainer/src/utils/webgazerLoader.ts');
const settings = await read('apps/visiontrainer/src/pages/settings/SettingsPage.tsx');
const training = await read('apps/rehabtrainerhub/training-modules/vision/pages/training/TrainingPage.tsx');
const acuity = await read('apps/visiontrainer/src/pages/assessment/AcuityTestPage.tsx');
const zh = await read('apps/visiontrainer/src/i18n/zh.ts');
const en = await read('apps/visiontrainer/src/i18n/en.ts');
const manifest = JSON.parse(await read('scripts/r2-ai-assets.manifest.json'));
const runtimePath = 'apps/visiontrainer/public/assets/webgazer/3.5.3/webgazer.js';
const runtime = await read(runtimePath);

assert.equal(
  calibration.includes("@jspsych/plugin-webgazer-init-camera"),
  false,
  'calibration must not use the stock permanently-disabled init-camera plugin',
);
for (const marker of [
  'ready_timeout_ms',
  'ready_stable_ms',
  'faceDetected',
  'trial.retry_text',
  'CleanupWebGazerRuntime',
  'activeInitCameraCleanup',
  'abortTrial',
]) {
  assert.ok(calibration.includes(marker), `WebGazer readiness contract missing: ${marker}`);
}
assert.ok(loader.includes('Timed out loading WebGazer'), 'script loading must have a timeout');
assert.ok(loader.includes("webGazerRuntimeVersion = '3.5.3'"), 'WebGazer must use a pinned runtime version');
assert.ok(loader.includes('ConfigureWebGazerAssetPath'), 'the MediaPipe path must follow the loaded script origin');
assert.equal(loader.includes('local-v1'), false, 'the obsolete WebGazer runtime must not be a fallback');
assert.ok(runtime.includes('faceMeshSolutionPath:"./mediapipe/face_mesh"'), 'the self-hosted runtime must default to local MediaPipe assets');
assert.equal(settings.includes('endExperiment'), false, 'jsPsych cleanup must use the supported abortExperiment API');
assert.ok(settings.includes('abortExperiment'), 'settings cancel must abort the active jsPsych timeline');

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
  const source = `apps/visiontrainer/public/assets/webgazer/3.5.3/${relativePath}`;
  const key = `ai/webgazer/3.5.3/${relativePath}`;
  const asset = manifest.assets.find((candidate) => candidate.key === key);
  assert.ok(asset, `R2 manifest is missing ${key}`);
  assert.equal(asset.source, source, `R2 manifest source mismatch for ${key}`);
  assert.equal(asset.contentType, contentType, `R2 manifest content type mismatch for ${key}`);
  const bytes = await readBytes(source);
  assert.equal(asset.size, bytes.byteLength, `R2 manifest size mismatch for ${key}`);
  assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'), `R2 manifest hash mismatch for ${key}`);
}
for (const host of [settings, training, acuity]) {
  assert.ok(host.includes('CleanupWebGazerRuntime'), 'every WebGazer host must clean up the runtime');
  assert.ok(host.includes("settings.wg.retry"), 'every calibration host must provide retry copy');
}
for (const dictionary of [zh, en]) {
  for (const key of [
    'settings.wg.loading',
    'settings.wg.waitingFace',
    'settings.wg.ready',
    'settings.wg.timeout',
    'settings.wg.retry',
    'settings.wg.errorStart',
  ]) {
    assert.ok(dictionary.includes(`'${key}'`), `translation key missing: ${key}`);
  }
}

console.log('WebGazer calibration contract passed.');

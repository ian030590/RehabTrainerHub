import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function BuildEyeTracking(appRoot, outputDirectory) {
  const root = resolve(appRoot, '../..');
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/eye-tracking-assets.manifest.json'), 'utf8'));
  const inputRoot = resolve(outputDirectory, 'input/eye-tracking-1.1.0');
  await mkdir(inputRoot, { recursive: true });
  const original = await readFile(resolve(appRoot, 'runtime/WEBGAZER-SOURCE.txt'));
  if (hash(original) !== manifest.vendorSha256) throw new Error('WebGazer vendor digest mismatch');
  // Only host model URLs and pre-acquired camera plumbing change; retain the original regression and model implementation.
  let source = original.toString('utf8').replaceAll('\r\n', '\n');
  const extensionOffset = source.indexOf('  /* Vendored: @jspsych/extension-webgazer');
  if (extensionOffset <= 0) throw new Error('WebGazer extension boundary mismatch');
  source = source.slice(0, extensionOffset);
  for (const [external, local] of [['https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1', './models/facemesh/model.json'], ['https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1', './models/blazeface/model.json']]) {
    if (!source.includes(external)) throw new Error('WebGazer model URL mismatch');
    source = source.replaceAll(external, local);
  }
  for (const [external, local] of [['FACEMESH_GRAPHMODEL_PATH, { fromTFHub: true }', 'FACEMESH_GRAPHMODEL_PATH, { fromTFHub: false }'],
    ['BLAZEFACE_MODEL_URL,{fromTFHub:!0}', 'BLAZEFACE_MODEL_URL,{fromTFHub:!1}']]) {
    if (!source.includes(external)) throw new Error('WebGazer local model loader mismatch');
    source = source.replace(external, local);
  }
  const cameraCall = 'navigator.mediaDevices.getUserMedia( src_webgazer.params.camConstraints )';
  const calibrationGuard = 'var recordScreenPosition = function(x, y, eventType) {\n  if (paused) {\n    return;\n  }';
  if (!source.includes(cameraCall) || !source.includes(calibrationGuard)) throw new Error('WebGazer camera or calibration adaptation mismatch');
  source = source.replace(cameraCall, 'Promise.resolve(window.TrainerHubEyeStream)');
  source = source.replace(calibrationGuard, 'var recordScreenPosition = function(x, y, eventType) {');
  const localGuard = "window.location.hostname !== 'localhost' && window.chrome";
  if (!source.includes(localGuard)) throw new Error('WebGazer secure-context adaptation mismatch');
  source = source.replace(localGuard, "window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.chrome");
  await writeFile(resolve(inputRoot, 'webgazer.js'), source);
  for (const asset of manifest.assets) {
    const cachePath = resolve(root, '.tmp/eye-tracking-model', asset.path);
    let bytes = await readFile(cachePath).catch(() => null);
    if (!bytes || hash(bytes) !== asset.sha256) {
      const response = await fetch(asset.sourceUrl, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Eye model download failed (${response.status})`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.size || hash(bytes) !== asset.sha256) throw new Error('Eye model digest mismatch');
      await mkdir(dirname(cachePath), { recursive: true }); await writeFile(cachePath, bytes);
    }
    if (bytes.length !== asset.size || hash(bytes) !== asset.sha256) throw new Error('Eye input asset digest mismatch');
    const destination = resolve(inputRoot, 'models', asset.path);
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes);
  }
  for (const [sourceFile, destination] of [['eyeTrackingController.js', 'eyeTrackingController.js'], ['eyeTrackingEntry.js', 'eyeTrackingEntry.js']])
    await cp(resolve(appRoot, 'runtime', sourceFile), resolve(inputRoot, destination));
  await build({ configFile: false, publicDir: false, logLevel: 'warn', build: { outDir: inputRoot, emptyOutDir: false,
    lib: { entry: resolve(appRoot, 'runtime/eyeTrackingClient.js'), name: 'TrainerHubEyeTracking', formats: ['iife'], fileName: () => 'index.js' } } });
  await writeFile(resolve(inputRoot, 'preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebGazer camera</title><link rel="stylesheet" href="./preview.css"></head><body><script src="./webgazer.js"></script><script type="module" src="./eyeTrackingEntry.js"></script></body></html>');
  await writeFile(resolve(inputRoot, 'preview.css'), ':root{--camera-background:#202428}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--camera-background)}');
  const legacyRoot = resolve(outputDirectory, 'input/eye-tracking-1.0.0');
  await cp(inputRoot, legacyRoot, { recursive: true });
  const legacyEntry = (await readFile(resolve(inputRoot, 'eyeTrackingEntry.js'), 'utf8')).replace('  timeOrigin: performance.timeOrigin,', '').replace('  now: () => performance.now(),', '');
  await writeFile(resolve(legacyRoot, 'eyeTrackingEntry.js'), legacyEntry);
}

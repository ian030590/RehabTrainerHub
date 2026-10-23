import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

// Versioned sensor proxies for Every Ball (pose, microphone) and tongue training. Every model and WASM file
// is checked against scripts/r2-ai-assets.manifest.json; browsers never load them from a CDN.
const proxies = [
  { directory: 'pose-tracking-1.0.0', entry: 'poseTrackingEntry.ts', global: 'TrainerHubPoseTracking',
    models: ['/hand_landmarker/', '/pose_landmarker_lite/'], tensorflow: false },
  { directory: 'tongue-tracking-1.0.0', entry: 'tongueTrackingEntry.ts', global: 'TrainerHubTongueTracking',
    models: ['/face_landmarker/'], tensorflow: true },
  { directory: 'microphone-1.0.0', entry: 'microphoneEntry.js', global: 'TrainerHubMicrophone', models: null, tensorflow: false },
];

export async function BuildSensorInputs(appRoot, outputDirectory) {
  const root = resolve(appRoot, '../..');
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/r2-ai-assets.manifest.json'), 'utf8'));
  for (const proxy of proxies) {
    const inputRoot = resolve(outputDirectory, 'input', proxy.directory);
    await mkdir(inputRoot, { recursive: true });
    if (proxy.models) {
      await mkdir(resolve(inputRoot, 'wasm'), { recursive: true });
      const assets = manifest.assets.filter(asset => asset.key.includes('/tasks-vision/0.10.35/wasm/')
        || proxy.models.some(model => asset.key.includes(model)));
      if (assets.length !== 6 + proxy.models.length) throw new Error(`${proxy.directory} is missing a verified asset.`);
      for (const asset of assets) {
        const name = asset.key.split('/').at(-1);
        await writeFile(resolve(inputRoot, asset.source ? 'wasm/' + name : name), await ReadVerifiedAsset(root, asset));
      }
      await cp(resolve(root, 'node_modules/@mediapipe/tasks-vision/README.md'), resolve(inputRoot, 'MEDIAPIPE-NOTICE.txt'));
      await cp(resolve(appRoot, 'runtime/MEDIAPIPE-LICENSE.txt'), resolve(inputRoot, 'MEDIAPIPE-LICENSE.txt'));
    }
    if (proxy.tensorflow) {
      const versions = await Promise.all(['@tensorflow/tfjs-core', '@tensorflow/tfjs-backend-webgl', '@tensorflow/tfjs-backend-cpu', '@tensorflow-models/knn-classifier']
        .map(async name => `${name} ${JSON.parse(await readFile(resolve(root, 'node_modules', name, 'package.json'), 'utf8')).version}`));
      await writeFile(resolve(inputRoot, 'TENSORFLOW-NOTICE.txt'),
        `This proxy bundles ${versions.join(', ')}.\nCopyright Google LLC. Licensed under the Apache License 2.0; see TENSORFLOW-LICENSE.txt.\n`);
      await cp(resolve(appRoot, 'runtime/MEDIAPIPE-LICENSE.txt'), resolve(inputRoot, 'TENSORFLOW-LICENSE.txt'));
    }
    await build({ configFile: false, publicDir: false, logLevel: 'warn',
      build: { outDir: inputRoot, emptyOutDir: false, minify: true,
        lib: { entry: resolve(appRoot, 'runtime', proxy.entry), name: proxy.global, formats: ['iife'], fileName: () => 'index.js' },
      },
    });
  }
  console.log('Built versioned pose, tongue and microphone input with verified MediaPipe 0.10.35 WASM and models.');
}

async function ReadVerifiedAsset(root, asset) {
  let bytes;
  if (asset.source) bytes = await readFile(resolve(root, asset.source));
  else {
    const cachePath = resolve(root, '.tmp/input-models', asset.key.split('/').at(-1));
    bytes = await readFile(cachePath).catch(() => null);
    if (!bytes || Hash(bytes) !== asset.sha256) {
      const response = await fetch(asset.sourceUrl, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Model download failed (${response.status}): ${asset.key}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== asset.size || Hash(bytes) !== asset.sha256) throw new Error(`Model digest mismatch: ${asset.key}`);
      await mkdir(resolve(cachePath, '..'), { recursive: true });
      await writeFile(cachePath, bytes);
    }
  }
  if (bytes.length !== asset.size || Hash(bytes) !== asset.sha256) throw new Error(`Input asset digest mismatch: ${asset.key}`);
  return bytes;
}

function Hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

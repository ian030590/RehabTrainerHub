import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

export async function BuildHandTracking(appRoot, outputDirectory) {
  const root = resolve(appRoot, '../..');
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/r2-ai-assets.manifest.json'), 'utf8'));
  const assets = manifest.assets.filter(asset => asset.key.includes('/tasks-vision/0.10.35/wasm/')
    || asset.key.includes('/hand_landmarker/'));
  const inputRoot = resolve(outputDirectory, 'input/hand-tracking-1.0.0');
  await mkdir(resolve(inputRoot, 'wasm'), { recursive: true });
  for (const asset of assets) {
    let bytes;
    if (asset.source) bytes = await readFile(resolve(root, asset.source));
    else {
      const cachePath = resolve(root, '.tmp/hand-tracking-model/hand_landmarker.task');
      bytes = await readFile(cachePath).catch(() => null);
      if (!bytes || Hash(bytes) !== asset.sha256) {
        const response = await fetch(asset.sourceUrl, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`Hand model download failed (${response.status})`);
        bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== asset.size || Hash(bytes) !== asset.sha256) throw new Error('Hand model digest mismatch');
        await mkdir(resolve(cachePath, '..'), { recursive: true });
        await writeFile(cachePath, bytes);
      }
    }
    if (bytes.length !== asset.size || Hash(bytes) !== asset.sha256) throw new Error(`Input asset digest mismatch: ${asset.key}`);
    const name = asset.key.split('/').at(-1);
    await writeFile(resolve(inputRoot, asset.source ? 'wasm/' + name : name), bytes);
  }
  await build({ configFile: false, publicDir: false, logLevel: 'warn',
    build: { outDir: inputRoot, emptyOutDir: false, minify: true,
      lib: { entry: resolve(appRoot, 'runtime/handTrackingEntry.ts'), name: 'TrainerHubHandTracking',
        formats: ['iife'], fileName: () => 'index.js' },
    },
  });
  await cp(resolve(root, 'node_modules/@mediapipe/tasks-vision/README.md'), resolve(inputRoot, 'MEDIAPIPE-NOTICE.txt'));
  await cp(resolve(appRoot, 'runtime/MEDIAPIPE-LICENSE.txt'), resolve(inputRoot, 'MEDIAPIPE-LICENSE.txt'));
  console.log('Built versioned hand input with verified MediaPipe 0.10.35 WASM and model.');
}

function Hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

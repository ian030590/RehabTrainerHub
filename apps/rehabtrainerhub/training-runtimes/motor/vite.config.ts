import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/runtimes/motor/',
  plugins: [react()],
  resolve: { alias: {
    '@rehab-trainer/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
    '@rehab-trainer/hub-modules': fileURLToPath(new URL('../../training-modules', import.meta.url)),
  } },
  server: { watch: { ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'] } },
  build: {
    outDir: '../../out/runtimes/motor', assetsDir: 'assets', emptyOutDir: true,
    rollupOptions: { output: { manualChunks: CreateRuntimeChunks } },
  },
});

function CreateRuntimeChunks(id: string) {
  const normalizedId = id.replaceAll('\\', '/');
  if (normalizedId.includes('.css')) return;
  if (normalizedId.includes('vite/preload-helper') || normalizedId.includes('commonjsHelpers')) return 'bundler-runtime';
  if (/\/node_modules\/(?:react|react-dom|scheduler|react-router|react-router-dom)\//.test(normalizedId)) return 'react-runtime';
  if (normalizedId.includes('/node_modules/three/')) return 'three-runtime';
  if (normalizedId.includes('/node_modules/pixi.js/') || normalizedId.includes('/node_modules/@pixi/')) return 'pixi-runtime';
  if (normalizedId.includes('/node_modules/jspsych/') || normalizedId.includes('/node_modules/@jspsych/')) return 'experiment-runtime';
  if (normalizedId.includes('/node_modules/@tensorflow/') || normalizedId.includes('/node_modules/@tensorflow-models/')) return 'tensorflow-runtime';
}

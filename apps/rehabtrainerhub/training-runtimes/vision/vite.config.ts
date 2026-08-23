import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/runtimes/vision/', plugins: [react()],
  resolve: { alias: {
    '@rehab-trainer/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
    '@rehab-trainer/hub-modules': fileURLToPath(new URL('../../training-modules', import.meta.url)),
  } },
  server: { watch: { usePolling: true, interval: 750, ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'] } },
  build: {
    outDir: '../../out/runtimes/vision', assetsDir: 'assets', emptyOutDir: true,
    rollupOptions: { output: { manualChunks(id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (normalizedId.includes('/node_modules/three/')) return 'three-runtime';
    } } },
  },
});

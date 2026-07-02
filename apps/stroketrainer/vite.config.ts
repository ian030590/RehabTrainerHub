import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const isCloudflarePagesBuild = process.env.CF_PAGES === '1' || mode === 'cloudflare';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      },
    },
    define: {
      __BUNDLED_ZH_VOSK_MODEL_ENABLED__: JSON.stringify(!isCloudflarePagesBuild),
    },
    base: './',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replaceAll('\\', '/');
            if (normalizedId.includes('/node_modules/three/')) {
              return 'three-runtime';
            }
            if (normalizedId.includes('/node_modules/pixi.js/') || normalizedId.includes('/node_modules/@pixi/')) {
              return 'pixi-runtime';
            }
            if (normalizedId.includes('/node_modules/jspsych/') || normalizedId.includes('/node_modules/@jspsych/')) {
              return 'experiment-runtime';
            }
            if (normalizedId.includes('/node_modules/@tensorflow/') || normalizedId.includes('/node_modules/@tensorflow-models/')) {
              return 'tensorflow-runtime';
            }
            if (normalizedId.includes('/node_modules/recharts/')) {
              return 'charts-runtime';
            }
          },
        },
      },
    },
  };
});

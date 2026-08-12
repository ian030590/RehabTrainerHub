import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'MouthTrainer | 舌頭動作與口腔練習 - 居家訓練網';
const seoDescription = 'MouthTrainer 提供以攝影機辨識舌頭左右方向的口腔動作互動練習。';

export default defineConfig({
  plugins: [
    react(),
    CreateViteHtmlSeoPlugin({
      alternateName: '居家舌頭動作練習',
      applicationName: 'MouthTrainer',
      description: seoDescription,
      featureList: ['攝影機舌頭方向辨識', '舌頭左右動作練習'],
      siteUrl: 'https://mouth.trainerhub.cc',
      title: seoTitle,
    }),
  ],
  resolve: {
      alias: {
        '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
        '@rehab-trainer/hub-modules': fileURLToPath(new URL('../rehabtrainerhub/training-modules', import.meta.url)),
      },
  },
  base: '/',
  server: {
    watch: {
      ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (normalizedId.includes('.css')) return;
          if (normalizedId.includes('vite/preload-helper') || normalizedId.includes('commonjsHelpers')) return 'bundler-runtime';
          if (normalizedId.includes('/node_modules/react/') || normalizedId.includes('/node_modules/react-dom/') || normalizedId.includes('/node_modules/scheduler/') || normalizedId.includes('/node_modules/react-router/')) return 'react-runtime';
          if (normalizedId.includes('/node_modules/pixi.js/') || normalizedId.includes('/node_modules/@pixi/')) return 'pixi-runtime';
          if (normalizedId.includes('/node_modules/jspsych/') || normalizedId.includes('/node_modules/@jspsych/')) return 'experiment-runtime';
          if (normalizedId.includes('/node_modules/@tensorflow/') || normalizedId.includes('/node_modules/@tensorflow-models/')) return 'tensorflow-runtime';
        },
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'MotorTrainer | 上肢動作與手眼協調訓練 - 居家訓練網';
const seoDescription = 'MotorTrainer 提供畫畫塔防、小行星護盾、手勢指令與手部追蹤等上肢互動練習，協助依專業建議安排居家動作訓練。';

export default defineConfig({
    plugins: [
      react(),
      CreateViteHtmlSeoPlugin({
        alternateName: '居家上肢動作訓練',
        applicationName: 'MotorTrainer',
        description: seoDescription,
        featureList: ['圖形繪製練習', '手部定位與追蹤', '手勢辨識互動'],
        siteUrl: 'https://motor.trainerhub.cc',
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
            if (normalizedId.includes('.css')) {
              return;
            }
            if (normalizedId.includes('vite/preload-helper') || normalizedId.includes('commonjsHelpers')) {
              return 'bundler-runtime';
            }
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/') ||
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'react-runtime';
            }
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
          },
        },
      },
    },
});

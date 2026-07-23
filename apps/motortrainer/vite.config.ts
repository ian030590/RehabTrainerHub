import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function EscapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const siteUrl = 'https://motor.trainerhub.cc';
const seoTitle = 'MotorTrainer | 居家動作復健訓練';
const seoDescription = 'MotorTrainer 提供上肢與下肢訓練入口，協助依治療師建議安排居家動作復健練習。';

export default defineConfig({
    plugins: [
      react(),
      {
        name: 'motortrainer-html-metadata',
        transformIndexHtml(html) {
          return html.replace(
            '</head>',
            [
              `  <link rel="canonical" href="${EscapeHtml(siteUrl)}" />`,
              `  <meta property="og:url" content="${EscapeHtml(siteUrl)}" />`,
              '  <meta property="og:type" content="website" />',
              '  <meta property="og:site_name" content="Rehab Trainer Hub" />',
              `  <meta property="og:title" content="${EscapeHtml(seoTitle)}" />`,
              `  <meta property="og:description" content="${EscapeHtml(seoDescription)}" />`,
              '  <meta name="twitter:card" content="summary" />',
              `  <meta name="twitter:title" content="${EscapeHtml(seoTitle)}" />`,
              `  <meta name="twitter:description" content="${EscapeHtml(seoDescription)}" />`,
              '</head>',
            ].join('\n'),
          );
        },
      },
    ],
    resolve: {
      alias: {
        '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
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
            if (normalizedId.includes('/node_modules/recharts/')) {
              return 'charts-runtime';
            }
          },
        },
      },
    },
});

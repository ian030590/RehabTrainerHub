import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function EscapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const siteUrl = 'https://mouth.trainerhub.cc';
const seoTitle = 'MouthTrainer | 口說、理解與口腔訓練';
const seoDescription = 'MouthTrainer 提供口說、理解與口腔動作訓練，協助依專業建議安排居家練習。';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'mouthtrainer-html-metadata',
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const siteUrl = 'https://stroke.trainerhub.cc';
const seoTitle = 'StrokeTrainer | 居家中風復健練習';
const seoDescription = 'StrokeTrainer 提供動作、認知與語音練習，協助依治療師建議安排居家中風復健訓練。';

export default defineConfig(({ mode }) => {
  const isCloudflarePagesBuild = process.env.CF_PAGES === '1' || mode === 'cloudflare';

  return {
    plugins: [
      react(),
      {
        name: 'stroketrainer-html-metadata',
        transformIndexHtml(html) {
          return html.replace(
            '</head>',
            [
              `  <link rel="canonical" href="${escapeHtml(siteUrl)}" />`,
              `  <meta property="og:url" content="${escapeHtml(siteUrl)}" />`,
              '  <meta property="og:type" content="website" />',
              '  <meta property="og:site_name" content="Rehab Trainer Hub" />',
              `  <meta property="og:title" content="${escapeHtml(seoTitle)}" />`,
              `  <meta property="og:description" content="${escapeHtml(seoDescription)}" />`,
              '  <meta name="twitter:card" content="summary" />',
              `  <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />`,
              `  <meta name="twitter:description" content="${escapeHtml(seoDescription)}" />`,
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
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function normalizeSiteUrl(value: string | undefined, fallback: string) {
  const url = value?.trim() || fallback;
  return url.replace(/\/+$/, '');
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export default defineConfig(({ mode }) => {
  const isCloudflarePagesBuild = process.env.CF_PAGES === '1' || mode === 'cloudflare';
  const siteUrl = normalizeSiteUrl(process.env.VITE_STROKETRAINER_URL, 'https://stroketrainer.pages.dev');

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
              '  <meta property="og:title" content="StrokeTrainer" />',
              '  <meta property="og:description" content="居家中風復健訓練系統，提供動作、認知與語音練習。" />',
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

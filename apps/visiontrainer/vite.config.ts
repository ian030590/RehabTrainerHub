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

const siteUrl = normalizeSiteUrl(process.env.VITE_VISIONTRAINER_URL, 'https://visiontrainer.pages.dev');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'visiontrainer-html-metadata',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          [
            `  <link rel="canonical" href="${escapeHtml(siteUrl)}" />`,
            `  <meta property="og:url" content="${escapeHtml(siteUrl)}" />`,
            '  <meta property="og:title" content="VisionTrainer" />',
            '  <meta property="og:description" content="視覺能力訓練系統，提供視覺評估、眼動、閱讀與視覺注意力練習。" />',
            '</head>',
          ].join('\n'),
        );
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/') || id.includes('\\node_modules\\three\\')) {
            return 'three-runtime';
          }
        },
      },
    },
  },
});

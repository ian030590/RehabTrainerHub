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

const siteUrl = normalizeSiteUrl(process.env.VITE_BRAINTRAINER_URL, 'https://braintrainer.pages.dev');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'braintrainer-html-metadata',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          [
            `  <link rel="canonical" href="${escapeHtml(siteUrl)}" />`,
            `  <meta property="og:url" content="${escapeHtml(siteUrl)}" />`,
            '  <meta property="og:title" content="BrainTrainer" />',
            '  <meta property="og:description" content="注意、記憶與思考訓練入口，目前提供訓練模組佔位。" />',
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
    assetsDir: 'assets'
  },
});

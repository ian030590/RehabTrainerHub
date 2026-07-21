import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const siteUrl = 'https://brain.trainerhub.cc';
const seoTitle = 'BrainTrainer | 注意記憶與思考訓練';
const seoDescription = 'BrainTrainer 提供注意、記憶與思考訓練入口，協助依專業建議安排認知訓練練習。';

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
  base: '/',
  resolve: {
    alias: {
      '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  server: {
    watch: {
      ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
});

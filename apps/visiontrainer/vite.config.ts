import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function EscapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const siteUrl = 'https://vision.trainerhub.cc';
const seoTitle = 'VisionTrainer | 視覺訓練與評估工具';
const seoDescription = 'VisionTrainer 提供視覺評估、眼動、閱讀與視覺注意力練習，適合依專業建議安排居家視覺訓練。';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'visiontrainer-html-metadata',
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
  base: '/',
  resolve: {
    alias: {
      '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // Avoid phantom Windows file-watch events causing an endless full-reload loop in dev.
      usePolling: true,
      interval: 750,
      ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'],
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

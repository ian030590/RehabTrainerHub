import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'VisionTrainer | 視覺練習與紀錄工具 - 居家訓練網';
const seoDescription = 'VisionTrainer 提供視標辨識、對比辨識、眼動、閱讀、視覺搜尋與駕駛注意力模擬練習；為非醫療練習工具，結果不代表視力、診斷或治療建議。';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      CreateViteHtmlSeoPlugin({
        alternateName: '居家視覺練習與紀錄工具',
        applicationName: 'VisionTrainer',
        description: seoDescription,
        featureList: ['視標與對比辨識練習', '眼球運動練習', '閱讀與視覺注意力練習'],
        siteUrl: 'https://vision.trainerhub.cc',
        title: seoTitle,
      }),
    ],
    base: '/',
    resolve: {
      alias: {
        '@rehab-trainer/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
        '@rehab-trainer/hub-modules': fileURLToPath(new URL('../rehabtrainerhub/training-modules', import.meta.url)),
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
  };
});

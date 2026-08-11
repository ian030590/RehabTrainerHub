import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'VisionTrainer | 視覺訓練與評估工具 - 居家訓練網';
const seoDescription = 'VisionTrainer 提供視力與對比敏感度評估工具，以及眼動、閱讀、視覺搜尋和視覺注意力練習；評估結果僅供練習參考。';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      CreateViteHtmlSeoPlugin({
        alternateName: '居家視覺訓練與評估',
        applicationName: 'VisionTrainer',
        description: seoDescription,
        featureList: ['視覺功能評估', '眼球運動訓練', '閱讀與視覺注意力練習'],
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

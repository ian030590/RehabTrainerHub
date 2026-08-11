import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'BrainTrainer | 注意力、記憶與認知訓練 - 居家訓練網';
const seoDescription = 'BrainTrainer 提供注意力、記憶力與高階認知互動練習，包含 UFOV、反應控制、記憶配對、推理與問題解決等訓練。';

export default defineConfig({
  plugins: [
    react(),
    CreateViteHtmlSeoPlugin({
      alternateName: '居家認知訓練',
      applicationName: 'BrainTrainer',
      description: seoDescription,
      featureList: ['注意力訓練', '記憶力訓練', '高階認知與思考練習'],
      siteUrl: 'https://brain.trainerhub.cc',
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
      ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
});

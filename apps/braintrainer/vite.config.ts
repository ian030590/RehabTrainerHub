import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { CreateViteHtmlSeoPlugin } from '../../scripts/vite-html-seo';

const seoTitle = 'BrainTrainer | 注意力、記憶與認知練習 - 居家訓練網';
const seoDescription = 'BrainTrainer 提供周邊注意力、反應控制、記憶配對、推理與問題解決等注意力、記憶及認知互動練習。';

export default defineConfig({
  plugins: [
    react(),
    CreateViteHtmlSeoPlugin({
      alternateName: '居家認知練習',
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

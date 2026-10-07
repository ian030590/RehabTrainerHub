import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@rehab-trainer/ui': resolve(__dirname, '../../../../packages/ui/src'),
      '@rehab-trainer/games': resolve(__dirname, '..'),
      '@rehab-trainer/hub-modules': resolve(__dirname, '..'),
    },
  },
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
    outDir: 'dist',
  },
});

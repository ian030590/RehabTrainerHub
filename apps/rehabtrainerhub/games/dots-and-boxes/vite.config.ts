import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@rehab-trainer/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
      '@rehab-trainer/games': fileURLToPath(new URL('..', import.meta.url)),
      '@rehab-trainer/hub-modules': fileURLToPath(new URL('..', import.meta.url)),
    },
  },
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
    outDir: 'dist',
  },
});

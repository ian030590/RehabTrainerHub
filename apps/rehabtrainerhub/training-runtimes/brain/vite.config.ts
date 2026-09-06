import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', plugins: [react()],
  resolve: { alias: {
    '@rehab-trainer/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
    '@rehab-trainer/hub-modules': fileURLToPath(new URL('../../training-modules', import.meta.url)),
    '@rehab-trainer/games': fileURLToPath(new URL('../../games', import.meta.url)),
  } },
  server: { watch: { ignored: ['**/tsconfig.json', '**/tsconfig.*.json', '**/*.tsbuildinfo'] } },
  build: { outDir: '../../out/.official-game-shells/brain', assetsDir: 'assets', emptyOutDir: true },
});

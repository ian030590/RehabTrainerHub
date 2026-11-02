import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [react(), { name: 'sandbox-classic-script', transformIndexHtml: {
    order: 'post', handler: html => html.replace(/type="module" crossorigin/g, 'defer'),
  } }, { name: 'pixelfx-license', generateBundle() {
    for (const fileName of ['LICENSE-pixelfx.md', 'NOTICE.md']) {
      this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(`./fx/${fileName}`, import.meta.url), 'utf8') });
    }
  } }],
  build: {
    assetsDir: 'assets',
    emptyOutDir: true,
    outDir: 'dist',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});

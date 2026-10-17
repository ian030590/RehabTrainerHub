import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [react(), { name: 'sandbox-classic-script', transformIndexHtml: {
    order: 'post', handler: html => html.replace(/type="module" crossorigin/g, 'defer')
      .replace('<script defer', '<script defer src="./vehicle-data.js"></script><script defer'),
  }, generateBundle() {
    // Separate classic script keeps the unchanged model below the runner's 8 MiB per-file limit without fetch.
    this.emitFile({ type: 'asset', fileName: 'vehicle-data.js', source: `window.DrivingRehabVehicleData=${JSON.stringify(readFileSync(new URL('./models/car.glb', import.meta.url)).toString('base64'))};` });
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

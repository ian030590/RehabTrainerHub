import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'sandbox-classic-script',
    transformIndexHtml: {
      order: 'post',
      handler: html => html.replace(/type="module" crossorigin/g, 'defer'),
    },
  }],
  build: {
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});

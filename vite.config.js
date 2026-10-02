import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built game works from any folder or static host.
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});

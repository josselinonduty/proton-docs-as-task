import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A dev-only harness that mounts the real board overlay against a fake Proton
 * editor, so the UI can be exercised (and user-tested) without loading the
 * extension into Proton Docs. Never part of the extension build.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '#imports': fileURLToPath(new URL('./shims/imports.ts', import.meta.url)),
      'wxt/browser': fileURLToPath(new URL('./shims/browser.ts', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5199,
    strictPort: true,
    allowedHosts: true,
  },
});

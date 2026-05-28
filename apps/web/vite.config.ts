/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/web',
  server: { port: 4200, host: 'localhost' },
  plugins: [
    react(),
    tsconfigPaths(),
    // Turns the web app into an installable, offline-capable PWA.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Acme App',
        short_name: 'Acme',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  build: { outDir: '../../dist/apps/web', emptyOutDir: true },
});

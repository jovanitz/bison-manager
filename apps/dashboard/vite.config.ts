/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/dashboard',
  server: { port: 4201, host: 'localhost' },
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  build: { outDir: '../../dist/apps/dashboard', emptyOutDir: true },
});

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/medicine-manager',
  server: { port: 4203, host: 'localhost' },
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  build: { outDir: '../../dist/apps/medicine-manager', emptyOutDir: true },
});

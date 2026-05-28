import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Tauri serves this dev server and bundles the build output.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/desktop',
  server: { port: 4500, host: 'localhost', strictPort: true },
  plugins: [react(), tsconfigPaths()],
  build: { outDir: '../../dist/apps/desktop', emptyOutDir: true },
});

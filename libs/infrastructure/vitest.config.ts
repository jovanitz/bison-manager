import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.ts'],
    // The two postgres specs share one local database and re-seed it per
    // test; parallel spec files would race each other's wipes (FK errors,
    // deadlocks). Serial file execution costs ~1s here.
    fileParallelism: false,
  },
});

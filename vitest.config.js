import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    // Run test files sequentially to avoid DB conflicts
    fileParallelism: false,
  },
});

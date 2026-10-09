import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: './',
    include: ['test/integration/**/*.int-spec.ts'],
    globalSetup: ['test/integration/support/global-setup.ts'],
    setupFiles: ['test/integration/support/setup-env.ts'],
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});

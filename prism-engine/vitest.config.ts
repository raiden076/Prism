import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    noExternal: ['@cloudflare/vitest-pool-workers'],
  },
  test: {
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
    poolOptions: {
      workers: {
        isolatedStorage: true,
      },
    },
  },
});

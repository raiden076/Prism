import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
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
        main: './tests/worker.ts',
        wrangler: { configPath: './wrangler.jsonc' },
      },
    },
  },
});

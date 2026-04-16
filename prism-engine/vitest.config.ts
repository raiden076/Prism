import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        AI_ACTIVATED: 'false',
        OTPLESS_CLIENT_ID: 'test-client-id',
        OTPLESS_CLIENT_SECRET: 'test-client-secret',
        SUPERTOKENS_CORE_URL: 'https://try.supertokens.io',
        SUPERTOKENS_API_KEY: 'test-api-key',
        USE_SUPERTOKENS_AUTH: 'true',
        CORS_ALLOWED_ORIGINS: 'tauri://localhost,http://localhost:1420,http://localhost:8787',
      },
    },
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
});

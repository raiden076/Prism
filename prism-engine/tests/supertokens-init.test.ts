import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import {
  initSuperTokens,
  createSuperTokensMiddleware,
  isSuperTokensEnabled,
  getUserIdFromSession,
  getSession,
  revokeSession,
  requireAuth,
  SuperTokens,
  Session,
  Passwordless,
} from '../src/lib/supertokens';

// Mock environment
type TestEnv = {
  DB: D1Database;
  VAULT: R2Bucket;
  CONTRACTOR_LOCATIONS: DurableObjectNamespace;
  AI_ACTIVATED: string;
  OTPLESS_CLIENT_ID: string;
  OTPLESS_CLIENT_SECRET: string;
  SUPERTOKENS_CORE_URL: string;
  SUPERTOKENS_API_KEY: string;
  USE_SUPERTOKENS_AUTH: string;
};

describe('Task 4.1: SuperTokens Initialization', () => {
  let app: Hono<{ Bindings: TestEnv }>;
  let env: TestEnv;

  beforeEach(() => {
    app = new Hono<{ Bindings: TestEnv }>();
    env = {
      DB: {} as D1Database,
      VAULT: {} as R2Bucket,
      CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
      AI_ACTIVATED: 'false',
      OTPLESS_CLIENT_ID: 'test-client-id',
      OTPLESS_CLIENT_SECRET: 'test-client-secret',
      SUPERTOKENS_CORE_URL: 'https://try.supertokens.io',
      SUPERTOKENS_API_KEY: 'test-api-key',
      USE_SUPERTOKENS_AUTH: 'true',
    };
  });

  it('should detect SuperTokens enabled via feature flag', () => {
    expect(isSuperTokensEnabled('true')).toBe(true);
    expect(isSuperTokensEnabled('false')).toBe(false);
    expect(isSuperTokensEnabled('')).toBe(false);
    expect(isSuperTokensEnabled(undefined as any)).toBe(false);
  });

  it('should initialize SuperTokens without errors', () => {
    expect(() => {
      initSuperTokens(env.SUPERTOKENS_CORE_URL, env.SUPERTOKENS_API_KEY);
    }).not.toThrow();
  });

  it('should export all required modules', () => {
    expect(SuperTokens).toBeDefined();
    expect(Session).toBeDefined();
    expect(Passwordless).toBeDefined();
    expect(createSuperTokensMiddleware).toBeDefined();
    expect(requireAuth).toBeDefined();
    expect(getUserIdFromSession).toBeDefined();
    expect(getSession).toBeDefined();
    expect(revokeSession).toBeDefined();
  });

  it('should create middleware function', () => {
    const middleware = createSuperTokensMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create requireAuth middleware', () => {
    const authMiddleware = requireAuth();
    expect(typeof authMiddleware).toBe('function');
  });
});

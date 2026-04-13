/**
 * Middleware tests for withUser (auth.ts) and requireRole (rbac.ts).
 *
 * Tests middleware via standalone test Hono apps. Mocks SuperTokens Core
 * JWKS endpoint via globalThis.fetch override. Uses real D1 via miniflare.
 *
 * Covers: RBAC-04 (middleware enforces on protected routes)
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env, User, UserRole } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// Imports under test
import { withUser, type AuthVariables } from '../../src/middleware/auth';
import { requireRole } from '../../src/middleware/rbac';

// --- Test app: withUser middleware ---
const authApp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
authApp.use('*', withUser());
authApp.get('/test', (c) =>
  c.json({
    userId: c.get('user').id,
    role: c.get('user').role,
    stUserId: c.get('supertokensUserId'),
  })
);

// --- Test app: requireRole middleware (no auth, user set manually) ---
function makeRbacApp(...roles: UserRole[]) {
  const app = new Hono<{ Variables: { user: User } }>();
  app.use('*', requireRole(...roles));
  app.get('/protected', (c) => c.json({ ok: true }));
  return app;
}

// --- Mock env ---
function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: {} as R2Bucket,
    CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
    AI_ACTIVATED: 'false',
    OTPLESS_CLIENT_ID: 'test',
    OTPLESS_CLIENT_SECRET: 'test',
    SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
    SUPERTOKENS_API_KEY: 'test-key',
    USE_SUPERTOKENS_AUTH: 'true',
  };
}

// --- JWT key pair ---
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-1', use: 'sig', alg: 'RS256' };
}

async function generateAccessToken(
  userId: string = 'st-user-1',
  sessionHandle: string = 'test-session'
): Promise<string> {
  await ensureKeys();
  return new SignJWT({ sub: userId, sessionHandle })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer('https://test-core.supertokens.io')
    .setExpirationTime('1h')
    .sign(testKeyPair.privateKey);
}

// --- Fetch mock ---
const originalFetch = globalThis.fetch;

function mockFetch() {
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('.well-known/jwks.json')) {
      return new Response(JSON.stringify({ keys: [testPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(url, init);
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// --- Helpers ---
function authRequest(path: string, options?: RequestInit) {
  return authApp.request(path, options, getTestEnv());
}

function makeTestUser(overrides: { role?: UserRole; stUserId?: string }): User {
  return {
    id: crypto.randomUUID(),
    role: overrides.role ?? 'crony',
    phoneNumber: '+910000000000',
    regionScope: null,
    createdAt: null,
    supervisorId: null,
    tags: [],
    hierarchyDepth: 0,
    reporterId: null,
    supertokensUserId: overrides.stUserId ?? null,
  };
}

describe('withUser middleware', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = env.DB;
    await applyMigrations(db);
    await ensureKeys();
  });

  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  // Test 1: withUser() sets user on context when valid Bearer token provided
  it('sets user on context when valid Bearer token provided', async () => {
    const stUserId = 'st-mw-valid';
    const userId = crypto.randomUUID();
    await db
      .prepare('INSERT INTO Users (id, role, phone_number, supertokens_user_id) VALUES (?, ?, ?, ?)')
      .bind(userId, 'admin', '+911111111111', stUserId)
      .run();

    const token = await generateAccessToken(stUserId);
    const res = await authRequest('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe(userId);
    expect(data.role).toBe('admin');
    expect(data.stUserId).toBe(stUserId);
  });

  // Test 2: withUser() returns 401 when no Authorization header
  it('returns 401 when no Authorization header', async () => {
    const res = await authRequest('/test');
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  // Test 3: withUser() returns 401 when Bearer token is invalid/expired
  it('returns 401 when Bearer token is invalid', async () => {
    const res = await authRequest('/test', {
      headers: { Authorization: 'Bearer invalid-token-here' },
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  // Test 4: withUser() returns 404 when SuperTokens user has no D1 row
  it('returns 404 when SuperTokens user has no D1 row', async () => {
    const stUserId = 'st-no-d1-user';
    const token = await generateAccessToken(stUserId);

    const res = await authRequest('/test', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('User not found');
  });
});

describe('requireRole middleware', () => {
  // Test 5: requireRole('admin') passes when user.role === 'admin'
  it('passes when user.role matches required role', async () => {
    const rbacApp = makeRbacApp('admin');
    const adminUser = makeTestUser({ role: 'admin' });

    const res = await rbacApp.request('/protected', {
      headers: { 'X-Test-User': JSON.stringify(adminUser) },
    });

    // requireRole reads user from c.get('user'), need to set it via a wrapper
    // Since we can't set context vars from outside, use a wrapper app
    const wrapperApp = new Hono<{ Variables: { user: User } }>();
    wrapperApp.use('*', async (c, next) => {
      c.set('user', adminUser);
      await next();
    });
    wrapperApp.use('*', requireRole('admin'));
    wrapperApp.get('/protected', (c) => c.json({ ok: true }));

    const wrapperRes = await wrapperApp.request('/protected');
    expect(wrapperRes.status).toBe(200);
    const data = await wrapperRes.json();
    expect(data.ok).toBe(true);
  });

  // Test 6: requireRole('admin') returns 403 when user.role === 'crony'
  it('returns 403 when user.role does not match required role', async () => {
    const cronyUser = makeTestUser({ role: 'crony' });

    const wrapperApp = new Hono<{ Variables: { user: User } }>();
    wrapperApp.use('*', async (c, next) => {
      c.set('user', cronyUser);
      await next();
    });
    wrapperApp.use('*', requireRole('admin'));
    wrapperApp.get('/protected', (c) => c.json({ ok: true }));

    const res = await wrapperApp.request('/protected');
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });

  // Test 7: requireRole('crony', 'contractor') passes for contractor role
  it('passes when user.role matches one of multiple allowed roles', async () => {
    const contractorUser = makeTestUser({ role: 'contractor' });

    const wrapperApp = new Hono<{ Variables: { user: User } }>();
    wrapperApp.use('*', async (c, next) => {
      c.set('user', contractorUser);
      await next();
    });
    wrapperApp.use('*', requireRole('crony', 'contractor'));
    wrapperApp.get('/protected', (c) => c.json({ ok: true }));

    const res = await wrapperApp.request('/protected');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  // Test 8: requireRole() returns 403 when no user in context
  it('returns 403 when no user in context', async () => {
    const wrapperApp = new Hono<{ Variables: { user: User } }>();
    // No middleware sets user
    wrapperApp.use('*', requireRole('admin'));
    wrapperApp.get('/protected', (c) => c.json({ ok: true }));

    const res = await wrapperApp.request('/protected');
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('no user context');
  });
});

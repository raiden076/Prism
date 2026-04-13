/**
 * RBAC filter tests for getReportsFilter + hierarchy access + integration chain.
 *
 * Tests getReportsFilter directly with real D1 via miniflare.
 * Tests full middleware chain (withUser + requireRole) integration.
 *
 * Covers: RBAC-01, RBAC-02, RBAC-03, RBAC-05
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env, User, UserRole } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { insertTestUser, insertTestReport, insertTestIntervention, insertTestVerification } from '../factories';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// Imports under test
import { withUser, type AuthVariables } from '../../src/middleware/auth';
import { requireRole, getReportsFilter } from '../../src/middleware/rbac';

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

describe('getReportsFilter', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = env.DB;
    await applyMigrations(db);
    await ensureKeys();
  });

  // Test 1: Admin sees all reports (RBAC-01)
  it('admin role returns 1=1 with no params', async () => {
    const filter = await getReportsFilter('admin', 'any-id', db);
    expect(filter.whereClause).toBe('1=1');
    expect(filter.params).toEqual([]);
  });

  // Test 2: Contractor sees only assigned reports (RBAC-02)
  it('contractor role returns Interventions subquery', async () => {
    const contractorId = await insertTestUser(db, { role: 'contractor' });
    const filter = await getReportsFilter('contractor', contractorId, db);
    expect(filter.whereClause).toContain('Interventions');
    expect(filter.whereClause).toContain('contractor_id = ?');
    expect(filter.params).toEqual([contractorId]);
  });

  // Test 3: Crony sees own reports + verifications (RBAC-03)
  it('crony role returns reporter_id + Verifications subquery', async () => {
    const cronyId = await insertTestUser(db, { role: 'crony' });
    const filter = await getReportsFilter('crony', cronyId, db);
    expect(filter.whereClause).toContain('reporter_id = ?');
    expect(filter.whereClause).toContain('Verifications');
    expect(filter.whereClause).toContain('verifier_id = ?');
    expect(filter.params).toEqual([cronyId, cronyId]);
  });

  // Test 4 + 5: Hierarchy access returns subtree reporter_ids via recursive CTE (RBAC-05)
  it('hierarchy user returns subtree IDs via recursive CTE', async () => {
    // Create supervisor (top of hierarchy)
    const supervisorId = await insertTestUser(db, { role: 'admin', supervisor_id: null });

    // Create 3 children under supervisor
    const child1Id = await insertTestUser(db, { role: 'crony', supervisor_id: supervisorId });
    const child2Id = await insertTestUser(db, { role: 'crony', supervisor_id: supervisorId });
    const child3Id = await insertTestUser(db, { role: 'crony', supervisor_id: supervisorId });

    // Cast to trigger default case (using 'admin' would hit admin case,
    // so we test the default case with a non-standard approach)
    // Actually, the switch uses UserRole which is 'crony' | 'contractor' | 'admin'
    // The default case handles anything that's not those three.
    // To test it properly, we cast to trigger the default path.
    const filter = await getReportsFilter(
      'supervisor' as UserRole,
      supervisorId,
      db
    );

    // Should include supervisor + 3 children = 4 IDs
    expect(filter.params).toHaveLength(4);
    expect(filter.params).toContain(supervisorId);
    expect(filter.params).toContain(child1Id);
    expect(filter.params).toContain(child2Id);
    expect(filter.params).toContain(child3Id);
    expect(filter.whereClause).toContain('reporter_id IN (');
    expect(filter.whereClause).toContain('?,?,?,?');
  });

  // Test: hierarchy user with no descendants returns only self (recursive CTE includes self)
  it('hierarchy user with no descendants returns only self via CTE', async () => {
    const orphanId = await insertTestUser(db, { role: 'crony', supervisor_id: null });
    const filter = await getReportsFilter(
      'supervisor' as UserRole,
      orphanId,
      db
    );
    // Recursive CTE includes self (anchor: WHERE id = ?) so returns [orphanId]
    expect(filter.whereClause).toContain('reporter_id IN (?)');
    expect(filter.params).toEqual([orphanId]);
  });
});

describe('Middleware integration chain', () => {
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

  // Test 6: Full chain: withUser() + requireRole('admin') + handler
  it('full chain passes for admin with valid token', async () => {
    const stUserId = 'st-admin-integ';
    const adminId = await insertTestUser(db, { role: 'admin' });
    // Link ST user
    await db
      .prepare('UPDATE Users SET supertokens_user_id = ? WHERE id = ?')
      .bind(stUserId, adminId)
      .run();

    const chainApp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
    chainApp.use('*', withUser());
    chainApp.use('*', requireRole('admin'));
    chainApp.get('/admin-reports', (c) =>
      c.json({ userId: c.get('user').id, role: c.get('user').role })
    );

    const token = await generateAccessToken(stUserId);
    const res = await chainApp.request(
      '/admin-reports',
      { headers: { Authorization: `Bearer ${token}` } },
      getTestEnv()
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.role).toBe('admin');
  });

  // Test 7: withUser() + requireRole('admin') rejects contractor with 403
  it('full chain rejects contractor from admin-only route', async () => {
    const stUserId = 'st-contractor-integ';
    const contractorId = await insertTestUser(db, { role: 'contractor' });
    await db
      .prepare('UPDATE Users SET supertokens_user_id = ? WHERE id = ?')
      .bind(stUserId, contractorId)
      .run();

    const chainApp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
    chainApp.use('*', withUser());
    chainApp.use('*', requireRole('admin'));
    chainApp.get('/admin-reports', (c) =>
      c.json({ userId: c.get('user').id })
    );

    const token = await generateAccessToken(stUserId);
    const res = await chainApp.request(
      '/admin-reports',
      { headers: { Authorization: `Bearer ${token}` } },
      getTestEnv()
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Forbidden');
  });
});


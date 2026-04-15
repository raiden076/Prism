/**
 * Board Route Tests (RPT-06, RPT-08, RPT-09)
 *
 * TDD RED phase - tests define expected behavior.
 * Route file does not exist yet; imports will fail until GREEN phase.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import {
  upsertUserBySuperTokens,
  createReport,
  createWhitelistedSource,
} from '../../src/lib/queries';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// Import the route module (will not exist during RED phase)
import { boardRoutes } from '../../src/routes/board';
import type { AuthVariables } from '../../src/middleware/auth';

// --- Test app ---
const testApp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
testApp.route('/api/v2/reports', boardRoutes);

// --- Mock env ---
function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: { put: async () => undefined } as unknown as R2Bucket,
    CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
    AI_ACTIVATED: 'false',
    OTPLESS_CLIENT_ID: 'test',
    OTPLESS_CLIENT_SECRET: 'test',
    SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
    SUPERTOKENS_API_KEY: 'test-key',
    USE_SUPERTOKENS_AUTH: 'true',
    WEBHOOK_SECRET: 'test-webhook-secret',
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

async function createTestUser(
  db: D1Database,
  phone: string,
  role: string
): Promise<{ stUserId: string; accessToken: string; dbUserId: string }> {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;

  // Create user with specific role
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO Users (id, role, phone_number, supertokens_user_id) VALUES (?, ?, ?, ?)'
    )
    .bind(id, role, phone, stUserId)
    .run();

  // Also create whitelisted source for the user
  await createWhitelistedSource(db, {
    linkedUserId: id,
    verifiedName: `Test ${role} ${phone}`,
    referenceId: `ref-${phone}`,
    approvalStatus: 'approved',
  });

  const accessToken = await generateAccessToken(stUserId);
  return { stUserId, accessToken, dbUserId: id };
}

function makeAuthenticatedGetRequest(
  path: string,
  accessToken: string
): Request {
  return new Request(`http://localhost${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

describe('Board Route', () => {
  const testEnv = getTestEnv();
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let cronyUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
  });

  beforeEach(async () => {
    mockFetch();

    // Create admin and crony users
    adminUser = await createTestUser(env.DB, '+919888880101', 'admin');
    cronyUser = await createTestUser(env.DB, '+919888880102', 'crony');

    // Create some reports for testing
    // Admin creates reports
    await createReport(env.DB, {
      reporterId: adminUser.dbUserId,
      latitude: 28.6139,
      longitude: 77.209,
      r2ImageUrl: 'r2://harvest/admin-report-1.jpg',
      status: 'pending',
    });

    await createReport(env.DB, {
      reporterId: adminUser.dbUserId,
      latitude: 28.614,
      longitude: 77.2091,
      r2ImageUrl: 'r2://harvest/admin-report-2.jpg',
      status: 'assigned',
    });

    // Crony creates reports
    await createReport(env.DB, {
      reporterId: cronyUser.dbUserId,
      latitude: 28.6141,
      longitude: 77.2092,
      r2ImageUrl: 'r2://harvest/crony-report-1.jpg',
      status: 'pending',
    });

    await createReport(env.DB, {
      reporterId: cronyUser.dbUserId,
      latitude: 28.6142,
      longitude: 77.2093,
      r2ImageUrl: 'r2://harvest/crony-report-2.jpg',
      status: 'pending_review',
    });
  });

  afterEach(() => {
    restoreFetch();
  });

  // --- RPT-06: Board returns paginated reports ---

  it('RPT-06: GET /api/v2/reports returns 200 with { reports: [...], total: N }', async () => {
    const req = makeAuthenticatedGetRequest('/api/v2/reports', adminUser.accessToken);
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toBeDefined();
    expect(Array.isArray(body.reports)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThanOrEqual(4); // At least 4 reports created
  });

  it('RPT-06: GET /api/v2/reports?limit=2&offset=0 returns at most 2 reports with correct total', async () => {
    const req = makeAuthenticatedGetRequest(
      '/api/v2/reports?limit=2&offset=0',
      adminUser.accessToken
    );
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports.length).toBeLessThanOrEqual(2);
    expect(body.total).toBeGreaterThanOrEqual(4); // Total reflects ALL reports
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  // --- RPT-08: Status filter ---

  it('RPT-08: GET /api/v2/reports?status=pending returns only pending reports', async () => {
    const req = makeAuthenticatedGetRequest(
      '/api/v2/reports?status=pending',
      adminUser.accessToken
    );
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports.length).toBeGreaterThan(0);
    for (const report of body.reports) {
      expect(report.status).toBe('pending');
    }
  });

  it('RPT-08: GET /api/v2/reports?status=invalid_status returns 400 "Invalid status"', async () => {
    const req = makeAuthenticatedGetRequest(
      '/api/v2/reports?status=invalid_status',
      adminUser.accessToken
    );
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid status');
  });

  // --- RPT-09: RBAC filtering ---

  it('RPT-09: Admin user sees all reports (RBAC: 1=1)', async () => {
    const req = makeAuthenticatedGetRequest('/api/v2/reports', adminUser.accessToken);
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    // Admin should see all 4 reports (both admin's and crony's)
    expect(body.total).toBeGreaterThanOrEqual(4);
  });

  it('RPT-09: Crony user sees only own reports (RBAC: reporter_id = ?)', async () => {
    const req = makeAuthenticatedGetRequest('/api/v2/reports', cronyUser.accessToken);
    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    // Crony should only see their own 2 reports
    expect(body.total).toBe(2);
    for (const report of body.reports) {
      expect(report.reporterId).toBe(cronyUser.dbUserId);
    }
  });
});

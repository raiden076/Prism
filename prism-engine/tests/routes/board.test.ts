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
import type { ReportStatus } from '../../src/lib/types';
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
    VAULT: {} as R2Bucket,
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

interface AuthenticatedUser {
  stUserId: string;
  accessToken: string;
  dbUserId: string;
}

async function createAuthenticatedUser(
  db: D1Database,
  phone: string,
  role: 'crony' | 'contractor' | 'admin' = 'crony'
): Promise<AuthenticatedUser> {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;

  // Create user directly in DB (bypasses upsert to set role)
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO Users (id, role, phone_number, supertokens_user_id) VALUES (?, ?, ?, ?)'
    )
    .bind(id, role, phone, stUserId)
    .run();

  const accessToken = await generateAccessToken(stUserId);
  return { stUserId, accessToken, dbUserId: id };
}

async function seedReport(
  db: D1Database,
  reporterId: string,
  status: ReportStatus = 'pending',
  lat: number = 28.6139,
  lon: number = 77.209
): Promise<string> {
  const id = crypto.randomUUID();
  const digipin = 'TEST-DIGIPIN';
  await db
    .prepare(
      'INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(id, reporterId, lat, lon, digipin, 'r2://test.jpg', status)
    .run();
  return id;
}

describe('Board Route', () => {
  const testEnv = getTestEnv();
  let adminUser: AuthenticatedUser;
  let cronyUser: AuthenticatedUser;

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
  });

  beforeEach(async () => {
    mockFetch();

    adminUser = await createAuthenticatedUser(env.DB, '+919000000001', 'admin');
    cronyUser = await createAuthenticatedUser(env.DB, '+919000000002', 'crony');
  });

  afterEach(() => {
    restoreFetch();
  });

  // --- RPT-06: Pagination ---

  it('RPT-06: GET / returns 200 with { reports, total } ordered by created_at DESC, max 100', async () => {
    // Seed 3 reports for admin (1=1 sees all)
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, adminUser.dbUserId, 'assigned');
    await seedReport(env.DB, adminUser.dbUserId, 'resolved');

    const req = new Request('http://localhost/api/v2/reports', {
      headers: { Authorization: `Bearer ${adminUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toBeDefined();
    expect(body.total).toBe(3);
    expect(Array.isArray(body.reports)).toBe(true);
    expect(body.reports.length).toBeLessThanOrEqual(100);
  });

  it('RPT-06: GET / with limit=2&offset=0 returns at most 2 reports with correct total', async () => {
    // Seed 3 reports
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, adminUser.dbUserId, 'pending');

    const req = new Request('http://localhost/api/v2/reports?limit=2&offset=0', {
      headers: { Authorization: `Bearer ${adminUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports.length).toBe(2);
    expect(body.total).toBe(3);
  });

  // --- RPT-08: Status filter ---

  it('RPT-08: GET / with status=pending returns only pending reports', async () => {
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, adminUser.dbUserId, 'assigned');
    await seedReport(env.DB, adminUser.dbUserId, 'pending');

    const req = new Request('http://localhost/api/v2/reports?status=pending', {
      headers: { Authorization: `Bearer ${adminUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports.length).toBe(2);
    for (const report of body.reports) {
      expect(report.status).toBe('pending');
    }
  });

  it('RPT-08: GET / with invalid status returns 400', async () => {
    const req = new Request('http://localhost/api/v2/reports?status=invalid_status', {
      headers: { Authorization: `Bearer ${adminUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid status');
  });

  // --- RPT-09: RBAC ---

  it('RPT-09: Admin user sees all reports (RBAC: 1=1)', async () => {
    // Admin creates 1, crony creates 1
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, cronyUser.dbUserId, 'pending');

    const req = new Request('http://localhost/api/v2/reports', {
      headers: { Authorization: `Bearer ${adminUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
  });

  it('RPT-09: Crony user sees only own reports (RBAC: reporter_id = ?)', async () => {
    // Admin creates 1, crony creates 2
    await seedReport(env.DB, adminUser.dbUserId, 'pending');
    await seedReport(env.DB, cronyUser.dbUserId, 'pending');
    await seedReport(env.DB, cronyUser.dbUserId, 'pending');

    const req = new Request('http://localhost/api/v2/reports', {
      headers: { Authorization: `Bearer ${cronyUser.accessToken}` },
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    // Crony sees own (2) + verified (none) = 2
    expect(body.total).toBe(2);
    for (const report of body.reports) {
      expect(report.reporterId).toBe(cronyUser.dbUserId);
    }
  });
});

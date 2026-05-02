import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { applyMigrations } from '../setup';
import { upsertUserBySuperTokens, createReport } from '../../src/lib/queries';
import { boardRoutes } from '../../src/routes/board';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// --- Test app ---
const testApp = new Hono<{ Bindings: any; Variables: any }>();
testApp.route('/api/v2/reports', boardRoutes);

// --- JWT Helpers ---
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-1', use: 'sig', alg: 'RS256' };
}

async function generateAccessToken(userId: string): Promise<string> {
  await ensureKeys();
  return new SignJWT({ userId, sessionHandle: 'test-session' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer('https://test-core.supertokens.io')
    .setExpirationTime('1h')
    .sign(testKeyPair.privateKey);
}

// --- Fetch Mock ---
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

async function createTestUser(phone: string, role: 'admin' | 'contractor' | 'crony') {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;
  const user = await upsertUserBySuperTokens(env.DB, stUserId, phone);
  await env.DB.prepare("UPDATE Users SET role = ?, supertokens_user_id = ? WHERE id = ?").bind(role, stUserId, user.id).run();
  const token = await generateAccessToken(stUserId);
  return { ...user, role, stUserId, token };
}

describe('RBAC Integration Tests', () => {
  let admin: any;
  let contractor: any;
  let crony: any;
  let report: any;
  let testEnv: any;

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
    testEnv = {
      ...env,
      SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
      SUPERTOKENS_API_KEY: 'test-key',
      USE_SUPERTOKENS_AUTH: 'true'
    };
    admin = await createTestUser('+919000000001', 'admin');
    contractor = await createTestUser('+919000000002', 'contractor');
    crony = await createTestUser('+919000000003', 'crony');
  });

  beforeEach(async () => {
    mockFetch();
    report = await createReport(env.DB, {
      reporterId: admin.id,
      latitude: 28.6315,
      longitude: 77.2167,
      r2ImageUrl: 'r2://test.jpg',
      status: 'pending'
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Endpoint Access Control', () => {
    it('Admin can access board reports', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${admin.token}` }
        }),
        testEnv
      );
      expect(res.status).toBe(200);
    });

    it('Contractor can access board reports', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${contractor.token}` }
        }),
        testEnv
      );
      expect(res.status).toBe(200);
    });

    it('Crony can access board reports', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${crony.token}` }
        }),
        testEnv
      );
      expect(res.status).toBe(200);
    });

    it('Unauthenticated request is rejected with 401', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports'),
        testEnv
      );
      expect(res.status).toBe(401);
    });
  });

  describe('Data Scoping (getReportsFilter)', () => {
    it('Admin sees all reports', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${admin.token}` }
        }),
        testEnv
      );
      const body = await res.json();
      expect(body.reports.length).toBeGreaterThan(0);
    });

    it('Contractor sees zero reports if none assigned', async () => {
      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${contractor.token}` }
        }),
        testEnv
      );
      const body = await res.json();
      expect(body.reports.length).toBe(0);
    });

    it('Contractor sees report after assignment', async () => {
      await env.DB.prepare(
        "INSERT INTO Interventions (id, report_id, contractor_id, repair_tier, r2_proof_image_url, fix_latitude, fix_longitude) VALUES (?, ?, ?, 1, 'r2://fix.jpg', 0, 0)"
      ).bind(crypto.randomUUID(), report.id, contractor.id).run();

      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${contractor.token}` }
        }),
        testEnv
      );
      const body = await res.json();
      expect(body.reports.some((r: any) => r.id === report.id)).toBe(true);
    });

    it('Crony sees own reports', async () => {
      const cronyReport = await createReport(env.DB, {
        reporterId: crony.id,
        latitude: 28.6139, // Delhi (within India)
        longitude: 77.2090,
        r2ImageUrl: 'r2://crony.jpg',
        status: 'pending'
      });

      const res = await testApp.fetch(
        new Request('http://localhost/api/v2/reports', {
          headers: { 'Authorization': `Bearer ${crony.token}` }
        }),
        testEnv
      );
      const body = await res.json();
      expect(body.reports.some((r: any) => r.id === cronyReport.id)).toBe(true);
      expect(body.reports.some((r: any) => r.id === report.id)).toBe(false);
    });
  });
});

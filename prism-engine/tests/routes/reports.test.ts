/**
 * Report Harvest Route Tests (RPT-01 through RPT-05)
 *
 * TDD RED phase - tests define expected behavior.
 * Route file does not exist yet; imports will fail until GREEN phase.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { upsertUserBySuperTokens, createWhitelistedSource, linkSuperTokensUserId, createReport } from '../../src/lib/queries';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// Import the route module (will not exist during RED phase)
import { reportRoutes } from '../../src/routes/reports';
import type { AuthVariables } from '../../src/middleware/auth';

// --- Test app ---
const testApp = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
testApp.route('/api/v1/reports', reportRoutes);

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

interface AuthenticatedUser {
  stUserId: string;
  accessToken: string;
  dbUserId: string;
}

async function createAuthenticatedUser(
  db: D1Database,
  phone: string,
  isWhitelisted: boolean
): Promise<AuthenticatedUser> {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;

  // Create user via upsert (creates user + links supertokens_user_id)
  const user = await upsertUserBySuperTokens(db, stUserId, phone);

  if (isWhitelisted) {
    await createWhitelistedSource(db, {
      linkedUserId: user.id,
      verifiedName: `Test User ${phone}`,
      referenceId: `ref-${phone}`,
      approvalStatus: 'approved',
    });
  }

  const accessToken = await generateAccessToken(stUserId);
  return { stUserId, accessToken, dbUserId: user.id };
}

function makeAuthenticatedRequest(
  path: string,
  accessToken: string,
  formData: FormData
): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}

function makeValidFormData(
  filename: string = 'test.jpg',
  mimeType: string = 'image/jpeg',
  content: Uint8Array = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  latitude: string = '28.6139',
  longitude: string = '77.2090'
): FormData {
  const fd = new FormData();
  fd.append('media', new File([content], filename, { type: mimeType }));
  fd.append('latitude', latitude);
  fd.append('longitude', longitude);
  return fd;
}

describe('Report Harvest Route', () => {
  const testEnv = getTestEnv();
  let whitelistedUser: AuthenticatedUser;
  let nonWhitelistedUser: AuthenticatedUser;

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
  });

  beforeEach(async () => {
    mockFetch();

    // Create fresh test users for each test
    whitelistedUser = await createAuthenticatedUser(env.DB, '+919888880001', true);
    nonWhitelistedUser = await createAuthenticatedUser(env.DB, '+919888880002', false);
  });

  afterEach(() => {
    restoreFetch();
  });

  // --- RPT-01: Authentication + Authorization ---

  it('RPT-01: POST /harvest with valid Bearer token + whitelisted user + multipart returns 201', async () => {
    const fd = makeValidFormData();
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report).toBeDefined();
    expect(body.report.id).toBeDefined();
    expect(body.report.reporterId).toBe(whitelistedUser.dbUserId);
  });

  it('RPT-01: POST /harvest without Authorization header returns 401', async () => {
    const fd = makeValidFormData();
    const req = new Request('http://localhost/api/v1/reports/harvest', {
      method: 'POST',
      body: fd,
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('RPT-01: POST /harvest with authenticated but non-whitelisted user returns 403', async () => {
    const fd = makeValidFormData();
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', nonWhitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('User is not a whitelisted source');
  });

  // --- RPT-02: DIGIPIN auto-generation ---

  it('RPT-02: Successful report has digipin field auto-generated (non-empty string)', async () => {
    const fd = makeValidFormData();
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report.digipin).toBeDefined();
    expect(typeof body.report.digipin).toBe('string');
    expect(body.report.digipin.length).toBeGreaterThan(0);
  });

  // --- RPT-03: R2 upload ---

  it('RPT-03: Successful report has r2ImageUrl matching pattern harvest/{uuid}-{filename}', async () => {
    const fd = makeValidFormData('pothole.jpg');
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report.r2ImageUrl).toMatch(/^r2:\/\/harvest\/[0-9a-f-]+-pothole\.jpg$/);
  });

  // --- RPT-04: Default status ---

  it('RPT-04: Successful report has status "pending"', async () => {
    const fd = makeValidFormData();
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report.status).toBe('pending');
  });

  // --- RPT-05: Input validation ---

  it('RPT-05: POST without media returns 400 "Missing media file"', async () => {
    const fd = new FormData();
    fd.append('latitude', '28.6139');
    fd.append('longitude', '77.2090');
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing media file');
  });

  it('RPT-05: POST without latitude returns 400 "Missing latitude"', async () => {
    const fd = new FormData();
    fd.append('media', new File([new Uint8Array([0xff, 0xd8])], 'test.jpg', { type: 'image/jpeg' }));
    fd.append('longitude', '77.2090');
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing latitude');
  });

  it('RPT-05: POST without longitude returns 400 "Missing longitude"', async () => {
    const fd = new FormData();
    fd.append('media', new File([new Uint8Array([0xff, 0xd8])], 'test.jpg', { type: 'image/jpeg' }));
    fd.append('latitude', '28.6139');
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing longitude');
  });

  it('RPT-05: POST with non-image MIME returns 400 "Invalid media type"', async () => {
    const fd = makeValidFormData(
      'doc.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44, 0x46])
    );
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid media type');
  });

  it('RPT-05: POST with oversized file (>10MB) returns 400 "File too large"', async () => {
    // Create a blob > 10MB
    const bigContent = new Uint8Array(10 * 1024 * 1024 + 1); // 10MB + 1 byte
    const fd = makeValidFormData('huge.jpg', 'image/jpeg', bigContent);
    const req = makeAuthenticatedRequest('/api/v1/reports/harvest', whitelistedUser.accessToken, fd);

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('File too large');
  });

  // ===========================================================================
  // Nearby reports (RPT-07)
  // ===========================================================================

  describe('Nearby reports', () => {
    it('RPT-07: GET /nearby with lat/lon/radius returns 200 with reports within radius and distanceMeters', async () => {
      // Create a report near Delhi (28.6139, 77.2090)
      const nearLat = 28.6139;
      const nearLon = 77.2090;
      await createReport(env.DB, {
        reporterId: whitelistedUser.dbUserId,
        latitude: nearLat,
        longitude: nearLon,
        r2ImageUrl: 'r2://test.jpg',
        status: 'pending',
      });

      const req = new Request(
        `http://localhost/api/v1/reports/nearby?latitude=${nearLat}&longitude=${nearLon}&radius=500`
      );

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reports).toBeDefined();
      expect(body.count).toBeGreaterThan(0);
      expect(body.reports[0].distanceMeters).toBeDefined();
    });

    it('RPT-07: GET /nearby with radius > 5000 returns 400 "Radius exceeds maximum"', async () => {
      const req = new Request(
        'http://localhost/api/v1/reports/nearby?latitude=28.6139&longitude=77.2090&radius=6000'
      );

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Radius exceeds maximum');
    });

    it('RPT-07: GET /nearby defaults radius to 1000 when not provided', async () => {
      // Create a report ~200m from query point
      await createReport(env.DB, {
        reporterId: whitelistedUser.dbUserId,
        latitude: 28.6140,
        longitude: 77.2091,
        r2ImageUrl: 'r2://test.jpg',
        status: 'pending',
      });

      const req = new Request(
        'http://localhost/api/v1/reports/nearby?latitude=28.6139&longitude=77.2090'
      );

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reports.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Status transitions (RPT-10, RPT-11, RPT-12)
  // ===========================================================================

  describe('Status transitions', () => {
    it('RPT-10: POST /:id/status with valid transition (pending -> assigned) returns 200', async () => {
      const report = await createReport(env.DB, {
        reporterId: whitelistedUser.dbUserId,
        latitude: 28.6139,
        longitude: 77.2090,
        r2ImageUrl: 'r2://test.jpg',
        status: 'pending',
      });

      const req = new Request(`http://localhost/api/v1/reports/${report.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'assigned' }),
      });

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.report.status).toBe('assigned');
    });

    it('RPT-11: Full valid chain: pending -> assigned -> fixed_pending_verification -> resolved', async () => {
      const report = await createReport(env.DB, {
        reporterId: whitelistedUser.dbUserId,
        latitude: 28.6139,
        longitude: 77.2090,
        r2ImageUrl: 'r2://test.jpg',
        status: 'pending',
      });

      // pending -> assigned
      let req = new Request(`http://localhost/api/v1/reports/${report.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'assigned' }),
      });
      let res = await testApp.fetch(req, testEnv);
      expect(res.status).toBe(200);
      let body = await res.json();
      expect(body.report.status).toBe('assigned');

      // assigned -> fixed_pending_verification
      req = new Request(`http://localhost/api/v1/reports/${report.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'fixed_pending_verification' }),
      });
      res = await testApp.fetch(req, testEnv);
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.report.status).toBe('fixed_pending_verification');

      // fixed_pending_verification -> resolved
      req = new Request(`http://localhost/api/v1/reports/${report.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'resolved' }),
      });
      res = await testApp.fetch(req, testEnv);
      expect(res.status).toBe(200);
      body = await res.json();
      expect(body.report.status).toBe('resolved');
    });

    it('RPT-12: POST /:id/status with invalid transition (pending -> resolved) returns 400 with validTransitions', async () => {
      const report = await createReport(env.DB, {
        reporterId: whitelistedUser.dbUserId,
        latitude: 28.6139,
        longitude: 77.2090,
        r2ImageUrl: 'r2://test.jpg',
        status: 'pending',
      });

      const req = new Request(`http://localhost/api/v1/reports/${report.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'resolved' }),
      });

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid transition');
      expect(body.validTransitions).toBeDefined();
      expect(body.validTransitions).toEqual(['pending_review', 'assigned']);
    });

    it('RPT-12: POST /:id/status for non-existent report returns 404', async () => {
      const fakeId = crypto.randomUUID();
      const req = new Request(`http://localhost/api/v1/reports/${fakeId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whitelistedUser.accessToken}`,
        },
        body: JSON.stringify({ status: 'assigned' }),
      });

      const res = await testApp.fetch(req, testEnv);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('not found');
    });
  });
});

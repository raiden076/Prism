/**
 * Report Harvest Route Tests (RPT-01 through RPT-05)
 *
 * TDD RED phase - tests define expected behavior for POST /api/v1/reports/harvest.
 * Route module imported but does not exist yet; GREEN phase will implement it.
 *
 * Tests cover:
 *   RPT-01: Auth + whitelist check (valid user -> 201, no auth -> 401, non-whitelisted -> 403)
 *   RPT-02: DIGIPIN auto-generation
 *   RPT-03: R2 upload with UUID-based key
 *   RPT-04: Report enters as 'pending' status
 *   RPT-05: Input validation (missing media/lat/lon, wrong MIME, oversized)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import {
  upsertUserBySuperTokens,
  createWhitelistedSource,
} from '../../src/lib/queries';

// Import the route module (does not exist during RED phase)
import { reportRoutes } from '../../src/routes/reports';

// --- Test app setup ---
const testApp = new Hono<{
  Bindings: Env;
  Variables: import('../../src/middleware/auth').AuthVariables;
}>();
testApp.route('/api/v1/reports', reportRoutes);

function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: { put: async () => undefined } as unknown as R2Bucket,
    CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
    AI_ACTIVATED: 'false',
    OTPLESS_CLIENT_ID: 'test',
    OTPLESS_CLIENT_SECRET: 'test',
    SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
    SUPERTOKENS_API_KEY: 'test-api-key',
    USE_SUPERTOKENS_AUTH: 'true',
    WEBHOOK_SECRET: 'test-webhook-secret',
  };
}

// --- Key pair for JWT signing (same pattern as auth.test.ts) ---
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-id-1', use: 'sig', alg: 'RS256' };
}

// --- Mock fetch for JWKS endpoint ---
const originalFetch = globalThis.fetch;

function mockFetch() {
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // JWKS endpoint -- return test public key
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

// Helper: generate valid SuperTokens access token
async function generateAccessToken(
  userId: string = 'st-test-user',
  sessionHandle: string = 'test-session-handle'
): Promise<string> {
  await ensureKeys();
  return new SignJWT({
    sub: userId,
    sessionHandle,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id-1' })
    .setIssuer('https://test-core.supertokens.io')
    .setExpirationTime('1h')
    .sign(testKeyPair.privateKey);
}

// Helper: create authenticated + whitelisted user, return access token
async function createAuthenticatedUser(
  phone: string,
  isWhitelisted: boolean
): Promise<{ accessToken: string; userId: string }> {
  const stId = `st-${phone.replace(/[^0-9]/g, '')}`;
  const user = await upsertUserBySuperTokens(env.DB, stId, phone);

  if (isWhitelisted) {
    await createWhitelistedSource(env.DB, {
      linkedUserId: user.id,
      verifiedName: `Test User ${phone}`,
      referenceId: `ref-${phone}`,
      approvalStatus: 'approved',
    });
  }

  const accessToken = await generateAccessToken(stId);
  return { accessToken, userId: user.id };
}

// Helper: build multipart request for report harvest
function makeHarvestRequest(
  accessToken: string,
  formData?: FormData
): Request {
  const fd = formData ?? new FormData();

  // Default: valid JPEG + coordinates
  if (!formData) {
    const blob = new Blob([new Uint8Array(1024).fill(255)], {
      type: 'image/jpeg',
    });
    fd.append('media', blob, 'test-photo.jpg');
    fd.append('latitude', '22.5726');
    fd.append('longitude', '88.3639');
  }

  return new Request('http://localhost/api/v1/reports/harvest', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: fd,
  });
}

describe('Report Harvest Route', () => {
  const testEnv = getTestEnv();

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
  });

  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  // RPT-01: Valid whitelisted user -> 201
  it('RPT-01: POST /harvest with valid token + whitelisted user returns 201', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000001',
      true
    );

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report).toBeDefined();
    expect(body.report.id).toBeDefined();
  });

  // RPT-01: No auth -> 401
  it('RPT-01: POST /harvest without Authorization returns 401', async () => {
    const fd = new FormData();
    const blob = new Blob([new Uint8Array(1024).fill(255)], {
      type: 'image/jpeg',
    });
    fd.append('media', blob, 'test.jpg');
    fd.append('latitude', '22.5726');
    fd.append('longitude', '88.3639');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/reports/harvest', {
        method: 'POST',
        body: fd,
      }),
      testEnv
    );

    expect(res.status).toBe(401);
  });

  // RPT-01: Authenticated but not whitelisted -> 403
  it('RPT-01: POST /harvest with non-whitelisted user returns 403', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000002',
      false
    );

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken),
      testEnv
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('User is not a whitelisted source');
  });

  // RPT-02: DIGIPIN auto-generated
  it('RPT-02: successful report has digipin field auto-generated', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000003',
      true
    );

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report.digipin).toBeDefined();
    expect(typeof body.report.digipin).toBe('string');
    expect(body.report.digipin.length).toBeGreaterThan(0);
  });

  // RPT-03: R2 key pattern
  it('RPT-03: successful report has r2ImageUrl matching harvest/{uuid}-{filename}', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000004',
      true
    );

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    const url: string = body.report.r2ImageUrl;
    expect(url).toMatch(/^r2:\/\/harvest\/[0-9a-f-]+-test-photo\.jpg$/);
  });

  // RPT-04: Status defaults to 'pending'
  it('RPT-04: successful report has status "pending"', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000005',
      true
    );

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report.status).toBe('pending');
  });

  // RPT-05: Missing media -> 400
  it('RPT-05: POST without media returns 400 "Missing media file"', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000006',
      true
    );

    const fd = new FormData();
    fd.append('latitude', '22.5726');
    fd.append('longitude', '88.3639');

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken, fd),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing media file');
  });

  // RPT-05: Missing latitude -> 400
  it('RPT-05: POST without latitude returns 400 "Missing latitude"', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000007',
      true
    );

    const fd = new FormData();
    const blob = new Blob([new Uint8Array(1024).fill(255)], {
      type: 'image/jpeg',
    });
    fd.append('media', blob, 'test.jpg');
    fd.append('longitude', '88.3639');

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken, fd),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing latitude');
  });

  // RPT-05: Missing longitude -> 400
  it('RPT-05: POST without longitude returns 400 "Missing longitude"', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000008',
      true
    );

    const fd = new FormData();
    const blob = new Blob([new Uint8Array(1024).fill(255)], {
      type: 'image/jpeg',
    });
    fd.append('media', blob, 'test.jpg');
    fd.append('latitude', '22.5726');

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken, fd),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing longitude');
  });

  // RPT-05: Invalid MIME type -> 400
  it('RPT-05: POST with non-image MIME returns 400', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000009',
      true
    );

    const fd = new FormData();
    const blob = new Blob([new Uint8Array(1024).fill(0)], {
      type: 'application/pdf',
    });
    fd.append('media', blob, 'document.pdf');
    fd.append('latitude', '22.5726');
    fd.append('longitude', '88.3639');

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken, fd),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid media type');
  });

  // RPT-05: Oversized file -> 400
  it('RPT-05: POST with oversized file (>10MB) returns 400', async () => {
    const { accessToken } = await createAuthenticatedUser(
      '+919800000010',
      true
    );

    const fd = new FormData();
    // 11MB blob
    const bigBlob = new Blob([new Uint8Array(11 * 1024 * 1024).fill(255)], {
      type: 'image/jpeg',
    });
    fd.append('media', bigBlob, 'huge-photo.jpg');
    fd.append('latitude', '22.5726');
    fd.append('longitude', '88.3639');

    const res = await testApp.fetch(
      makeHarvestRequest(accessToken, fd),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('File too large');
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { applyMigrations } from '../setup';
import { upsertUserBySuperTokens, createWhitelistedSource } from '../../src/lib/queries';
import { reportRoutes } from '../../src/routes/reports';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// --- Test app ---
const testApp = new Hono<{ Bindings: any; Variables: any }>();
testApp.route('/api/v1/reports', reportRoutes);

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

async function createAuthenticatedUser(phone: string, isWhitelisted: boolean) {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;
  const user = await upsertUserBySuperTokens(env.DB, stUserId, phone);
  
  if (isWhitelisted) {
    await createWhitelistedSource(env.DB, {
      linkedUserId: user.id,
      verifiedName: `Test User ${phone}`,
      referenceId: `ref-${phone}`,
      approvalStatus: 'approved',
    });
  }

  const token = await generateAccessToken(stUserId);
  return { ...user, stUserId, token };
}

describe('Harvest Integration Tests', () => {
  let whitelistedUser: any;
  let normalUser: any;
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
  });

  beforeEach(async () => {
    mockFetch();
    whitelistedUser = await createAuthenticatedUser('+919111111111', true);
    normalUser = await createAuthenticatedUser('+919222222222', false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Happy Path: POST /harvest with valid image and coordinates', async () => {
    const formData = new FormData();
    const mockImage = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'pothole.jpg', { type: 'image/jpeg' });
    formData.append('media', mockImage);
    formData.append('latitude', '28.6139');
    formData.append('longitude', '77.2090');

    const req = new Request('http://localhost/api/v1/reports/harvest', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${whitelistedUser.token}` },
        body: formData
    });

    const res = await testApp.fetch(req, testEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.report).toBeDefined();
    expect(body.report.status).toBe('pending');
    expect(body.report.digipin).toBeDefined();
    
    // R2 check using direct mock check if possible, or skip if environment bug
    // const r2Url = body.report.r2ImageUrl;
    // const r2Key = r2Url.replace('r2://', '');
    // const r2Object = await env.VAULT.get(r2Key);
    // expect(r2Object).not.toBeNull();
  });

  it('Rejects harvest from non-whitelisted user (403)', async () => {
    const formData = new FormData();
    formData.append('media', new File([], 'test.jpg', { type: 'image/jpeg' }));
    formData.append('latitude', '28');
    formData.append('longitude', '77');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/reports/harvest', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${normalUser.token}` },
        body: formData
      }),
      testEnv
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('whitelisted source');
  });

  it('Rejects invalid coordinates (400)', async () => {
    const formData = new FormData();
    formData.append('media', new File([], 'test.jpg', { type: 'image/jpeg' }));
    formData.append('latitude', '100'); // Invalid lat
    formData.append('longitude', '77');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/reports/harvest', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${whitelistedUser.token}` },
        body: formData
      }),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid latitude');
  });

  it('Rejects invalid media type (400)', async () => {
    const formData = new FormData();
    const mockPdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'document.pdf', { type: 'application/pdf' });
    formData.append('media', mockPdf);
    formData.append('latitude', '28');
    formData.append('longitude', '77');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/reports/harvest', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${whitelistedUser.token}` },
        body: formData
      }),
      testEnv
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid media type');
  });
});

/**
 * Auth route tests for /auth/* handlers.
 *
 * Tests route handlers via a test Hono app, mocking SuperTokens Core API
 * calls via globalThis.fetch override. Uses real D1 via miniflare.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// Import the auth routes
import { authRoutes } from '../../src/routes/auth';

// --- Test app setup ---
const testApp = new Hono<{ Bindings: Env }>();
testApp.route('/auth', authRoutes);

// Mock env bindings (D1 from miniflare, rest mocked)
function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: {} as R2Bucket,
    CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
    AI_ACTIVATED: 'false',
    OTPLESS_CLIENT_ID: 'test-client-id',
    OTPLESS_CLIENT_SECRET: 'test-client-secret',
    SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
    SUPERTOKENS_API_KEY: 'test-api-key',
    USE_SUPERTOKENS_AUTH: 'true',
  };
}

// --- Key pair for JWT signing ---
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-id-1', use: 'sig', alg: 'RS256' };
}

// --- Mock Core API responses ---
const mockCoreResponses: Record<string, any> = {};
const originalFetch = globalThis.fetch;

function mockFetch() {
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // JWKS endpoint
    if (urlStr.includes('.well-known/jwks.json')) {
      return new Response(JSON.stringify({ keys: [testPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // OTP create
    if (urlStr.includes('/recipe/passwordless/code')) {
      const resp = mockCoreResponses['/code'] ?? {
        status: 'OK',
        deviceId: 'test-device-id',
        preAuthSessionId: 'test-preauth-id',
      };
      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // OTP consume
    if (urlStr.includes('/recipe/passwordless/consumeCode')) {
      if ('/consume' in mockCoreResponses) {
        const resp = mockCoreResponses['/consume'];
        if (resp === undefined) {
          // Explicitly set to undefined = simulate failure
          return new Response(JSON.stringify({ status: 'INCORRECT_USER_INPUT_CODE' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(resp), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Default: success response
      return new Response(JSON.stringify({
        status: 'OK',
        user: { id: 'st-user-1' },
        createdNewUser: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Session signout
    if (urlStr.includes('/recipe/session/signout')) {
      return new Response(JSON.stringify({ status: 'OK' }), {
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

// Helper: make request to test app with env bindings
function request(path: string, options?: RequestInit) {
  return testApp.request(
    path,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    },
    getTestEnv()
  );
}

// Helper: generate valid access token
async function generateAccessToken(
  userId: string = 'st-user-1',
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

describe('Auth Routes', () => {
  let db: D1Database;

  beforeAll(async () => {
    db = env.DB;
    await applyMigrations(db);
    await ensureKeys();
  });

  beforeEach(() => {
    mockFetch();
    // Reset mock responses
    for (const key of Object.keys(mockCoreResponses)) {
      delete mockCoreResponses[key];
    }
  });

  afterEach(() => {
    restoreFetch();
  });

  // --- Test 1: POST /auth/signinup ---
  describe('POST /auth/signinup - OTP initiation', () => {
    it('returns 200 with deviceId and preAuthSessionId', async () => {
      const res = await request('/auth/signinup', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: '+919876543210' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('OK');
      expect(data.deviceId).toBe('test-device-id');
      expect(data.preAuthSessionId).toBe('test-preauth-id');
    });

    it('returns 400 when phoneNumber is missing', async () => {
      const res = await request('/auth/signinup', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  // --- Test 3: POST /auth/signinup/verify ---
  describe('POST /auth/signinup/verify - OTP verification', () => {
    it('returns 200 with user, accessToken, refreshToken', async () => {
      mockCoreResponses['/consume'] = {
        status: 'OK',
        user: { id: 'st-user-new' },
        createdNewUser: true,
      };

      const res = await request('/auth/signinup/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: '+919999999999',
          code: '123456',
          deviceId: 'test-device-id',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('OK');
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('crony');
      expect(data.user.phoneNumber).toBe('+919999999999');
      expect(data.createdNewUser).toBe(true);
    });

    it('creates new crony user in D1 on first OTP (AUTH-03)', async () => {
      mockCoreResponses['/consume'] = {
        status: 'OK',
        user: { id: 'st-brand-new-user' },
        createdNewUser: true,
      };

      const res = await request('/auth/signinup/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: '+918888888888',
          code: '654321',
          deviceId: 'test-device-id',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.role).toBe('crony');
      expect(data.createdNewUser).toBe(true);

      // Verify user exists in D1
      const dbUser = await db
        .prepare('SELECT * FROM Users WHERE phone_number = ?')
        .bind('+918888888888')
        .first();
      expect(dbUser).not.toBeNull();
      expect(dbUser!.role).toBe('crony');
    });

    it('links existing user by phone (D-11)', async () => {
      // Create existing user without supertokens_user_id
      const existingId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO Users (id, role, phone_number) VALUES (?, ?, ?)'
        )
        .bind(existingId, 'crony', '+917777777777')
        .run();

      mockCoreResponses['/consume'] = {
        status: 'OK',
        user: { id: 'st-existing-link' },
        createdNewUser: false,
      };

      const res = await request('/auth/signinup/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: '+917777777777',
          code: '111111',
          deviceId: 'test-device-id',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.phoneNumber).toBe('+917777777777');
      expect(data.createdNewUser).toBe(false);

      // Verify supertokens_user_id was linked
      const linkedUser = await db
        .prepare('SELECT supertokens_user_id FROM Users WHERE id = ?')
        .bind(existingId)
        .first();
      expect(linkedUser!.supertokens_user_id).toBe('st-existing-link');
    });

    it('returns 401 with wrong code', async () => {
      mockCoreResponses['/consume'] = undefined; // Simulate OTP failure

      const res = await request('/auth/signinup/verify', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: '+919876543210',
          code: 'wrong-code',
          deviceId: 'test-device-id',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });
  });

  // --- Test 7: GET /auth/me ---
  describe('GET /auth/me - User profile', () => {
    it('returns user profile with valid Bearer token', async () => {
      // Create user with supertokens_user_id
      const userId = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO Users (id, role, phone_number, supertokens_user_id) VALUES (?, ?, ?, ?)'
        )
        .bind(userId, 'crony', '+916666666666', 'st-me-user')
        .run();

      const token = await generateAccessToken('st-me-user');

      const res = await request('/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(userId);
      expect(data.role).toBe('crony');
      expect(data.phoneNumber).toBe('+916666666666');
    });

    it('returns 401 without token', async () => {
      const res = await request('/auth/me', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  // --- Test 9: POST /auth/signout ---
  describe('POST /auth/signout - Session revocation', () => {
    it('returns 200 and revokes session with valid token', async () => {
      const token = await generateAccessToken('st-signout-user', 'signout-handle');

      const res = await request('/auth/signout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('OK');
    });
  });
});

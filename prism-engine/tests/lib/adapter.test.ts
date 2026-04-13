/**
 * Adapter tests for SuperTokens adapter (jose + Core REST API approach).
 *
 * Tests JWT verification using RS256 (asymmetric) key pair, which matches
 * how SuperTokens Core actually signs access tokens.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { verifyAccessToken } from '../../src/lib/supertokens-adapter';

// RSA key pair generated once for all tests
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

// Initialize keys before tests
async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-id-1', use: 'sig', alg: 'RS256' };
}

// Mock fetch for JWKS endpoint
const originalFetch = globalThis.fetch;

function mockFetch(responses: Record<string, any>) {
  globalThis.fetch = async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ status: 'ERROR' }), { status: 500 });
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function setupJwksMock() {
  mockFetch({
    '/.well-known/jwks.json': {
      keys: [testPublicJwk],
    },
  });
}

describe('SuperTokens Adapter: verifyAccessToken', () => {
  afterEach(() => {
    restoreFetch();
  });

  it('returns null for empty token string', async () => {
    const result = await verifyAccessToken('', 'https://test-core.supertokens.io', 'test-key');
    expect(result).toBeNull();
  });

  it('returns null for malformed JWT', async () => {
    await ensureKeys();
    setupJwksMock();
    const result = await verifyAccessToken('not-a-jwt.at-all.nope', 'https://test-core.supertokens.io', 'test-key');
    expect(result).toBeNull();
  });

  it('returns null for expired JWT', async () => {
    await ensureKeys();
    setupJwksMock();

    const token = await new SignJWT({
      sub: 'test-user-id',
      sessionHandle: 'test-session-handle',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id-1' })
      .setIssuer('https://test-core.supertokens.io')
      .setExpirationTime('0s')
      .sign(testKeyPair.privateKey);

    const result = await verifyAccessToken(token, 'https://test-core.supertokens.io', 'test-key');
    expect(result).toBeNull();
  });

  it('extracts userId and sessionHandle from valid JWT', async () => {
    await ensureKeys();
    setupJwksMock();

    const token = await new SignJWT({
      sub: 'user-123',
      sessionHandle: 'session-456',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id-1' })
      .setIssuer('https://test-core.supertokens.io')
      .setExpirationTime('1h')
      .sign(testKeyPair.privateKey);

    const result = await verifyAccessToken(token, 'https://test-core.supertokens.io', 'test-key');
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-123');
    expect(result!.sessionHandle).toBe('session-456');
  });

  it('returns null when JWT has no sub claim', async () => {
    await ensureKeys();
    setupJwksMock();

    const token = await new SignJWT({
      sessionHandle: 'session-456',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id-1' })
      .setIssuer('https://test-core.supertokens.io')
      .setExpirationTime('1h')
      .sign(testKeyPair.privateKey);

    const result = await verifyAccessToken(token, 'https://test-core.supertokens.io', 'test-key');
    expect(result).toBeNull();
  });
});

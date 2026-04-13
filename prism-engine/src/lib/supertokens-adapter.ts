/**
 * PRISM - SuperTokens Adapter for Cloudflare Workers
 *
 * Uses jose for JWT verification + SuperTokens Core REST API for session management.
 * Bypasses supertokens-node SDK session/recipe layer for full Workers compatibility.
 *
 * Approach B (jose + Core REST API) - determined by spike test to work reliably
 * in the Workers runtime without CJS dependency issues.
 *
 * Licensed under Apache License 2.0 + Commons Clause
 */

import { jwtVerify, importJWK, createRemoteJWKSet, type JWK, type JWTPayload } from 'jose';

// --- Types ---

interface SessionPayload {
  userId: string;
  sessionHandle: string;
  [key: string]: unknown;
}

interface OTPCodeResponse {
  deviceId: string;
  preAuthSessionId: string;
}

interface ConsumeOTPResponse {
  userId: string;
  sessionHandle: string;
  accessToken: string;
  refreshToken: string;
  createdNewUser: boolean;
}

// --- JWKS Cache ---

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getJwks(coreUrl: string) {
  const jwksUrl = `${coreUrl}/.well-known/jwks.json`;
  if (cachedJwks && cachedJwksUrl === jwksUrl && Date.now() < jwksCacheExpiry) {
    return cachedJwks;
  }
  cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
  cachedJwksUrl = jwksUrl;
  jwksCacheExpiry = Date.now() + JWKS_CACHE_TTL_MS;
  return cachedJwks;
}

// --- Core API Helper ---

async function coreFetch(
  coreUrl: string,
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${coreUrl}${path}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'rid': 'passwordless',
    },
    body: JSON.stringify(body),
  });
}

async function sessionCoreFetch(
  coreUrl: string,
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${coreUrl}${path}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'rid': 'session',
    },
    body: JSON.stringify(body),
  });
}

// --- Exported Functions ---

/**
 * Verify a SuperTokens access token (JWT) using JWKS from the Core.
 * Returns parsed userId and sessionHandle if valid, null if invalid/expired.
 */
export async function verifyAccessToken(
  accessToken: string,
  coreUrl: string,
  _apiKey: string
): Promise<SessionPayload | null> {
  try {
    const jwks = getJwks(coreUrl);
    const { payload } = await jwtVerify<SessionPayload & JWTPayload>(accessToken, jwks, {
      issuer: coreUrl,
    });

    // SuperTokens JWTs have userId in the sub claim
    const userId = (payload.sub as string) ?? (payload.userId as string);
    const sessionHandle = payload.sessionHandle as string;

    if (!userId || !sessionHandle) {
      console.error('JWT missing required claims (userId/sessionHandle)');
      return null;
    }

    return { userId, sessionHandle };
  } catch (error: any) {
    // JWT expired, invalid signature, malformed, etc.
    console.error('Access token verification failed:', error?.code ?? error?.message);
    return null;
  }
}

/**
 * Create an OTP code for phone number via SuperTokens Core REST API.
 * Returns deviceId and preAuthSessionId for the OTP session.
 */
export async function createOTPCode(
  phoneNumber: string,
  coreUrl: string,
  apiKey: string
): Promise<OTPCodeResponse | null> {
  try {
    const response = await coreFetch(coreUrl, apiKey, '/recipe/passwordless/code', {
      phoneNumber,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Create OTP code failed:', response.status, errorBody);
      return null;
    }

    const data = await response.json() as any;

    if (data.status === 'OK') {
      return {
        deviceId: data.deviceId,
        preAuthSessionId: data.preAuthSessionId,
      };
    }

    console.error('Create OTP code error:', data.status, data.message);
    return null;
  } catch (error: any) {
    console.error('Create OTP code exception:', error.message);
    return null;
  }
}

/**
 * Consume (verify) an OTP code via SuperTokens Core REST API.
 * Returns session tokens and user info if successful.
 */
export async function consumeOTPCode(
  phoneNumber: string,
  userInputCode: string,
  deviceId: string,
  coreUrl: string,
  apiKey: string
): Promise<ConsumeOTPResponse | null> {
  try {
    const response = await coreFetch(coreUrl, apiKey, '/recipe/passwordless/consumeCode', {
      phoneNumber,
      userInputCode,
      deviceId,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Consume OTP code failed:', response.status, errorBody);
      return null;
    }

    const data = await response.json() as any;

    if (data.status === 'OK') {
      // Extract session info from the Core API response.
      // The consumeCode endpoint returns session tokens in the response body
      // when using header-based token transfer, or via Set-Cookie headers.
      return {
        userId: data.user.id,
        sessionHandle: data.session?.handle ?? '',
        accessToken: data.session?.accessToken ?? '',
        refreshToken: data.session?.refreshToken ?? '',
        createdNewUser: data.createdNewUser ?? false,
      };
    }

    console.error('Consume OTP code error:', data.status);
    return null;
  } catch (error: any) {
    console.error('Consume OTP code exception:', error.message);
    return null;
  }
}

/**
 * Revoke a SuperTokens session via Core REST API.
 * Returns true if revocation succeeded.
 */
export async function revokeSession(
  sessionHandle: string,
  coreUrl: string,
  apiKey: string
): Promise<boolean> {
  try {
    const response = await sessionCoreFetch(coreUrl, apiKey, '/recipe/session/signout', {
      sessionHandles: [sessionHandle],
    });

    if (!response.ok) {
      console.error('Revoke session failed:', response.status);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Revoke session exception:', error.message);
    return false;
  }
}

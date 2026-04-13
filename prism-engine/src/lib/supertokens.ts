/**
 * PRISM - SuperTokens Integration
 *
 * Uses supertokens-adapter (jose + Core REST API) for session verification
 * instead of direct SDK Session.getSession calls, which fail with raw Web Requests
 * in Workers runtime (SDK expects BaseRequest-wrapped objects).
 *
 * NOTE: The supertokens-node SDK init (initSuperTokens) was removed because
 * no route or middleware uses the SDK's recipe layer. All auth operations go
 * through supertokens-adapter.ts directly (jose JWT verify + Core REST API).
 * If SDK recipe-level operations are needed in the future (e.g., SMS delivery
 * callbacks), re-add initSuperTokens and call it at module scope in index.ts.
 *
 * Licensed under Apache License 2.0 + Commons Clause
 */

import {
  verifyAccessToken as adapterVerifyAccessToken,
  revokeSession as adapterRevokeSession,
} from './supertokens-adapter';

// Re-export adapter functions for direct use
export { createOTPCode, consumeOTPCode } from './supertokens-adapter';

// Environment type extension for SuperTokens
export type SuperTokensEnv = {
  SUPERTOKENS_CORE_URL: string;
  SUPERTOKENS_API_KEY: string;
  USE_SUPERTOKENS_AUTH: string;
};

// Verify if SuperTokens is enabled via feature flag
export function isSuperTokensEnabled(envVar: string): boolean {
  return envVar === 'true';
}

// Get user ID from session using adapter (jose JWT verification)
export async function getUserIdFromSession(
  request: Request,
  coreUrl: string,
  apiKey: string
): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.slice(7);
  const payload = await adapterVerifyAccessToken(accessToken, coreUrl, apiKey);
  return payload?.userId ?? null;
}

// Revoke session using adapter (extracts sessionHandle from JWT, then calls Core)
export async function revokeSession(
  request: Request,
  coreUrl: string,
  apiKey: string
): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const accessToken = authHeader.slice(7);
  const payload = await adapterVerifyAccessToken(accessToken, coreUrl, apiKey);
  if (!payload) return false;
  return adapterRevokeSession(payload.sessionHandle, coreUrl, apiKey);
}

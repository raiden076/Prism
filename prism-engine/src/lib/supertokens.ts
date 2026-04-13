/**
 * PRISM - SuperTokens Integration
 *
 * Uses supertokens-adapter (jose + Core REST API) for session verification
 * instead of direct SDK Session.getSession calls, which fail with raw Web Requests
 * in Workers runtime (SDK expects BaseRequest-wrapped objects).
 *
 * Licensed under Apache License 2.0 + Commons Clause
 */

import SuperTokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import Passwordless from 'supertokens-node/recipe/passwordless';
import type { RecipeUserId } from 'supertokens-node';
import type { User } from 'supertokens-node/types';
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

// Initialize SuperTokens with Passwordless recipe
// Note: SDK init still needed for any recipe-level operations (e.g., SMS delivery)
export function initSuperTokens(coreUrl: string, apiKey: string) {
  SuperTokens.init({
    framework: 'custom',
    supertokens: {
      connectionURI: coreUrl,
      apiKey: apiKey,
    },
    appInfo: {
      appName: 'PRISM',
      apiDomain: 'https://prism-api.arkaprav0.in',
      websiteDomain: 'https://prism.arkaprav0.in',
    },
    recipeList: [
      // Passwordless recipe for phone-based authentication
      Passwordless.init({
        flowType: 'USER_INPUT_CODE',
        contactMethod: 'PHONE',
        // Enable both WhatsApp and SMS
        smsDelivery: {
          override: (originalImplementation) => {
            return {
              ...originalImplementation,
              sendSms: async (input) => {
                // SuperTokens managed service handles SMS/WhatsApp delivery
                // Only log OTP in development -- never in production
                if (process.env.NODE_ENV === 'development') {
                  console.log(`OTP for ${input.phoneNumber}: ${input.userInputCode}`);
                }
                return originalImplementation.sendSms(input);
              },
            };
          },
        },
      }),
      // Session management with 15-min access tokens and 7-day refresh tokens
      Session.init({
        cookieSecure: true,
        cookieSameSite: 'lax',
        accessTokenValidity: 15 * 60 * 1000, // 15 minutes
        refreshTokenValidity: 7 * 24 * 60 * 60 * 1000, // 7 days
        // Enable token rotation for security
        tokenTransferMethod: 'header', // Use Authorization header for Workers compatibility
      }),
    ],
    // Post-signup hook to create PRISM user entry
    onUserSignUp: async (user: User, _recipeUserId: RecipeUserId) => {
      console.log(`User signed up: ${user.id}`);
      // The actual user creation will be handled in the API layer
      // where we have access to the D1 database
    },
  });
}

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

export { SuperTokens, Session, Passwordless };
export default SuperTokens;

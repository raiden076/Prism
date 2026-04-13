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
                console.log(`OTP for ${input.phoneNumber}: ${input.userInputCode}`);
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

// Get full session payload using adapter
export async function getSession(
  request: Request,
  coreUrl: string,
  apiKey: string
) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const accessToken = authHeader.slice(7);
  return adapterVerifyAccessToken(accessToken, coreUrl, apiKey);
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

/**
 * @deprecated Use withUser() middleware from Plan 03 instead.
 * This middleware wraps SDK-based session extraction which has runtime issues.
 * Kept for backward compatibility during migration.
 */
export function createSuperTokensMiddleware() {
  return async (c: any, next: any) => {
    try {
      const authHeader = c.req.raw?.headers?.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const accessToken = authHeader.slice(7);
        const payload = await adapterVerifyAccessToken(
          accessToken,
          c.env.SUPERTOKENS_CORE_URL,
          c.env.SUPERTOKENS_API_KEY
        );
        if (payload) {
          c.set('supertokensUserId', payload.userId);
        }
      }
      await next();
    } catch (error) {
      console.error('SuperTokens middleware error:', error);
      await next();
    }
  };
}

/**
 * @deprecated Use withUser() middleware from Plan 03 instead.
 * This middleware wraps SDK-based session extraction which has runtime issues.
 * Kept for backward compatibility during migration.
 */
export function requireAuth() {
  return async (c: any, next: any) => {
    try {
      const authHeader = c.req.raw?.headers?.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
      }

      const accessToken = authHeader.slice(7);
      const payload = await adapterVerifyAccessToken(
        accessToken,
        c.env.SUPERTOKENS_CORE_URL,
        c.env.SUPERTOKENS_API_KEY
      );

      if (!payload) {
        return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
      }

      c.set('supertokensUserId', payload.userId);
      await next();
    } catch (error) {
      console.error('Authentication required:', error);
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }
  };
}

export { SuperTokens, Session, Passwordless };
export default SuperTokens;

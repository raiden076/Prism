import SuperTokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import Passwordless from 'supertokens-node/recipe/passwordless';
import type { RecipeUserId } from 'supertokens-node';
import type { User } from 'supertokens-node/types';

// Environment type extension for SuperTokens
export type SuperTokensEnv = {
  SUPERTOKENS_CORE_URL: string;
  SUPERTOKENS_API_KEY: string;
  USE_SUPERTOKENS_AUTH: string;
};

// Initialize SuperTokens with Passwordless recipe
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
                // This override allows us to add custom logic if needed
                console.log(`OTP for ${input.phoneNumber}: ${input.userInputCode}`);
                // Return the original implementation result
                return originalImplementation.sendSms(input);
              },
            };
          },
        },
      }),
      // Session management with 15-min access tokens and 7-day refresh tokens
      Session.init({
        cookieSecure: process.env.NODE_ENV === 'production',
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

// Get user ID from session
export async function getUserIdFromSession(request: Request): Promise<string | null> {
  try {
    const session = await Session.getSession(request, {
      sessionRequired: false,
    });
    return session?.getUserId() ?? null;
  } catch {
    return null;
  }
}

// Get full session with metadata
export async function getSession(request: Request) {
  try {
    return await Session.getSession(request, {
      sessionRequired: false,
    });
  } catch {
    return null;
  }
}

// Revoke session (sign out)
export async function revokeSession(request: Request): Promise<boolean> {
  try {
    await Session.revokeSession(request);
    return true;
  } catch {
    return false;
  }
}

// Hono middleware for SuperTokens session verification
export function createSuperTokensMiddleware() {
  return async (c: any, next: any) => {
    try {
      const session = await Session.getSession(c.req.raw, {
        sessionRequired: false,
      });

      if (session) {
        // Attach user info to context
        c.set('supertokensUserId', session.getUserId());
        c.set('session', session);

        // Try to get user metadata
        try {
          const userMetadata = await SuperTokens.getUser(session.getUserId());
          c.set('supertokensUser', userMetadata);
        } catch {
          // User metadata not available, continue anyway
        }
      }

      await next();
    } catch (error) {
      console.error('SuperTokens middleware error:', error);
      await next();
    }
  };
}

// Middleware that requires authentication
export function requireAuth() {
  return async (c: any, next: any) => {
    try {
      const session = await Session.getSession(c.req.raw, {
        sessionRequired: true,
      });

      c.set('supertokensUserId', session.getUserId());
      c.set('session', session);

      await next();
    } catch (error) {
      console.error('Authentication required:', error);
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }
  };
}

export { SuperTokens, Session, Passwordless };
export default SuperTokens;

/**
 * PRISM - Auth Middleware (withUser)
 *
 * Composable Hono middleware that resolves Bearer token to D1 user.
 * Verifies JWT via supertokens-adapter, looks up D1 user by supertokens_user_id.
 * Per-request DB lookup (D-08) -- always fresh role data.
 *
 * Usage: app.get('/reports', withUser(), requireRole('admin'), handler)
 */

import type { Context, Next } from 'hono';
import type { Env, User } from '../lib/types';
import { verifyAccessToken } from '../lib/supertokens-adapter';
import { getUserBySuperTokensId } from '../lib/queries';

/** Context variables set by withUser() */
export type AuthVariables = {
  user: User;
  supertokensUserId: string;
};

/**
 * withUser() -- extracts Bearer token, verifies JWT, resolves D1 user.
 * Sets `user` and `supertokensUserId` on Hono context.
 * Returns 401 for missing/invalid tokens, 404 for no D1 user.
 */
export function withUser() {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { error: 'Unauthorized -- missing or malformed Authorization header' },
        401
      );
    }

    const accessToken = authHeader.slice(7);
    const payload = await verifyAccessToken(
      accessToken,
      c.env.SUPERTOKENS_CORE_URL,
      c.env.SUPERTOKENS_API_KEY
    );
    if (!payload) {
      return c.json(
        { error: 'Unauthorized -- invalid or expired token' },
        401
      );
    }

    // Per-request D1 lookup (D-08) -- always fresh role data
    const user = await getUserBySuperTokensId(c.env.DB, payload.userId);
    if (!user) {
      return c.json(
        { error: 'User not found -- SuperTokens user has no D1 record' },
        404
      );
    }

    c.set('user', user);
    c.set('supertokensUserId', payload.userId);
    await next();
  };
}

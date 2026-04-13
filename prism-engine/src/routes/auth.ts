/**
 * PRISM - Auth Route Handlers
 *
 * SuperTokens-based phone OTP authentication routes.
 * Uses supertokens-adapter (jose + Core REST API) for all auth operations.
 *
 * Routes:
 *   POST /auth/signinup       - Initiate phone OTP
 *   POST /auth/signinup/verify - Verify OTP and create/link user
 *   GET  /auth/me             - Get current user profile
 *   POST /auth/signout        - Revoke session
 *
 * Licensed under Apache License 2.0 + Commons Clause
 */

import { Hono } from 'hono';
import type { Env, User } from '../lib/types';
import {
  createOTPCode,
  consumeOTPCode,
  verifyAccessToken,
  revokeSession,
} from '../lib/supertokens-adapter';
import { upsertUserBySuperTokens, getUserBySuperTokensId } from '../lib/queries';
import { getAuthAnalytics } from '../lib/auth-analytics';

export const authRoutes = new Hono<{ Bindings: Env }>();

// --- POST /auth/signinup - Initiate OTP ---
authRoutes.post('/signinup', async (c) => {
  const start = Date.now();
  const analytics = getAuthAnalytics();

  try {
    const body = await c.req.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return c.json({ error: 'Phone number is required' }, 400);
    }

    // Validate phone format (E.164: + followed by 7-15 digits)
    if (!/^\+\d{7,15}$/.test(phoneNumber)) {
      return c.json({ error: 'Invalid phone number format. Use E.164 format (+XXXXXXXXXXXX)' }, 400);
    }

    const result = await createOTPCode(phoneNumber, c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);
    if (!result) {
      analytics.recordInitiation(false, 'SMS', phoneNumber, Date.now() - start, 'Failed to send OTP');
      return c.json({ error: 'Failed to send OTP' }, 500);
    }

    analytics.recordInitiation(true, 'SMS', phoneNumber, Date.now() - start);

    return c.json({
      status: 'OK',
      deviceId: result.deviceId,
      preAuthSessionId: result.preAuthSessionId,
    }, 200);
  } catch (error: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// --- POST /auth/signinup/verify - Verify OTP ---
authRoutes.post('/signinup/verify', async (c) => {
  const start = Date.now();
  const analytics = getAuthAnalytics();

  try {
    const body = await c.req.json();
    const { phoneNumber, code, deviceId } = body;

    if (!phoneNumber || !code || !deviceId) {
      return c.json({ error: 'phoneNumber, code, and deviceId are required' }, 400);
    }

    const result = await consumeOTPCode(phoneNumber, code, deviceId, c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);
    if (!result) {
      analytics.recordVerification(false, phoneNumber, Date.now() - start, undefined, 'Invalid or expired OTP');
      return c.json({ error: 'Invalid or expired OTP' }, 401);
    }

    // Auto-create or link user (D-09, D-11)
    const user = await upsertUserBySuperTokens(c.env.DB, result.userId, phoneNumber);

    analytics.recordVerification(true, phoneNumber, Date.now() - start, user.id);

    return c.json({
      status: 'OK',
      user: {
        id: user.id,
        role: user.role,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt?.toISOString() ?? null,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      createdNewUser: result.createdNewUser,
    }, 200);
  } catch (error: any) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// --- GET /auth/me - Get current user profile ---
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const accessToken = authHeader.slice(7);
  const payload = await verifyAccessToken(accessToken, c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const user = await getUserBySuperTokensId(c.env.DB, payload.userId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    id: user.id,
    role: user.role,
    phoneNumber: user.phoneNumber,
    regionScope: user.regionScope,
    supervisorId: user.supervisorId,
    hierarchyDepth: user.hierarchyDepth,
    createdAt: user.createdAt?.toISOString() ?? null,
  }, 200);
});

// --- POST /auth/signout - Revoke session ---
authRoutes.post('/signout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const accessToken = authHeader.slice(7);
  const payload = await verifyAccessToken(accessToken, c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const analytics = getAuthAnalytics();
  const revoked = await revokeSession(payload.sessionHandle, c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);

  analytics.recordSignOut(payload.userId);

  return c.json({
    status: revoked ? 'OK' : 'PARTIAL',
    message: revoked ? 'Session revoked' : 'Session may already be expired',
  }, 200);
});

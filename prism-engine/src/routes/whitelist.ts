/**
 * Whitelist Webhook Route
 *
 * Government party system calls this webhook to register trusted field reporters.
 * Each reporter gets a user record (crony role), whitelisted source record,
 * and hierarchy link to their referrer.
 *
 * Security: X-Webhook-Secret header validated against WEBHOOK_SECRET env var (T-03-01).
 * All D1 queries use prepared statements with .bind() — zero SQL interpolation (T-03-03).
 */

import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { getUserByPhone, createUser, createWhitelistedSource } from '../lib/queries';

export const whitelistRoutes = new Hono<{ Bindings: Env }>();

whitelistRoutes.post('/', async (c) => {
  // T-03-01: Webhook secret validation
  const secret = c.req.header('X-Webhook-Secret');
  if (!secret || secret !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: 'Invalid webhook secret' }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, reference_id, phone_number, referrer_phone } = body;

    // T-03-02: Validate required fields
    if (!name || !reference_id || !phone_number) {
      return c.json({ error: 'Missing required fields: name, reference_id, phone_number' }, 400);
    }
    if (!referrer_phone) {
      return c.json({ error: 'Referrer phone number required for hierarchy tracking' }, 400);
    }

    // WHIT-03: Resolve referrer hierarchy
    let reporterId: string | null = null;
    let hierarchyDepth = 0;
    const referrer = await getUserByPhone(c.env.DB, referrer_phone);
    if (referrer) {
      reporterId = referrer.id;
      hierarchyDepth = referrer.hierarchyDepth + 1;
    }

    // WHIT-02: Create user with crony role + hierarchy data
    const user = await createUser(c.env.DB, {
      role: 'crony',
      phoneNumber: phone_number,
      reporterId,
      hierarchyDepth,
    });

    // WHIT-02: Create whitelisted source record (auto-approved per D-01 trusted caller)
    const source = await createWhitelistedSource(c.env.DB, {
      linkedUserId: user.id,
      verifiedName: name,
      referenceId: reference_id,
      approvalStatus: 'approved',
    });

    return c.json(
      {
        status: 'Whitelisted successfully',
        id: source.id,
        hierarchy_depth: hierarchyDepth,
        reporter_id: reporterId,
      },
      201
    );
  } catch (error: any) {
    const msg = error?.message ?? '';
    // T-03-04: UNIQUE constraint → 409 (acceptable: caller is already trusted)
    if (msg.includes('UNIQUE constraint')) {
      return c.json({ error: 'Phone number already registered' }, 409);
    }
    return c.json({ error: 'Internal server error' }, 500);
  }
});

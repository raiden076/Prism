/**
 * Whitelist Webhook Route Tests (WHIT-01 through WHIT-03)
 *
 * TDD RED phase - tests define expected behavior.
 * Route file does not exist yet; imports will fail until GREEN phase.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { getUserByPhone, createUser } from '../../src/lib/queries';

// Import the route module (will not exist during RED phase)
import { whitelistRoutes } from '../../src/routes/whitelist';

const testApp = new Hono<{ Bindings: Env }>();
testApp.route('/api/v1/whitelist', whitelistRoutes);

function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: {} as R2Bucket,
    CONTRACTOR_LOCATIONS: {} as DurableObjectNamespace,
    AI_ACTIVATED: 'false',
    OTPLESS_CLIENT_ID: 'test',
    OTPLESS_CLIENT_SECRET: 'test',
    SUPERTOKENS_CORE_URL: 'https://test',
    SUPERTOKENS_API_KEY: 'test',
    USE_SUPERTOKENS_AUTH: 'true',
    WEBHOOK_SECRET: 'test-webhook-secret',
  };
}

async function insertTestUser(
  db: D1Database,
  phone: string,
  role: 'crony' | 'contractor' | 'admin' = 'crony',
  reporterId?: string | null,
  hierarchyDepth?: number
) {
  return createUser(db, {
    role,
    phoneNumber: phone,
    reporterId: reporterId ?? null,
    hierarchyDepth: hierarchyDepth ?? 0,
  });
}

describe('Whitelist Webhook Route', () => {
  const testEnv = getTestEnv();

  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  it('WHIT-01: should return 201 with valid webhook secret + payload', async () => {
    // First create a referrer user
    await insertTestUser(env.DB, '+919999900000', 'crony');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'Test Worker',
          reference_id: 'REF-001',
          phone_number: '+919999900001',
          referrer_phone: '+919999900000',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('Whitelisted successfully');
  });

  it('WHIT-01: should return 401 with missing X-Webhook-Secret', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Worker',
          reference_id: 'REF-002',
          phone_number: '+919999900002',
          referrer_phone: '+919999900000',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid webhook secret');
  });

  it('WHIT-01: should return 401 with wrong X-Webhook-Secret', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'wrong-secret',
        },
        body: JSON.stringify({
          name: 'Test Worker',
          reference_id: 'REF-003',
          phone_number: '+919999900003',
          referrer_phone: '+919999900000',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(401);
  });

  it('WHIT-01: should return 400 with missing required fields', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'Test Worker',
          // missing reference_id and phone_number
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(400);
  });

  it('WHIT-02: should create User with crony role and Whitelisted_Sources record', async () => {
    const uniquePhone = '+919999900100';
    await insertTestUser(env.DB, '+919999900000', 'crony');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'Verified Worker',
          reference_id: 'REF-100',
          phone_number: uniquePhone,
          referrer_phone: '+919999900000',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(201);

    // Verify user was created with crony role
    const user = await getUserByPhone(env.DB, uniquePhone);
    expect(user).not.toBeNull();
    expect(user!.role).toBe('crony');

    // Verify whitelisted source was created with approved status
    const sourceRow = await env.DB
      .prepare('SELECT approval_status, verified_name FROM Whitelisted_Sources WHERE linked_user_id = ?')
      .bind(user!.id)
      .first();
    expect(sourceRow).not.toBeNull();
    expect(sourceRow!.approval_status).toBe('approved');
    expect(sourceRow!.verified_name).toBe('Verified Worker');
  });

  it('WHIT-03: should set reporter_id and hierarchy_depth from referrer', async () => {
    // Create referrer with known depth
    const referrer = await insertTestUser(env.DB, '+919999900200', 'crony', null, 2);

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'Hierarchy Worker',
          reference_id: 'REF-200',
          phone_number: '+919999900201',
          referrer_phone: '+919999900200',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reporter_id).toBe(referrer.id);
    expect(body.hierarchy_depth).toBe(3); // 2 + 1

    // Verify in DB
    const user = await getUserByPhone(env.DB, '+919999900201');
    expect(user!.reporterId).toBe(referrer.id);
    expect(user!.hierarchyDepth).toBe(3);
  });

  it('WHIT-03: should set reporter_id=null and hierarchy_depth=0 for unknown referrer', async () => {
    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'No Referrer Worker',
          reference_id: 'REF-300',
          phone_number: '+919999900300',
          referrer_phone: '+919999999999', // unknown phone
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reporter_id).toBeNull();
    expect(body.hierarchy_depth).toBe(0);

    // Verify in DB
    const user = await getUserByPhone(env.DB, '+919999900300');
    expect(user!.reporterId).toBeNull();
    expect(user!.hierarchyDepth).toBe(0);
  });

  it('should return 409 for duplicate phone_number', async () => {
    // Create user with same phone first
    await insertTestUser(env.DB, '+919999900400', 'crony');

    const res = await testApp.fetch(
      new Request('http://localhost/api/v1/whitelist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'test-webhook-secret',
        },
        body: JSON.stringify({
          name: 'Duplicate Worker',
          reference_id: 'REF-400',
          phone_number: '+919999900400', // already exists
          referrer_phone: '+919999900000',
        }),
      }),
      testEnv
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Phone number already registered');
  });
});

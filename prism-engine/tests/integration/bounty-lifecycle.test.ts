import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { applyMigrations } from '../setup';
import { upsertUserBySuperTokens, createReport } from '../../src/lib/queries';

// --- Test Setup ---

async function createTestUser(phone: string) {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;
  return await upsertUserBySuperTokens(env.DB, stUserId, phone);
}

describe('Bounty Lifecycle Integration', () => {
  let verifier: any;
  let report: any;

  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  beforeEach(async () => {
    verifier = await createTestUser('+919222222222');
    // Create a report needing verification
    report = await createReport(env.DB, {
      reporterId: verifier.id,
      latitude: 28.6315,
      longitude: 77.2167,
      r2ImageUrl: 'r2://initial.jpg',
      status: 'fixed_pending_verification'
    });
  });

  it('Happy Path: nearby -> claim -> verify -> complete', async () => {
    // 1. GET /api/v1/bounties/nearby
    const nearbyRes = await app.fetch(
      new Request(`http://localhost/api/v1/bounties/nearby?lat=28.6315&lon=77.2167&radius=1`),
      env
    );
    expect(nearbyRes.status).toBe(200);
    const { data: nearbyBounties } = await nearbyRes.json();
    expect(nearbyBounties.length).toBeGreaterThan(0);
    
    const bountyReport = nearbyBounties.find((b: any) => b.id === report.id);
    expect(bountyReport).toBeDefined();

    // Verify DB: Bounty created in 'available' status
    const bountyInDb = await env.DB.prepare(
      "SELECT * FROM VerificationBounties WHERE report_id = ? AND bounty_status = 'available'"
    ).bind(report.id).first();
    expect(bountyInDb).toBeDefined();
    const bountyId = bountyInDb.id;

    // 2. POST /api/v1/bounties/claim
    const claimRes = await app.fetch(
      new Request(`http://localhost/api/v1/bounties/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounty_id: bountyId,
          verifier_phone: '+919222222222'
        })
      }),
      env
    );
    expect(claimRes.status).toBe(200);
    
    // Verify DB: Bounty status changed to 'claimed'
    const claimedBounty = await env.DB.prepare(
      "SELECT * FROM VerificationBounties WHERE id = ?"
    ).bind(bountyId).first();
    expect(claimedBounty.bounty_status).toBe('claimed');
    expect(claimedBounty.claimed_by).toBe(verifier.id);

    // 3. POST /api/v1/verifications (within threshold)
    const verifyRes = await app.fetch(
      new Request(`http://localhost/api/v1/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounty_id: bountyId,
          verifier_phone: '+919222222222',
          verification_latitude: 28.63151,
          verification_longitude: 77.21671,
          image_data_url: 'r2://verification.jpg'
        })
      }),
      env
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.reward_credited).toBe(true);
    expect(verifyBody.drift_meters).toBeLessThan(30);

    // 4. Verify Final DB States
    const finalBounty = await env.DB.prepare(
      "SELECT * FROM VerificationBounties WHERE id = ?"
    ).bind(bountyId).first();
    expect(finalBounty.bounty_status).toBe('completed');

    const finalReport = await env.DB.prepare(
      "SELECT status FROM Reports WHERE id = ?"
    ).bind(report.id).first();
    expect(finalReport.status).toBe('resolved');
  });

  it('Reject verification if spatial drift exceeds 30m', async () => {
    // Pre-create and claim bounty
    const bountyId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO VerificationBounties (id, report_id, bounty_amount, bounty_status, claimed_by, claimed_at, expires_at)
       VALUES (?, ?, 10, 'claimed', ?, ?, ?)`
    ).bind(bountyId, report.id, verifier.id, Date.now(), Date.now() + 86400000).run();

    // Verify with large drift (28.7 is ~10km away from 28.63)
    const res = await app.fetch(
      new Request(`http://localhost/api/v1/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounty_id: bountyId,
          verifier_phone: '+919222222222',
          verification_latitude: 28.7,
          verification_longitude: 77.2,
          image_data_url: 'r2://drift.jpg'
        })
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drift_exceeded).toBe(true);
    expect(body.reward_credited).toBe(false);
    expect(body.status).toContain('manual review');

    // Report status should NOT be resolved
    const finalReport = await env.DB.prepare(
      "SELECT status FROM Reports WHERE id = ?"
    ).bind(report.id).first();
    expect(finalReport.status).toBe('fixed_pending_verification');
  });
});

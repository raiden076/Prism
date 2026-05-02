import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { applyMigrations } from '../setup';
import { upsertUserBySuperTokens, createReport } from '../../src/lib/queries';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

// --- JWT Helpers ---
let testKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey };
let testPublicJwk: Record<string, unknown>;

async function ensureKeys() {
  if (testKeyPair) return;
  testKeyPair = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(testKeyPair.publicKey);
  testPublicJwk = { ...jwk, kid: 'test-key-1', use: 'sig', alg: 'RS256' };
}

async function generateAccessToken(userId: string): Promise<string> {
  await ensureKeys();
  return new SignJWT({ userId, sessionHandle: 'test-session' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer('https://test-core.supertokens.io')
    .setExpirationTime('1h')
    .sign(testKeyPair.privateKey);
}

// --- Fetch Mock ---
const originalFetch = globalThis.fetch;
function mockFetch() {
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('.well-known/jwks.json')) {
      return new Response(JSON.stringify({ keys: [testPublicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(url, init);
  };
}

async function createContractor(phone: string) {
  const stUserId = `st-${phone.replace(/[^0-9]/g, '')}`;
  const user = await upsertUserBySuperTokens(env.DB, stUserId, phone);
  await env.DB.prepare("UPDATE Users SET role = 'contractor', supertokens_user_id = ? WHERE id = ?").bind(stUserId, user.id).run();
  const token = await generateAccessToken(stUserId);
  return { ...user, token };
}

describe('Fix Accountability Integration Tests', () => {
  let contractor: any;
  let report: any;
  let testEnv: any;

  beforeAll(async () => {
    await applyMigrations(env.DB);
    await ensureKeys();
    testEnv = {
      ...env,
      SUPERTOKENS_CORE_URL: 'https://test-core.supertokens.io',
      SUPERTOKENS_API_KEY: 'test-key',
      USE_SUPERTOKENS_AUTH: 'true'
    };
  });

  beforeEach(async () => {
    mockFetch();
    contractor = await createContractor('+919111111111');
    report = await createReport(env.DB, {
      reporterId: contractor.id,
      latitude: 28.6315,
      longitude: 77.2167,
      r2ImageUrl: 'r2://initial.jpg',
      status: 'assigned'
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Happy Path: Fix submitted within 30m drift', async () => {
    const res = await app.fetch(
      new Request(`http://localhost/api/v2/interventions/fix`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${contractor.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          report_id: report.id,
          contractor_id: contractor.id,
          repair_tier: 1,
          fix_latitude: 28.63152, // Very close
          fix_longitude: 77.21671,
          r2_proof_url: 'r2://proof.jpg'
        })
      }),
      testEnv
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.drift_meters).toBeLessThanOrEqual(30.0);
    
    // Verify Report status updated
    const updatedReport = await env.DB.prepare("SELECT status FROM Reports WHERE id = ?").bind(report.id).first();
    expect(updatedReport.status).toBe('fixed_pending_verification');
  });

  it('Spatial Drift Exceeded: Rejects fix outside 30m boundary', async () => {
    const res = await app.fetch(
      new Request(`http://localhost/api/v2/interventions/fix`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${contractor.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          report_id: report.id,
          contractor_id: contractor.id,
          repair_tier: 1,
          fix_latitude: 28.640, // Far away (~1km)
          fix_longitude: 77.216,
          r2_proof_url: 'r2://fraud.jpg'
        })
      }),
      testEnv
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Spatial drift exceeded');
    
    // Verify Report status UNCHANGED
    const finalReport = await env.DB.prepare("SELECT status FROM Reports WHERE id = ?").bind(report.id).first();
    expect(finalReport.status).toBe('assigned');
  });
});

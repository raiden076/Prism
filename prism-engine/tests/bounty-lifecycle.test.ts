import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

describe('Bounty Lifecycle Integration Tests', () => {
  const verifierPhone = '+919222222222';
  const verifierId = 'verifier-id';
  const center = { lat: 28.6315, lon: 77.2167 };

  let mockDBState: {
    reports: any[];
    users: any[];
    bounties: any[];
  };

  beforeEach(() => {
    mockDBState = {
      reports: [{
        id: 'rep-1',
        latitude: center.lat,
        longitude: center.lon,
        status: 'fixed_pending_verification'
      }],
      users: [{
        id: verifierId,
        phone_number: verifierPhone,
        approval_status: 'approved'
      }],
      bounties: []
    };
  });

  const createMockEnv = () => ({
    DB: {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockImplementation((...params: any[]) => ({
          first: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM Users')) return mockDBState.users[0];
            if (query.includes('FROM Reports')) return mockDBState.reports[0];
            if (query.includes('FROM VerificationBounties')) {
               if (query.includes('bounty_status = \'available\'')) return mockDBState.bounties[0];
               return mockDBState.bounties[0];
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes('FROM Reports')) return { results: mockDBState.reports };
            return { results: [] };
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes('INSERT INTO VerificationBounties')) {
                mockDBState.bounties.push({ id: params[0], report_id: params[1], bounty_status: 'available', expires_at: params[4] });
            }
            if (query.includes('UPDATE VerificationBounties')) {
                if (mockDBState.bounties[0]) mockDBState.bounties[0].bounty_status = query.includes('claimed') ? 'claimed' : 'completed';
            }
            return { success: true };
          })
        }))
      })),
    },
    VAULT: { put: vi.fn().mockResolvedValue({}) },
    CONTRACTOR_LOCATIONS: { idFromName: vi.fn().mockReturnValue({}), get: vi.fn().mockReturnValue({ fetch: vi.fn() }) },
    USE_SUPERTOKENS_AUTH: 'false',
    AI_ACTIVATED: 'false',
    CORS_ALLOWED_ORIGINS: '*'
  });

  it('verifies nearby bounties and handles manual review for drift', async () => {
    const env = createMockEnv() as any;

    // 1. Get nearby (Discovery)
    const nearbyRes = await worker.fetch(
        new Request(`http://localhost/api/v1/bounties/nearby?lat=${center.lat}&lon=${center.lon}&radius=1`),
        env
    );
    expect(nearbyRes.status).toBe(200);
    
    // 2. Mock a claimed bounty in state for verification test
    mockDBState.bounties[0] = {
        id: 'b-1',
        report_id: 'rep-1',
        claimed_by: verifierId,
        bounty_status: 'claimed',
        latitude: center.lat,
        longitude: center.lon
    };

    // 3. Verification with drift (Manual Review Path)
    const verifyRes = await worker.fetch(
        new Request('http://localhost/api/v1/verifications', {
            method: 'POST',
            body: JSON.stringify({ 
                bounty_id: 'b-1', 
                verifier_phone: verifierPhone,
                verification_latitude: center.lat + 0.1, // Far away
                verification_longitude: center.lon,
                image_data_url: 'data:img'
            })
        }),
        env
    );
    
    expect(verifyRes.status).toBe(200);
    const data = await verifyRes.json();
    expect(data.status).toContain('manual review');
  });
});

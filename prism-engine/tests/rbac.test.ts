import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';

describe('RBAC Integration Tests', () => {
  const adminPhone = 'admin-phone';
  const contractorPhone = 'contractor-phone';
  const cronyPhone = 'crony-phone';
  
  // Create a proper D1 mock structure
  const createMockDB = (results: any[] = []) => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(results[0] || null),
      all: vi.fn().mockResolvedValue({ results }),
      run: vi.fn().mockResolvedValue({ success: true })
    };
    return {
      prepare: vi.fn().mockReturnValue(mockStmt)
    };
  };

  const createEnv = (results: any[] = []) => ({
    DB: createMockDB(results),
    VAULT: {
      put: vi.fn().mockResolvedValue({})
    },
    CONTRACTOR_LOCATIONS: {
        idFromName: vi.fn().mockReturnValue({}),
        get: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ contractors: [] })))
        })
    },
    USE_SUPERTOKENS_AUTH: 'false',
    AI_ACTIVATED: 'true',
    CORS_ALLOWED_ORIGINS: '*'
  });

  describe('POST /api/v2/interventions/fix', () => {
    it('allows access to the endpoint (checking basic structure)', async () => {
      // Mock for report lookup
      const env = createEnv([{ latitude: 28.5, longitude: 77.2 }]);
      
      const res = await worker.fetch(new Request('http://localhost/api/v2/interventions/fix', {
        method: 'POST',
        headers: { 
            'Authorization': adminPhone, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
            report_id: 'r1', 
            contractor_id: 'c1',
            fix_latitude: 28.5, 
            fix_longitude: 77.2,
            r2_proof_url: 'r2://proof'
        })
      }), env);
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toContain('Fix submitted');
    });

    it('returns 404 if report not found', async () => {
      const env = createEnv([]); // No report found
      const res = await worker.fetch(new Request('http://localhost/api/v2/interventions/fix', {
        method: 'POST',
        headers: { 'Authorization': adminPhone, 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: 'r-none' })
      }), env);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v2/reports', () => {
    it('returns list of reports', async () => {
       const reports = [{ id: 'rep1', status: 'pending' }, { id: 'rep2', status: 'approved' }];
       const env = createEnv(reports);
       const res = await worker.fetch(new Request('http://localhost/api/v2/reports'), env);
       expect(res.status).toBe(200);
       const body = await res.json();
       expect(body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/reports/:id/approve', () => {
    it('approves a report', async () => {
        const env = createEnv([]);
        const res = await worker.fetch(new Request('http://localhost/api/v1/reports/rep1/approve', {
            method: 'POST'
        }), env);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('Report approved');
    });
  });
});

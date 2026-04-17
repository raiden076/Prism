import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

describe('ContractorLocation Durable Object Integration', () => {
  const contractorId = 'c1';
  const mockContractor = {
    id: contractorId,
    phone_number: '+919444444444',
    latitude: 28.63,
    longitude: 77.21,
    status: 'online',
    name: 'Ahmed'
  };

  const storage = new Map();

  const createEnv = () => ({
    CONTRACTOR_LOCATIONS: {
      idFromName: vi.fn().mockReturnValue({ id: 'global-id' }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockImplementation(async (reqOrUrl: any) => {
           const urlStr = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url;
           const url = new URL(urlStr);
           
           // Match logic used in src/index.ts
           if (url.pathname.endsWith('/location')) {
               storage.set('c1', mockContractor);
               return new Response(JSON.stringify({ status: 'Location updated' }));
           }
           if (url.pathname.endsWith('/locations')) {
               return new Response(JSON.stringify({ contractors: [storage.get('c1')] }));
           }
           return new Response('Not Found', { status: 404 });
        })
      })
    },
    USE_SUPERTOKENS_AUTH: 'false',
    AI_ACTIVATED: 'false',
    CORS_ALLOWED_ORIGINS: '*'
  });

  beforeEach(() => {
    storage.clear();
  });

  it('updates and retrieves contractor location via HTTP fallback', async () => {
    const env = createEnv() as any;

    const postRes = await worker.fetch(new Request('http://localhost/api/v1/contractors/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockContractor)
    }), env);
    expect(postRes.status).toBe(200);

    const getRes = await worker.fetch(new Request('http://localhost/api/v1/contractors/locations'), env);
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data.contractors[0].id).toBe(contractorId);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';

describe('CORS Security', () => {
  const testEnv = {
    ...env,
    CORS_ALLOWED_ORIGINS: 'tauri://localhost,http://localhost:1420'
  };

  it('allows listed origin (tauri://localhost)', async () => {
    const res = await app.fetch(
      new Request('http://localhost/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'tauri://localhost',
          'Access-Control-Request-Method': 'GET'
        }
      }),
      testEnv
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('tauri://localhost');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('rejects unlisted origin (http://evil.com) by returning default allowed origin', async () => {
    const res = await app.fetch(
      new Request('http://localhost/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://evil.com',
          'Access-Control-Request-Method': 'GET'
        }
      }),
      testEnv
    );

    // Hono's cors middleware returns origin if allowed, else returns first allowed origin
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('tauri://localhost');
  });
});

import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('CORS Unit Tests', () => {
	const env = {
		CORS_ALLOWED_ORIGINS: 'tauri://localhost,http://localhost:1420,http://localhost:8787',
		USE_SUPERTOKENS_AUTH: 'false',
		AI_ACTIVATED: 'false'
	};

	it('allows requests from whitelisted origin (tauri://localhost)', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/health', {
				headers: { 'Origin': 'tauri://localhost' }
			}),
			env
		);
		expect(res.status).toBe(200);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('tauri://localhost');
		expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
	});

	it('denies requests from unlisted origin (http://malicious.com)', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/health', {
				headers: { 'Origin': 'http://malicious.com' }
			}),
			env
		);
		const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
		expect(allowOrigin).not.toBe('http://malicious.com');
	});

	it('returns correct headers for OPTIONS preflight', async () => {
		const res = await worker.fetch(
			new Request('http://localhost/health', {
				method: 'OPTIONS',
				headers: {
					'Origin': 'tauri://localhost',
					'Access-Control-Request-Method': 'POST',
					'Access-Control-Request-Headers': 'Content-Type, Authorization'
				}
			}),
			env
		);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
		expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
	});
});

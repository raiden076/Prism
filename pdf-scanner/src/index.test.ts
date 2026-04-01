import { describe, it, expect } from 'vitest';
import app from './index';

// Mock environment
const mockEnv = {
	VIRUSTOTAL_API_KEY: 'test-api-key',
	MAX_FILE_SIZE_MB: '10'
};

describe('PDF Virus Scanner', () => {
	describe('Health Check', () => {
		it('should return healthy status', async () => {
			const req = new Request('http://localhost/health');
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(200);
			expect(json.status).toBe('healthy');
			expect(json.service).toBe('pdf-virus-scanner');
		});
	});

	describe('PDF Scanning', () => {
		it('should reject non-multipart requests', async () => {
			const req = new Request('http://localhost/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(400);
			expect(json.scanStatus).toBe('error');
		});

		it('should reject non-PDF files', async () => {
			const formData = new FormData();
			const blob = new Blob(['not a pdf'], { type: 'text/plain' });
			formData.append('file', blob, 'test.txt');
			
			const req = new Request('http://localhost/scan', {
				method: 'POST',
				body: formData
			});
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(400);
			expect(json.scanStatus).toBe('error');
			expect(json.error).toContain('Only PDF files are supported');
		});

		it('should detect invalid PDF structure', async () => {
			const formData = new FormData();
			const blob = new Blob(['fake pdf content'], { type: 'application/pdf' });
			formData.append('file', blob, 'fake.pdf');
			
			const req = new Request('http://localhost/scan', {
				method: 'POST',
				body: formData
			});
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(400);
			expect(json.scanStatus).toBe('error');
			expect(json.error).toContain('Invalid PDF file structure');
		});

		it('should scan valid PDF and return results', async () => {
			// Create a minimal valid PDF
			const pdfContent = new Uint8Array([
				0x25, 0x50, 0x44, 0x46, // %PDF
				0x2D, 0x31, 0x2E, 0x34, // -1.4
				0x0A, 0x31, 0x20, 0x30, 0x20, 0x6F, 0x62, 0x6A, // Minimal content
				0x0A, 0x3C, 0x3C, 0x0A, 0x3E, 0x3E, // << >>
				0x0A, 0x65, 0x6E, 0x64, 0x6F, 0x62, 0x6A, // endobj
				0x0A, 0x25, 0x25, 0x45, 0x4F, 0x46 // %%EOF
			]);
			
			const formData = new FormData();
			const blob = new Blob([pdfContent], { type: 'application/pdf' });
			formData.append('file', blob, 'test.pdf');
			
			const req = new Request('http://localhost/scan', {
				method: 'POST',
				body: formData
			});
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(200);
			expect(json.fileName).toBe('test.pdf');
			expect(json.scanStatus).toBeDefined();
			expect(json.scanId).toBeDefined();
			expect(Array.isArray(json.detections)).toBe(true);
		});

		it('should detect suspicious JavaScript in PDF', async () => {
			// PDF with JavaScript
			const pdfWithJS = new Uint8Array([
				0x25, 0x50, 0x44, 0x46, // %PDF
				...new TextEncoder().encode('-1.4\n/JavaScript\n<<\n/JS (alert("test"))\n>>\nendobj\n%%EOF')
			]);
			
			const formData = new FormData();
			const blob = new Blob([pdfWithJS], { type: 'application/pdf' });
			formData.append('file', blob, 'malicious.pdf');
			
			const req = new Request('http://localhost/scan', {
				method: 'POST',
				body: formData
			});
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(res.status).toBe(200);
			const jsDetection = json.detections.find(
				(d: { message: string }) => d.message.includes('JavaScript')
			);
			expect(jsDetection).toBeDefined();
		});
	});

	describe('Scan Result Retrieval', () => {
		it('should return info about scan retrieval', async () => {
			const req = new Request('http://localhost/scan/test-scan-id');
			const res = await app.fetch(req, mockEnv);
			const json = await res.json();
			
			expect(json.scanId).toBe('test-scan-id');
			expect(json.message).toContain('not implemented');
		});
	});
});

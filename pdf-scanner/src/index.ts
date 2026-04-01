import { Hono } from 'hono';

interface ScanResult {
	fileName: string;
	fileSize: number;
	mimeType: string;
	scanStatus: 'clean' | 'suspicious' | 'infected' | 'error';
	detections: Detection[];
	scanTime: string;
	scanId: string;
}

interface Detection {
	type: 'signature' | 'heuristic' | 'external';
	severity: 'low' | 'medium' | 'high' | 'critical';
	message: string;
	details?: string;
}

interface Env {
	VIRUSTOTAL_API_KEY: string;
	MAX_FILE_SIZE_MB: string;
}

const app = new Hono<{ Bindings: Env }>();

// PDF Magic bytes and signatures
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

// Suspicious patterns commonly found in malicious PDFs
const SUSPICIOUS_PATTERNS = [
	{ pattern: /\/JavaScript/i, severity: 'medium' as const, message: 'JavaScript detected in PDF' },
	{ pattern: /\/JS/i, severity: 'medium' as const, message: 'JavaScript code block detected' },
	{ pattern: /\/OpenAction/i, severity: 'medium' as const, message: 'Automatic action on open detected' },
	{ pattern: /\/Launch/i, severity: 'high' as const, message: 'Launch action detected (can execute external programs)' },
	{ pattern: /\/URI/i, severity: 'low' as const, message: 'External URI reference detected' },
	{ pattern: /\/SubmitForm/i, severity: 'medium' as const, message: 'Form submission action detected' },
	{ pattern: /\/ImportData/i, severity: 'high' as const, message: 'Data import action detected' },
	{ pattern: /\/GoToE/i, severity: 'medium' as const, message: 'Embedded file navigation detected' },
	{ pattern: /\/RichMedia/i, severity: 'medium' as const, message: 'Rich media content detected' },
	{ pattern: /\/Flash/i, severity: 'high' as const, message: 'Flash content detected' },
	{ pattern: /getURL|postURL/i, severity: 'medium' as const, message: 'URL fetching capability detected' },
	{ pattern: /app\.launchURL/i, severity: 'high' as const, message: 'URL launch capability detected' },
	{ pattern: /this\.exportXFAData/i, severity: 'high' as const, message: 'XFA data export detected' },
];

// Obfuscation patterns
const OBFUSCATION_PATTERNS = [
	{ pattern: /\\\d{1,3}/g, threshold: 20, message: 'Numeric character obfuscation detected' },
	{ pattern: /#([0-9A-Fa-f]{2})/g, threshold: 20, message: 'Hex encoding detected' },
	{ pattern: /eval\s*\(/i, message: 'Eval function detected' },
	{ pattern: /unescape\s*\(/i, message: 'Unescape function detected' },
	{ pattern: /String\.fromCharCode/i, message: 'String.fromCharCode obfuscation detected' },
];

function generateScanId(): string {
	return crypto.randomUUID();
}

function isValidPDF(buffer: ArrayBuffer): boolean {
	const bytes = new Uint8Array(buffer);
	if (bytes.length < 4) return false;
	
	for (let i = 0; i < 4; i++) {
		if (bytes[i] !== PDF_MAGIC[i]) return false;
	}
	return true;
}

function scanPDFContent(content: string): Detection[] {
	const detections: Detection[] = [];
	
	// Check for suspicious PDF patterns
	for (const { pattern, severity, message } of SUSPICIOUS_PATTERNS) {
		if (pattern.test(content)) {
			detections.push({
				type: 'signature',
				severity,
				message,
				details: `Pattern match: ${pattern.source}`
			});
		}
	}
	
	// Check for obfuscation
	for (const { pattern, threshold, message } of OBFUSCATION_PATTERNS) {
		const matches = content.match(pattern);
		if (matches) {
			if (!threshold || matches.length >= threshold) {
				detections.push({
					type: 'heuristic',
					severity: 'medium',
					message,
					details: `Found ${matches.length} occurrences`
				});
			}
		}
	}
	
	// Check for embedded files
	if (/\/EmbeddedFile|\/Filespec/i.test(content)) {
		detections.push({
			type: 'signature',
			severity: 'high',
			message: 'Embedded file detected in PDF',
			details: 'PDF contains one or more embedded files'
		});
	}
	
	// Check for XFA forms (often exploited)
	if (/\/XFA|xfa:|http:\/\/www\.xfa\.org/i.test(content)) {
		detections.push({
			type: 'signature',
			severity: 'high',
			message: 'XFA form detected',
			details: 'XFA (XML Forms Architecture) forms can contain malicious code'
		});
	}
	
	return detections;
}

async function scanWithVirusTotal(
	fileBuffer: ArrayBuffer,
	fileName: string,
	apiKey: string
): Promise<Detection[]> {
	const detections: Detection[] = [];
	
	try {
		// Step 1: Upload file for scanning
		const formData = new FormData();
		formData.append('file', new Blob([fileBuffer]), fileName);
		
		const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
			method: 'POST',
			headers: {
				'x-apikey': apiKey
			},
			body: formData
		});
		
		if (!uploadResponse.ok) {
			detections.push({
				type: 'external',
				severity: 'low',
				message: 'VirusTotal scan unavailable',
				details: `Upload failed: ${uploadResponse.status}`
			});
			return detections;
		}
		
		const uploadData = await uploadResponse.json();
		const analysisId = uploadData.data?.id;
		
		if (!analysisId) {
			detections.push({
				type: 'external',
				severity: 'low',
				message: 'VirusTotal analysis ID not received',
				details: 'Unable to retrieve scan results'
			});
			return detections;
		}
		
		// Step 2: Wait and retrieve analysis results
		let retries = 5;
		let analysisData;
		
		while (retries > 0) {
			await new Promise(resolve => setTimeout(resolve, 3000));
			
			const analysisResponse = await fetch(
				`https://www.virustotal.com/api/v3/analyses/${analysisId}`,
				{
					headers: {
						'x-apikey': apiKey
					}
				}
			);
			
			if (analysisResponse.ok) {
				analysisData = await analysisResponse.json();
				if (analysisData.data?.attributes?.status === 'completed') {
					break;
				}
			}
			
			retries--;
		}
		
		if (analysisData?.data?.attributes?.stats) {
			const stats = analysisData.data.attributes.stats;
			const malicious = stats.malicious || 0;
			const suspicious = stats.suspicious || 0;
			const total = Object.values(stats).reduce((a: number, b: number) => a + b, 0);
			
			if (malicious > 0) {
				detections.push({
					type: 'external',
					severity: malicious > 5 ? 'critical' : 'high',
					message: `VirusTotal: ${malicious}/${total} engines detected malware`,
					details: `Detected by ${malicious} antivirus engines`
				});
			} else if (suspicious > 0) {
				detections.push({
					type: 'external',
					severity: 'medium',
					message: `VirusTotal: ${suspicious}/${total} engines flagged as suspicious`,
					details: `Flagged by ${suspicious} engines`
				});
			} else {
				detections.push({
					type: 'external',
					severity: 'low',
					message: `VirusTotal: Clean (${total} engines checked)`,
					details: 'No malware detected by VirusTotal'
				});
			}
		}
	} catch (error) {
		detections.push({
			type: 'external',
			severity: 'low',
			message: 'VirusTotal scan failed',
			details: error instanceof Error ? error.message : 'Unknown error'
		});
	}
	
	return detections;
}

function determineScanStatus(detections: Detection[]): ScanResult['scanStatus'] {
	if (detections.length === 0) return 'clean';
	
	const criticalCount = detections.filter(d => d.severity === 'critical').length;
	const highCount = detections.filter(d => d.severity === 'high').length;
	const hasExternalInfection = detections.some(
		d => d.type === 'external' && d.severity === 'critical'
	);
	
	if (criticalCount > 0 || hasExternalInfection) return 'infected';
	if (highCount > 0) return 'suspicious';
	return 'clean';
}

app.get('/health', (c) => {
	return c.json({
		status: 'healthy',
		service: 'pdf-virus-scanner',
		timestamp: new Date().toISOString()
	});
});

app.post('/scan', async (c) => {
	const scanId = generateScanId();
	const startTime = Date.now();
	
	try {
		const contentType = c.req.header('content-type') || '';
		
		if (!contentType.includes('multipart/form-data')) {
			return c.json({
				scanId,
				scanStatus: 'error',
				error: 'Invalid content type. Use multipart/form-data'
			}, 400);
		}
		
		const formData = await c.req.formData();
		const file = formData.get('file');
		
		if (!file || !(file instanceof File)) {
			return c.json({
				scanId,
				scanStatus: 'error',
				error: 'No file provided or invalid file'
			}, 400);
		}
		
		// Validate file type
		if (!file.name.toLowerCase().endsWith('.pdf')) {
			return c.json({
				scanId,
				scanStatus: 'error',
				error: 'Only PDF files are supported'
			}, 400);
		}
		
		// Check file size
		const maxSizeMB = parseInt(c.env.MAX_FILE_SIZE_MB || '10');
		const maxSizeBytes = maxSizeMB * 1024 * 1024;
		
		if (file.size > maxSizeBytes) {
			return c.json({
				scanId,
				scanStatus: 'error',
				error: `File too large. Maximum size is ${maxSizeMB}MB`
			}, 413);
		}
		
		// Read file content
		const fileBuffer = await file.arrayBuffer();
		
		// Validate PDF structure
		if (!isValidPDF(fileBuffer)) {
			return c.json({
				scanId,
				scanStatus: 'error',
				error: 'Invalid PDF file structure'
			}, 400);
		}
		
		// Convert buffer to string for content analysis
		const decoder = new TextDecoder('utf-8', { fatal: false });
		const content = decoder.decode(fileBuffer);
		
		// Perform local scanning
		const localDetections = scanPDFContent(content);
		
		// Perform external VirusTotal scan if API key is available
		let allDetections = [...localDetections];
		if (c.env.VIRUSTOTAL_API_KEY) {
			const externalDetections = await scanWithVirusTotal(
				fileBuffer,
				file.name,
				c.env.VIRUSTOTAL_API_KEY
			);
			allDetections = [...allDetections, ...externalDetections];
		}
		
		const scanResult: ScanResult = {
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.type || 'application/pdf',
			scanStatus: determineScanStatus(allDetections),
			detections: allDetections,
			scanTime: new Date().toISOString(),
			scanId
		};
		
		console.log(`[SCAN COMPLETE] ${scanId} - Status: ${scanResult.scanStatus} - Time: ${Date.now() - startTime}ms`);
		
		return c.json(scanResult);
		
	} catch (error) {
		console.error(`[SCAN ERROR] ${scanId}:`, error);
		
		return c.json({
			scanId,
			scanStatus: 'error',
			error: error instanceof Error ? error.message : 'Unknown error during scan',
			scanTime: new Date().toISOString()
		}, 500);
	}
});

app.get('/scan/:scanId', async (c) => {
	const scanId = c.req.param('scanId');
	
	return c.json({
		scanId,
		message: 'Scan result retrieval not implemented',
		note: 'Scan results are returned immediately after scanning. Store results if you need to retrieve them later.'
	});
});

// Export the Hono app as the default handler
export default app;

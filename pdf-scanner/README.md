# PDF Virus Scanner Worker

A Cloudflare Worker that scans PDF files for viruses and malicious content using both local heuristics and external VirusTotal API.

## Features

- **PDF Validation**: Verifies file structure and magic bytes
- **Local Heuristic Scanning**: Detects suspicious patterns without external APIs
- **VirusTotal Integration**: Optional external scanning for comprehensive results
- **Size Limits**: Configurable maximum file size (default 10MB)
- **Multiple Detection Types**:
  - JavaScript detection
  - Embedded file detection
  - XFA form detection
  - Obfuscation patterns
  - Launch actions
  - External URI references

## Setup

### 1. Install Dependencies

```bash
cd pdf-scanner
bun install
```

### 2. Configure VirusTotal API (Optional)

To enable external virus scanning, set up a VirusTotal API key:

```bash
# Get your API key from https://www.virustotal.com
cd pdf-scanner
wrangler secret put VIRUSTOTAL_API_KEY
# Enter your API key when prompted
```

### 3. Deploy

```bash
# Deploy to Cloudflare
bun run deploy

# Or run locally for testing
bun run dev
```

## API Usage

### Health Check

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

### Scan a PDF

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/scan \
  -F "file=@/path/to/your/file.pdf"
```

### Response Format

```json
{
  "fileName": "document.pdf",
  "fileSize": 12345,
  "mimeType": "application/pdf",
  "scanStatus": "suspicious",
  "detections": [
    {
      "type": "signature",
      "severity": "medium",
      "message": "JavaScript detected in PDF",
      "details": "Pattern match: /\\/JavaScript/i"
    },
    {
      "type": "external",
      "severity": "low",
      "message": "VirusTotal: Clean (72 engines checked)",
      "details": "No malware detected by VirusTotal"
    }
  ],
  "scanTime": "2025-03-20T10:30:00.000Z",
  "scanId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Scan Status Values

- `clean`: No threats detected
- `suspicious`: Some suspicious patterns found (review recommended)
- `infected`: Malware or critical threats detected
- `error`: Scan failed due to technical issues

### Severity Levels

- `low`: Informational, low risk
- `medium`: Potentially suspicious, review recommended
- `high`: Likely malicious, caution advised
- `critical`: Confirmed malware, reject file

## Configuration

Update `wrangler.jsonc` to change settings:

```json
{
  "vars": {
    "MAX_FILE_SIZE_MB": "10"
  }
}
```

## Testing

```bash
# Run tests
bun run test

# Test with a sample PDF
curl -X POST http://localhost:8787/scan \
  -F "file=@test.pdf"
```

## Architecture

The worker performs multiple layers of scanning:

1. **File Validation**: Checks PDF magic bytes and structure
2. **Pattern Matching**: Scans for known malicious signatures
3. **Heuristic Analysis**: Detects obfuscation and suspicious patterns
4. **External Verification**: Uses VirusTotal for comprehensive malware detection

## Security Considerations

- Files are scanned in memory only (not persisted)
- VirusTotal API key should be kept secret (use `wrangler secret`)
- Size limits prevent DoS attacks
- CORS headers should be configured if accessing from browsers

## Development

```bash
# Local development
bun run dev

# Type checking
npx tsc --noEmit

# Deploy
bun run deploy
```

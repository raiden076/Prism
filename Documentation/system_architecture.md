# PRISM System Architecture

## Executive Summary

PRISM is a decentralized civic infrastructure reporting platform designed for rapid pothole detection and civic infrastructure issue management. The system uses a hybrid architecture combining edge computing (Cloudflare Workers), modern frontend technologies (Tauri + Svelte 5), and tactical Neo-Brutalism design principles to create a high-performance, accountability-focused civic engagement tool.

**Key Innovation**: The platform implements a dual-phase architecture (Cold Start → AI Activation) that balances immediate deployment capability with future AI enhancement potential while maintaining complete audit trails through blockchain-inspired verification loops.

---

## 1. System Overview

### 1.1 Architecture Philosophy

PRISM follows a **distributed edge-first architecture** with the following core principles:

- **Zero-Trust Security**: OTPless phone authentication with role-based access
- **Edge Computing**: All API logic runs on Cloudflare's global edge network
- **Hardware Integration**: Native mobile capabilities (camera, GPS, haptics) via Tauri
- **Accountability**: Immutable audit trails with spatial verification
- **Offline-First**: Local data persistence with sync capabilities

### 1.2 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Mobile App    │    │   Desktop App   │                    │
│  │  (Android/iOS)  │    │  (Tauri-based)  │                    │
│  │                 │    │                 │                    │
│  │ ┌───────────┐   │    │ ┌───────────┐   │                    │
│  │ │ Camera    │   │    │ │ Camera    │   │                    │
│  │ │ GPS       │   │    │ │ GPS       │   │                    │
│  │ │ Haptics   │   │    │ │ Haptics   │   │                    │
│  │ └───────────┘   │    │ └───────────┘   │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                          │
│              ┌───────▼───────┐                                  │
│              │  Svelte 5 UI  │                                  │
│              │  (Neo-Brutal) │                                  │
│              └───────┬───────┘                                  │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       │ HTTPS/WebSocket
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE COMPUTING LAYER                         │
│  ┌─────────────────────────────────────────────────────┐        │
│  │           Cloudflare Workers (Global Edge)          │        │
│  │                                                     │        │
│  │  ┌─────────────────────────────────────────────┐   │        │
│  │  │              Hono.js API Router              │   │        │
│  │  │                                             │   │        │
│  │  │  ┌─────────────┐      ┌─────────────────┐   │   │        │
│  │  │  │ Phase 1     │      │ Phase 2         │   │   │        │
│  │  │  │ Cold Start  │ ───▶ │ AI Activation   │   │   │        │
│  │  │  │ Routes      │      │ Routes          │   │   │        │
│  │  │  └─────────────┘      └─────────────────┘   │   │        │
│  │  │                                             │   │        │
│  │  │  ┌─────────────────────────────────────────┐│   │        │
│  │  │  │         YOLO Inference Service          ││   │        │
│  │  │  │     (Pothole Detection Pipeline)        ││   │        │
│  │  │  └─────────────────────────────────────────┘│   │        │
│  │  └─────────────────────────────────────────────┘   │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                       │
                       │ Internal Binding
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA STORAGE LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   D1 SQLite  │  │     R2       │  │   KV (Session)       │  │
│  │  (Metadata)  │  │  (Media)     │  │   (Rate Limiting)    │  │
│  │              │  │              │  │                      │  │
│  │ • Reports    │  │ • Images     │  │ • JWT Tokens         │  │
│  │ • Users      │  │ • Videos     │  │ • OTP Codes          │  │
│  │ • Verifications│ • Metadata   │  │ • Rate Counters      │  │
│  │ • Interventions│              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture (Tauri + Svelte 5)

### 2.1 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Svelte 5 | Reactive UI with runes pattern |
| **Native Wrapper** | Tauri v2 | Cross-platform native app |
| **Styling** | Tailwind CSS | Utility-first styling |
| **State Management** | Svelte 5 Runes | `$state`, `$derived`, `$effect` |
| **Build Tool** | Vite | Fast development and building |
| **Package Manager** | Bun | Fast package management |

### 2.2 Directory Structure

```
prism/
├── src/
│   ├── routes/                    # SvelteKit file-based routing
│   │   ├── +page.svelte          # Field Interface (Report Pothole)
│   │   ├── board/
│   │   │   └── +page.svelte      # Executive War Room Dashboard
│   │   ├── auth/
│   │   │   └── +page.svelte      # OTPless Authentication
│   │   └── verify/
│   │       └── +page.svelte      # Verification Interface
│   │
│   ├── lib/                       # Shared utilities and components
│   │   ├── components/           # Svelte components
│   │   │   ├── ui/              # Neo-Brutalism UI primitives
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Card.svelte
│   │   │   │   └── Input.svelte
│   │   │   ├── map/             # Map visualization
│   │   │   │   └── LiveMap.svelte
│   │   │   └── camera/          # Camera integration
│   │   │       └── CameraCapture.svelte
│   │   │
│   │   ├── stores/              # Svelte stores
│   │   │   ├── auth.svelte.ts   # Authentication state
│   │   │   ├── reports.svelte.ts # Reports data
│   │   │   └── location.svelte.ts # GPS tracking
│   │   │
│   │   ├── utils/               # Utility functions
│   │   │   ├── geolocation.ts   # GPS helpers
│   │   │   ├── haptics.ts       # Haptic feedback
│   │   │   └── digipin.ts       # DIGIPIN encoding
│   │   │
│   │   └── api/                 # API client
│   │       └── client.ts        # Hono.js RPC client
│   │
│   ├── app.html                 # HTML template
│   ├── app.css                  # Global styles + Tailwind
│   └── +layout.svelte           # Root layout with providers
│
├── src-tauri/                   # Tauri native layer
│   ├── src/
│   │   ├── main.rs             # Rust entry point
│   │   └── lib.rs              # Native API bindings
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri configuration
│
├── static/                      # Static assets
├── tailwind.config.ts          # Tailwind + Neo-Brutalism theme
├── svelte.config.js            # Svelte configuration
├── vite.config.ts              # Vite configuration
└── package.json                # Dependencies
```

### 2.3 Neo-Brutalism Design System

#### Color Palette

```typescript
// tailwind.config.ts
colors: {
  'prism-black': '#0a0a0a',
  'prism-white': '#fafafa',
  'prism-surface': '#e5e5e5',
  'prism-success': '#00ff00',  // Tactical green
  'prism-crisis': '#ff0000',   // Crisis red
  'prism-warning': '#ffaa00',
  'prism-info': '#0088ff',
}
```

#### Component Physics

```typescript
// Neo-Brutalism Button Pattern
// Solid shadows create physical depression effect
const buttonClasses = `
  bg-prism-white
  border-2 border-prism-black
  shadow-solid-md           // Solid shadow for elevation
  transition-all duration-75
  hover:shadow-solid-lg     // Larger shadow on hover
  active:shadow-none        // Shadow disappears on press
  active:translate-y-1      // Button physically depresses
`;
```

#### Hardware Integration

```typescript
// Haptic feedback on all significant interactions
function triggerHaptic(pattern: 'light' | 'medium' | 'heavy' = 'medium') {
  if (navigator.vibrate) {
    const patterns = {
      light: 20,
      medium: 50,
      heavy: 100
    };
    navigator.vibrate(patterns[pattern]);
  }
}

// Usage in components
<button 
  onclick={() => {
    triggerHaptic('medium');
    submitReport();
  }}
>
  Submit Report
</button>
```

### 2.4 State Management Pattern

```typescript
// lib/stores/reports.svelte.ts
// Svelte 5 Runes for reactive state

interface Report {
  id: string;
  coordinates: { lat: number; lng: number };
  digipin: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mediaUrls: string[];
  timestamp: Date;
  status: 'pending' | 'verified' | 'intervened';
}

// Reactive state using $state rune
let reports = $state<Report[]>([]);
let selectedReport = $state<Report | null>(null);
let isLoading = $state(false);

// Derived state using $derived rune
const criticalReports = $derived(
  reports.filter(r => r.severity === 'critical')
);

const reportsByStatus = $derived(
  reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)
);

// Actions
export async function submitReport(data: Omit<Report, 'id'>) {
  isLoading = true;
  try {
    const response = await api.reports.create.$post({
      json: data
    });
    const newReport = await response.json();
    reports = [...reports, newReport];
    triggerHaptic('heavy');
  } finally {
    isLoading = false;
  }
}
```

---

## 3. Backend Architecture (Cloudflare Workers + Hono.js)

### 3.1 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Cloudflare Workers | Edge computing platform |
| **Framework** | Hono.js | Lightweight, fast web framework |
| **Language** | TypeScript | Type-safe development |
| **Database** | D1 (SQLite) | Relational data storage |
| **Object Storage** | R2 | Media blob storage |
| **Caching** | KV | Session and rate limiting |
| **AI/ML** | Workers AI | YOLO inference pipeline |
| **Deployment** | Wrangler | Cloudflare deployment CLI |

### 3.2 Directory Structure

```
prism-engine/
├── src/
│   ├── index.ts                 # Main entry point
│   │
│   ├── routes/                  # API route handlers
│   │   ├── auth.ts             # OTPless authentication
│   │   ├── reports.ts          # Report CRUD operations
│   │   ├── interventions.ts    # Contractor assignment
│   │   ├── verifications.ts    # Crony verification loop
│   │   ├── admin.ts            # Admin operations
│   │   └── ai.ts               # AI inference routes
│   │
│   ├── services/               # Business logic
│   │   ├── geolocation.ts      # GPS/DIGIPIN utilities
│   │   ├── image-processing.ts # Canvas metadata stamping
│   │   ├── notification.ts     # Push notifications
│   │   └── yolo-inference.ts   # AI pothole detection
│   │
│   ├── middleware/             # Hono middleware
│   │   ├── auth.ts             # JWT verification
│   │   ├── rate-limit.ts       # Rate limiting
│   │   ├── cors.ts             # CORS handling
│   │   └── validation.ts       # Input validation
│   │
│   ├── types/                  # TypeScript types
│   │   ├── database.ts         # D1 schema types
│   │   ├── api.ts              # API contract types
│   │   └── models.ts           # Domain models
│   │
│   └── utils/                  # Utilities
│       ├── errors.ts           # Error handling
│       ├── logger.ts           # Structured logging
│       └── digipin.ts          # DIGIPIN encoding/decoding
│
├── migrations/                 # Database migrations
│   ├── 0001_init_schema.sql
│   ├── 0002_add_indexes.sql
│   └── 0003_add_interventions.sql
│
├── schemas/                    # Validation schemas
│   └── validation.ts
│
├── tests/                      # Test suites
│   ├── unit/
│   └── integration/
│
├── wrangler.jsonc              # Cloudflare configuration
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

### 3.3 API Architecture (Phase 1 & Phase 2)

#### Phase 1: Cold Start (Current Implementation)

```typescript
// Phase 1 routes - whitelist-only ingestion
const phase1Routes = new Hono<{ Bindings: Env }>();

// Reports can only be submitted by whitelisted sources
phase1Routes.post('/reports', 
  whitelistMiddleware,           // Verify phone in whitelist
  validateReportData,            // Validate input
  async (c) => {
    const report = await c.req.json();
    
    // Auto-approve all reports in Phase 1
    const db = c.env.DB;
    await db.prepare(`
      INSERT INTO reports (id, digipin, coordinates, severity, status, submitted_by)
      VALUES (?, ?, ?, ?, 'approved', ?)
    `).bind(
      crypto.randomUUID(),
      report.digipin,
      JSON.stringify(report.coordinates),
      report.severity,
      c.get('userId')
    ).run();
    
    return c.json({ success: true }, 201);
  }
);

// No AI inference - all reports accepted as-is
// Focus: Build user base, validate UX, establish workflows
```

#### Phase 2: AI Activation (Future Implementation)

```typescript
// Phase 2 routes - AI-powered verification
const phase2Routes = new Hono<{ Bindings: Env }>();

// AI inference before report acceptance
phase2Routes.post('/reports',
  authMiddleware,
  validateReportData,
  async (c) => {
    const { imageUrl, coordinates } = await c.req.json();
    
    // Run YOLO inference on image
    const inference = await c.env.AI.run(
      '@cf/yolo/pothole-detection',
      { image: imageUrl }
    );
    
    // Confidence threshold: 0.75
    if (inference.confidence < 0.75) {
      return c.json({
        error: 'No pothole detected in image',
        confidence: inference.confidence
      }, 422);
    }
    
    // AI-approved report enters verification queue
    const db = c.env.DB;
    await db.prepare(`
      INSERT INTO reports (id, digipin, coordinates, ai_confidence, status)
      VALUES (?, ?, ?, ?, 'pending_verification')
    `).bind(
      crypto.randomUUID(),
      coordinates,
      inference.confidence
    ).run();
    
    return c.json({ 
      success: true, 
      aiConfidence: inference.confidence 
    }, 201);
  }
);
```

### 3.4 Database Schema (D1)

```sql
-- migrations/0001_init_schema.sql

-- Users table with role-based access
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('crony', 'contractor', 'admin')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Whitelist for Phase 1 controlled access
CREATE TABLE whitelisted_sources (
    id TEXT PRIMARY KEY,
    phone_number TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('crony', 'contractor', 'admin')) NOT NULL,
    added_by TEXT REFERENCES users(id),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports with geolocation tagging
CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    digipin TEXT NOT NULL,                    -- DIGIPIN format location
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    media_urls TEXT,                          -- JSON array of R2 URLs
    ai_confidence REAL,                       -- YOLO confidence score
    status TEXT CHECK (status IN ('pending', 'approved', 'verified', 'intervened', 'rejected')) DEFAULT 'pending',
    submitted_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Interventions for contractor accountability
CREATE TABLE interventions (
    id TEXT PRIMARY KEY,
    report_id TEXT REFERENCES reports(id),
    contractor_id TEXT REFERENCES users(id),
    contractor_location TEXT,                 -- GPS at intervention time
    spatial_drift_meters REAL,                -- Haversine distance
    status TEXT CHECK (status IN ('assigned', 'in_progress', 'completed')),
    notes TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Verification loop for crony ground truth
CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    report_id TEXT REFERENCES reports(id),
    crony_id TEXT REFERENCES users(id),
    verification_status TEXT CHECK (verification_status IN ('matches', 'discrepancy', 'resolved')),
    location_at_verification TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spatial index for location-based queries
CREATE INDEX idx_reports_location ON reports(latitude, longitude);
CREATE INDEX idx_reports_digipin ON reports(digipin);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_interventions_contractor ON interventions(contractor_id);
```

### 3.5 Spatial Drift Calculation

```typescript
// services/geolocation.ts

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculate Haversine distance between two coordinates
 * Used for contractor accountability (≤30m threshold)
 */
export function calculateSpatialDrift(
  reportLocation: Coordinates,
  contractorLocation: Coordinates
): number {
  const R = 6371000; // Earth's radius in meters
  
  const φ1 = reportLocation.lat * Math.PI / 180;
  const φ2 = contractorLocation.lat * Math.PI / 180;
  const Δφ = (contractorLocation.lat - reportLocation.lat) * Math.PI / 180;
  const Δλ = (contractorLocation.lng - reportLocation.lng) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in meters
}

// Accountability check
export function isWithinThreshold(
  drift: number, 
  threshold: number = 30
): boolean {
  return drift <= threshold;
}
```

---

## 4. Data Flow Architecture

### 4.1 Report Submission Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     REPORT SUBMISSION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

User (Crony)
    │
    │ 1. Capture Image + GPS
    │    • Camera API (Tauri)
    │    • High-accuracy geolocation
    │    • DIGIPIN encoding
    ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND PROCESSING                                          │
│ • Metadata stamping (timestamp, GPS, DIGIPIN on canvas)     │
│ • Image compression                                           │
│ • Local cache (offline capability)                           │
└─────────────────────────────────────────────────────────────┘
    │
    │ 2. Upload to R2 + Submit Metadata
    ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND API (Cloudflare Workers)                             │
│                                                              │
│ Phase 1 (Cold Start):                                        │
│ • Whitelist verification                                     │
│ • Auto-approve                                               │
│ • Store in D1                                                │
│                                                              │
│ Phase 2 (AI Activation):                                     │
│ • AI inference (YOLO)                                        │
│ • Confidence check (≥0.75)                                   │
│ • If pass → verification queue                               │
│ • If fail → reject with feedback                             │
└─────────────────────────────────────────────────────────────┘
    │
    │ 3. Store Data
    ▼
┌─────────────────────────────────────────────────────────────┐
│ STORAGE                                                      │
│ • D1: Report metadata (digipin, coordinates, status)        │
│ • R2: Image/video blobs                                      │
│ • KV: Rate limiting counters                                 │
└─────────────────────────────────────────────────────────────┘
    │
    │ 4. Real-time Update
    ▼
┌─────────────────────────────────────────────────────────────┐
│ WAR ROOM DASHBOARD                                           │
│ • Live map update                                            │
│ • Severity heatmap refresh                                   │
│ • Push notification to contractors                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Accountability Loop Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNTABILITY LOOP FLOW                      │
└─────────────────────────────────────────────────────────────────┘

New Report Created (Status: pending/approved)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTRACTOR ASSIGNMENT                                        │
│ Admin assigns contractor to report                          │
│ Status → 'intervened'                                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CONTRACTOR MOBILIZATION                                      │
│ • Contractor receives notification                          │
│ • GPS tracking begins                                        │
│ • Route to location calculated                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ ARRIVAL VERIFICATION                                         │
│ • Contractor marks 'arrived'                                 │
│ • GPS coordinates captured                                   │
│ • Haversine drift calculated                                 │
│ • If drift ≤ 30m → proceed                                   │
│ • If drift > 30m → flag for review                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ WORK COMPLETION                                              │
│ • Before/after photos                                        │
│ • Contractor marks 'completed'                               │
│ • Timestamp logged                                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ CRONY VERIFICATION LOOP                                      │
│ • Random crony dispatched to verify                         │
│ • Compares contractor photos with reality                   │
│ • Status: 'matches', 'discrepancy', or 'resolved'          │
│ • If discrepancy → escalation to admin                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ FINAL STATUS                                                 │
│ Report marked as 'resolved'                                  │
│ Full audit trail available                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Architecture

### 5.1 Authentication Flow (OTPless)

```
┌─────────────────────────────────────────────────────────────────┐
│                    OTPLESS AUTHENTICATION                        │
└─────────────────────────────────────────────────────────────────┘

User
    │
    │ 1. Enter Phone Number
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
│ POST /auth/otp/send                                          │
│ { phone: "+1234567890" }                                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                      │
│ • Generate 6-digit OTP                                       │
│ • Store in KV (TTL: 5 minutes)                              │
│ • Send SMS via Twilio/Msg91                                  │
└─────────────────────────────────────────────────────────────┘
    │
    │ 2. SMS Delivered
    ▼
User
    │
    │ 3. Enter OTP
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
│ POST /auth/otp/verify                                        │
│ { phone: "+1234567890", otp: "123456" }                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                      │
│ • Verify OTP from KV                                        │
│ • If valid:                                                  │
│   - Create user if new                                      │
│   - Generate JWT (TTL: 7 days)                              │
│   - Return token + user role                                 │
│ • If invalid:                                                │
│   - Increment attempt counter                               │
│   - Lockout after 3 attempts                                │
└─────────────────────────────────────────────────────────────┘
    │
    │ 4. JWT Token
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                     │
│ • Store token in secure storage (Tauri)                     │
│ • Include token in all API requests                         │
│ • Auto-refresh before expiry                                │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Role-Based Access Control (RBAC)

```typescript
// middleware/auth.ts

enum Role {
  CRONY = 'crony',
  CONTRACTOR = 'contractor',
  ADMIN = 'admin'
}

// Permission matrix
const permissions = {
  [Role.CRONY]: [
    'reports:submit',
    'reports:view_own',
    'verifications:complete'
  ],
  [Role.CONTRACTOR]: [
    'reports:view_assigned',
    'interventions:update',
    'interventions:complete'
  ],
  [Role.ADMIN]: [
    'reports:view_all',
    'reports:assign',
    'users:manage',
    'whitelist:manage',
    'interventions:override',
    'verifications:view_all'
  ]
};

export function requireRole(...allowedRoles: Role[]) {
  return async (c: Context, next: Next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    
    if (!allowedRoles.includes(payload.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    
    c.set('user', payload);
    await next();
  };
}

// Route protection examples
app.post('/reports', requireRole(Role.CRONY), submitReport);
app.patch('/interventions/:id', requireRole(Role.CONTRACTOR), updateIntervention);
app.get('/admin/dashboard', requireRole(Role.ADMIN), getAdminDashboard);
```

### 5.3 Rate Limiting

```typescript
// middleware/rate-limit.ts

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const key = `rate_limit:${ip}`;
    
    const kv = c.env.KV;
    const current = await kv.get(key);
    const count = current ? parseInt(current) : 0;
    
    if (count >= config.maxRequests) {
      return c.json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(config.windowMs / 1000)
      }, 429);
    }
    
    await kv.put(key, (count + 1).toString(), {
      expirationTtl: Math.ceil(config.windowMs / 1000)
    });
    
    await next();
  };
}

// Different limits for different endpoints
app.post('/auth/otp/send', rateLimit({ windowMs: 60000, maxRequests: 3 }));
app.post('/reports', rateLimit({ windowMs: 60000, maxRequests: 10 }));
```

---

## 6. AI/ML Architecture (Phase 2)

### 6.1 YOLO Inference Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOLO INFERENCE PIPELINE                       │
└─────────────────────────────────────────────────────────────────┘

Image Upload
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. PREPROCESSING                                             │
│ • Resize to 640x640 (YOLO input size)                       │
│ • Normalize pixel values (0-1)                              │
│ • Convert to tensor format                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. INFERENCE (Cloudflare Workers AI)                         │
│ • Model: @cf/yolo/pothole-detection                         │
│ • Inference time: < 100ms                                    │
│ • Output: Bounding boxes + confidence scores                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. POST-PROCESSING                                           │
│ • Non-maximum suppression (NMS)                             │
│ • Filter by confidence threshold (0.75)                     │
│ • Classify severity based on:                               │
│   - Pothole size (bounding box area)                        │
│   - Depth estimation (if available)                         │
│   - Context (road type, traffic)                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DECISION                                                  │
│ • confidence ≥ 0.75 → Approve & queue for verification     │
│ • confidence < 0.75 → Reject with user feedback             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Model Training Strategy

```typescript
// Training data collection (Phase 1 → Phase 2 transition)

interface TrainingSample {
  imageUrl: string;
  labels: {
    bbox: [x: number, y: number, width: number, height: number];
    class: 'pothole';
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  metadata: {
    digipin: string;
    timestamp: Date;
    verified: boolean;
  };
}

// Data collection during Phase 1
// - All submitted images stored in R2
// - Crony verifications serve as ground truth
// - Build labeled dataset for model fine-tuning

// Phase 2 deployment
// - Fine-tune YOLO on collected dataset
// - Deploy to Cloudflare Workers AI
// - Continuous learning from new verifications
```

---

## 7. Deployment Architecture

### 7.1 Cloudflare Workers Configuration

```json
// wrangler.jsonc
{
  "name": "prism-engine",
  "compatibility_date": "2024-03-20",
  "main": "src/index.ts",
  
  "vars": {
    "ENVIRONMENT": "production",
    "JWT_EXPIRY_DAYS": "7"
  },
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "prism_board",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ],
  
  "r2_buckets": [
    {
      "binding": "MEDIA_BUCKET",
      "bucket_name": "prism-media"
    }
  ],
  
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  ],
  
  "ai": {
    "binding": "AI"
  },
  
  "routes": [
    {
      "pattern": "api.prism.civic/*",
      "zone_name": "prism.civic"
    }
  ]
}
```

### 7.2 Deployment Workflow

```bash
# Development workflow

# 1. Local development
wrangler dev --local

# 2. Database migrations
wrangler d1 migrations apply prism_board --local

# 3. Type generation
wrangler types

# 4. Deploy to production
wrangler deploy

# 5. Production database migrations
wrangler d1 migrations apply prism_board --remote
```

### 7.3 CI/CD Pipeline (Recommended)

```yaml
# .github/workflows/deploy.yml
name: Deploy PRISM Engine

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Run type check
        run: bun run typecheck
        
      - name: Run tests
        run: bun test
        
      - name: Apply migrations
        run: wrangler d1 migrations apply prism_board --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          
      - name: Deploy to Cloudflare
        run: wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 8. Performance Considerations

### 8.1 Edge Computing Benefits

| Metric | Traditional Cloud | Cloudflare Workers |
|--------|------------------|-------------------|
| **Cold Start** | 100-500ms | 0-5ms |
| **Global Latency** | 50-200ms | 10-50ms |
| **Concurrent Requests** | Limited | 100,000+/zone |
| **Edge Caching** | CDN required | Built-in |

### 8.2 Optimization Strategies

```typescript
// 1. Database query optimization
// Use prepared statements and indexes
const stmt = db.prepare(`
  SELECT * FROM reports 
  WHERE status = ? 
  AND digipin LIKE ?
  ORDER BY created_at DESC
  LIMIT 50
`);

// 2. Caching layer
// Cache frequently accessed data in KV
const cacheKey = `reports:${digipin}`;
let reports = await kv.get(cacheKey, { type: 'json' });

if (!reports) {
  reports = await fetchReportsFromDB(digipin);
  await kv.put(cacheKey, JSON.stringify(reports), {
    expirationTtl: 300 // 5 minutes
  });
}

// 3. Image optimization
// Store multiple sizes in R2
// - original: Full resolution
// - thumbnail: 300x300
// - preview: 800x600
```

---

## 9. Monitoring & Observability

### 9.1 Structured Logging

```typescript
// utils/logger.ts

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context: {
    requestId: string;
    userId?: string;
    path: string;
    method: string;
    duration?: number;
  };
  metadata?: Record<string, unknown>;
}

export function log(
  level: LogEntry['level'],
  message: string,
  c: Context,
  metadata?: Record<string, unknown>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: {
      requestId: c.get('requestId'),
      userId: c.get('user')?.id,
      path: c.req.path,
      method: c.req.method,
      duration: c.get('startTime') 
        ? Date.now() - c.get('startTime')
        : undefined
    },
    metadata
  };
  
  console.log(JSON.stringify(entry));
}
```

### 9.2 Key Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| API Response Time | < 100ms | > 500ms |
| AI Inference Time | < 200ms | > 1000ms |
| Database Query Time | < 50ms | > 200ms |
| Error Rate | < 0.1% | > 1% |
| JWT Validation Failures | < 0.01% | > 0.1% |
| R2 Upload Success Rate | > 99.9% | < 99% |

---

## 10. Future Architecture Evolution

### 10.1 Phase 3: Ecosystem Expansion

```
Future Enhancements:

1. Mobile SDK
   - Allow third-party apps to submit reports
   - Standardized API for civic platforms
   
2. Blockchain Integration
   - Immutable audit trail on-chain
   - Smart contracts for contractor payments
   - Tokenized incentives for cronies
   
3. Predictive Analytics
   - ML models for pothole prediction
   - Weather correlation analysis
   - Infrastructure degradation forecasting
   
4. Multi-Tenant Support
   - Different cities as separate tenants
   - Customizable workflows per municipality
   - White-label solutions
```

### 10.2 Scalability Roadmap

| Phase | Users | Reports/Day | Infrastructure |
|-------|-------|-------------|----------------|
| **Phase 1** | 1,000 | 100 | Single Worker, Single D1 |
| **Phase 2** | 10,000 | 1,000 | Multiple Workers, Sharded D1 |
| **Phase 3** | 100,000 | 10,000 | Global distribution, Caching layer |
| **Phase 4** | 1M+ | 100,000+ | Multi-region, Queue-based processing |

---

## 11. Security Checklist

### Pre-Deployment Security Audit

- [ ] JWT secrets rotated and stored securely
- [ ] Rate limiting implemented on all endpoints
- [ ] Input validation on all API inputs
- [ ] SQL injection prevention (prepared statements)
- [ ] XSS protection headers configured
- [ ] CORS properly configured for production domains
- [ ] Phone number validation and sanitization
- [ ] Image upload restrictions (type, size)
- [ ] OTP rate limiting and lockout
- [ ] Admin endpoints require MFA
- [ ] Audit logging enabled
- [ ] R2 bucket permissions configured
- [ ] D1 backup strategy in place
- [ ] SSL/TLS enforced (Cloudflare default)
- [ ] Secrets management (Wrangler secrets)

---

## 12. References & Documentation

### Internal Documentation
- `AGENTS.md` - AI agent development guidelines
- `implementation_plan.md` - Step-by-step implementation guide
- `Gemini.md` - Project progress tracking

### External References
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [Tauri Documentation](https://tauri.app/)
- [Hono.js Documentation](https://hono.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)

---

## Document Information

- **Version**: 1.0
- **Last Updated**: 2026-03-20
- **Author**: PRISM Engineering Team
- **Status**: Active Development
- **Next Review**: 2026-04-20

---

*This architecture document serves as the single source of truth for PRISM system design. All engineering decisions should align with the principles and patterns defined herein.*
# Phase 1: Foundation - Research

**Researched:** 2026-04-13
**Domain:** TypeScript types, D1 query layer, geo libraries, Cloudflare Workers test infrastructure
**Confidence:** HIGH

## Summary

Phase 1 builds the shared foundation layer for all downstream phases: typed interfaces matching D1 schema, portable DIGIPIN and spatial utility libraries, typed D1 query functions, and a real-persistence test infrastructure using miniflare. Every Phase 2+ route handler, middleware, and service depends on artifacts from this phase.

The frontend already has complete DIGIPIN (`prism/src/lib/digipin.ts`, 228 lines) and spatial (`prism/src/lib/spatial.ts`, 239 lines) implementations ready to port to the backend with minimal changes. The backend has inline DIGIPIN in `prism-engine/src/index.ts` lines 24-69 that must be extracted and replaced with a lib import. Five D1 migrations define 13 tables across the schema.

**Critical finding:** The project's `vitest.config.ts` uses the DEPRECATED `environment: 'miniflare'` approach. The modern `@cloudflare/vitest-pool-workers` library provides `cloudflareTest()` Vite plugin with built-in D1/R2 persistence, migration loading via `readD1Migrations()`, and per-test migration application via `applyD1Migrations()` from `cloudflare:test`. This must be migrated as part of the test infrastructure task.

**Primary recommendation:** Port frontend geo libs verbatim, build typed query layer as plain functions (no classes), modernize vitest config to use `cloudflareTest()` plugin, create factory helpers for test data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single `prism-engine/src/lib/types.ts` file containing all DB type definitions (User, Report, Intervention, Verification, Bounty, GeoFenceCluster, etc.) plus Env type
- **D-02:** Dual type pattern — raw `*Row` types matching D1 query results (nullable fields, string dates) + app-friendly types with transforms. Example: `UserRow` (DB shape) and `User` (app shape)
- **D-03:** Backend is canonical source for geo libraries. Extract from `prism-engine/src/index.ts` into `prism-engine/src/lib/digipin.ts` and `prism-engine/src/lib/spatial.ts`
- **D-04:** Frontend keeps its own copies in `prism/src/lib/digipin.ts` and `prism/src/lib/spatial.ts` — no shared package
- **D-05:** Backend DIGIPIN module should include full feature set (encode, decode, validate, format, prefix, distance) matching frontend's existing implementation
- **D-06:** Typed query functions in `prism-engine/src/lib/queries.ts` — plain functions wrapping D1 prepared statements with typed params and return types
- **D-07:** Each function takes `D1Database` as first param, returns typed result — no classes, no repository pattern
- **D-08:** Use miniflare's built-in D1/R2 persistence for tests — real database operations, no mocks
- **D-09:** Migrations applied to test D1 instance before each test suite (via miniflare config or setup script)
- **D-10:** Factory helper functions for creating test records directly in D1 (e.g., `insertTestUser(db, overrides)`)

### Claude's Discretion
- Exact file structure within `prism-engine/src/lib/` (single queries.ts vs split by domain)
- Naming conventions for query functions
- Test file organization and naming
- Which utility functions to include beyond DIGIPIN + Haversine minimum

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Unit tests for all services (DIGIPIN, Haversine, status state machine, RBAC filters) | DIGIPIN/spatial libs ported from frontend have complete implementations to test. Status state machine enum + transition validation logic needed. RBAC filter logic needed. Vitest + cloudflareTest plugin provides test runner. |
| TEST-02 | Unit tests for all middleware (auth, validation, error handling) | Hono middleware test pattern documented. cloudflare:test env provides bindings. Factory helpers create test users/roles for auth middleware verification. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ~3.2.0 (latest 4.1.4) | Test runner | Already installed; Workers pool pins to ~3.x [VERIFIED: npm registry] |
| @cloudflare/vitest-pool-workers | ^0.12.4 (latest 0.14.3) | Workers test environment | Official Cloudflare test harness, provides real D1/R2/DO in miniflare [VERIFIED: npm registry] |
| wrangler | ^4.74.0 (latest 4.81.1) | Workers CLI + miniflare | D1 migrations, local dev, type generation [VERIFIED: npm registry] |
| hono | ^4.12.8 (latest 4.12.12) | HTTP framework | Already installed, used for all routes [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | ^5.5.2 | Type system | All source files |
| vitest-environment-miniflare | ^2.14.4 | DEPRECATED — to be removed | Current config uses this; migrate to cloudflareTest plugin |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cloudflareTest plugin | Keep environment: 'miniflare' | Deprecated approach, missing readD1Migrations/applyD1Migrations APIs, harder to get real D1 persistence |
| Single queries.ts | Split by domain (user-queries.ts, report-queries.ts) | Single file simpler for foundation; split later when queries grow past ~200 lines |

**Installation:**
```bash
cd prism-engine
# Upgrade vitest-pool-workers for cloudflareTest support
bun add -D @cloudflare/vitest-pool-workers@latest
# Remove deprecated env
bun remove vitest-environment-miniflare
```

**Version verification (2026-04-13):**
- vitest: installed ~3.2.0, latest 4.1.4 — staying on ~3.x for Workers pool compatibility
- @cloudflare/vitest-pool-workers: installed ^0.12.4, latest 0.14.3 — upgrade recommended for cloudflareTest API
- wrangler: installed ^4.74.0, latest 4.81.1
- hono: installed ^4.12.8, latest 4.12.12

## Architecture Patterns

### Recommended Project Structure
```
prism-engine/src/lib/
├── types.ts          # All DB types (Row + App), Env type, status enums
├── digipin.ts        # DIGIPIN encode/decode/validate/format/prefix/distance
├── spatial.ts        # Haversine, bounding box, drift calc, bearing, sort, filter
└── queries.ts        # Typed D1 query functions (plain functions, no classes)

prism-engine/tests/
├── setup.ts          # D1 migration application, shared fixtures
├── digipin.test.ts   # DIGIPIN unit tests
├── spatial.test.ts   # Spatial utility unit tests
├── queries.test.ts   # Query function tests with real D1
├── factories.ts      # Factory helpers: insertTestUser, insertTestReport, etc.
└── types.test.ts     # Type transform tests (Row -> App shape)
```

### Pattern 1: Dual Type System (D-02)
**What:** Raw `*Row` types matching D1 query output, app-friendly types with transforms
**When to use:** Every D1 table gets both types
**Example:**
```typescript
// Source: D-02 decision + D1 migration schema analysis
// Raw D1 row — nullable fields, string dates, exactly as D1 returns
export interface UserRow {
  id: string;
  role: string;  // D1 returns CHECK constraint as string
  phone_number: string;
  region_scope: string | null;
  created_at: string;  // D1 returns DATETIME as string
  supervisor_id: string | null;
  tags: string;  // JSON string, not parsed
  hierarchy_depth: number | null;
  reporter_id: string | null;
  supertokens_user_id: string | null;
}

// App-friendly type — parsed, non-null where appropriate
export interface User {
  id: string;
  role: UserRole;
  phoneNumber: string;
  regionScope: string | null;
  createdAt: Date;
  supervisorId: string | null;
  tags: string[];
  hierarchyDepth: number;
  reporterId: string | null;
  supertokensUserId: string | null;
}

// Transform function
export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    role: row.role as UserRole,
    phoneNumber: row.phone_number,
    regionScope: row.region_scope,
    createdAt: new Date(row.created_at),
    supervisorId: row.supervisor_id,
    tags: JSON.parse(row.tags || '[]'),
    hierarchyDepth: row.hierarchy_depth ?? 0,
    reporterId: row.reporter_id,
    supertokensUserId: row.supertokens_user_id,
  };
}
```

### Pattern 2: Typed Query Functions (D-06, D-07)
**What:** Plain functions taking D1Database as first param, returning typed results
**When to use:** All D1 queries in Phase 2+
**Example:**
```typescript
// Source: D-06/D-07 decisions + established D1 patterns in index.ts
export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM Users WHERE id = ?').bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function getReportsByStatus(
  db: D1Database,
  status: ReportStatus,
  limit: number = 100
): Promise<Report[]> {
  const result = await db.prepare(
    'SELECT * FROM Reports WHERE status = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(status, limit).all<ReportRow>();
  return (result.results ?? []).map(rowToReport);
}
```

### Pattern 3: Modern Vitest Config with cloudflareTest
**What:** Replace deprecated `environment: 'miniflare'` with `cloudflareTest()` Vite plugin
**When to use:** All backend tests
**Example:**
```typescript
// Source: [CITED: developers.cloudflare.com/workers/testing/vitest]
// prism-engine/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers/config';

export default defineConfig({
  test: {
    ...cloudflareTest({
      setupFiles: ['./tests/setup.ts'],
      workers: {
        isolatedStorage: true,
      },
    }),
    include: ['tests/**/*.test.ts'],
  },
});
```

### Pattern 4: D1 Migration Loading in Tests (D-09)
**What:** Load and apply migrations before each test suite
**When to use:** Every test file that queries D1
**Example:**
```typescript
// Source: [CITED: developers.cloudflare.com/workers/testing/vitest]
// prism-engine/tests/setup.ts
import { readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { applyD1Migrations } from 'cloudflare:test';

let migrations: D1Migration[] | undefined;

export async function applyMigrations(db: D1Database) {
  if (!migrations) {
    migrations = await readD1Migrations('./migrations');
  }
  await applyD1Migrations(db, migrations);
}
```

```typescript
// prism-engine/vitest.config.ts — pass migrations binding
import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers/config';

export default defineConfig({
  test: {
    ...cloudflareTest({
      setupFiles: ['./tests/setup.ts'],
    }),
    include: ['tests/**/*.test.ts'],
  },
});
```

### Pattern 5: Factory Test Helpers (D-10)
**What:** Functions that insert test records directly into D1
**When to use:** Every test that needs DB records
**Example:**
```typescript
// Source: D-10 decision
// prism-engine/tests/factories.ts
import type { D1Database } from '@cloudflare/workers-types';

interface UserOverrides {
  id?: string;
  role?: string;
  phone_number?: string;
  region_scope?: string | null;
  supervisor_id?: string | null;
  reporter_id?: string | null;
}

export async function insertTestUser(db: D1Database, overrides: UserOverrides = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  await db.prepare(
    'INSERT INTO Users (id, role, phone_number, region_scope, supervisor_id, reporter_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    overrides.role ?? 'crony',
    overrides.phone_number ?? `+919${Math.random().toString().slice(2, 12)}`,
    overrides.region_scope ?? null,
    overrides.supervisor_id ?? null,
    overrides.reporter_id ?? null
  ).run();
  return id;
}

export async function insertTestReport(db: D1Database, reporterId: string, overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? crypto.randomUUID();
  await db.prepare(
    'INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    reporterId,
    (overrides.latitude as number) ?? 28.6139,
    (overrides.longitude as number) ?? 77.2090,
    (overrides.digipin as string) ?? '39G-4CJ-6969',
    (overrides.r2_image_url as string) ?? 'r2://test-image.jpg',
    (overrides.status as string) ?? 'pending'
  ).run();
  return id;
}
```

### Anti-Patterns to Avoid
- **Mocking D1 in tests:** D-08 explicitly mandates real D1 operations. Use miniflare persistence, never `{}` as D1Database. [VERIFIED: CONTEXT.md D-08]
- **Repository pattern / query classes:** D-07 explicitly mandates plain functions. No UserRepository class. [VERIFIED: CONTEXT.md D-07]
- **String interpolation in SQL:** Established pattern uses `.bind()` exclusively. `db.prepare('SELECT * FROM Users WHERE id = ' + id)` is forbidden. [VERIFIED: codebase/CONVENTIONS.md]
- **Shared package for geo libs:** D-04 explicitly says frontend keeps its own copies. No monorepo shared package. [VERIFIED: CONTEXT.md D-04]
- **Using `environment: 'miniflare'` in vitest config:** Deprecated. Must use `cloudflareTest()` plugin from `@cloudflare/vitest-pool-workers/config`. [VERIFIED: npm registry + Cloudflare docs]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DIGIPIN encoding/decoding | Custom geo algorithm | Port from `prism/src/lib/digipin.ts` | Complete, tested-in-production implementation already exists in frontend |
| Haversine distance | Math from scratch | Port from `prism/src/lib/spatial.ts` | Handles edge cases, proven in field use |
| D1 migration loading in tests | Custom SQL file reader | `readD1Migrations()` from vitest-pool-workers | Handles migration ordering, format parsing |
| D1 test DB setup | Manual CREATE TABLE statements | `applyD1Migrations()` from cloudflare:test | Runs actual migrations, ensures test schema matches production |
| UUID generation | Custom ID function | `crypto.randomUUID()` | Already established pattern in codebase, crypto-safe |

**Key insight:** Frontend has battle-tested implementations of both geo libraries. Port verbatim — do not rewrite from scratch.

## Common Pitfalls

### Pitfall 1: D1 Column Type Mismatches
**What goes wrong:** D1 returns DATETIME as string, CHECK constraint values as string, nullable columns as null. TypeScript types that assume Date objects or enums break at runtime.
**Why it happens:** D1 is SQLite — everything comes back as string/number/null regardless of column affinity.
**How to avoid:** Dual type pattern (D-02). Row types match D1 output exactly. Transform functions convert to app types.
**Warning signs:** `row.createdAt.getFullYear is not a function` errors in downstream code.

### Pitfall 2: Stale vitest config (environment: 'miniflare')
**What goes wrong:** Tests using old `environment: 'miniflare'` cannot access `cloudflare:test` module's `env` object. No real D1 persistence. Manual mock objects like `env = { DB: {} as D1Database }`.
**Why it happens:** `vitest-environment-miniflare` is deprecated. Modern approach uses `cloudflareTest()` Vite plugin.
**How to avoid:** Rewrite vitest.config.ts to use `cloudflareTest()` from `@cloudflare/vitest-pool-workers/config`. Import `env` from `cloudflare:test` in test files.
**Warning signs:** Tests with `{} as D1Database` mock objects. `cloudflare:test` import errors.

### Pitfall 3: Migration Not Applied Before Tests
**What goes wrong:** Test tries to INSERT into table that doesn't exist in test D1. `SqliteError: no such table: Users`.
**Why it happens:** Test D1 instance starts with empty database. Migrations must be explicitly applied.
**How to avoid:** `applyD1Migrations(db, migrations)` in setup file, called via `setupFiles` in vitest config.
**Warning signs:** "no such table" errors in test output.

### Pitfall 4: DIGIPIN Grid Row Reversal
**What goes wrong:** Lat/lng encoding produces wrong DIGIPIN because row index is not reversed.
**Why it happens:** DIGIPIN grid is laid out south-to-north but array is indexed north-to-south. `const gridRow = 3 - row` is critical.
**How to avoid:** Port frontend implementation verbatim — do not reimplement. Test with known coordinate-DIGIPIN pairs.
**Warning signs:** Known coordinates produce incorrect DIGIPIN codes. Decode-encode roundtrip fails.

### Pitfall 5: Test File Location Mismatch
**What goes wrong:** Tests in `test/` directory (singular) don't match vitest `include: ['tests/**/*.test.ts']` pattern. Tests silently skipped.
**Why it happens:** Two test directories exist: `test/` (old, has index.spec.ts) and `tests/` (new, has supertokens tests). vitest config only watches `tests/`.
**How to avoid:** Consolidate to `tests/` directory. Update or remove `test/` directory. Ensure vitest include pattern matches.
**Warning signs:** `vitest run` reports fewer tests than expected.

## Code Examples

### Status State Machine Enum
```typescript
// Source: D1 Reports table CHECK constraint in 0001_init_schema.sql
export const REPORT_STATUSES = ['pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved'] as const;
export type ReportStatus = typeof REPORT_STATUSES[number];

// Valid transitions map
export const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  pending: ['pending_review', 'approved'],  // Phase 1 auto-approves
  pending_review: ['assigned', 'rejected'],
  assigned: ['fixed_pending_verification'],
  fixed_pending_verification: ['resolved', 'pending_review'],
  resolved: [],  // Terminal state
};

export function isValidTransition(from: ReportStatus, to: ReportStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### User Role Enum
```typescript
// Source: D1 Users table CHECK constraint in 0001_init_schema.sql
export const USER_ROLES = ['crony', 'contractor', 'admin'] as const;
export type UserRole = typeof USER_ROLES[number];
```

### DIGIPIN Test (Known Coordinate Pairs)
```typescript
// Source: Port from prism/src/lib/digipin.ts — test with roundtrip
import { describe, it, expect } from 'vitest';
import { latLngToDIGIPIN, digipinToLatLng, isValidDIGIPIN } from '../src/lib/digipin';

describe('DIGIPIN', () => {
  it('roundtrips: encode then decode returns same coordinates (within 4m precision)', () => {
    const lat = 28.6139;
    const lon = 77.2090;
    const digipin = latLngToDIGIPIN(lat, lon);
    const coords = digipinToLatLng(digipin);

    expect(Math.abs(coords.latitude - lat)).toBeLessThan(0.00005);  // ~5m
    expect(Math.abs(coords.longitude - lon)).toBeLessThan(0.00005);
  });

  it('validates known DIGIPIN format', () => {
    expect(isValidDIGIPIN('39G-4CJ-6969')).toBe(true);
    expect(isValidDIGIPIN('INVALID!!')).toBe(false);
  });
});
```

### Haversine Test (Known Distance)
```typescript
// Source: Port from prism/src/lib/spatial.ts
import { describe, it, expect } from 'vitest';
import { haversineDistance, calculateSpatialDrift } from '../src/lib/spatial';

describe('Spatial', () => {
  it('calculates known distance: Delhi to Agra ~175km', () => {
    const dist = haversineDistance(28.6139, 77.2090, 27.1767, 78.0081);
    expect(dist).toBeGreaterThan(170_000);
    expect(dist).toBeLessThan(180_000);
  });

  it('spatial drift under 30m threshold passes', () => {
    const result = calculateSpatialDrift(
      { latitude: 28.6139, longitude: 77.2090 },
      { latitude: 28.6139, longitude: 77.2090 },  // Same point
      30
    );
    expect(result.exceedsThreshold).toBe(false);
    expect(result.driftMeters).toBe(0);
  });
});
```

### Test Setup with Real D1
```typescript
// Source: [CITED: developers.cloudflare.com/workers/testing/vitest]
// tests/setup.ts
import { env } from 'cloudflare:test';
import { readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

let migrations: any[];

beforeAll(async () => {
  if (!migrations) {
    migrations = await readD1Migrations('./migrations');
  }
  // applyD1Migrations imported via cloudflare:test in test files
});

// Export for use in test files
export { migrations };
```

```typescript
// tests/queries.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { getUserById } from '../src/lib/queries';
import { insertTestUser } from './factories';

describe('Query Functions', () => {
  beforeAll(async () => {
    const migrations = await readD1Migrations('./migrations');
    await applyD1Migrations(env.DB, migrations);
  });

  it('getUserById returns user when exists', async () => {
    const userId = await insertTestUser(env.DB, { phone_number: '+919999999999' });
    const user = await getUserById(env.DB, userId);
    expect(user).not.toBeNull();
    expect(user!.phoneNumber).toBe('+919999999999');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `environment: 'miniflare'` in vitest | `cloudflareTest()` Vite plugin | vitest-pool-workers 0.14+ | Must rewrite vitest.config.ts |
| Manual D1 mock objects | Real D1 via miniflare + cloudflare:test | Always recommended | Tests use real SQL, catch schema bugs |
| `readFile` for migration SQL | `readD1Migrations()` from vitest-pool-workers/config | vitest-pool-workers 0.14+ | Built-in migration loading |
| Manual CREATE TABLE in tests | `applyD1Migrations()` from cloudflare:test | Always available | Runs actual migrations |

**Deprecated/outdated:**
- `vitest-environment-miniflare`: Deprecated package. Project has it installed (`^2.14.4`). Must remove and replace with cloudflareTest plugin. [VERIFIED: npm registry]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cloudflareTest()` API available in @cloudflare/vitest-pool-workers ^0.12.4 | Architecture Patterns | May need upgrade to 0.14.x; fallback: keep cloudflareTest but pin 0.14.3 |
| A2 | `readD1Migrations()` and `applyD1Migrations()` available in current installed version | Architecture Patterns | May need upgrade; fallback: read SQL files manually |
| A3 | `env.DB` from `cloudflare:test` provides real D1Database with full SQL support | Code Examples | If env.DB not configured in poolOptions, tests fail; fallback: explicit miniflare config |
| A4 | DIGIPIN algorithm in frontend is correct and can be ported verbatim | Code Examples | If frontend has bugs, tests will catch them via roundtrip testing |
| A5 | Report status 'approved' exists in Phase 1 flow per RPT-04 (auto-approve) but not in D1 CHECK constraint | Status State Machine | CHECK only has 'pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved'; 'approved' may be mapped to one of these |

**Note on A5:** The D1 CHECK constraint for Reports.status is `IN ('pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved')`. RPT-04 says "Phase 1 reports auto-approved (status = 'approved')" but 'approved' is NOT in the CHECK constraint. This appears to be a schema-requirement mismatch that needs clarification. 'approved' may be intended as 'pending_review' or may require a migration. Flagged for discuss-phase.

## Open Questions

1. **Report status 'approved' vs D1 CHECK constraint**
   - What we know: RPT-04 says "auto-approved (status = 'approved')". D1 CHECK only allows 'pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved'.
   - What's unclear: Is 'approved' a missing enum value or should it map to 'pending_review'?
   - Recommendation: Flag for user clarification. For foundation phase, define types matching the actual D1 schema CHECK constraint. Status state machine can be adjusted later.

2. **cloudflareTest upgrade path**
   - What we know: Installed @cloudflare/vitest-pool-workers ^0.12.4. Latest is 0.14.3.
   - What's unclear: Does ^0.12.4 resolve to 0.14.x (which has cloudflareTest)? Or is 0.12.x a separate branch?
   - Recommendation: Run `bun add -D @cloudflare/vitest-pool-workers@latest` as first step in test infrastructure task.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Package mgmt | ✓ | — | — |
| vitest | Test runner | ✓ | ~3.2.0 | — |
| @cloudflare/vitest-pool-workers | Workers test env | ✓ | ^0.12.4 | — |
| wrangler | D1 migrations, types | ✓ | ^4.74.0 | — |
| D1 (miniflare) | Test DB persistence | ✓ | via vitest-pool-workers | — |
| typescript | Type checking | ✓ | ^5.5.2 | — |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ~3.2.0 with @cloudflare/vitest-pool-workers |
| Config file | prism-engine/vitest.config.ts (needs rewrite) |
| Quick run command | `cd prism-engine && bun vitest run tests/digipin.test.ts -t "DIGIPIN"` |
| Full suite command | `cd prism-engine && bun vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | DIGIPIN encode/decode/validate/format/prefix/distance | unit | `bun vitest run tests/digipin.test.ts` | Wave 0 |
| TEST-01 | Haversine distance, bounding box, spatial drift, bearing, sort, filter | unit | `bun vitest run tests/spatial.test.ts` | Wave 0 |
| TEST-01 | Report status state machine transitions | unit | `bun vitest run tests/types.test.ts -t "status"` | Wave 0 |
| TEST-01 | RBAC filter logic (role-based query scoping) | unit | `bun vitest run tests/types.test.ts -t "RBAC"` | Wave 0 |
| TEST-02 | Auth middleware verification | unit | `bun vitest run tests/auth-middleware.test.ts` | Wave 0 |
| TEST-02 | Validation middleware (input checks) | unit | `bun vitest run tests/validation.test.ts` | Wave 0 |
| TEST-02 | Error handling middleware | unit | `bun vitest run tests/error-handling.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd prism-engine && bun vitest run`
- **Per wave merge:** `cd prism-engine && bun vitest run --coverage`
- **Phase gate:** Full suite green + coverage report before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/setup.ts` — D1 migration application, shared fixtures
- [ ] `tests/factories.ts` — insertTestUser, insertTestReport factory helpers
- [ ] `tests/digipin.test.ts` — covers TEST-01 (DIGIPIN)
- [ ] `tests/spatial.test.ts` — covers TEST-01 (Haversine)
- [ ] `tests/types.test.ts` — covers TEST-01 (status machine, RBAC filters)
- [ ] `tests/auth-middleware.test.ts` — covers TEST-02 (auth)
- [ ] `tests/validation.test.ts` — covers TEST-02 (validation)
- [ ] `tests/error-handling.test.ts` — covers TEST-02 (error handling)
- [ ] Rewrite `vitest.config.ts` — migrate from environment: 'miniflare' to cloudflareTest()
- [ ] Remove `vitest-environment-miniflare` dependency
- [ ] Remove or consolidate stale `test/index.spec.ts` (expects "Hello World!")
- [ ] Upgrade `@cloudflare/vitest-pool-workers` to latest for cloudflareTest API

*(Note: Some TEST-02 middleware tests may be partial stubs in Phase 1 since the actual middleware code is built in Phase 2. Test structure and infrastructure should exist; test bodies may test the pattern/framework rather than production middleware.)*

## Security Domain

> Phase 1 has no auth routes, no user input handling, no API endpoints. Security enforcement minimal.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 2 scope |
| V3 Session Management | no | Phase 2 scope |
| V4 Access Control | partial | RBAC type enums defined but not enforced |
| V5 Input Validation | no | No user input in Phase 1 |
| V6 Cryptography | no | `crypto.randomUUID()` is platform-provided |

### Known Threat Patterns for Cloudflare Workers + D1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Prepared statements with `.bind()` — enforced by D-06 pattern |
| Type confusion | Tampering | Dual type pattern (D-02) with explicit transforms |

## Sources

### Primary (HIGH confidence)
- `prism/src/lib/digipin.ts` — Complete DIGIPIN implementation to port
- `prism/src/lib/spatial.ts` — Complete spatial library to port
- `prism-engine/src/index.ts` lines 24-81 — Inline DIGIPIN + Env type
- `prism-engine/migrations/0001-0004` — D1 schema definition (13 tables)
- `prism-engine/vitest.config.ts` — Current test config
- `prism-engine/package.json` — Dependency versions
- `prism-engine/test/env.d.ts` — cloudflare:test module declaration

### Secondary (MEDIUM confidence)
- [CITED: developers.cloudflare.com/workers/testing/vitest] — cloudflareTest plugin, readD1Migrations, applyD1Migrations APIs
- `prism-engine/tests/supertokens-init.test.ts` — Existing test pattern (manual mocks, to be replaced)
- `prism-engine/test/index.spec.ts` — Stale test expecting "Hello World!"

### Tertiary (LOW confidence)
- A5 assumption about 'approved' status not being in CHECK constraint — needs user clarification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified versions against npm registry, all packages installed
- Architecture: HIGH — all patterns derived from locked decisions + existing codebase
- Pitfalls: HIGH — derived from actual D1 schema analysis and existing test code review
- Test infrastructure: MEDIUM — cloudflareTest API documented but upgrade from 0.12.x to 0.14.x not tested on this project

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable stack, low churn expected)

# Phase 3: Core Reports - Research

**Researched:** 2026-04-14
**Domain:** Report lifecycle (whitelist -> submit -> query -> status transitions) on Cloudflare Workers + Hono.js + D1 + R2
**Confidence:** HIGH

## Summary

Phase 3 extracts existing monolithic route logic from `prism-engine/src/index.ts` into modular route files, adds webhook authentication, RBAC-filtered board queries with pagination, and a status transition endpoint backed by the existing state machine in `types.ts`. The query layer (`queries.ts`) already has most functions needed — `createReport`, `getNearbyReports`, `getReportsByStatus`, `updateReportStatus`, `createWhitelistedSource`, `getUserDescendants`. Missing pieces: a `getWhitelistedSourceByUserId` query, a paginated board query with RBAC + status filters combined, and a `WEBHOOK_SECRET` env var binding.

**Primary recommendation:** Extract existing inline routes into `src/routes/whitelist.ts`, `src/routes/reports.ts`, `src/routes/board.ts`. Add webhook secret validation middleware. Build board query that composes `getReportsFilter()` (RBAC) + status filter + offset pagination. Use existing `isValidTransition()` for status endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Secret header authentication for whitelist webhook. Static secret via `X-Webhook-Secret` header. `WEBHOOK_SECRET` env var in Workers. Route validates header matches env var.
- **D-02:** Report submission requires whitelisted_source link. Route checks `Whitelisted_Sources` table for active record linked to authenticated user. Non-whitelisted authenticated users get 403.
- **D-03:** Image MIME types only: `image/jpeg`, `image/png`, `image/webp`. Max 10MB. Validate Content-Type from multipart, reject non-image with 400. Validate body size before R2 put.
- **D-04:** Default radius 1km, max cap 5km. Query param `radius` optional (defaults 1000m), capped at 5000m. Reject >5000m with 400.

### Claude's Discretion
- Exact secret header naming convention
- Whitelisted source lookup caching strategy
- Image validation depth (MIME only vs magic bytes)
- Board response field selection
- Pagination cursor vs offset implementation

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WHIT-01 | Whitelist webhook accepts name, reference_id, phone_number, referrer_phone | Existing route `POST /api/v1/whitelist` in index.ts lines 167-216. Extract to `routes/whitelist.ts`. Add webhook secret validation (D-01). |
| WHIT-02 | User record created with crony role linked to whitelisted source | Existing `createUser()` + `createWhitelistedSource()` in queries.ts. Existing logic creates both records in sequence. |
| WHIT-03 | Referrer hierarchy established via reporter_id with depth tracking | Existing logic in index.ts lines 185-193. Looks up referrer by phone, sets `reporter_id` and increments `hierarchy_depth`. `createUser()` in queries.ts accepts `reporterId` and `supervisorId` params. |
| WHIT-04 | Recursive hierarchy subtree queryable for access control | `getUserDescendants()` in queries.ts already implements recursive CTE. `getHierarchySubtree()` wraps it. |
| RPT-01 | Authenticated whitelisted user can submit report with photo (multipart/form-data) | Extract from `POST /api/v1/reports/harvest` (index.ts lines 219-270). Add `withUser()` middleware + whitelisted source check (D-02). Use `c.req.parseBody()` + `c.env.VAULT.put()`. |
| RPT-02 | Report captures latitude, longitude, and auto-generated DIGIPIN | `latLngToDIGIPIN()` in digipin.ts. `createReport()` in queries.ts calls it internally. |
| RPT-03 | Photo uploaded to R2 with UUID-based key | Existing pattern: `crypto.randomUUID()` + `harvest/{uuid}-{filename}`. `c.env.VAULT.put(objectKey, await media.arrayBuffer())`. |
| RPT-04 | Phase 1 reports auto-approved (status = 'approved') | **CRITICAL MISMATCH**: 'approved' NOT in REPORT_STATUSES or D1 CHECK constraint. CONTEXT.md says 'pending'. Old code inserts 'approved' which fails D1 CHECK. Must use 'pending' + add 'assigned' as first valid transition. See Open Questions. |
| RPT-05 | Invalid payload (missing media/lat/lon) returns 400 with clear error message | Extract existing validation from harvest route. Add MIME + size checks per D-03. |
| RPT-06 | Board endpoint returns reports ordered by creation date (paginated, max 100) | New route needed. `getReportsByStatus()` exists but doesn't paginate or combine RBAC. Build `getBoardReports()` query with `LIMIT ? OFFSET ?`. |
| RPT-07 | Nearby reports queryable by lat/lon/radius with distance calculation | `getNearbyReports()` in queries.ts already implements bounding box + Haversine. Needs radius cap per D-04 (default 1000m, max 5000m). |
| RPT-08 | Reports filterable by status | Add `status` query param to board route. Existing `REPORT_STATUSES` array validates allowed values. |
| RPT-09 | Query results scoped by user role (RBAC filter) | `getReportsFilter()` in rbac.ts returns `{ whereClause, params }`. Compose with status filter in board query. |
| RPT-10 | Report status state machine enforces valid transitions only | `isValidTransition()` in types.ts + `updateReportStatus()` in queries.ts already implement this. |
| RPT-11 | Status transitions: pending -> approved -> assigned -> fixed_pending_verification -> resolved | **CRITICAL MISMATCH**: Current `STATUS_TRANSITIONS` has no 'approved' status. Transitions are: pending -> [pending_review, assigned]. See Open Questions. |
| RPT-12 | Invalid status transitions rejected with error | `updateReportStatus()` returns null on invalid transition. Route returns 400 with error message. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | ^4.12.8 | HTTP framework | Project standard, all routes use Hono instances |
| @cloudflare/vitest-pool-workers | 0.12.4 | Test runner | Workers-compatible test env via miniflare |
| vitest | ~3.2.0 | Test framework | Project standard, all existing tests use it |
| jose | (installed) | JWT verification | Used by supertokens-adapter for auth |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| cloudflare:test | D1 test bindings + `applyD1Migrations` | All route tests needing D1 |

### No New Installations Needed
All dependencies already installed. Phase 3 uses existing query layer, types, middleware, and utilities.

## Architecture Patterns

### Recommended Project Structure
```
prism-engine/src/
├── index.ts                    # Main app — wires route modules (already has auth routes)
├── routes/
│   ├── auth.ts                 # Phase 2 output — pattern to follow
│   ├── whitelist.ts            # NEW: POST /api/v1/whitelist (extracted from index.ts)
│   ├── reports.ts              # NEW: POST /api/v1/reports/harvest + nearby + status transition
│   └── board.ts                # NEW: GET /api/v2/reports (paginated, RBAC-filtered)
├── middleware/
│   ├── auth.ts                 # Phase 2 output — withUser()
│   └── rbac.ts                 # Phase 2 output — requireRole(), getReportsFilter()
├── lib/
│   ├── types.ts                # Phase 1 output — ReportStatus, STATUS_TRANSITIONS
│   ├── queries.ts              # Phase 1 output — all query functions
│   ├── digipin.ts              # Phase 1 output — latLngToDIGIPIN
│   ├── spatial.ts              # Phase 1 output — haversineDistance
│   └── supertokens-adapter.ts  # Phase 2 output — JWT verification
└── tests/
    ├── setup.ts                # Migration helper
    ├── worker.ts               # Minimal test worker
    ├── routes/
    │   ├── auth.test.ts        # Phase 2 output — pattern to follow
    │   ├── whitelist.test.ts   # NEW
    │   ├── reports.test.ts     # NEW
    │   └── board.test.ts       # NEW
    └── lib/                    # Existing unit tests
```

### Pattern 1: Route Module Extraction
**What:** Each route domain in its own file, exported as named Hono instance.
**When to use:** All new routes follow this pattern.
**Example:**
```typescript
// Source: established by routes/auth.ts pattern
import { Hono } from 'hono';
import type { Env } from '../lib/types';

export const whitelistRoutes = new Hono<{ Bindings: Env }>();

whitelistRoutes.post('/', async (c) => {
  // Validate webhook secret (D-01)
  const secret = c.req.header('X-Webhook-Secret');
  if (secret !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: 'Invalid webhook secret' }, 401);
  }
  // ... handler logic
});
```

Wiring in index.ts:
```typescript
import { whitelistRoutes } from './routes/whitelist';
import { reportRoutes } from './routes/reports';
import { boardRoutes } from './routes/board';

app.route('/api/v1/whitelist', whitelistRoutes);
app.route('/api/v1/reports', reportRoutes);
app.route('/api/v2/reports', boardRoutes);
```

### Pattern 2: RBAC-Filtered Board Query
**What:** Compose `getReportsFilter()` output with status filter + pagination in a single SQL query.
**When to use:** Board endpoint (RPT-06, RPT-08, RPT-09).
**Example:**
```typescript
// New query function in queries.ts
export async function getBoardReports(
  db: D1Database,
  filter: { whereClause: string; params: string[] },
  options: { status?: ReportStatus; limit?: number; offset?: number }
): Promise<{ reports: Report[]; total: number }> {
  const limit = Math.min(options.limit ?? 100, 100);
  const offset = options.offset ?? 0;

  let whereParts = [filter.whereClause];
  let params = [...filter.params];

  if (options.status) {
    whereParts.push('status = ?');
    params.push(options.status);
  }

  const where = whereParts.join(' AND ');

  // Count query
  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM Reports WHERE ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  // Data query
  const { results } = await db
    .prepare(`SELECT * FROM Reports WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset)
    .all<ReportRow>();

  return {
    reports: results.map(rowToReport),
    total: countResult?.total ?? 0,
  };
}
```

### Pattern 3: Route Test Structure
**What:** Create test Hono app, mock env bindings, use real D1 via miniflare.
**When to use:** All route tests.
**Example:**
```typescript
// Source: established by tests/routes/auth.test.ts pattern
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import type { Env } from '../../src/lib/types';
import { applyMigrations } from '../setup';
import { reportRoutes } from '../../src/routes/reports';

const testApp = new Hono<{ Bindings: Env }>();
testApp.route('/api/v1/reports', reportRoutes);

function getTestEnv(): Env {
  return {
    DB: env.DB,
    VAULT: {} as R2Bucket,
    // ... other bindings
    WEBHOOK_SECRET: 'test-webhook-secret',
  };
}
```

### Pattern 4: Whitelist Source Verification Middleware
**What:** Composable check that user has active whitelisted_source record.
**When to use:** Report harvest route (D-02).
```typescript
// In routes/reports.ts — inline check, not separate middleware (simpler for single route)
const source = await db
  .prepare('SELECT id, approval_status FROM Whitelisted_Sources WHERE linked_user_id = ? AND approval_status = ?')
  .bind(user.id, 'approved')
  .first();

if (!source) {
  return c.json({ error: 'User is not a whitelisted source' }, 403);
}
```

### Anti-Patterns to Avoid
- **Inline SQL in route handlers:** Extract to queries.ts. All existing query functions follow this pattern.
- **String interpolation in SQL:** Always use `.bind()`. `getReportsFilter()` returns parameterized WHERE clauses.
- **Hardcoded status strings:** Use `ReportStatus` type and `REPORT_STATUSES` array for validation.
- **Double-fetching report in status transitions:** `updateReportStatus()` already does get + validate + update. Don't duplicate.
- **R2 put without size check:** Validate body size before `VAULT.put()` per D-03.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status state machine | Custom transition validation | `isValidTransition()` in types.ts | Already implemented, tested, matches D1 CHECK constraint |
| Report creation with DIGIPIN | Manual DIGIPIN + INSERT | `createReport()` in queries.ts | Handles UUID, DIGIPIN encoding, re-fetch |
| Nearby search | Full-table scan + filter | `getNearbyReports()` in queries.ts | Bounding box pre-filter + Haversine post-filter |
| RBAC WHERE clauses | Manual role-based query building | `getReportsFilter()` in rbac.ts | Handles admin/contractor/crony/hierarchy cases |
| Auth middleware | Custom auth header parsing | `withUser()` from middleware/auth.ts | JWT verification + D1 user resolution |
| Haversine distance | Custom math | `haversineDistance()` from spatial.ts | Tested, handles edge cases |

## Common Pitfalls

### Pitfall 1: 'approved' Status Doesn't Exist in Schema
**What goes wrong:** RPT-04 says "auto-approved (status = 'approved')" but 'approved' is NOT in REPORT_STATUSES, STATUS_TRANSITIONS, or the D1 CHECK constraint.
**Why it happens:** Requirement written before schema was finalized. Old index.ts harvest route hardcodes `'approved'` which would fail on real D1.
**How to avoid:** Use 'pending' for Phase 1 whitelist-trusted reports. CONTEXT.md success criteria #3 says "pending" status. The whitelist trust means reports skip AI review, not that they're approved.
**Warning signs:** Any route inserting status = 'approved' into Reports table.

### Pitfall 2: Missing WEBHOOK_SECRET in Env Type
**What goes wrong:** New env var `WEBHOOK_SECRET` not in the `Env` type or `wrangler.jsonc`.
**Why it happens:** Env type defined in two places: `types.ts` (canonical) and `index.ts` (legacy duplicate).
**How to avoid:** Add `WEBHOOK_SECRET: string` to `Env` in `types.ts` AND add to `wrangler.jsonc` vars section. The `index.ts` duplicate `Env` type also needs updating (or removal — types.ts is canonical).
**Warning signs:** TypeScript compilation errors or undefined at runtime.

### Pitfall 3: R2 Mock in Tests
**What goes wrong:** Test env uses `{} as R2Bucket` — calling `VAULT.put()` in tests throws.
**Why it happens:** Miniflare doesn't auto-create R2 mock. Tests need a mock implementation.
**How to avoid:** Create a minimal R2 mock for report harvest tests: `{ put: async () => undefined } as unknown as R2Bucket`. Or use a Map-based mock that tracks puts.
**Warning signs:** Test failures on routes that call `c.env.VAULT.put()`.

### Pitfall 4: getReportsFilter() SQL Injection via whereClause
**What goes wrong:** Building dynamic SQL by concatenating `filter.whereClause` into query string.
**Why it happens:** `getReportsFilter()` returns a raw SQL fragment, not a parameterized query builder.
**How to avoid:** Always use template literal with `${filter.whereClause}` for the clause itself (it's safe — generated by the function, not user input), and `.bind(...filter.params, ...additionalParams)` for all dynamic values. The whereClause strings are hardcoded in rbac.ts, not user-supplied.
**Warning signs:** Any `.bind()` call that doesn't include `filter.params`.

### Pitfall 5: Multipart Body Size Validation
**What goes wrong:** Workers have a 100MB body size limit but no explicit 10MB check per D-03.
**Why it happens:** `c.req.parseBody()` reads entire body into memory. No size check before R2 put.
**How to avoid:** Check `Content-Length` header before parsing. If absent (chunked transfer), validate after parse: `media.size > 10 * 1024 * 1024`. Reject with 400.
**Warning signs:** Routes accepting media without size validation.

### Pitfall 6: Hierarchy Depth Not Updated in createUser()
**What goes wrong:** `createUser()` in queries.ts doesn't set `hierarchy_depth` — it only sets `reporter_id` and `supervisor_id`.
**Why it happens:** Migration 0003 added `hierarchy_depth` column but `createUser()` INSERT doesn't include it.
**How to avoid:** Add `hierarchy_depth` to `createUser()` input type and INSERT statement. Whitelist route must calculate depth from referrer.
**Warning signs:** New users created via webhook have `hierarchy_depth = 0` (default) instead of parent depth + 1.

## Code Examples

### Whitelist Webhook Route (extracted from index.ts)
```typescript
// Source: existing index.ts POST /api/v1/whitelist + D-01 webhook secret
import { Hono } from 'hono';
import type { Env } from '../lib/types';
import { getUserByPhone, createUser, createWhitelistedSource } from '../lib/queries';

export const whitelistRoutes = new Hono<{ Bindings: Env }>();

whitelistRoutes.post('/', async (c) => {
  // D-01: Webhook secret validation
  const secret = c.req.header('X-Webhook-Secret');
  if (!secret || secret !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: 'Invalid webhook secret' }, 401);
  }

  const body = await c.req.json();
  const { name, reference_id, phone_number, referrer_phone } = body;

  if (!name || !reference_id || !phone_number) {
    return c.json({ error: 'Missing required payload parameters' }, 400);
  }
  if (!referrer_phone) {
    return c.json({ error: 'Referrer phone number required for hierarchy tracking' }, 400);
  }

  try {
    let reporterId: string | null = null;
    let hierarchyDepth = 0;

    const referrer = await getUserByPhone(c.env.DB, referrer_phone);
    if (referrer) {
      reporterId = referrer.id;
      hierarchyDepth = referrer.hierarchyDepth + 1;
    }

    const user = await createUser(c.env.DB, {
      role: 'crony',
      phoneNumber: phone_number,
      reporterId,
    });

    const source = await createWhitelistedSource(c.env.DB, {
      linkedUserId: user.id,
      verifiedName: name,
      referenceId: reference_id,
      approvalStatus: 'approved',
    });

    return c.json({
      status: 'Whitelisted successfully',
      id: source.id,
      hierarchy_depth: hierarchyDepth,
      reporter_id: reporterId,
    }, 201);
  } catch (error: any) {
    const msg = error?.message ?? '';
    if (msg.includes('UNIQUE constraint')) {
      return c.json({ error: 'Phone number already registered' }, 409);
    }
    return c.json({ error: 'Database transaction failed' }, 500);
  }
});
```

### Board Query with RBAC + Status Filter + Pagination
```typescript
// Source: new pattern composing getReportsFilter() + status + offset pagination
// Goes in queries.ts
export async function getBoardReports(
  db: D1Database,
  filter: { whereClause: string; params: string[] },
  options: { status?: ReportStatus; limit?: number; offset?: number }
): Promise<{ reports: Report[]; total: number }> {
  const limit = Math.min(options.limit ?? 100, 100);
  const offset = options.offset ?? 0;

  const whereParts = [filter.whereClause];
  const params = [...filter.params];

  if (options.status) {
    whereParts.push('status = ?');
    params.push(options.status);
  }

  const where = whereParts.length > 0 ? whereParts.join(' AND ') : '1=1';

  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM Reports WHERE ${where}`)
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await db
    .prepare(
      `SELECT * FROM Reports WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all<ReportRow>();

  return {
    reports: results.map(rowToReport),
    total: countResult?.total ?? 0,
  };
}
```

### Status Transition Endpoint
```typescript
// Source: new route using existing updateReportStatus() + isValidTransition()
reportRoutes.post('/:id/status', withUser(), async (c) => {
  const reportId = c.req.param('id');
  const { status } = await c.req.json();

  if (!status || !REPORT_STATUSES.includes(status)) {
    return c.json({ error: `Invalid status. Must be one of: ${REPORT_STATUSES.join(', ')}` }, 400);
  }

  const current = await getReportById(c.env.DB, reportId);
  if (!current) {
    return c.json({ error: 'Report not found' }, 404);
  }

  if (!isValidTransition(current.status, status as ReportStatus)) {
    return c.json({
      error: `Invalid transition: ${current.status} -> ${status}`,
      validTransitions: STATUS_TRANSITIONS[current.status],
    }, 400);
  }

  const updated = await updateReportStatus(c.env.DB, reportId, status as ReportStatus);
  if (!updated) {
    return c.json({ error: 'Failed to update report status' }, 500);
  }

  return c.json({ report: updated }, 200);
});
```

### Image MIME + Size Validation (D-03)
```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// After parseBody
const media = formData.get('media');
if (!media || !(media instanceof File)) {
  return c.json({ error: 'Missing media file' }, 400);
}

if (!ALLOWED_MIME_TYPES.includes(media.type as any)) {
  return c.json({
    error: `Invalid media type: ${media.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
  }, 400);
}

if (media.size > MAX_FILE_SIZE) {
  return c.json({ error: `File too large: ${media.size} bytes. Max: ${MAX_FILE_SIZE} bytes` }, 400);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline routes in index.ts | Modular route files | Phase 2 | New routes follow `routes/*.ts` pattern |
| Phone-in-header auth | SuperTokens Bearer token + withUser() | Phase 2 | Report routes use `withUser()` middleware |
| Raw SQL in routes | queries.ts functions | Phase 1 | All DB access through query functions |
| No RBAC on board | getReportsFilter() | Phase 2 | Board queries use RBAC scoping |

**Deprecated/outdated in index.ts:**
- `POST /api/v1/whitelist` (lines 167-216): No webhook secret, no `createUser()`/`createWhitelistedSource()` usage — extracts to `routes/whitelist.ts`
- `POST /api/v1/reports/harvest` (lines 219-270): Phone-in-header auth, no MIME/size validation — extracts to `routes/reports.ts`
- `GET /api/v2/reports` (lines 275-278): No RBAC, no pagination, no status filter — replaces with `routes/board.ts`
- Local `haversine()` function (lines 367-379): Duplicate of `haversineDistance()` in spatial.ts — remove

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 'approved' status is intentional mismatch with schema — use 'pending' for whitelist-trusted reports | Phase Requirements (RPT-04) | If 'approved' IS needed, schema + types.ts + STATUS_TRANSITIONS all need migration |
| A2 | `createUser()` will be extended to accept `hierarchyDepth` parameter | Pitfall 6 | If not extended, whitelist route must do separate UPDATE |
| A3 | `WEBHOOK_SECRET` will be added to `wrangler.jsonc` vars section | Pitfall 2 | Without it, webhook route fails in deployed env |
| A4 | Offset pagination sufficient for board endpoint (cursor pagination not needed) | Architecture Patterns | If dataset grows large, offset pagination degrades — but capped at 100 reports |

## Open Questions (RESOLVED)

1. **RPT-04 vs Schema: 'approved' vs 'pending' status** — RESOLVED: Use 'pending' per CONTEXT.md. Plans implement pending status. "Auto-approved" means "auto-trusted, skip AI review", not a literal status.

2. **Should old inline routes be removed from index.ts during extraction?** — RESOLVED: Wire new route modules in index.ts. Old inline routes superseded by route module pattern. Old code preserved in git history.

3. **Hierarchy depth update strategy for createUser()** — RESOLVED: Add `hierarchyDepth` param to `createUser()` input type. Plan 01 Task 1 implements this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Package mgmt, script runner | ✓ | 1.3.8 | — |
| node | Vitest runtime | ✓ | 25.5.0 | — |
| wrangler | D1 migrations, type gen | ✓ | 4.80.0 | — |
| vitest | Test runner | ✓ | ~3.2.0 | — |
| D1 (local) | DB via miniflare | ✓ | via vitest pool | — |
| R2 (local) | Object storage | ✓ | via vitest pool | — |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~3.2.0 with @cloudflare/vitest-pool-workers 0.12.4 |
| Config file | `prism-engine/vitest.config.ts` |
| Quick run command | `cd prism-engine && bun vitest run tests/routes/whitelist.test.ts -x` |
| Full suite command | `cd prism-engine && bun vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WHIT-01 | Webhook accepts name, reference_id, phone_number, referrer_phone | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ Wave 0 |
| WHIT-02 | Creates user + whitelisted_source records | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ Wave 0 |
| WHIT-03 | Referrer hierarchy established with depth tracking | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ Wave 0 |
| WHIT-04 | Hierarchy subtree queryable | unit | `bun vitest run tests/lib/queries.test.ts -x` | ✓ existing |
| RPT-01 | Whitelisted user submits report with photo | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-02 | Report captures lat/lon + DIGIPIN | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-03 | Photo uploaded to R2 with UUID key | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-04 | Phase 1 reports enter as pending | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-05 | Invalid payload returns 400 | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-06 | Board returns paginated reports | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ Wave 0 |
| RPT-07 | Nearby reports with radius + distance | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-08 | Reports filterable by status | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ Wave 0 |
| RPT-09 | RBAC scoping on queries | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ Wave 0 |
| RPT-10 | State machine enforces valid transitions | unit | `bun vitest run tests/lib/types.test.ts -x` | ✓ existing |
| RPT-11 | Valid transition chain works | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |
| RPT-12 | Invalid transitions rejected | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd prism-engine && bun vitest run tests/routes/ -x`
- **Per wave merge:** `cd prism-engine && bun vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/whitelist.test.ts` — covers WHIT-01, WHIT-02, WHIT-03
- [ ] `tests/routes/reports.test.ts` — covers RPT-01 through RPT-05, RPT-07, RPT-11, RPT-12
- [ ] `tests/routes/board.test.ts` — covers RPT-06, RPT-08, RPT-09
- [ ] `getBoardReports()` query function in queries.ts — needed by board route
- [ ] `getWhitelistedSourceByUserId()` query function in queries.ts — needed for D-02 check
- [ ] `hierarchyDepth` parameter added to `createUser()` input — needed for WHIT-03
- [ ] `WEBHOOK_SECRET` added to Env type in types.ts — needed for D-01

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | SuperTokens JWT via withUser() middleware |
| V3 Session Management | yes | SuperTokens session tokens, Bearer auth |
| V4 Access Control | yes | requireRole() + getReportsFilter() RBAC middleware |
| V5 Input Validation | yes | Content-Type validation, MIME check, size limit, coordinate range check |
| V6 Cryptography | no | No custom crypto in this phase |

### Known Threat Patterns for Cloudflare Workers + Hono

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook secret bypass | Spoofing | Constant-time comparison for WEBHOOK_SECRET (use `crypto.subtle.timingSafeEqual` or simple === — Workers isolate per-request) |
| SQL injection via RBAC filter | Tampering | `getReportsFilter()` returns hardcoded whereClause strings, all dynamic values are bind params |
| File upload type confusion | Tampering | MIME validation + max size per D-03. Consider magic-byte check for production (Claude's discretion) |
| IDOR on status transitions | Information disclosure | withUser() + RBAC check — verify user has access to the report before allowing status change |
| Pagination abuse (offset bombing) | Denial of Service | Hard limit of 100 results per page, validated limit param |

## Sources

### Primary (HIGH confidence)
- `prism-engine/src/lib/types.ts` — ReportStatus, STATUS_TRANSITIONS, isValidTransition, all Row/App types
- `prism-engine/src/lib/queries.ts` — all query functions including createReport, getNearbyReports, updateReportStatus
- `prism-engine/src/middleware/auth.ts` — withUser() middleware pattern
- `prism-engine/src/middleware/rbac.ts` — getReportsFilter() with role-based WHERE generation
- `prism-engine/src/routes/auth.ts` — route module pattern to follow
- `prism-engine/src/index.ts` — existing inline routes being extracted (lines 167-270)
- `prism-engine/migrations/0001_init_schema.sql` — D1 CHECK constraints for status
- `prism-engine/vitest.config.ts` — test configuration
- `prism-engine/tests/setup.ts` — migration application pattern
- `prism-engine/tests/routes/auth.test.ts` — route test pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-04 — locked implementation choices

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions verified in package.json
- Architecture: HIGH — route module pattern established by Phase 2 auth routes, query layer complete
- Pitfalls: HIGH — verified against actual source code, confirmed schema mismatches
- Requirements mapping: MEDIUM — RPT-04/RPT-11 have 'approved' status conflict needing user confirmation

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack, no fast-moving dependencies)

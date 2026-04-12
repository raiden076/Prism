# Architecture Patterns

**Domain:** Civic infrastructure reporting platform (Cloudflare Workers + Hono.js)
**Researched:** 2026-04-12

## Recommended Architecture

PRISM backend uses a layered architecture inside a single Cloudflare Worker. Hono's `app.route()` grouping enables modular route files that compose into one app. No microservices, no separate Workers. One deployment unit, clean internal boundaries.

```
Request
  |
  v
[Cloudflare Worker Entry (src/index.ts)]
  |
  v
[Global Middleware Stack]
  |-- CORS
  |-- Error Handler
  |-- SuperTokens Session (feature-flagged)
  |
  v
[Route Groups (via app.route())]
  |-- /auth/*        -> auth.routes.ts
  |-- /api/v1/*      -> v1 routes (whitelist, reports, bounties, hierarchy, users)
  |-- /api/v2/*      -> v2 routes (reports, interventions)
  |
  v
[Middleware per Group]
  |-- requireAuth    -> validates session, loads UserContext into c.var
  |-- requireRole()  -> RBAC check against c.var.user
  |-- validateInput  -> Zod schema validation
  |
  v
[Route Handler]
  |-- Extracts validated input
  |-- Calls service layer
  |-- Returns typed response
  |
  v
[Service Layer]
  |-- report.service.ts    -> report CRUD, status transitions, spatial queries
  |-- user.service.ts      -> user lookup, hierarchy traversal, RBAC resolution
  |-- bounty.service.ts    -> bounty claim/complete lifecycle
  |-- intervention.service.ts -> fix submission, drift calc
  |-- media.service.ts     -> R2 upload/download, key generation
  |-- auth.service.ts      -> SuperTokens integration, session mapping
  |
  v
[Data Access Layer]
  |-- db/queries/          -> prepared statement wrappers per domain table
  |     users.queries.ts
  |     reports.queries.ts
  |     interventions.queries.ts
  |     verifications.queries.ts
  |     bounties.queries.ts
  |     whitelist.queries.ts
  |
  v
[Cloudflare Bindings]
  |-- D1 (DB)     -> SQLite relational store
  |-- R2 (VAULT)  -> media blob storage
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/index.ts` | App bootstrap, global middleware, route mounting | All route groups |
| `src/routes/auth.routes.ts` | SuperTokens sign-in/up, sign-out, /auth/me | auth.service |
| `src/routes/whitelist.routes.ts` | Webhook for hierarchy capture, user onboarding | user.service, whitelist.queries |
| `src/routes/report.routes.ts` | Report ingestion (v1 harvest + v2 public), querying, status updates | report.service, media.service |
| `src/routes/intervention.routes.ts` | Contractor fix submission, spatial drift check | intervention.service, report.service |
| `src/routes/verification.routes.ts` | Crony ground-truth verification, bounty verification | verification flow, bounty.service |
| `src/routes/bounty.routes.ts` | Nearby bounties, claim, complete | bounty.service, report.service |
| `src/routes/hierarchy.routes.ts` | Subtree queries, tree visualization | user.service |
| `src/routes/user.routes.ts` | User info, user listing by role | user.service |
| `src/routes/deployment.routes.ts` | Contractor deployment to incident | report.service, intervention.service |
| `src/middleware/auth.ts` | Session validation, UserContext injection | auth.service, user.queries |
| `src/middleware/rbac.ts` | Role-based access filters | UserContext from c.var |
| `src/middleware/validator.ts` | Zod input validation per route | Zod schemas |
| `src/middleware/error-handler.ts` | Global error catch, structured error responses | All routes |
| `src/services/*.ts` | Business logic, state machine enforcement | db/queries, each other |
| `src/db/queries/*.ts` | D1 prepared statement wrappers, no business logic | D1 binding |
| `src/lib/geo.ts` | DIGIPIN encoding, Haversine distance | Called by services |
| `src/lib/supertokens.ts` | SuperTokens SDK init, session helpers | SuperTokens Core |
| `src/types/env.ts` | Env bindings type, Variables type | All files |
| `src/types/models.ts` | DB row interfaces, API request/response types | All files |

### Data Flow

**Report Lifecycle (core value loop):**

```
1. WHITELIST WEBHOOK
   External party system -> POST /api/v1/whitelist
   -> user.service.createUser() + hierarchy lookup
   -> whitelist.queries.insert()
   -> D1 Users + Whitelisted_Sources tables

2. REPORT INGESTION
   Crony app -> POST /api/v1/reports/harvest (multipart)
   -> auth middleware (whitelist check)
   -> media.service.uploadToR2()
   -> geo.encodeDIGIPIN(lat, lon)
   -> report.service.createReport()
   -> D1 Reports table (status: 'approved')

3. CONTRACTOR DEPLOYMENT
   Admin -> POST /api/v1/deployments
   -> report.service.updateStatus('assigned')
   -> D1 Reports.status update

4. FIX SUBMISSION (ACCOUNTABILITY LOOP)
   Contractor -> POST /api/v2/interventions/fix
   -> intervention.service.submitFix()
   -> geo.haversine(original, fix coords)
   -> if drift <= 30m: Reports.status -> 'fixed_pending_verification'
   -> if drift > 30m: reject, flag for review
   -> D1 Interventions table

5. VERIFICATION (GROUND TRUTH)
   Crony -> POST /api/v2/interventions/verify
   OR bounty flow: POST /api/v1/verifications
   -> report.service.updateStatus('resolved' | 'pending_review')
   -> D1 Verifications table

6. BOUNTY LIFECYCLE (PARALLEL PATH)
   Report hits 'fixed_pending_verification' -> bounty auto-created
   Crony -> GET /api/v1/bounties/nearby (location-filtered)
   -> POST /api/v1/bounties/claim (15-min lock)
   -> POST /api/v1/verifications (with drift check)
   -> bounty.service.complete() + reward
```

**Auth Flow:**

```
Client -> POST /auth/signinup (SuperTokens callback)
-> auth.service.resolveOrCreateUser()
-> user.queries.upsertWithHierarchy()
-> SuperTokens.setUserMetadata()
-> return UserContext + session tokens

Client -> GET /auth/me
-> Session.getUserId() from SuperTokens
-> user.queries.findBySuperTokensId()
-> return UserContext

All API calls -> Authorization header
-> auth middleware extracts session
-> loads UserContext into c.var.user
-> RBAC middleware checks c.var.user.role
```

### Directory Structure

```
prism-engine/src/
├── index.ts                          # App entry: global middleware + route mounting
├── types/
│   ├── env.ts                        # Bindings, Variables type defs
│   └── models.ts                     # DB row interfaces, API DTOs
├── routes/
│   ├── auth.routes.ts                # /auth/* endpoints
│   ├── whitelist.routes.ts           # /api/v1/whitelist
│   ├── report.routes.ts             # /api/v1/reports/*, /api/v2/reports
│   ├── intervention.routes.ts        # /api/v2/interventions/*
│   ├── verification.routes.ts        # /api/v1/verifications, /api/v2/interventions/verify
│   ├── bounty.routes.ts              # /api/v1/bounties/*
│   ├── hierarchy.routes.ts           # /api/v1/hierarchy/*
│   ├── user.routes.ts                # /api/v1/users, /api/v2/user/info
│   └── deployment.routes.ts          # /api/v1/deployments
├── middleware/
│   ├── auth.ts                       # Session validation -> c.var.user
│   ├── rbac.ts                       # Role check factory
│   ├── validator.ts                  # Zod schema validation
│   └── error-handler.ts             # Global onError handler
├── services/
│   ├── auth.service.ts               # SuperTokens integration
│   ├── user.service.ts               # User CRUD, hierarchy traversal
│   ├── report.service.ts             # Report lifecycle, status machine
│   ├── intervention.service.ts       # Fix submission, drift calc
│   ├── bounty.service.ts             # Bounty claim/complete lifecycle
│   └── media.service.ts              # R2 operations
├── db/
│   └── queries/
│       ├── users.queries.ts          # Users table prepared statements
│       ├── reports.queries.ts        # Reports table prepared statements
│       ├── interventions.queries.ts  # Interventions table
│       ├── verifications.queries.ts  # Verifications + BountyVerifications
│       ├── bounties.queries.ts       # VerificationBounties table
│       └── whitelist.queries.ts      # Whitelisted_Sources table
├── lib/
│   ├── geo.ts                        # DIGIPIN encoding, Haversine distance
│   ├── supertokens.ts                # SuperTokens SDK init, helpers
│   └── errors.ts                     # Custom error classes (NotFoundError, AuthError, etc.)
└── schemas/
    └── validation.ts                 # Zod schemas for all API inputs
```

## Patterns to Follow

### Pattern 1: Route Group Composition
**What:** Each domain gets its own Hono sub-app, mounted via `app.route()` in index.ts.
**When:** Always. Every new route domain gets a new file.
**Why:** Hono's `app.route('/prefix', subApp)` is the canonical multi-file pattern per [Hono routing docs](https://hono.dev/docs/api/routing#grouping). Keeps routes modular, enables per-group middleware.

```typescript
// src/index.ts
import { Hono } from 'hono';
import type { AppEnv } from './types/env';
import { authRoutes } from './routes/auth.routes';
import { reportRoutes } from './routes/report.routes';
import { bountyRoutes } from './routes/bounty.routes';
// ...

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', cors());
app.use('*', errorHandler);
app.use('*', superTokensSession);

// Mount route groups
app.route('/auth', authRoutes);
app.route('/api/v1/reports', reportRoutes);
app.route('/api/v1/bounties', bountyRoutes);
// ...

export default app;
```

### Pattern 2: Typed createMiddleware with Variables
**What:** Use `createMiddleware` from `hono/factory` with typed Variables for auth context injection. Per [Hono middleware docs](https://hono.dev/docs/guides/middleware#extending-the-context-in-middleware).
**When:** Every middleware that passes data to route handlers.
**Why:** Type-safe `c.get()` / `c.set()` eliminates casting and runtime bugs. Chained `.use()` calls auto-merge Variable types per [Hono type inference docs](https://hono.dev/docs/guides/middleware#type-inference-across-chained-middleware).

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/env';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await resolveSession(c.req.raw, c.env);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const user = await UserService.findBySession(session, c.env.DB);
  if (!user) return c.json({ error: 'User not found' }, 404);

  c.set('user', user);
  await next();
});
```

### Pattern 3: Service Layer (thin routes, fat services)
**What:** Route handlers extract input, call service, return response. All business logic in service files.
**When:** Always. Routes never contain business logic or direct DB queries.
**Why:** Services are testable in isolation with mock D1. Routes are trivial integration glue.

```typescript
// src/routes/report.routes.ts
const reportRoutes = new Hono<AppEnv>();

reportRoutes.post('/harvest', requireAuth, requireWhitelisted, async (c) => {
  const user = c.get('user');
  const formData = await c.req.formData();
  const input = parseHarvestInput(formData); // validation

  const report = await ReportService.harvest(input, user, c.env);
  return c.json(report, 200);
});

// src/services/report.service.ts
export const ReportService = {
  async harvest(input: HarvestInput, user: UserContext, env: Env) {
    const mediaKey = await MediaService.upload(input.media, env.VAULT);
    const digipin = encodeDIGIPIN(input.latitude, input.longitude);
    const reportId = crypto.randomUUID();

    await ReportsQueries.insert(env.DB, {
      id: reportId,
      reporter_id: user.id,
      latitude: input.latitude,
      longitude: input.longitude,
      digipin,
      r2_image_url: `r2://${mediaKey}`,
      status: 'approved',
    });

    return { id: reportId, digipin, status: 'approved' };
  },
};
```

### Pattern 4: Query Layer (prepared statements only)
**What:** Each table gets a queries file with prepared statement wrappers. No raw SQL in services.
**When:** All D1 interactions.
**Why:** Prevents SQL injection via type-checked params. Centralizes query text for audit. Enables `D1.batch()` for multi-statement transactions.

```typescript
// src/db/queries/reports.queries.ts
export const ReportsQueries = {
  insert: (db: D1Database, params: ReportInsertParams) =>
    db.prepare(
      'INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(params.id, params.reporter_id, params.latitude, params.longitude, params.digipin, params.r2_image_url, params.status).run(),

  updateStatus: (db: D1Database, id: string, status: ReportStatus) =>
    db.prepare('UPDATE Reports SET status = ? WHERE id = ?').bind(status, id).run(),

  findById: (db: D1Database, id: string) =>
    db.prepare('SELECT * FROM Reports WHERE id = ?').bind(id).first(),

  findNearby: (db: D1Database, status: ReportStatus[], limit: number) =>
    db.prepare('SELECT * FROM Reports WHERE status IN (?, ?, ?, ?) ORDER BY created_at DESC LIMIT ?')
      .bind(...status, limit).all(),
};
```

### Pattern 5: D1 Batch for Transactions
**What:** Use `D1.batch()` for multi-table writes that must succeed or fail atomically.
**When:** Creating user + whitelist entry simultaneously, bounty claim + status update, verification + report status change.
**Why:** `D1.batch()` wraps all statements in an implicit transaction. If any fail, all roll back. Eliminates partial-write bugs.

```typescript
// Example: whitelist webhook (user + source in one transaction)
await db.batch([
  db.prepare('INSERT INTO Users (id, role, phone_number, reporter_id, hierarchy_depth) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, 'crony', phone, reporterId, depth),
  db.prepare('INSERT INTO Whitelisted_Sources (id, linked_user_id, verified_name, reference_id, approval_status) VALUES (?, ?, ?, ?, ?)')
    .bind(sourceId, userId, name, referenceId, 'approved'),
]);
```

### Pattern 6: Report Status State Machine
**What:** Enforce valid status transitions in `report.service.ts`. Status changes go through a single `transitionStatus()` function.
**When:** Any report status update.
**Why:** Prototype had status updates scattered across routes with no validation. Illegal transitions (e.g., 'resolved' -> 'pending') would corrupt board state.

```typescript
// src/services/report.service.ts
const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  pending: ['approved', 'rejected'],
  pending_review: ['approved', 'rejected'],
  approved: ['assigned'],
  assigned: ['fixed_pending_verification'],
  fixed_pending_verification: ['resolved', 'pending_review'],
  resolved: [], // terminal state
  rejected: [], // terminal state
};

export function transitionStatus(current: ReportStatus, next: ReportStatus): ReportStatus {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new InvalidTransitionError(current, next);
  }
  return next;
}
```

### Pattern 7: Feature Flag Pattern for SuperTokens
**What:** `USE_SUPERTOKENS_AUTH` env var gates SuperTokens middleware. Legacy phone-in-header auth remains as fallback.
**When:** Gradual rollout. Remove once SuperTokens is fully validated.
**Why:** Prototype already has this pattern. Preserve it during rewrite for safe migration.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Business Logic in Route Handlers
**What:** Routes that contain D1 queries, status transitions, or calculation logic.
**Why bad:** Untestable in isolation. Duplicates logic across routes. Changes require touching multiple files.
**Instead:** Routes call service functions. Services contain all logic. Queries files contain all SQL.

### Anti-Pattern 2: Monolithic index.ts
**What:** All routes, helpers, types in one file (current prototype: 1700 lines).
**Why bad:** Merge conflicts on team changes. Can't find anything. Circular dependency risk. Hard to test.
**Instead:** One file per route domain, one per service, one per query collection.

### Anti-Pattern 3: Direct D1 Queries Outside Query Layer
**What:** `c.env.DB.prepare('SELECT...')` scattered in routes or services.
**Why bad:** No centralized query audit. Hard to optimize. SQL injection risk increases.
**Instead:** All SQL lives in `src/db/queries/*.ts`. Services call query functions.

### Anti-Pattern 4: Skipping Input Validation
**What:** Accepting raw `c.req.json()` or `c.req.formData()` without schema validation.
**Why bad:** Prototype had no validation. Malformed data reaches DB. Runtime crashes on missing fields.
**Instead:** Zod schemas for every endpoint. Validation middleware rejects before handler runs.

### Anti-Pattern 5: Unbounded Distance Queries
**What:** `SELECT * FROM Reports` then filter in JS with Haversine (current prototype pattern).
**Why bad:** Full table scan on every request. Scales linearly with report count. D1 query size limit.
**Instead:** For v1, accept this with a reasonable LIMIT. For future, pre-compute DIGIPIN-based geohash prefixes for coarse filtering before Haversine refinement.

### Anti-Pattern 6: Race Conditions on Bounty Claims
**What:** Read bounty status, check availability, then update (TOCTOU race).
**Why bad:** Two cronies could claim same bounty simultaneously.
**Instead:** Use D1's atomic `UPDATE ... SET status = 'claimed' WHERE id = ? AND status = 'available'` pattern. Check `meta.changes` to confirm exactly 1 row updated.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 100K+ users |
|---------|--------------|--------------|----------------|
| D1 query perf | Single Worker, low latency, no issues | Add indexes on Reports.status, Reports.reporter_id, Users.phone_number. Use LIMIT on all list queries | Migrate to read replicas or Hyperdrive for connection pooling |
| R2 media storage | Negligible cost | Monitor PUT costs, add upload size limits | Add Cloudflare Images for auto-resize, signed URLs for access control |
| Nearby reports query | Full scan + JS filter OK with LIMIT 100 | Add DIGIPIN prefix index for coarse geo-filter before Haversine | Consider Cloudflare KV geo-index or external spatial DB |
| SuperTokens session | Managed core handles easily | Ensure session cache warm | Evaluate self-hosted SuperTokens core for latency control |
| Concurrent bounty claims | D1 row-level locking sufficient | Same pattern, monitor contention | Queue-based claim system |
| Report status transitions | In-process state machine | Same | Same (state machine is CPU-bound, not I/O) |

## Build Order (Dependency-Aware)

Components must be built in this order based on what depends on what:

```
Phase 1: Foundation (no external dependencies)
  1. src/types/env.ts              -- AppEnv type (Bindings + Variables)
  2. src/types/models.ts           -- DB row interfaces, DTOs
  3. src/lib/geo.ts                -- DIGIPIN + Haversine (pure functions, no deps)
  4. src/lib/errors.ts             -- Custom error classes
  5. src/schemas/validation.ts     -- Zod schemas for all inputs
  6. src/db/queries/*.queries.ts   -- All query wrappers (depends on models.ts)
  7. src/middleware/error-handler.ts -- Global error handler

Phase 2: Auth Layer (depends on Phase 1)
  8. src/lib/supertokens.ts         -- SuperTokens SDK init (preserve from prototype)
  9. src/services/auth.service.ts   -- Auth resolution logic
  10. src/middleware/auth.ts        -- requireAuth middleware
  11. src/middleware/rbac.ts        -- requireRole middleware factory
  12. src/middleware/validator.ts   -- Zod validation middleware
  13. src/routes/auth.routes.ts     -- /auth/* endpoints

Phase 3: Core Domain Services (depends on Phase 1 + 2)
  14. src/services/user.service.ts      -- User CRUD, hierarchy
  15. src/services/media.service.ts     -- R2 operations
  16. src/services/report.service.ts    -- Report lifecycle + state machine
  17. src/services/intervention.service.ts -- Fix submission + drift
  18. src/services/bounty.service.ts    -- Bounty lifecycle

Phase 4: Route Wiring (depends on Phase 1-3)
  19. src/routes/whitelist.routes.ts    -- Whitelist webhook
  20. src/routes/report.routes.ts       -- Report endpoints
  21. src/routes/intervention.routes.ts -- Fix endpoints
  22. src/routes/verification.routes.ts -- Verify endpoints
  23. src/routes/bounty.routes.ts       -- Bounty endpoints
  24. src/routes/hierarchy.routes.ts    -- Hierarchy tree
  25. src/routes/user.routes.ts         -- User info
  26. src/routes/deployment.routes.ts   -- Contractor deploy
  27. src/index.ts                      -- Mount everything + global middleware

Phase 5: Migration + Schema Alignment (parallel with Phase 1-4)
  28. migrations/0002_add_missing_columns.sql  -- Add hierarchy_depth, reporter_id, supertokens_user_id to Users
  29. migrations/0003_add_bounty_tables.sql    -- VerificationBounties + BountyVerifications tables
  30. migrations/0004_add_indexes.sql          -- Performance indexes
```

**Dependency graph:**
```
types/models -> db/queries -> services -> routes -> index.ts
types/env --------^              ^
lib/geo -------------------------|
lib/errors ----------^           |
lib/supertokens -----------> auth.service -> auth middleware -> auth routes
schemas/validation -> validator middleware -> all routes
```

## Key Architectural Decisions

### Decision 1: Single Worker, Not Microservices
**Why:** PRISM serves a single government deployment (West Bengal). One Worker reduces latency (no inter-Worker network calls), simplifies deployment, and keeps D1 queries local. The modular route structure inside one Worker gives code separation without operational complexity.

### Decision 2: Service Layer Over Direct DB Access
**Why:** Services encapsulate state machine logic (report status transitions), spatial calculations (Haversine thresholds), and cross-table operations (whitelist + user creation in batch). Testing services with mock D1 is straightforward. Testing route handlers that contain DB logic is not.

### Decision 3: Durable Objects REMOVED from v1 Scope
**Why:** Prototype used a Durable Object (`ContractorLocationObject`) for real-time WebSocket contractor tracking. This is explicitly out of scope per PROJECT.md. Remove from architecture. Contractor tracking is simple status fields on Interventions table.

### Decision 4: Zod for Input Validation
**Why:** Prototype had zero input validation. Every endpoint accepted raw JSON/form-data. Zod provides compile-time type inference from schemas, runtime validation, and clear error messages. One schema definition feeds both validation and TypeScript types.

### Decision 5: Query Files, Not ORM
**Why:** D1 is SQLite. PRISM has 6 tables. An ORM adds bundle size to a Worker (size-limited at 1MB compressed). Raw prepared statements are faster, smaller, and give full SQL control. The query layer provides structure without ORM overhead.

## Sources

- [Hono Routing API](https://hono.dev/docs/api/routing) -- Route grouping, app.route(), basePath (HIGH confidence, official docs)
- [Hono Middleware Guide](https://hono.dev/docs/guides/middleware) -- createMiddleware, Variables, type inference across chains (HIGH confidence, official docs)
- Prototype source code analysis -- `/home/arkaprav0/Prism/prism-engine/src/index.ts` (1691 lines)
- Migration schema -- `/home/arkaprav0/Prism/prism-engine/migrations/0001_init_schema.sql`
- SuperTokens lib -- `/home/arkaprav0/Prism/prism-engine/src/lib/supertokens.ts`
- Durable Object -- `/home/arkaprav0/Prism/prism-engine/src/contractor-locations.ts` (to be removed from v1)
- PROJECT.md -- `/home/arkaprav0/Prism/.planning/PROJECT.md`

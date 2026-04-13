# Phase 2: Auth + RBAC - Research

**Researched:** 2026-04-13
**Domain:** SuperTokens authentication, RBAC middleware, Cloudflare Workers runtime compatibility
**Confidence:** MEDIUM

## Summary

Phase 2 delivers phone OTP auth via SuperTokens, session management, RBAC middleware, and hierarchy-scoped access control on Cloudflare Workers. The existing codebase already has significant scaffolding (`supertokens.ts` init/helpers, `queries.ts` user lookups, auth routes in `index.ts`), but a critical compatibility gap exists: `supertokens-node` v24.0.2 fails to load in the Cloudflare Workers runtime (both production and Vitest miniflare) because its dependency `libphonenumber-js/max` uses CJS syntax incompatible with V8 isolates. Two of three existing SuperTokens test files fail with `SyntaxError: Unexpected token ':'`.

The existing code also has a runtime bug: `Session.getSession(c.req.raw, ...)` passes a Web API `Request` object to the SDK, which expects a `BaseRequest`-compatible object with `getHeaderValue`/`getCookieValue` methods. With `framework: "custom"`, the SDK does NOT auto-wrap raw requests -- the caller must provide a compliant wrapper. This means session validation will fail at runtime.

**Primary recommendation:** Spike two approaches in parallel: (A) wrap `supertokens-node` calls behind a thin adapter that uses `PreParsedRequest` from the custom framework module, testing whether `nodejs_compat` + bundler resolves the CJS issue; (B) bypass `supertokens-node` Session/Passwordless SDK entirely and call the SuperTokens Core REST API directly via `fetch()` from Workers, using `jose` for JWT verification. Pick whichever approach passes a minimal end-to-end test in miniflare first.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Research compatibility first -- study `supertokens-node` Workers compatibility via docs/web before writing code. Understand runtime constraints (V8 isolates, `nodejs_compat` flag limits, missing Node APIs) before building.
- **D-02:** SMS now, WhatsApp later. Start with SuperTokens managed SMS delivery. Keep existing `supertokens.ts` SMS override, structure code to accept additional channels cleanly.
- **D-03:** Header-based token transfer (`Authorization` header). Existing code already uses `tokenTransferMethod: 'header'`. Workers don't handle cookies natively -- header-based avoids cookie complexity.
- **D-04:** Session config: 15min access token + 7day refresh token (keep existing).
- **D-05:** Hono middleware chains for RBAC. Composable pattern: `withUser()` attaches authenticated user to context, `requireRole('admin')` enforces role check.
- **D-06:** Recursive CTE hierarchy query in `queries.ts` as `getDescendantIds(db, userId)`. Called by RBAC middleware when hierarchy-scoped access needed.
- **D-07:** Drop legacy phone-in-header auth entirely. SuperTokens only from Phase 2 onward.
- **D-08:** Per-request DB lookup for user resolution. Middleware resolves SuperTokens session userId -> D1 Users row on every request, cached on Hono context.
- **D-09:** Auto-create D1 user on first successful OTP verification. SuperTokens `onUserSignUp` fires -> API layer creates D1 `Users` row with `crony` role default + links `supertokens_user_id`.
- **D-10:** Link via `supertokens_user_id` column (migration 0004 already adds it). `getUserBySuperTokensId()` in queries.ts already queries this mapping.
- **D-11:** If user exists in D1 but has no `supertokens_user_id` -- link on first SuperTokens login. Upsert pattern: check by phone first, if found update `supertokens_user_id`; if not found, create new user.
- **D-12:** Extract `/auth/*` routes to separate module (e.g., `prism-engine/src/routes/auth.ts`). Keep `index.ts` as route aggregator.
- **D-13:** Clean cutover from legacy auth -- no dual auth. Delete old `/api/v2/auth/verify` (OTPLEss) and `/api/v2/user/info` (phone header).
- **D-14:** Auth routes follow `/auth/` prefix convention.

### Claude's Discretion
- Exact middleware file organization (single file vs split by concern)
- Error response format for auth failures (consistent with Phase 1 patterns)
- Auth analytics integration (existing `auth-analytics.ts` -- wire it in or defer)
- Feature flag integration (existing `feature-flags.ts` -- wire it in or defer)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can authenticate via phone OTP through SuperTokens | SuperTokens Passwordless recipe with PHONE contact method. OTP initiation via `Passwordless.createCode()` or Core REST API. OTP verification via `Passwordless.consumeCode()` or Core REST API. See "Standard Stack" and "Code Examples". |
| AUTH-02 | User session persists across requests via SuperTokens session management | Session recipe with `tokenTransferMethod: 'header'`. Access token in `Authorization: Bearer <jwt>` header. Refresh via dedicated endpoint. `Session.getSession()` or JWT verification via `jose`. |
| AUTH-03 | New user auto-created on first successful OTP verification (crony role default) | Upsert pattern: on OTP success, check D1 by phone -> if found, link `supertokens_user_id` -> if not found, create with `crony` role. Existing `createUser()` in queries.ts handles insertion. |
| AUTH-04 | User can sign out, revoking SuperTokens session | `Session.revokeSession()` or Core REST API `POST /recipe/session/signout`. Route: `POST /auth/signout`. |
| RBAC-01 | Admin role sees all reports and can manage users | `requireRole('admin')` middleware returns `{ whereClause: '1=1', params: [] }`. Existing pattern in index.ts line 138-139. |
| RBAC-02 | Contractor role sees only assigned reports | `requireRole('contractor')` returns `{ whereClause: 'id IN (SELECT report_id FROM Interventions WHERE contractor_id = ?)', params: [user.id] }`. Existing pattern in index.ts line 143-148. |
| RBAC-03 | Crony role sees own reports and bounties available for verification | `requireRole('crony')` returns `{ whereClause: '(reporter_id = ? OR id IN (SELECT report_id FROM Verifications WHERE verifier_id = ?))' }`. Existing pattern in index.ts line 160-164. |
| RBAC-04 | RBAC middleware enforces permissions on all protected routes | Hono middleware chain: `withUser()` + `requireRole()`. Composable: `app.get('/reports', withUser(), requireRole('admin'), handler)`. D-05 decision. |
| RBAC-05 | Hierarchy-scoped access -- masters/region heads see reports from their subtree | Recursive CTE via `supervisor_id` (queries.ts) or `reporter_id` (index.ts). `getDescendantIds(db, userId)` returns subtree user IDs. D-06 decision. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `supertokens-node` | 24.0.2 | Auth SDK (Passwordless + Session) | Locked decision D-01/D-02/D-03. Existing code already uses it. |
| `hono` | ^4.12.8 | HTTP framework | Existing project standard. Middleware chains for RBAC. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jose` | ^4.13.1 (installed via supertokens-node) | JWT verification | If bypassing supertokens-node Session SDK, use for independent JWT verification. Already in node_modules. |
| `@cloudflare/vitest-pool-workers` | 0.12.4 | Test environment | All backend tests use miniflare runtime. |
| `vitest` | ~3.2.0 | Test framework | Project standard. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `supertokens-node` SDK in Workers | SuperTokens Core REST API via `fetch()` | REST API bypasses Node.js dependency issues. More manual JWT/session handling but full Workers compatibility. `[ASSUMED]` |
| `supertokens-node` SDK in Workers | `jose` for JWT decode + SuperTokens Core for verification | Lighter runtime footprint. Must manually handle refresh flow. `[ASSUMED]` |

**Installation:**
```bash
# Already installed -- no new packages needed for core auth
# If using jose directly (fallback approach):
# npm install jose  # Already transitive dep of supertokens-node
```

**Version verification:**
```bash
npm view supertokens-node version  # 24.0.2 (verified 2026-04-13)
npm view hono version              # (already installed ^4.12.8)
npm view jose version              # (already installed ^4.13.1 via supertokens-node)
```

## Architecture Patterns

### Recommended Project Structure
```
prism-engine/src/
├── index.ts                    # Route aggregator (imports route modules)
├── routes/
│   └── auth.ts                 # /auth/* route handlers (signinup, me, signout)
├── middleware/
│   ├── auth.ts                 # withUser(), requireAuth() middleware
│   └── rbac.ts                 # requireRole(), getReportsFilter() middleware
├── lib/
│   ├── supertokens.ts          # SuperTokens init + session helpers (existing)
│   ├── supertokens-adapter.ts  # Web Request -> BaseRequest adapter (NEW)
│   ├── queries.ts              # D1 query layer (existing, add linkSuperTokensUserId)
│   ├── types.ts                # Type definitions (existing)
│   ├── auth-analytics.ts       # Auth metrics (existing, discretionary wiring)
│   └── feature-flags.ts        # Feature flag manager (existing, discretionary wiring)
```

### Pattern 1: Web Request Adapter for SuperTokens Custom Framework
**What:** Wrap Web API `Request` in a `BaseRequest`-compatible object for `supertokens-node`'s custom framework mode.
**When to use:** Every call to `Session.getSession()` or `Session.revokeSession()` from a Hono handler.
**Why:** The SDK's `framework: "custom"` mode does NOT auto-wrap raw `Request` objects. It expects `getHeaderValue()`, `getCookieValue()`, `getOriginalURL()`, `getMethod()` methods. The Web API `Request` uses `headers.get()` instead. `[VERIFIED: source code inspection of supertokens-node/lib/build/framework/custom/framework.js and sessionRequestFunctions.js]`
**Example:**
```typescript
// Source: [VERIFIED from supertokens-node source code inspection]
// prism-engine/src/lib/supertokens-adapter.ts
import { PreParsedRequest, CollectingResponse } from 'supertokens-node/framework/custom';

interface WebRequestLike {
  headers: Headers;
  url: string;
  method: string;
  cookies?: Record<string, string>;
}

function toBaseRequest(webReq: WebRequestLike) {
  return new PreParsedRequest({
    method: webReq.method,
    url: webReq.url,
    headers: webReq.headers,  // Web Headers object -- PreParsedRequest calls .get()
    cookies: webReq.cookies ?? parseCookies(webReq.headers.get('cookie')),
    getJSONBody: async () => { /* lazy parse */ },
    getFormBody: async () => { /* lazy parse */ },
    query: Object.fromEntries(new URL(webReq.url).searchParams),
  });
}
```

### Pattern 2: Composable Hono Middleware for RBAC
**What:** `withUser()` resolves session -> D1 user, `requireRole()` enforces access.
**When to use:** All protected routes.
**Example:**
```typescript
// prism-engine/src/middleware/auth.ts
import type { Context, Next } from 'hono';
import type { Env, User, UserRole } from '../lib/types';

// Augment Hono context with user
type AuthVariables = {
  user: User;
  supertokensUserId: string;
};

export function withUser() {
  return async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
    // 1. Extract session from request
    const stUserId = await getUserIdFromSession(c.req.raw);
    if (!stUserId) return c.json({ error: 'Unauthorized' }, 401);

    // 2. Lookup D1 user by supertokens_user_id
    const user = await getUserBySuperTokensId(c.env.DB, stUserId);
    if (!user) return c.json({ error: 'User not found' }, 404);

    // 3. Cache on context
    c.set('user', user);
    c.set('supertokensUserId', stUserId);
    await next();
  };
}

// prism-engine/src/middleware/rbac.ts
export function requireRole(...roles: UserRole[]) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
```

### Pattern 3: Upsert User on First Login
**What:** On successful OTP, check D1 by phone -> link or create.
**When to use:** `/auth/signinup` route handler.
**Example:**
```typescript
// In auth route handler after OTP verification succeeds
const existingUser = await getUserByPhone(db, phoneNumber);
if (existingUser) {
  if (!existingUser.supertokensUserId) {
    await linkSuperTokensUserId(db, existingUser.id, stUserId);
  }
  return existingUser;
}
const newUser = await createUser(db, { role: 'crony', phoneNumber });
await linkSuperTokensUserId(db, newUser.id, stUserId);
return newUser;
```

### Anti-Patterns to Avoid
- **Passing raw Web `Request` to `Session.getSession()`:** SDK expects `BaseRequest` with `getHeaderValue()`. Must wrap via `PreParsedRequest`. `[VERIFIED: source code inspection]`
- **Calling `initSuperTokens()` on every request:** Current index.ts line 41-55 calls `SuperTokens.init()` on every request. `SuperTokens.init()` is a singleton -- repeated calls are no-ops, but the middleware creation (`createSuperTokensMiddleware()`) runs every time. Move init to Worker global scope. `[VERIFIED: source code inspection of supertokens-node/lib/build/supertokens.ts -- init checks for existing instance]`
- **Using `process.env` in Workers:** `supertokens.ts` line 60 uses `process.env.NODE_ENV`. Workers don't have `process` by default. `nodejs_compat` provides a polyfill but it's unreliable. Use Hono env bindings instead. `[VERIFIED: code inspection]`
- **Dual auth (SuperTokens + legacy phone header):** D-07 says drop legacy. Don't implement fallback to phone-in-header auth. `[LOCKED: D-07]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification | Custom JWT decode + verify | `jose` library (already installed) | Edge cases: algorithm validation, expiry, key rotation, claims verification |
| OTP delivery | Custom SMS sending | SuperTokens managed delivery or `Passwordless.createCode()` | Twilio integration, rate limiting, phone number formatting, delivery receipts |
| Session management | Custom token creation/refresh | SuperTokens Session recipe | Refresh token rotation, anti-CSRF, session revocation, concurrent session handling |
| Password hashing/verification | Custom crypto | N/A (OTP only, no passwords) | Not needed for phone OTP flow |
| Role-based query filters | Inline WHERE clauses in handlers | Middleware returning `{ whereClause, params }` | Existing pattern in index.ts. Extract to reusable middleware. |

**Key insight:** Auth is a deceptively complex domain. Token expiry edge cases, refresh race conditions, session revocation propagation, and CSRF protection all have subtle bugs. Use SuperTokens for the heavy lifting -- but recognize that its Node.js SDK may not work in Workers directly.

## Runtime State Inventory

> Not a rename/refactor phase. Skipping.
> However, note: `getDescendantIds` in index.ts uses `reporter_id` for hierarchy traversal (line 124), while `getUserDescendants` in queries.ts uses `supervisor_id` (line 114). These are two different hierarchy models. Phase must reconcile which is canonical. See Open Questions.

## Common Pitfalls

### Pitfall 1: supertokens-node CJS Dependencies Fail in Workers
**What goes wrong:** `libphonenumber-js/max/index.cjs` uses CJS syntax that V8 isolates cannot parse, causing `SyntaxError: Unexpected token ':'`.
**Why it happens:** `supertokens-node` bundles Node.js-specific dependencies. `nodejs_compat` flag does not make all Node.js patterns work in V8 isolates.
**How to avoid:** Test with actual miniflare/Vitest Workers runtime BEFORE building auth features. Run a spike that imports `supertokens-node` and calls `init()`.
**Warning signs:** `SyntaxError` on import, `require is not defined`, `process is not defined`.
**Status:** CONFIRMED. Two existing test files fail: `tests/supertokens-init.test.ts` and `tests/supertokens-session.test.ts`. Error trace: `libphonenumber-js/max/index.cjs:3:16`. `[VERIFIED: test run 2026-04-13]`

### Pitfall 2: Session.getSession() Called with Wrong Request Type
**What goes wrong:** `Session.getSession(c.req.raw, { sessionRequired: false })` fails because Web API `Request` lacks `getHeaderValue()` method.
**Why it happens:** With `framework: "custom"`, the SDK does NOT wrap the request. It expects a `BaseRequest`-compatible object. The existing code passes raw `c.req.raw` which is a standard Web API `Request`.
**How to avoid:** Create a `WebRequestAdapter` that wraps `c.req.raw` in a `PreParsedRequest` from `supertokens-node/framework/custom`. Or use `Session.getSessionWithoutRequestResponse()` with raw token strings.
**Warning signs:** `req.getHeaderValue is not a function` or similar TypeError at runtime.
**Status:** CONFIRMED via source code inspection. `[VERIFIED: supertokens-node/lib/build/recipe/session/sessionRequestFunctions.js line 30-37]`

### Pitfall 3: initSuperTokens() Called Per-Request
**What goes wrong:** Unnecessary overhead + potential race conditions with singleton initialization.
**Why it happens:** Current index.ts lines 41-55 call `initSuperTokens()` inside a `*` middleware that runs on every request.
**How to avoid:** Call `initSuperTokens()` once at module level or in Worker global scope. The SDK uses singleton pattern internally.
**Warning signs:** None visible (it works due to singleton guard) but wastes CPU cycles.

### Pitfall 4: Two Hierarchy Models Conflict
**What goes wrong:** `getDescendantIds` in index.ts traverses via `reporter_id`, while `getUserDescendants` in queries.ts traverses via `supervisor_id`. Different subtree results.
**Why it happens:** Two independent implementations written at different times.
**How to avoid:** Standardize on ONE hierarchy model. D-06 says "recursive CTE hierarchy query in `queries.ts`". The `supervisor_id` column is the proper hierarchy FK (migration 0002). `reporter_id` is for referral tracking, not organizational hierarchy.
**Warning signs:** Wrong users see wrong reports. RBAC filter returns unexpected results.

### Pitfall 5: Test Environment Incompatibility
**What goes wrong:** Tests that import `supertokens-node` fail in Vitest Workers pool.
**Why it happens:** `@cloudflare/vitest-pool-workers` uses miniflare which simulates V8 isolates. `supertokens-node`'s dependencies (especially `libphonenumber-js`) use CJS patterns incompatible with this runtime.
**How to avoid:** Either (A) mock `supertokens-node` in tests, or (B) use the Core REST API approach which only needs `fetch()`. Auth route tests can test middleware logic without loading the actual SDK.
**Warning signs:** Test suite fails with syntax errors from node_modules.
**Status:** CONFIRMED. `tests/worker.ts` explicitly says "Avoids loading full src/index.ts which pulls in supertokens-node (incompatible with Vitest Workers runtime)." `[VERIFIED: code inspection]`

## Code Examples

### SuperTokens Core REST API Approach (Fallback)
```typescript
// If supertokens-node SDK fails in Workers, call Core API directly
// Source: [ASSUMED -- based on SuperTokens Core API docs knowledge]

const CORE_URL = env.SUPERTOKENS_CORE_URL;
const API_KEY = env.SUPERTOKENS_API_KEY;

// Create OTP code
async function createOTP(phoneNumber: string) {
  const res = await fetch(`${CORE_URL}/recipe/passwordless/code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': API_KEY,
      'rid': 'passwordless',
    },
    body: JSON.stringify({ phoneNumber }),
  });
  return res.json();
}

// Verify OTP
async function consumeOTP(phoneNumber: string, userInputCode: string, deviceId: string) {
  const res = await fetch(`${CORE_URL}/recipe/passwordless/consumeCode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': API_KEY,
      'rid': 'passwordless',
    },
    body: JSON.stringify({ phoneNumber, userInputCode, deviceId }),
  });
  return res.json(); // Returns { status: 'OK', user, createdNewUser, session }
}

// Verify session from access token
import { jwtVerify } from 'jose';
async function verifySession(accessToken: string) {
  // Fetch JWT signing key from SuperTokens Core
  const keysRes = await fetch(`${CORE_URL}/.well-known/jwks.json`);
  const { keys } = await keysRes.json();
  const { payload } = await jwtVerify(accessToken, keys[0]);
  return payload; // Contains userId, sessionHandle, etc.
}
```

### withUser() Middleware Pattern
```typescript
// Source: [VERIFIED from existing index.ts getUserFromAuth + Hono patterns]
import type { Context, Next } from 'hono';
import { getUserBySuperTokensId } from '../lib/queries';

export function withUser() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const accessToken = authHeader.slice(7);

    // Option A: Via supertokens-node SDK (if Workers-compatible)
    // const session = await Session.getSession(wrappedRequest, ...);

    // Option B: Via jose JWT verification (fallback)
    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const stUserId = payload.userId as string;
    const user = await getUserBySuperTokensId(c.env.DB, stUserId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    c.set('user', user);
    c.set('supertokensUserId', stUserId);
    await next();
  };
}
```

### RBAC getReportsFilter Extracted to Middleware
```typescript
// Source: [VERIFIED from existing index.ts lines 136-164]
import { getUserDescendants } from '../lib/queries';

export function getReportsFilter(
  role: UserRole,
  userId: string,
  db: D1Database
): Promise<{ whereClause: string; params: string[] }> {
  switch (role) {
    case 'admin':
      return Promise.resolve({ whereClause: '1=1', params: [] });
    case 'contractor':
      return Promise.resolve({
        whereClause: 'id IN (SELECT report_id FROM Interventions WHERE contractor_id = ?)',
        params: [userId],
      });
    case 'crony':
      return Promise.resolve({
        whereClause: '(reporter_id = ? OR id IN (SELECT report_id FROM Verifications WHERE verifier_id = ?))',
        params: [userId, userId],
      });
    default:
      // Hierarchy-scoped: get subtree via supervisor_id CTE
      return getUserDescendants(db, userId).then((descendants) => {
        const ids = descendants.map(d => d.id);
        const placeholders = ids.map(() => '?').join(',');
        return { whereClause: `reporter_id IN (${placeholders})`, params: ids };
      });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy OTPless phone-in-header auth | SuperTokens Passwordless OTP | Phase 2 (D-07) | All auth routes rewritten. No dual auth. |
| Inline auth in index.ts monolith | Extracted middleware + route modules | Phase 2 (D-12) | `withUser()`, `requireRole()` as composable middleware |
| `reporter_id` hierarchy traversal | `supervisor_id` recursive CTE | Pre-Phase 2 | Proper organizational hierarchy vs referral tracking |
| Cookie-based sessions | Header-based (`Authorization: Bearer`) | Phase 1 (D-03) | Workers don't handle cookies natively |

**Deprecated/outdated:**
- `/api/v2/auth/verify` (OTPLEss): Delete per D-13
- `/api/v2/user/info` (phone header): Delete per D-13
- `getUserFromAuth()` dual auth: Replace with `withUser()` middleware per D-07/D-08
- `getDescendantIds()` via `reporter_id`: Use `getUserDescendants()` via `supervisor_id` per D-06

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SuperTokens Core REST API is callable from Workers via `fetch()` | Code Examples | If Core API has CORS/IP restrictions, direct REST calls may fail. Verify with actual Core instance. |
| A2 | `jose` library (already transitive dep) works in Workers runtime for JWT verification | Code Examples | If `jose` v4 has Workers issues, need alternative. `jose` v5 is edge-compatible; v4 may need verification. |
| A3 | SuperTokens Core exposes `.well-known/jwks.json` for JWT key verification | Code Examples | If not available, must use different key discovery mechanism. |
| A4 | `supertokens-node` can work in Workers with proper request wrapping IF the CJS import issue is resolved | Architecture | If libphonenumber-js CJS issue is fundamental (not fixable by bundler), SDK approach is dead. |
| A5 | `supervisor_id` is the canonical hierarchy column for RBAC, not `reporter_id` | Pitfall 4 | If wrong, RBAC subtree queries return incorrect results. User must confirm. |

## Open Questions

1. **SuperTokens + Workers Runtime Compatibility**
   - What we know: `supertokens-node` v24.0.2 fails to load in miniflare due to `libphonenumber-js/max/index.cjs` CJS syntax. Two of three existing test files fail.
   - What's unclear: Can the bundler (wrangler/vite) resolve the CJS issue at build time? Or is the issue fundamental to the V8 isolate runtime?
   - Recommendation: Spike task first. Try `(A)` bundling supertokens-node with proper CJS externals config; `(B)` SuperTokens Core REST API + `jose` for JWT. Pick whichever passes `bun run vitest` first.

2. **Hierarchy Model: `supervisor_id` vs `reporter_id`**
   - What we know: Two hierarchy traversal paths exist. `queries.ts` uses `supervisor_id` (proper org hierarchy FK from migration 0002). `index.ts` uses `reporter_id` (referral tracking).
   - What's unclear: Which is the intended hierarchy for RBAC scope? D-06 says "recursive CTE in queries.ts" which uses `supervisor_id`. But existing RBAC logic (index.ts lines 117-133) uses `reporter_id`.
   - Recommendation: Use `supervisor_id` for RBAC (it's the proper organizational hierarchy). `reporter_id` tracks referral chains (Phase 3 whitelist feature). Planner should confirm with user.

3. **Auth Analytics Wiring**
   - What we know: `auth-analytics.ts` exists with full metrics collection. It's in Claude's discretion area.
   - What's unclear: Should it be wired in Phase 2 or deferred?
   - Recommendation: Wire it in -- it's already built, just needs importing into auth routes.

4. **Feature Flag Wiring**
   - What we know: `feature-flags.ts` uses `process.env.ROLLOUT_STAGE` which doesn't work in Workers without nodejs_compat. `USE_SUPERTOKENS_AUTH` env var already exists as a simple string flag.
   - What's unclear: Whether to use `FeatureFlagManager` for SuperTokens rollout or keep simple env var.
   - Recommendation: Keep simple env var `USE_SUPERTOKENS_AUTH`. Don't wire `FeatureFlagManager` -- it has `process.env` issues and adds complexity.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tools | Yes | 25.5.0 | -- |
| Bun | Package mgmt | Yes | 1.3.8 | -- |
| Wrangler | Dev/deploy | Yes | ^4.74.0 | -- |
| Vitest | Testing | Yes | ~3.2.0 | -- |
| @cloudflare/vitest-pool-workers | Test runtime | Yes | 0.12.4 | -- |
| Hono | HTTP framework | Yes | ^4.12.8 | -- |
| supertokens-node | Auth SDK | Yes (installed) | 24.0.2 | Core REST API + jose |
| jose | JWT verify | Yes (transitive) | ^4.13.1 | -- |
| SuperTokens Core | Auth backend | External | -- | Self-hosted or managed |
| D1 local | Database | Yes (via miniflare) | -- | -- |

**Missing dependencies with no fallback:**
- SuperTokens Core instance must be accessible at `SUPERTOKENS_CORE_URL` for auth to work. For dev/testing, use `try.supertokens.io` (existing test pattern).

**Missing dependencies with fallback:**
- `supertokens-node` SDK may not work in Workers runtime -> fallback to Core REST API + `jose` for JWT verification.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~3.2.0 with @cloudflare/vitest-pool-workers 0.12.4 |
| Config file | `prism-engine/vitest.config.ts` |
| Quick run command | `cd prism-engine && bun run vitest run tests/lib/ -x` |
| Full suite command | `cd prism-engine && bun run vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Phone OTP initiation and verification | unit + integration | `bun run vitest run tests/routes/auth.test.ts -x` | No -- Wave 0 |
| AUTH-02 | Session persists across requests | unit | `bun run vitest run tests/middleware/auth.test.ts -x` | No -- Wave 0 |
| AUTH-03 | Auto-create user on first OTP | unit | `bun run vitest run tests/routes/auth.test.ts -x` | No -- Wave 0 |
| AUTH-04 | Sign out revokes session | unit | `bun run vitest run tests/routes/auth.test.ts -x` | No -- Wave 0 |
| RBAC-01 | Admin sees all reports | unit | `bun run vitest run tests/middleware/rbac.test.ts -x` | No -- Wave 0 |
| RBAC-02 | Contractor sees only assigned | unit | `bun run vitest run tests/middleware/rbac.test.ts -x` | No -- Wave 0 |
| RBAC-03 | Crony sees own reports + available bounties | unit | `bun run vitest run tests/middleware/rbac.test.ts -x` | No -- Wave 0 |
| RBAC-04 | Middleware enforces on protected routes | integration | `bun run vitest run tests/middleware/auth.test.ts -x` | No -- Wave 0 |
| RBAC-05 | Hierarchy subtree access via recursive CTE | unit | `bun run vitest run tests/lib/queries.test.ts -x` | Partial -- exists but needs RBAC additions |

### Sampling Rate
- **Per task commit:** `cd prism-engine && bun run vitest run tests/<relevant>/ -x`
- **Per wave merge:** `cd prism-engine && bun run vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/routes/auth.test.ts` -- covers AUTH-01, AUTH-02, AUTH-03, AUTH-04
- [ ] `tests/middleware/auth.test.ts` -- covers AUTH-02, RBAC-04 (withUser middleware)
- [ ] `tests/middleware/rbac.test.ts` -- covers RBAC-01, RBAC-02, RBAC-03, RBAC-05
- [ ] Fix or mock `supertokens-node` imports -- existing `supertokens-init.test.ts` and `supertokens-session.test.ts` fail with SyntaxError
- [ ] Add `linkSuperTokensUserId()` query to `queries.ts` and test to `queries.test.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | SuperTokens Passwordless (phone OTP) |
| V3 Session Management | yes | SuperTokens Session recipe (15min access, 7day refresh, token rotation) |
| V4 Access Control | yes | Hono middleware (`withUser`, `requireRole`) + D1 role lookup |
| V5 Input Validation | yes | Hono body validation (phone number format, OTP code format) |
| V6 Cryptography | yes | JWT via `jose` or SuperTokens SDK, TLS for Core API calls |

### Known Threat Patterns for Auth + RBAC on Workers

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP brute force | Tampering | Rate limit OTP attempts (SuperTokens built-in), max 5 attempts per code |
| Session token theft | Tampering | Short-lived access tokens (15min), refresh token rotation, header-based transfer avoids XSS cookie theft |
| Role escalation | Elevation of privilege | Per-request D1 role lookup (D-08), never trust client-sent role |
| Hierarchy traversal | Information disclosure | Server-side recursive CTE (D-06), never trust client-sent hierarchy params |
| Missing auth on routes | Spoofing | `withUser()` middleware enforced at router level, not individual handlers |
| Token replay | Repudiation | JWT `jti` claim, token expiry, SuperTokens session handle revocation |

## Sources

### Primary (HIGH confidence)
- `prism-engine/src/lib/supertokens.ts` -- Existing SuperTokens init, session helpers, middleware
- `prism-engine/src/lib/queries.ts` -- Existing D1 query layer with user lookups
- `prism-engine/src/lib/types.ts` -- User/UserRole/Env type definitions
- `prism-engine/src/index.ts` -- Existing auth routes, RBAC helpers, SuperTokens middleware
- `prism-engine/tests/worker.ts` -- Explicit note: "supertokens-node incompatible with Vitest Workers runtime"
- `supertokens-node` source code inspection (framework/custom/framework.js, sessionRequestFunctions.js, supertokens.ts)
- npm registry: `supertokens-node@24.0.2` (verified 2026-04-13)

### Secondary (MEDIUM confidence)
- Existing test run output: 2 test suites fail due to `libphonenumber-js/max/index.cjs` syntax error
- `prism-engine/vitest.config.ts` -- Test configuration with miniflare pool
- `prism-engine/tests/setup.ts` -- Migration-based test D1 setup
- `prism-engine/tests/factories.ts` -- Test helper functions

### Tertiary (LOW confidence)
- SuperTokens Core REST API endpoints and response formats -- `[ASSUMED]` based on training knowledge, not verified against current docs. Web search returned no results for SuperTokens + Workers compatibility.
- `jose` v4 Workers compatibility -- `[ASSUMED]` based on library being widely used in edge runtimes. Not verified in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM -- `supertokens-node` installed but compatibility with Workers runtime is BLOCKED by CJS dependency issue
- Architecture: HIGH -- Patterns derived from existing working codebase and Hono conventions
- Pitfalls: HIGH -- Confirmed via source code inspection and test runs
- Compatibility: LOW -- Could not verify SuperTokens + Workers via external docs. Web search returned empty results across 10+ query variations.

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable patterns, but SuperTokens compatibility requires spike validation within 7 days)

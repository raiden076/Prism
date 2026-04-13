# Phase 2: Auth + RBAC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 02-auth-rbac
**Areas discussed:** SuperTokens Workers compat, RBAC middleware architecture, Session-to-DB user mapping, Auth route structure

---

## SuperTokens Workers Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first, then build | Validate supertokens-node on Workers via `bun run dev`, debug what breaks | |
| Research compatibility first | Web/docs research before writing code | ✓ |
| Trust existing scaffolding | Prototype showed it works, build on top | |

**User's choice:** Research compatibility first
**Notes:** Study `supertokens-node` Workers constraints (V8 isolates, `nodejs_compat` limits, missing Node APIs) via docs/web before coding. Research output informs spike plan.

### OTP Delivery Channel

| Option | Description | Selected |
|--------|-------------|----------|
| SuperTokens managed SMS | Single channel, existing code already configured | |
| WhatsApp + SMS both | Requires Meta Business setup | |
| SMS now, WhatsApp later | Progressive approach | ✓ |

**User's choice:** SMS now, WhatsApp later
**Notes:** Start with managed SMS. Structure code to accept additional channels for future WhatsApp integration.

### Token Transfer Method

| Option | Description | Selected |
|--------|-------------|----------|
| Header-based | Authorization header, avoids cookie complexity on Workers | ✓ |
| Cookie-based | Traditional web approach, requires cookie handling | |
| Both | Maximum compatibility, more code paths | |

**User's choice:** Header-based

### Session Config

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing (15m/7d) | 15min access + 7day refresh, good for field reporting | ✓ |
| Longer (1h/30d) | Better for offline scenarios | |
| Shorter (5m/1d) | Higher security | |

**User's choice:** Keep existing (15m/7d)

---

## RBAC Middleware Architecture

### RBAC Check Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Hono middleware chains | Composable: withUser(), requireRole(), clean separation | ✓ |
| Permission checker function | Single checkAccess(user, permission) function | |
| Route metadata + guard | Decorate routes, single middleware reads metadata | |

**User's choice:** Hono middleware chains

### Hierarchy Subtree Query Location

| Option | Description | Selected |
|--------|-------------|----------|
| Query layer function | getDescendantIds(db, userId) in queries.ts | ✓ |
| Inline in middleware | CTE in middleware, fewer files | |
| In-memory cache + CTE | Cache per Worker instance, complex invalidation | |

**User's choice:** Query layer function

### Legacy Auth Handling

| Option | Description | Selected |
|--------|-------------|----------|
| SuperTokens only | Drop phone-in-header auth, clean break | ✓ |
| Keep dual auth | Both paths during transition | |

**User's choice:** SuperTokens only

### User Resolution Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-request DB lookup | Middleware does session → D1 lookup, caches on context | ✓ |
| Session metadata cache | Cache in SuperTokens session, fewer DB queries | |

**User's choice:** Per-request DB lookup

---

## Session-to-DB User Mapping

### Auto-create on First OTP

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create with crony default | SuperTokens onUserSignUp → API creates D1 row, links supertokens_user_id | ✓ |
| Manual admin creation | Admin must create user before first login | |
| Whitelist-triggered only | Only create via whitelist webhook (Phase 3) | |

**User's choice:** Auto-create with crony default
**Notes:** Existing `createUser()` in queries.ts handles insertion. Default role = crony.

### Existing User Without ST Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Link on first login (upsert) | Check by phone, update supertokens_user_id if found, create if not | ✓ |
| Reject with error | User must be re-created | |
| Duplicate user | Create new D1 row (orphan) | |

**User's choice:** Link on first login (upsert pattern)
**Notes:** `getUserBySuperTokensId()` already exists in queries.ts for lookup.

---

## Auth Route Structure

### Route File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Separate module | Extract /auth/* to routes/auth.ts, index.ts as aggregator | ✓ |
| Keep inline | All routes in index.ts monolith | |
| Split by version | /api/v1/ in one file, /api/v2/ in another | |

**User's choice:** Separate module
**Notes:** Break monolith pattern. index.ts imports route modules. Cleaner for growing codebase.

### Legacy Route Cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Clean cutover | Delete old OTPless routes, replace with SuperTokens routes | ✓ |
| Gradual migration | Keep old routes alongside new during transition | |

**User's choice:** Clean cutover
**Notes:** Delete `/api/v2/auth/verify` (OTPLEss), `/api/v2/user/info` (phone header). New routes: `/auth/signinup`, `/auth/me`, `/auth/signout`.

---

## Claude's Discretion

- Exact middleware file organization (single file vs split by concern)
- Error response format for auth failures
- Auth analytics integration timing
- Feature flag integration timing

## Deferred Ideas

None — discussion stayed within phase scope

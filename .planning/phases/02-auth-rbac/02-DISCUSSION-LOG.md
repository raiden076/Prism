# Phase 2: Auth + RBAC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 02-auth-rbac
**Areas discussed:** SuperTokens Workers compat, RBAC middleware architecture

---

## SuperTokens Workers Compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| Spike first, then build | Validate supertokens-node on Workers via `bun run dev`, debug what breaks | ✓ |
| Research compatibility first | Web/docs research before writing code | |
| Trust existing scaffolding | Prototype showed it works, build on top | |

**User's choice:** Spike first, then build
**Notes:** STATE.md flagged SuperTokens + Workers as a risk with no official integration. Spike validates before investing in auth route implementation.

### OTP Delivery Channel

| Option | Description | Selected |
|--------|-------------|----------|
| SuperTokens managed SMS | Single channel, existing code already configured | ✓ |
| WhatsApp + SMS both | Requires Meta Business setup | |
| SMS now, WhatsApp later | Progressive approach | |

**User's choice:** SuperTokens managed SMS

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
**Notes:** Composable pattern fits Hono's middleware architecture well.

### Hierarchy Subtree Query Location

| Option | Description | Selected |
|--------|-------------|----------|
| Query layer function | getDescendantIds(db, userId) in queries.ts | ✓ |
| Inline in middleware | CTE in middleware, fewer files | |
| In-memory cache + CTE | Cache per Worker instance, complex invalidation | |

**User's choice:** Query layer function
**Notes:** Clean, testable, reusable — consistent with Phase 1 D-06/D-07 pattern.

### Legacy Auth Handling

| Option | Description | Selected |
|--------|-------------|----------|
| SuperTokens only | Drop phone-in-header auth, clean break | ✓ |
| Keep dual auth | Both paths during transition | |

**User's choice:** SuperTokens only
**Notes:** Prototype being rewritten — no need for backwards compatibility.

### User Resolution Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-request DB lookup | Middleware does session → D1 lookup, caches on context | ✓ |
| Session metadata cache | Cache in SuperTokens session, fewer DB queries | |

**User's choice:** Per-request DB lookup
**Notes:** Always fresh role data, simple implementation.

---

## Claude's Discretion

- Exact middleware file organization (single file vs split by concern)
- Error response format for auth failures
- Auth analytics integration timing
- Feature flag integration timing

## Deferred Ideas

None — discussion stayed within phase scope

# Phase 2: Auth + RBAC - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users authenticate via phone OTP through SuperTokens, sessions persist across requests, and role-based access control enforces permissions on all protected routes. This phase delivers: validated SuperTokens + Workers integration, auth route handlers (signin/up, signout, me), RBAC middleware (withUser, requireRole), hierarchy-scoped access via recursive CTE, and tests for all auth flows. No report/bounty features — those belong to Phase 3 and Phase 4.

</domain>

<decisions>
## Implementation Decisions

### SuperTokens Workers Compatibility
- **D-01:** Research compatibility first — study `supertokens-node` Workers compatibility via docs/web before writing code. Understand runtime constraints (V8 isolates, `nodejs_compat` flag limits, missing Node APIs) before building. Research output informs spike/validation plan.
- **D-02:** SMS now, WhatsApp later. Start with SuperTokens managed SMS delivery. Add WhatsApp channel as future enhancement — keep existing `supertokens.ts` SMS override, structure code to accept additional channels cleanly.
- **D-03:** Header-based token transfer (`Authorization` header). Existing code already uses `tokenTransferMethod: 'header'`. Workers don't handle cookies natively — header-based avoids cookie complexity.
- **D-04:** Session config: 15min access token + 7day refresh token (keep existing). Good balance for field reporting app.

### RBAC Middleware Architecture
- **D-05:** Hono middleware chains for RBAC. Composable pattern: `withUser()` attaches authenticated user to context, `requireRole('admin')` enforces role check. Routes compose: `app.get('/reports', withUser(), requireRole('admin'), handler)`. Clean separation, easy to test.
- **D-06:** Recursive CTE hierarchy query in `queries.ts` as `getDescendantIds(db, userId)`. Called by RBAC middleware when hierarchy-scoped access needed. Clean, testable, reusable.
- **D-07:** Drop legacy phone-in-header auth entirely. SuperTokens only from Phase 2 onward. Prototype is being rewritten — clean break, less code, less confusion.
- **D-08:** Per-request DB lookup for user resolution. Middleware resolves SuperTokens session userId → D1 Users row on every request, cached on Hono context. Simple, always fresh role data.

### Session-to-DB User Mapping
- **D-09:** Auto-create D1 user on first successful OTP verification. SuperTokens `onUserSignUp` fires → API layer creates D1 `Users` row with `crony` role default + links `supertokens_user_id`. Existing `createUser()` in queries.ts handles insertion.
- **D-10:** Link via `supertokens_user_id` column (migration 0004 already adds it). `getUserBySuperTokensId()` in queries.ts already queries this mapping.
- **D-11:** If user exists in D1 but has no `supertokens_user_id` — link on first SuperTokens login. Upsert pattern: check by phone first, if found update `supertokens_user_id`; if not found, create new user.

### Auth Route Structure
- **D-12:** Extract `/auth/*` routes to separate module (e.g., `prism-engine/src/routes/auth.ts`). Keep `index.ts` as route aggregator importing route modules. Cleaner than inline in monolith.
- **D-13:** Clean cutover from legacy auth — no dual auth. Delete old `/api/v2/auth/verify` (OTPLEss) and `/api/v2/user/info` (phone header). Replace with SuperTokens-backed `/auth/signinup`, `/auth/me`, `/auth/signout`.
- **D-14:** Auth routes follow `/auth/` prefix convention (matching existing pattern in supertokens.ts middleware). Phase 3+ API routes under `/api/v1/` and `/api/v2/` use auth middleware.

### Claude's Discretion
- Exact middleware file organization (single file vs split by concern)
- Error response format for auth failures (consistent with Phase 1 patterns)
- Auth analytics integration (existing `auth-analytics.ts` — wire it in or defer)
- Feature flag integration (existing `feature-flags.ts` — wire it in or defer)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Auth Code
- `prism-engine/src/lib/supertokens.ts` — SuperTokens init, session helpers, middleware scaffolding (createSuperTokensMiddleware, requireAuth)
- `prism-engine/src/lib/auth-analytics.ts` — Auth metrics collector (record, getStats, getRealTimeMetrics)
- `prism-engine/src/lib/feature-flags.ts` — Rollout manager (FeatureFlagManager, consistent hashing, staged rollout)
- `prism-engine/src/lib/queries.ts` — Query layer with getUserByPhone, getUserBySuperTokensId, createUser already implemented
- `prism-engine/src/lib/types.ts` — User/UserRow types, UserRole enum, Env type with SuperTokens bindings

### Legacy Auth Code (to extract/replace)
- `prism-engine/src/index.ts` lines 60-170 — getUserFromAuth(), getReportsFilter(), canUserAccessReport() — extract patterns, delete legacy implementation
- `prism-engine/src/index.ts` lines 365-543 — Auth routes (/api/v2/auth/verify, /api/v2/user/info) — replace with SuperTokens-based routes

### Database Schema
- `prism-engine/migrations/0004_supertokens_user_mapping.sql` — supertokens_user_id column on Users table
- `prism-engine/migrations/0002_role_hierarchy_tags.sql` — RoleHierarchy table, supervisor_id on Users

### Phase 1 Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Prior decisions on query layer, test infrastructure, type patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supertokens.ts`: Already has init, session get/revoke, requireAuth() middleware — build on top of this, don't rewrite
- `queries.ts`: getUserByPhone, getUserBySuperTokensId, createUser — auth queries already implemented
- `types.ts`: User type with role field, UserRole union type, Env with SuperTokens bindings — all defined
- `auth-analytics.ts`: Full metrics collector — wire into auth routes for observability
- `feature-flags.ts`: Rollout manager — available if gradual SuperTokens rollout needed

### Established Patterns
- Hono middleware: `async (c, next) => { ... await next() }` pattern
- D1 queries: `db.prepare(sql).bind(...params).first<Type>()` chain
- Query layer: Plain functions with D1Database first param (from Phase 1 D-06/D-07)
- Test infrastructure: Miniflare with real D1/R2 persistence (from Phase 1 D-08/D-10)

### Integration Points
- All Phase 3+ route handlers will use `withUser()` middleware
- All Phase 3+ route handlers will use `requireRole()` for access control
- Hierarchy queries in Phase 3 will use `getDescendantIds()` from this phase
- Frontend (Phase 6+) will call `/auth/signinup`, `/auth/me`, `/auth/signout` routes

</code_context>

<specifics>
## Specific Ideas

- Existing `getUserFromAuth()` in index.ts (lines 69-110) has the SuperTokens session → D1 user resolution pattern to preserve
- Existing `getReportsFilter()` in index.ts (lines 130-165) has the role-based WHERE clause logic to extract into middleware
- SuperTokens `onUserSignUp` hook (supertokens.ts line 69) logs but delegates user creation to API layer — keep this pattern
- RBAC filter logic per role: admin=all, contractor=assigned only, crony=own+available bounties, hierarchy=scoped subtree

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-auth-rbac*
*Context gathered: 2026-04-13*

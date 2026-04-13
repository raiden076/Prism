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
- **D-01:** Spike first — validate `supertokens-node` on Workers runtime before building auth routes. Run `bun run dev`, test init + OTP flow. If it fails, debug what breaks. ~15 min spike as first plan task.
- **D-02:** OTP delivery via SuperTokens managed SMS (single channel). No WhatsApp for now. Existing `supertokens.ts` SMS override stays as-is.
- **D-03:** Header-based token transfer (`Authorization` header). Existing code already uses `tokenTransferMethod: 'header'`. Workers don't handle cookies natively — header-based avoids cookie complexity.
- **D-04:** Session config: 15min access token + 7day refresh token (keep existing). Good balance for field reporting app.

### RBAC Middleware Architecture
- **D-05:** Hono middleware chains for RBAC. Composable pattern: `withUser()` attaches authenticated user to context, `requireRole('admin')` enforces role check. Routes compose: `app.get('/reports', withUser(), requireRole('admin'), handler)`. Clean separation, easy to test.
- **D-06:** Recursive CTE hierarchy query in `queries.ts` as `getDescendantIds(db, userId)`. Called by RBAC middleware when hierarchy-scoped access needed. Clean, testable, reusable.
- **D-07:** Drop legacy phone-in-header auth entirely. SuperTokens only from Phase 2 onward. Prototype is being rewritten — clean break, less code, less confusion.
- **D-08:** Per-request DB lookup for user resolution. Middleware resolves SuperTokens session userId → D1 Users row on every request, cached on Hono context. Simple, always fresh role data.

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

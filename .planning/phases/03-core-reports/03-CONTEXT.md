# Phase 3: Core Reports - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Trusted users submit geo-tagged reports with photos, and the board queries them with role-based filtering. Status state machine governs transitions. This phase delivers: whitelist webhook (user onboarding + hierarchy), report harvest route (R2 upload + DIGIPIN + validation), board query routes (paginated, RBAC-filtered, status-filtered), nearby reports, and status transition endpoint with state machine enforcement.

</domain>

<decisions>
## Implementation Decisions

### Whitelist Webhook Authentication
- **D-01:** Secret header authentication for whitelist webhook. Static secret passed via `X-Webhook-Secret` header. Single shared secret stored in Workers env var (`WEBHOOK_SECRET`). Route validates header matches env var before processing. Simple, effective for trusted caller (government party system).

### Report Trust Verification
- **D-02:** Report submission requires whitelisted_source link. Route checks `Whitelisted_Sources` table for active record linked to authenticated user. Only whitelisted cronies can submit reports. Matches ROADMAP "trusted whitelisted user" language. Non-whitelisted authenticated users get 403.

### Media Upload Constraints
- **D-03:** Accept image MIME types only: `image/jpeg`, `image/png`, `image/webp`. Max 10MB per upload. Validate Content-Type header from multipart, reject non-image types with 400. Validate body size before R2 put.

### Nearby Search Radius
- **D-04:** Default radius 1km, max cap 5km. Wide area scan suits West Bengal mixed urban/rural roads. Query param `radius` optional (defaults 1000m), capped at 5000m. Reject >5000m with 400.

### Claude's Discretion
- Exact secret header naming convention
- Whitelisted source lookup caching strategy
- Image validation depth (MIME only vs magic bytes)
- Board response field selection
- Pagination cursor vs offset implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `prism-engine/migrations/0001_init_schema.sql` — Users, Whitelisted_Sources, Reports tables
- `prism-engine/migrations/0002_role_hierarchy_tags.sql` — RoleHierarchy, supervisor_id on Users
- `prism-engine/migrations/0003_geofence_bounties.sql` — hierarchy_depth + reporter_id on Users
- `prism-engine/migrations/0004_supertokens_user_mapping.sql` — supertokens_user_id column

### Type System + Query Layer
- `prism-engine/src/lib/types.ts` — ReportStatus, STATUS_TRANSITIONS, isValidTransition, User, Report, WhitelistedSource types
- `prism-engine/src/lib/queries.ts` — createUser, getUserByPhone, createReport, getReportsByStatus, getNearbyReports, updateReportStatus, getUserDescendants, createWhitelistedSource
- `prism-engine/src/lib/digipin.ts` — latLngToDIGIPIN for report geo-encoding
- `prism-engine/src/lib/spatial.ts` — Haversine distance for nearby radius calc

### Auth + RBAC (Phase 2 output)
- `prism-engine/src/middleware/auth.ts` — withUser() middleware
- `prism-engine/src/middleware/rbac.ts` — getReportsFilter() for role-based WHERE clauses
- `prism-engine/src/routes/auth.ts` — Auth route wiring pattern to follow

### Prior Context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Query layer patterns, test infrastructure, type conventions
- `.planning/phases/02-auth-rbac/02-CONTEXT.md` — Auth middleware, RBAC architecture, session mapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `queries.ts`: All report query functions already implemented — createReport, getReportsByStatus, getNearbyReports, updateReportStatus, getUserDescendants, createWhitelistedSource, getUserByPhone
- `types.ts`: ReportStatus with STATUS_TRANSITIONS + isValidTransition already defined
- `middleware/auth.ts`: withUser() middleware resolves SuperTokens session → D1 user
- `middleware/rbac.ts`: getReportsFilter() generates role-based WHERE clauses
- `routes/auth.ts`: Route module pattern to follow (Hono instance, export, wire in index.ts)

### Established Patterns
- Route modules: new Hono() instance, export named routes, wire in index.ts via app.route()
- D1 queries: db.prepare(sql).bind(...params).first<Type>() chain
- Test factories: insertTestUser() for creating test records in D1
- Multipart parsing: c.req.parseBody() for form data
- R2 upload: c.env.VAULT.put(key, body) with UUID-based keys

### Integration Points
- index.ts imports route modules: app.route('/api/v1/whitelist', whitelistRoutes), app.route('/api/v1/reports', reportRoutes), app.route('/api/v2/reports', boardRoutes)
- All routes use withUser() for auth context
- Board routes use getReportsFilter() for RBAC scoping
- Report harvest uses createReport() which internally calls DIGIPIN encoding

</code_context>

<specifics>
## Specific Ideas

- Whitelist webhook pattern from existing index.ts POST /api/v1/whitelist — preserve logic, extract to route module
- Report harvest pattern from existing index.ts POST /api/v1/reports/harvest — multipart parsing, R2 upload, DIGIPIN generation
- Board query pattern from existing index.ts GET /api/v2/reports — RBAC filtering, pagination
- Status transitions use STATUS_TRANSITIONS map from types.ts — already validated by isValidTransition()

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-core-reports*
*Context gathered: 2026-04-14*

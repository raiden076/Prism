# Phase 1: Foundation - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

All shared contracts, infrastructure, and utility code exist so downstream phases can build without rework. This phase delivers: TypeScript type definitions matching D1 schema, canonical DIGIPIN and spatial utility libraries, typed D1 query layer, and test infrastructure with real miniflare persistence. No user-facing features, no auth, no API routes.

</domain>

<decisions>
## Implementation Decisions

### Type + Schema Organization
- **D-01:** Single `prism-engine/src/lib/types.ts` file containing all DB type definitions (User, Report, Intervention, Verification, Bounty, GeoFenceCluster, etc.) plus Env type
- **D-02:** Dual type pattern — raw `*Row` types matching D1 query results (nullable fields, string dates) + app-friendly types with transforms. Example: `UserRow` (DB shape) and `User` (app shape)

### DIGIPIN / Spatial Code Location
- **D-03:** Backend is canonical source for geo libraries. Extract from `prism-engine/src/index.ts` into `prism-engine/src/lib/digipin.ts` and `prism-engine/src/lib/spatial.ts`
- **D-04:** Frontend keeps its own copies in `prism/src/lib/digipin.ts` and `prism/src/lib/spatial.ts` — no shared package
- **D-05:** Backend DIGIPIN module should include full feature set (encode, decode, validate, format, prefix, distance) matching frontend's existing implementation

### Query Layer Architecture
- **D-06:** Typed query functions in `prism-engine/src/lib/queries.ts` — plain functions wrapping D1 prepared statements with typed params and return types
- **D-07:** Each function takes `D1Database` as first param, returns typed result — no classes, no repository pattern

### Test Infrastructure
- **D-08:** Use miniflare's built-in D1/R2 persistence for tests — real database operations, no mocks
- **D-09:** Migrations applied to test D1 instance before each test suite (via miniflare config or setup script)
- **D-10:** Factory helper functions for creating test records directly in D1 (e.g., `insertTestUser(db, overrides)`)

### Claude's Discretion
- Exact file structure within `prism-engine/src/lib/` (single queries.ts vs split by domain)
- Naming conventions for query functions
- Test file organization and naming
- Which utility functions to include beyond DIGIPIN + Haversine minimum

</decisions>

<specifics>
## Specific Ideas

- DIGIPIN reference implementation: `prism/src/lib/digipin.ts` (frontend) has the complete implementation to port to backend
- Haversine reference implementation: `prism/src/lib/spatial.ts` (frontend) has the complete spatial library
- Existing vitest.config.ts already uses miniflare with environmentOptions — extend for D1/R2 bindings
- Backend `index.ts` lines 24-69 contain inline DIGIPIN to extract and replace with lib import

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Geo Libraries
- `prism/src/lib/digipin.ts` — Complete DIGIPIN implementation (encode, decode, validate, format, prefix, distance) to port to backend
- `prism/src/lib/spatial.ts` — Complete spatial utilities (haversine, bounding box, drift calc, bearing, sort, filter) to port to backend
- `prism-engine/src/index.ts` lines 24-69 — Current inline DIGIPIN in backend to extract

### Database Schema
- `prism-engine/migrations/0001_init_schema.sql` — Core tables: Users, Whitelisted_Sources, Reports, Interventions, Verifications
- `prism-engine/migrations/0002_role_hierarchy_tags.sql` — RoleHierarchy, AccountabilityTags, UserTags, AuthorityChain, supervisor_id on Users
- `prism-engine/migrations/0003_geofence_bounties.sql` — GeoFenceClusters, GeoFenceReports, VerificationBounties, BountyVerifications, hierarchy_depth + reporter_id on Users
- `prism-engine/migrations/0004_supertokens_user_mapping.sql` — supertokens_user_id column on Users
- `prism-engine/migrations/0005_durable_objects.sql` — Durable Object namespace placeholder

### Test Infrastructure
- `prism-engine/vitest.config.ts` — Current test config with miniflare environment
- `.planning/codebase/TESTING.md` — Testing patterns, mocking strategies, missing test gaps

### Codebase Context
- `.planning/codebase/CONVENTIONS.md` — TypeScript standards, naming, error handling patterns
- `.planning/codebase/STRUCTURE.md` — File organization, where to add new code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `prism/src/lib/digipin.ts`: Complete DIGIPIN implementation ready to port to backend with minimal changes
- `prism/src/lib/spatial.ts`: Complete spatial library ready to port to backend
- `prism-engine/src/index.ts` Env type (lines 71-81): Already defines D1/R2/DO bindings — extract into types.ts
- `prism-engine/vitest.config.ts`: Miniflare environment already configured with env bindings

### Established Patterns
- D1 queries use `.prepare(sql).bind(...params).first()` / `.all()` / `.run()` chain
- TypeScript interfaces for object shapes, type for unions
- Prepared statements with `.bind()` for all DB queries — never string interpolation
- `crypto.randomUUID()` for ID generation
- Error handling: try-catch wrapping, return `{ success: false, error: string }` from service functions

### Integration Points
- All Phase 2+ routes will import types from `prism-engine/src/lib/types.ts`
- All Phase 2+ route handlers will use query functions from `prism-engine/src/lib/queries.ts`
- All Phase 2+ tests will use miniflare persistence + factory helpers
- Backend index.ts will import digipin/spatial from `./lib/` instead of inline definitions

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-13*

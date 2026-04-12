# Project Research Summary

**Project:** PRISM -- Decentralized Civic Infrastructure Reporting Platform
**Domain:** Civic tech, government infrastructure accountability (West Bengal, India pilot)
**Researched:** 2026-04-12
**Confidence:** MEDIUM-HIGH

## Executive Summary

PRISM is a civic infrastructure reporting platform where trusted "cronies" (field reporters) submit geo-tagged pothole reports, contractors fix them, and cronies independently verify fixes -- all enforced by a 30m Haversine spatial drift check. The platform's core differentiator is this closed accountability loop: no other civic platform (SeeClickFix, FixMyStreet, Swachhata) validates contractor physical presence at repair sites or requires independent ground-truth verification before marking resolved. A bounty system incentivizes crony verification, closing the economic loop.

The recommended architecture is a single Cloudflare Worker (Hono.js) with a layered internal structure: route files -> service layer -> query layer -> D1/R2 bindings. No microservices, no separate Workers. The Tauri v2 + Svelte 5 frontend compiles to a static SPA served via webview, with native plugin access for GPS, camera, and haptics. SuperTokens provides phone OTP auth, though its Edge runtime compatibility is the highest-risk integration point and must be validated on real Workers before building auth-dependent features.

Key risks: (1) SuperTokens Edge incompatibility -- feature-flag auth, test on real Workers immediately, have JWT fallback; (2) D1 spatial query performance -- use DIGIPIN prefix pre-filtering, never full-table scan; (3) GPS accuracy vs 30m drift threshold -- require minimum accuracy, use watchPosition; (4) bounty claim race conditions -- atomic UPDATE with meta.changes check.

## Key Findings

### Recommended Stack

The stack is well-established with verified versions. Critical: stay on Tailwind 3 (not 4), Vitest 4.1+ (not 3.x), TypeScript 5.6 (not 6.x). SuperTokens on Workers requires a custom integration pattern (no middleware, call core API directly via fetch) -- this is the riskiest stack decision.

**Core technologies:**
- **Hono 4.12.x**: HTTP framework -- zero deps, first-class Workers support, RPC mode for type safety
- **Cloudflare Workers + D1 + R2**: Runtime, DB, storage -- sub-ms cold start, serverless SQLite, zero egress media storage
- **Tauri v2 2.10.x + Svelte 5 5.55.x**: App shell + UI -- Rust-based native webview, runes reactivity, single codebase for desktop + mobile
- **SuperTokens node 24.x / web-js 0.16.x**: Auth -- phone OTP, RBAC roles, custom UI support
- **Vitest 4.1.x + @cloudflare/vitest-pool-workers**: Testing -- real Workers env in tests, required pool version
- **Zod + @hono/zod-validator**: Validation -- zero input validation in prototype; mandatory for rewrite

### Expected Features

**Must have (table stakes, P1):**
- Phone-based auth (SuperTokens OTP) -- India's primary digital identity
- Geo-tagged report submission (camera + GPS + DIGIPIN + R2) -- core value prop
- Report status tracking with state machine -- every civic platform has this
- RBAC (crony/contractor/admin) -- three actors with fundamentally different views
- Report querying with role-based filters -- War Room needs data
- Map-based report visualization -- government stakeholders expect spatial awareness

**Should have (competitive differentiators, P1):**
- Accountability loop (Haversine 30m spatial drift) -- PRISM's killer feature, no competitor does this
- Verification loop (crony ground-truth) -- independent verification before resolved
- Bounty system (claim/verify/complete) -- economic incentive closes the verification gap
- Whitelist webhook hierarchy -- trust propagation via party worker onboarding
- War Room dashboard -- tactical executive visibility, not a standard admin panel

**Defer (v1.x/v2+, P2-P3):**
- Offline-first queue (v1.x) -- add after online submission works
- AI/YOLO inference (Phase 2) -- auto-approve whitelisted reports for now
- Real-time WebSocket tracking -- spatial drift check is sufficient for v1
- Push notifications, analytics pipeline, multi-tenant -- post-pilot

### Architecture Approach

Single Cloudflare Worker with layered internal architecture: route files mount via `app.route()`, services contain all business logic, query files wrap all D1 prepared statements, middleware handles auth/RBAC/validation. Report status follows a strict state machine enforced by centralized `transitionStatus()`. The build order follows a clear dependency chain: types -> queries -> services -> routes -> index.ts.

**Major components:**
1. **Route layer** (`src/routes/*.ts`) -- 9 route domains mounted via Hono `app.route()`, thin handlers that extract input and call services
2. **Service layer** (`src/services/*.ts`) -- business logic: report lifecycle, bounty claim/complete, spatial drift, verification flow, media upload
3. **Query layer** (`src/db/queries/*.ts`) -- prepared statement wrappers per table, no raw SQL outside this layer
4. **Middleware stack** (`src/middleware/*.ts`) -- CORS, error handler, auth (session -> UserContext), RBAC, Zod validation
5. **Geo library** (`src/lib/geo.ts`) -- DIGIPIN encoding + Haversine distance, pure functions
6. **Frontend (Tauri + Svelte 5)** -- Static SPA, SvelteKit adapter-static, Tailwind 3 Neo-Brutalism design system

### Critical Pitfalls

1. **SuperTokens Edge incompatibility** -- `supertokens-node` uses Node.js APIs not available on Workers. Test on real Workers immediately, feature-flag auth, have JWT fallback plan.
2. **D1 spatial query bottleneck** -- Single-writer SQLite. Never full-table scan. Use DIGIPIN prefix pre-filtering + LIMIT on all queries.
3. **GPS accuracy vs 30m drift threshold** -- Consumer GPS often 50-200m accuracy. Require accuracy threshold, use watchPosition, warn users. This is hardware-limited.
4. **Report status machine violations** -- Centralize transitions in `transitionStatus()`, use D1 batch for status + dependent writes, no scattered status updates.
5. **Bounty claim race condition (TOCTOU)** -- Atomic `UPDATE ... WHERE status = 'available'` + check `meta.changes === 1`. Return 409 on contention.

## Implications for Roadmap

### Phase 1: Foundation + Types + Schema
**Rationale:** Everything depends on types, schema, and DB access. Establish contracts first.
**Delivers:** Type definitions (env, models), D1 migrations, query layer, geo library, Zod schemas, error classes, global error handler middleware.
**Addresses:** Table stakes scaffolding for all P1 features.
**Avoids:** Migration drift (pitfall #13), compatibility date staleness (pitfall #12).
**Research needed:** No -- well-documented patterns (D1 migrations, Hono project structure).

### Phase 2: Auth Layer
**Rationale:** Every feature requires authenticated users. Must validate SuperTokens on real Workers before proceeding.
**Delivers:** SuperTokens core API integration, auth middleware, RBAC middleware, Zod validation middleware, /auth/* routes.
**Uses:** SuperTokens node 24.x + web-js 0.16.x, custom Hono middleware calling core REST API.
**Implements:** Auth service, session verification, UserContext injection via c.var.
**Avoids:** SuperTokens Edge incompatibility (pitfall #1) -- test on real Workers in this phase.
**Research needed:** YES -- SuperTokens + Workers integration is custom, not officially documented. Needs `/gsd-research-phase` to validate approach before building.

### Phase 3: Core Domain Services + Routes
**Rationale:** Report ingestion, querying, and the accountability/verification loops are the product's core value.
**Delivers:** Report CRUD + state machine, user service, media service (R2), whitelist webhook, nearby reports, intervention (contractor fix + Haversine drift), verification, bounty lifecycle, all route files, index.ts wiring.
**Addresses:** All P1 features except War Room dashboard and bounty discovery.
**Avoids:** Status machine violations (pitfall #3), R2 write collisions (pitfall #5), bounty race conditions (pitfall #11), CORS issues (pitfall #15), GPS accuracy (pitfall #6).
**Research needed:** No -- Hono routing + D1 queries + R2 uploads are well-documented.

### Phase 4: Frontend Integration + War Room
**Rationale:** Frontend depends on working backend API. Build after backend is stable and tested.
**Delivers:** Tauri app with Svelte 5 routes: report submission (camera + GPS + canvas metadata burn), report list, War Room dashboard (reports tab + basic tabs), bounty discovery page, nearby bounties, Neo-Brutalism UI, haptic feedback.
**Uses:** Tauri v2 plugins (geolocation, haptics, store, camera), Svelte 5 runes, Tailwind 3 custom config, `idb` for offline cache.
**Avoids:** CORS issues (pitfall #15), GPS accuracy rejection (pitfall #6).
**Research needed:** Partial -- Tauri camera + GPS plugin patterns need validation, Svelte 5 runes in Tauri webview.

### Phase 5: Testing + Production Hardening
**Rationale:** Prototype has zero tests. Rewrite must be test-backed before any deployment.
**Delivers:** Unit tests for all services, integration tests for routes, D1 test fixtures, CORS verification, secrets rotation, R2 custom domain or Worker proxy, rate limiting, compatibility_date update.
**Avoids:** Plaintext secrets (pitfall #4), r2.dev rate limits (pitfall #14), stale compat date (pitfall #12), no rate limiting (pitfall #17).
**Research needed:** No -- Vitest + @cloudflare/vitest-pool-workers is well-documented.

### Phase Ordering Rationale

- **Foundation before auth before domain before frontend:** Hard dependency chain. Services need types + queries. Routes need services + auth. Frontend needs working API.
- **Auth is Phase 2 (not Phase 1):** SuperTokens Workers integration is the riskiest technical decision. Isolating it in Phase 2 means if it fails, we fall back to JWT without rewiring the entire app.
- **Core domain as single phase:** Report -> fix -> verify -> bounty is one value loop. Splitting it across phases creates integration gaps.
- **Frontend after backend:** Frontend without a working API is theater. Backend with no frontend is testable via curl.
- **Testing is continuous but formalized in Phase 5:** Write tests alongside implementation, but Phase 5 is dedicated coverage + production hardening.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Auth):** SuperTokens + Cloudflare Workers custom integration. No official guide exists. Needs API research, session flow validation, fallback strategy design.
- **Phase 4 (Frontend):** Tauri v2 camera plugin + geolocation plugin in production. Svelte 5 runes behavior inside Tauri webview. Canvas metadata burning workflow.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** D1 migrations, Zod schemas, TypeScript types -- well-documented.
- **Phase 3 (Core Domain):** Hono routing, D1 queries, R2 uploads, Haversine math -- standard patterns.
- **Phase 5 (Testing):** Vitest + Workers pool -- official Cloudflare docs cover this.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via npm registry. Compatibility constraints well-documented. |
| Features | MEDIUM | Based on codebase analysis + domain knowledge. Web search rate-limited. Competitor analysis from training data, not live research. |
| Architecture | HIGH | Derived from prototype analysis + Hono official docs + Cloudflare docs. Build order follows clear dependency chain. |
| Pitfalls | MEDIUM-HIGH | Cloudflare limits from official docs (HIGH). SuperTokens Edge issues from GitHub issues (MEDIUM). GPS accuracy from MDN (HIGH). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **SuperTokens + Workers integration:** No official documentation for running `supertokens-node` on Cloudflare Workers. The custom framework pattern (calling core API via fetch) needs validation during Phase 2. Fallback: `jose` library for JWT + custom phone OTP.
- **Zod 4 vs Zod 3 with @hono/zod-validator:** `@hono/zod-validator@0.7.6` may not support Zod 4.x. Must verify during Phase 1. Fallback: pin Zod to 3.24.x.
- **GPS accuracy in field conditions:** The 30m threshold may be unrealistic for consumer devices in rural West Bengal. Needs real-device testing during Phase 4. May require threshold adjustment or accuracy-aware acceptance logic.
- **DIGIPIN edge cases:** Boundary region encoding not fully verified against India Post specification. Test with known coordinate-DIGIPIN pairs in Phase 1.
- **D1 performance at scale:** Pilot is small (<100 users) but spatial queries need stress testing. DIGIPIN prefix indexing strategy needs validation with real data volumes.

## Sources

### Primary (HIGH confidence)
- npm registry API (registry.npmjs.org) -- version verification for all packages
- Hono official docs (hono.dev) -- routing, middleware, Workers setup, RPC mode
- Cloudflare official docs -- D1 limits, R2 limits, Workers limits, vitest-pool-workers
- MDN Geolocation API -- accuracy guarantees, watchPosition
- PRISM prototype source -- `prism-engine/src/index.ts` (1691 lines), migrations, frontend routes

### Secondary (MEDIUM confidence)
- SuperTokens GitHub issues (#835, #898, #913, #1012) -- Edge runtime compatibility problems
- SuperTokens official docs -- passwordless recipe, phone OTP, custom UI
- FixMyStreet (mySociety) -- open-source civic platform patterns
- SeeClickFix / Tyler Technologies -- civic platform feature analysis

### Tertiary (LOW confidence)
- DIGIPIN specification -- India Post Digital Pin Code, not fully verified
- Swachhata App -- MoHUA India, training data only
- SuperTokens + Workers custom integration -- inferred pattern, no official guide

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*

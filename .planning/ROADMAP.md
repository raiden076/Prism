# Roadmap: PRISM

## Overview

PRISM rewrites a monolithic prototype into a modular, tested platform. The journey starts with backend foundation (types, schema, geo library), validates the riskiest integration (SuperTokens on Workers), builds the core report-to-resolution loop (ingest, fix, verify, bounty), formalizes test coverage, then layers the Neo-Brutalism frontend on top of a proven API. Backend-first: no frontend work until tests pass.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Types, schema, geo library, query layer, test infrastructure
- [ ] **Phase 2: Auth + RBAC** - SuperTokens phone OTP integration, session management, role middleware
- [ ] **Phase 3: Core Reports** - Whitelist webhook, report ingestion, querying, status state machine
- [ ] **Phase 4: Accountability + Bounty** - Contractor fix loop, crony verification, bounty lifecycle
- [ ] **Phase 5: Test Coverage** - Formalize unit + e2e coverage across all backend routes
- [ ] **Phase 6: Frontend Core** - Field reporter capture UI + War Room dashboard
- [ ] **Phase 7: Frontend Bounty** - Bounty discovery, claim, verification submission UI

## Phase Details

### Phase 1: Foundation
**Goal**: All shared contracts, infrastructure, and utility code exist so downstream phases can build without rework
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. D1 migration applies cleanly and all tables/columns match TypeScript type definitions
  2. DIGIPIN encoding produces correct codes for known coordinate pairs
  3. Haversine distance calculation returns accurate results for test coordinate pairs
  4. Query layer wraps all D1 prepared statements with typed params and results
  5. Vitest runs with @cloudflare/vitest-pool-workers and test fixtures for D1 + R2 work
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: Auth + RBAC
**Goal**: Users authenticate via phone OTP, sessions persist, roles enforce access on all protected routes
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05
**Success Criteria** (what must be TRUE):
  1. User can sign up with phone number and receive + verify OTP via SuperTokens
  2. User session persists across requests and can be revoked on sign out
  3. New user auto-created with crony role on first successful OTP verification
  4. Admin sees all reports, contractor sees assigned only, crony sees own + available bounties
  5. Hierarchy-scoped access works -- subtree users see reports from their branch
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Core Reports
**Goal**: Trusted users can submit geo-tagged reports with photos, and the board can query them with role-based filtering
**Depends on**: Phase 2
**Requirements**: WHIT-01, WHIT-02, WHIT-03, WHIT-04, RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, RPT-08, RPT-09, RPT-10, RPT-11, RPT-12
**Success Criteria** (what must be TRUE):
  1. Whitelist webhook creates user with hierarchy link and depth tracking
  2. Authenticated whitelisted user submits report with photo stored in R2, geo-tagged with DIGIPIN
  3. Phase 1 reports auto-approve; invalid payloads return 400 with clear error
  4. Board endpoint returns paginated reports filtered by status and scoped by user role
  5. Status state machine rejects invalid transitions and enforces the correct flow
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Accountability + Bounty
**Goal**: Contractors fix reports with spatial accountability, cronies verify fixes on the ground, and bounties incentivize the verification loop
**Depends on**: Phase 3
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04, VERF-01, VERF-02, VERF-03, VERF-04, BNTY-01, BNTY-02, BNTY-03, BNTY-04, BNTY-05, BNTY-06
**Success Criteria** (what must be TRUE):
  1. Contractor submits fix with coordinates; system accepts if drift <= 30m, flags if > 30m
  2. Crony submits verification (photo + resolved boolean); resolved=true -> report resolved, false -> pending_review
  3. Bounties auto-generate for fixed_pending_verification reports with expiry
  4. Crony claims bounty (15-min lock), completes via verification, expired bounties unclaimable
  5. Nearby bounties discoverable by lat/lon/radius sorted by distance
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Test Coverage
**Goal**: All backend routes have passing e2e tests; unit tests cover all services, middleware, and utilities
**Depends on**: Phase 4
**Requirements**: TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. E2E tests cover every API route with D1/R2 test environment
  2. All unit tests for services, middleware, and utilities pass
  3. Test suite runs green -- no skipped, no flaky
  4. Backend is fully verified and ready for frontend development
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Frontend Core
**Goal**: Field reporters capture reports with camera + GPS, and War Room displays reports with status management
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. User captures photo with GPS metadata stamped, previews report with DIGIPIN before submission
  2. Report submission sends multipart/form-data to backend with haptic feedback on success
  3. War Room displays report list with status badges, DIGIPIN, creation date, severity
  4. War Room filters reports by status and allows contractor deployment on pending reports
  5. User hierarchy tree renders with expandable nodes
**UI hint**: yes
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Frontend Bounty
**Goal**: Cronies discover nearby bounties, claim them with countdown, and submit verification with photo + GPS
**Depends on**: Phase 6
**Requirements**: UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. Nearby bounties list loads sorted by distance from user location
  2. Claim action locks bounty with 15-min countdown timer and haptic feedback
  3. Verification submission captures photo + GPS + resolved checkbox and submits to backend
**UI hint**: yes
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Auth + RBAC | 0/3 | Not started | - |
| 3. Core Reports | 0/3 | Not started | - |
| 4. Accountability + Bounty | 0/3 | Not started | - |
| 5. Test Coverage | 0/2 | Not started | - |
| 6. Frontend Core | 0/3 | Not started | - |
| 7. Frontend Bounty | 0/2 | Not started | - |

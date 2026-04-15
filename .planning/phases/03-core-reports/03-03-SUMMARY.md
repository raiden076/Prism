---
phase: 03-core-reports
plan: 03
subsystem: api
tags: [reports, board, nearby, status-transitions, rbac, pagination, state-machine, tdd, cloudflare-workers, hono]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Modular route pattern, queries.ts, types.ts, setup.ts, whitelist route, RBAC middleware"
  - phase: 03-02
    provides: "Report harvest route, reports.ts route module, createReport query, withUser middleware integration"
provides:
  - "Board query route: GET /api/v2/reports with RBAC + status filter + pagination via getBoardReports"
  - "Nearby reports endpoint: GET /api/v1/reports/nearby with radius capped at 5000m (D-04)"
  - "Status transition endpoint: POST /api/v1/reports/:id/status with state machine enforcement"
  - "getBoardReports query function with composed RBAC + status + pagination"
  - "6 board route tests (RPT-06, RPT-08, RPT-09) + 7 report tests (RPT-07, RPT-10, RPT-11, RPT-12)"
affects: [04-bounties, 05-frontend-web]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RBAC-scoped board query via getReportsFilter() + getBoardReports() composition", "State machine enforcement on status transitions with isValidTransition()", "Radius-capped nearby query with bounding box pre-filter + Haversine post-filter"]

key-files:
  created: ["prism-engine/src/routes/board.ts", "prism-engine/tests/routes/board.test.ts"]
  modified: ["prism-engine/src/lib/queries.ts", "prism-engine/src/routes/reports.ts", "prism-engine/src/index.ts", "prism-engine/tests/routes/reports.test.ts"]

key-decisions:
  - "getBoardReports composes RBAC filter + optional status + pagination in single query function"
  - "Status transition endpoint validates against STATUS_TRANSITIONS state machine, returns 400 with validTransitions on invalid attempt"
  - "Nearby radius default 1000m, hard cap 5000m (D-04) enforced at route level"

patterns-established:
  - "Board query pattern: withUser() -> getReportsFilter(role, userId, db) -> getBoardReports(db, filter, options)"
  - "Status transition pattern: withUser() -> getReportById -> isValidTransition -> updateReportStatus"
  - "Radius-capped nearby pattern: parse lat/lon -> validate radius <= 5000 -> getNearbyReports with bounding box + Haversine"

requirements-completed: [RPT-06, RPT-07, RPT-08, RPT-09, RPT-10, RPT-11, RPT-12]

# Metrics
duration: 10min
completed: 2026-04-15
---

# Phase 03 Plan 03: Board Query + Nearby + Status Transitions Summary

**Board query route with RBAC-filtered pagination, nearby reports with 5km radius cap, and status state machine transitions -- TDD-tested via 13 new integration tests (24 total route tests)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-15T14:29:37Z
- **Completed:** 2026-04-15T14:40:23Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 6

## Accomplishments
- Board endpoint returns paginated reports scoped by user role (admin sees all, crony sees own, contractor sees assigned)
- Status filter accepts valid enum values, rejects invalid with 400
- Nearby reports queryable by lat/lon with radius capped at 5000m per D-04
- Status transitions enforced by state machine -- only valid transitions accepted, invalid returns 400 + valid options
- Full valid transition chain works: pending -> assigned -> fixed_pending_verification -> resolved

## Task Commits

Each task was committed atomically:

1. **Task 1: RED phase - queries, board tests, report tests** - `68e9799` (test)
2. **Task 2: GREEN phase - board route, nearby, status endpoints + wiring** - `e9ade86` (feat)

_Note: TDD tasks have separate RED (test) and GREEN (implementation) commits_

## Files Created/Modified
- `prism-engine/src/routes/board.ts` - GET / with withUser() + getReportsFilter() + getBoardReports
- `prism-engine/tests/routes/board.test.ts` - 6 integration tests (RPT-06, RPT-08, RPT-09)
- `prism-engine/src/lib/queries.ts` - Added getBoardReports with RBAC + status + pagination
- `prism-engine/src/routes/reports.ts` - Added GET /nearby + POST /:id/status endpoints
- `prism-engine/tests/routes/reports.test.ts` - 7 new tests (RPT-07, RPT-10, RPT-11, RPT-12)
- `prism-engine/src/index.ts` - Wired boardRoutes at /api/v2/reports

## Decisions Made
- getBoardReports composes getReportsFilter output with optional status and pagination -- single query function handles all composition
- Status transition endpoint returns validTransitions array on invalid attempt -- client can show valid options
- Nearby radius default 1000m chosen as sensible field-reporting range, 5000m cap prevents abuse (D-04)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `bun vitest run` not available; used `npx vitest --run` instead (worktree dependency resolution)
- Required `bun install` in worktree before first test run (node_modules not linked)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Board query route ready for War Room frontend consumption
- Nearby reports endpoint ready for field reporter mini-map
- Status transition endpoint ready for admin/manager workflow
- All 161 tests pass in full suite (14 test files)
- queries.ts has getBoardReports for any future paginated report queries

---
*Phase: 03-core-reports*
*Completed: 2026-04-15*

## Self-Check: PASSED

- All 6 created/modified files verified present
- Both commits (68e9799 RED, e9ade86 GREEN) verified in git log
- 24/24 route tests pass (6 board + 18 reports)
- 161/161 full suite pass
- All verification grep checks pass

---
phase: 02-auth-rbac
plan: 02
subsystem: auth
tags: [supertokens, jose, otp, passwordless, hono, cloudflare-workers, routes, jwt]

# Dependency graph
requires:
  - phase: 02-auth-rbac/01
    provides: supertokens-adapter.ts (jose JWT + Core REST API), upsertUserBySuperTokens query, linkSuperTokensUserId query
provides:
  - Auth route module (POST /auth/signinup, POST /auth/signinup/verify, GET /auth/me, POST /auth/signout)
  - Clean index.ts with auth routes imported as module
  - Legacy OTPless/phone-header auth fully removed
  - Deprecated middleware functions (createSuperTokensMiddleware, requireAuth, getSession) removed
affects: [02-03, rbac-middleware, withUser, frontend-auth]

# Tech tracking
tech-stack:
  added: []
  patterns: [route-module-extraction, test-hono-app-with-env-bindings, mock-core-api-via-globalthis-fetch]

key-files:
  created:
    - prism-engine/src/routes/auth.ts
    - prism-engine/tests/routes/auth.test.ts
  modified:
    - prism-engine/src/index.ts
    - prism-engine/src/lib/supertokens.ts
  deleted:
    - prism-engine/tests/supertokens-init.test.ts
    - prism-engine/tests/supertokens-session.test.ts

key-decisions:
  - "Auth routes extracted to routes/auth.ts module, wired via app.route('/auth', authRoutes) -- clean cutover (D-12)"
  - "Test approach: standalone test Hono app with env bindings passed via third parameter to app.request() -- avoids loading full index.ts with SDK imports"
  - "Legacy supertokens test files deleted: they test SDK-direct approach replaced by adapter, fail with CJS SyntaxError"
  - "Auth analytics wired into all handlers via getAuthAnalytics() singleton"

patterns-established:
  - "Route module pattern: Hono sub-router in routes/ directory, exported as named const, wired in index.ts"
  - "Test env injection: testApp.request(path, options, mockEnv) for Hono route testing in miniflare"
  - "Core API mocking: globalThis.fetch override with URL pattern matching for ST Core endpoints"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 14min
completed: 2026-04-13
---

# Phase 02 Plan 02: Auth Routes + Legacy Cleanup Summary

**SuperTokens auth route handlers with phone OTP flow, auto-create user upsert, and full legacy auth removal from index.ts**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-13T16:01:17Z
- **Completed:** 2026-04-13T16:15:24Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified, 2 deleted)

## Accomplishments
- Created routes/auth.ts with 4 auth endpoints: OTP initiate, OTP verify, profile, signout
- Auto-create user on first OTP via upsertUserBySuperTokens (D-09, D-11)
- Removed ~1200 lines of legacy auth code from index.ts (getUserFromAuth, getDescendantIds, getReportsFilter, canAccessReport, old /auth/* routes, /api/v2/auth/verify, /api/v2/user/info)
- Cleaned supertokens.ts: removed deprecated createSuperTokensMiddleware, requireAuth, getSession
- 9 new auth route tests passing, 114 total tests green (0 failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth route module with OTP + profile + signout handlers** - `b3ff426` (feat)
2. **Task 2: Clean up index.ts legacy auth + verify full test suite** - `8393db3` (refactor)

## Files Created/Modified
- `prism-engine/src/routes/auth.ts` - 4 auth route handlers using supertokens-adapter + queries, auth analytics wired
- `prism-engine/tests/routes/auth.test.ts` - 9 tests: OTP initiate (2), OTP verify (4), profile (2), signout (1)
- `prism-engine/src/index.ts` - Removed ~1200 lines: legacy auth helpers, old auth routes, per-request ST init; added authRoutes import + app.route wiring
- `prism-engine/src/lib/supertokens.ts` - Removed deprecated createSuperTokensMiddleware, requireAuth, getSession functions
- `prism-engine/tests/supertokens-init.test.ts` - Deleted (CJS SyntaxError, tests SDK-direct approach replaced by adapter)
- `prism-engine/tests/supertokens-session.test.ts` - Deleted (CJS SyntaxError, tests SDK-direct approach replaced by adapter)

## Decisions Made
- Used standalone test Hono app instead of SELF.fetch from cloudflare:test -- avoids loading full index.ts which pulls in supertokens-node SDK (incompatible with Vitest Workers runtime)
- Passed env bindings via Hono's app.request(path, options, env) third parameter -- clean injection of D1 + mock ST config
- Kept supertokens-integration.test.ts (passes fine) while deleting init/session tests (fail with SyntaxError) -- integration tests mock the SDK properly
- Auth analytics wired into all handlers as planned (Claude's discretion per RESEARCH.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed test env binding injection**
- **Found during:** Task 1 (test execution)
- **Issue:** testApp.request() without env bindings → c.env.SUPERTOKENS_CORE_URL undefined → 500 errors
- **Fix:** Created getTestEnv() helper, passed as third param to testApp.request()
- **Files modified:** tests/routes/auth.test.ts
- **Verification:** All 9 tests pass
- **Committed in:** b3ff426 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed OTP failure mock strategy**
- **Found during:** Task 1 (test execution)
- **Issue:** Setting mockCoreResponses['/consume'] = null fell through to default OK response via ?? operator
- **Fix:** Changed mock to use explicit key presence check + undefined sentinel value, returning { status: 'INCORRECT_USER_INPUT_CODE' } to trigger adapter's null return
- **Files modified:** tests/routes/auth.test.ts
- **Verification:** Wrong OTP test returns 401 as expected
- **Committed in:** b3ff426 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Minimal -- test infrastructure fixes, no production code changes needed.

## Issues Encountered
- Legacy supertokens-init.test.ts and supertokens-session.test.ts fail with SyntaxError from libphonenumber-js CJS -- deleted as planned (they test SDK-direct approach replaced by adapter)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth routes ready for Plan 03 (RBAC middleware: withUser, requireRole)
- routes/auth.ts uses adapter functions directly, ready for middleware wrapping
- index.ts clean -- route aggregator pattern established
- 114 tests green, zero failures, ready for incremental test additions

## Self-Check: PASSED

- All 3 created/modified files verified present (routes/auth.ts, auth.test.ts, SUMMARY.md)
- Both task commits (b3ff426, 8393db3) verified in git log
- Both deleted legacy test files confirmed removed
- 114 tests passing, 0 failures

---
*Phase: 02-auth-rbac*
*Completed: 2026-04-13*

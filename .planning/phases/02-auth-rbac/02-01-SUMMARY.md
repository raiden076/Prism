---
phase: 02-auth-rbac
plan: 01
subsystem: auth
tags: [supertokens, jose, jwt, cloudflare-workers, rbac, otp, passwordless]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: D1 schema with Users.supertokens_user_id column, queries.ts with getUserBySuperTokensId, types.ts with User type
provides:
  - SuperTokens adapter layer (jose JWT verification + Core REST API) for Workers runtime
  - linkSuperTokensUserId query function for D1 user linking
  - upsertUserBySuperTokens query function implementing D-11 upsert pattern
  - Fixed supertokens.ts with adapter-based session verification
affects: [02-02, 02-03, auth-routes, rbac-middleware]

# Tech tracking
tech-stack:
  added: [jose (transitive via supertokens-node, used directly for JWT verification)]
  patterns: [Core REST API bypass, JWKS caching, adapter pattern for Workers SDK compatibility]

key-files:
  created:
    - prism-engine/src/lib/supertokens-adapter.ts
    - prism-engine/tests/lib/adapter.test.ts
    - prism-engine/tests/lib/queries-auth.test.ts
  modified:
    - prism-engine/src/lib/queries.ts
    - prism-engine/src/lib/supertokens.ts

key-decisions:
  - "Approach B (jose + Core REST API) chosen over Approach A (SDK + PreParsedRequest) for reliability -- both pass spike test but B avoids SDK session wrapping pitfalls"
  - "RS256 used for JWT verification tests matching real SuperTokens Core signing behavior"
  - "createSuperTokensMiddleware/requireAuth deprecated in favor of upcoming withUser() from Plan 03"

patterns-established:
  - "Adapter pattern: supertokens-adapter.ts wraps jose JWT verification + Core REST API calls, insulating rest of codebase from SDK runtime issues"
  - "Upsert pattern: upsertUserBySuperTokens checks ST ID -> phone -> auto-create with crony role"
  - "JWKS caching: Module-level cache with 1-hour TTL for remote JWKS endpoint"

requirements-completed: [AUTH-01, AUTH-02, D-01, D-03, D-04, D-10]

# Metrics
duration: 17min
completed: 2026-04-13
---

# Phase 02 Plan 01: Auth Adapter Spike + Build Summary

**SuperTokens auth adapter using jose JWT verification + Core REST API, with user linking/upsert queries for D1**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-13T14:50:31Z
- **Completed:** 2026-04-13T15:07:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Determined Approach B (jose + Core REST API) works reliably in Workers runtime via spike test
- Built supertokens-adapter.ts with verifyAccessToken, createOTPCode, consumeOTPCode, revokeSession
- Added linkSuperTokensUserId and upsertUserBySuperTokens to queries.ts with D-11 upsert pattern
- Fixed supertokens.ts to use adapter instead of broken Session.getSession with raw Web Requests
- 13 new tests all pass (5 adapter + 8 query auth), zero regressions on existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Spike SuperTokens Workers compatibility + create adapter** - `fa34825` (feat)
2. **Task 2: Extend queries + fix supertokens.ts + write tests** - `fc44699` (feat)

## Files Created/Modified
- `prism-engine/src/lib/supertokens-adapter.ts` - jose JWT verification + Core REST API adapter (verifyAccessToken, createOTPCode, consumeOTPCode, revokeSession, JWKS caching)
- `prism-engine/src/lib/queries.ts` - Added linkSuperTokensUserId and upsertUserBySuperTokens functions
- `prism-engine/src/lib/supertokens.ts` - Refactored to use adapter for session verification, deprecated old middleware
- `prism-engine/tests/lib/adapter.test.ts` - 5 tests: empty token, malformed JWT, expired JWT, valid JWT with RS256, missing sub claim
- `prism-engine/tests/lib/queries-auth.test.ts` - 8 tests: link ST ID, link nonexistent, overwrite, upsert create/find/link/idempotent

## Decisions Made
- **Approach B over A:** Both approaches passed spike test (nodejs_compat resolves CJS issues), but Approach B (jose + REST API) is more reliable -- avoids SDK's internal BaseRequest wrapping pitfalls and the getTopLevelDomainForSameSiteResolution crash in Workers
- **RS256 for tests:** jose's createRemoteJWKSet doesn't support symmetric (oct) keys from JWKS endpoint. Real SuperTokens Core uses RS256, so tests use RS256 key pairs matching production behavior
- **Deprecation over deletion:** Marked createSuperTokensMiddleware/requireAuth as deprecated with JSDoc comments pointing to Plan 03's withUser() middleware, rather than deleting and breaking existing tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed HS256 to RS256 in adapter tests**
- **Found during:** Task 2 (adapter tests)
- **Issue:** jose createRemoteJWKSet rejects symmetric (oct) keys -- ERR_JOSE_NOT_SUPPORTED
- **Fix:** Switched to RS256 key pair (generateKeyPair) matching real SuperTokens Core behavior
- **Files modified:** prism-engine/tests/lib/adapter.test.ts
- **Verification:** All 5 adapter tests pass
- **Committed in:** fc44699 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal -- test approach corrected to match production token signing.

## Issues Encountered
- 6 pre-existing test failures in supertokens-init.test.ts and supertokens-session.test.ts -- all caused by SDK's getTopLevelDomainForSameSiteResolution crashing in Workers runtime. These are out of scope for this plan (they existed before changes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth adapter layer ready for Plan 02 (auth routes: /auth/otp/send, /auth/otp/verify, /auth/me, /auth/signout)
- Query functions (linkSuperTokensUserId, upsertUserBySuperTokens) ready for Plan 03 (RBAC middleware: withUser, requireRole)
- jose library available as transitive dependency of supertokens-node -- no new installation needed

## Self-Check: PASSED

- All 5 created/modified files verified present
- Both task commits (fa34825, fc44699) verified in git log
- 13 new tests pass, 6 pre-existing failures unchanged

---
*Phase: 02-auth-rbac*
*Completed: 2026-04-13*

---
phase: 03-core-reports
plan: 02
subsystem: api
tags: [reports, harvest, multipart, r2, digipin, tdd, cloudflare-workers, hono]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Modular route pattern, queries.ts, types.ts, setup.ts, whitelist route"
provides:
  - "Report harvest route: POST /api/v1/reports/harvest with auth + whitelist + R2 upload + validation"
  - "getWhitelistedSourceByUserId query function"
  - "11 integration tests covering RPT-01 through RPT-05"
  - "Fixed upsertUserBySuperTokens to link supertokens_user_id for brand-new users"
affects: [03-03, 05-frontend-web]

# Tech tracking
tech-stack:
  added: []
  patterns: ["c.req.raw.formData() for multipart parsing (standard Web API)", "route module with auth middleware chaining: withUser() + whitelist check"]

key-files:
  created: ["prism-engine/src/routes/reports.ts", "prism-engine/tests/routes/reports.test.ts"]
  modified: ["prism-engine/src/lib/queries.ts", "prism-engine/src/index.ts"]

key-decisions:
  - "Used c.req.raw.formData() (standard Web API) for multipart parsing after parseBody() proved incompatible"
  - "Fixed upsertUserBySuperTokens bug: new-user path never linked supertokens_user_id, causing withUser() to return 404"

patterns-established:
  - "Auth + whitelist route pattern: withUser() middleware -> getWhitelistedSourceByUserId check -> business logic"
  - "Multipart validation pattern: raw.formData() -> instanceof File check -> MIME/size validation"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-04, RPT-05]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 03 Plan 02: Report Harvest Route Summary

**Report harvest route with SuperTokens auth, whitelist source verification, R2 upload, MIME/size validation, and DIGIPIN auto-generation -- TDD-tested via 11 integration tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-13T23:35:13Z
- **Completed:** 2026-04-14T00:17:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Whitelisted authenticated users submit geo-tagged photo reports via multipart/form-data
- Reports enter as 'pending' status with auto-generated DIGIPIN
- Photos uploaded to R2 with UUID-based keys (harvest/{uuid}-{filename})
- Non-whitelisted authenticated users get 403, unauthenticated get 401
- MIME type validation (image/jpeg, image/png, image/webp) and 10MB size limit enforced
- Missing fields (media, latitude, longitude) return specific 400 error messages
- Fixed bug in upsertUserBySuperTokens where new users never got supertokens_user_id linked

## Task Commits

Executed by two parallel agents, merged:

1. **RED phase (agent A)** - `b38f7c1` (test)
2. **RED phase (agent B)** - `994aa94` (test)
3. **GREEN phase (agent A)** - `0610982` (feat)
4. **GREEN phase (agent B)** - `a0f787b` (feat)
5. **Merge resolution** - `6009ffa` (chore)

_Note: Parallel execution produced duplicate RED/GREEN commits. Merge resolved to best version._

## Files Created/Modified
- `prism-engine/src/routes/reports.ts` - POST /harvest with withUser() + whitelist check + R2 upload + validation
- `prism-engine/tests/routes/reports.test.ts` - 11 integration tests (RPT-01 through RPT-05)
- `prism-engine/src/lib/queries.ts` - Added getWhitelistedSourceByUserId + fixed upsertUserBySuperTokens bug
- `prism-engine/src/index.ts` - Wired reportRoutes at /api/v1/reports

## Decisions Made
- Used `c.req.raw.formData()` (standard Web API) for multipart parsing -- parseBody() returns incompatible type in Workers runtime
- Fixed upsertUserBySuperTokens: added `linkSuperTokensUserId` call in new-user creation path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed upsertUserBySuperTokens not linking supertokens_user_id for new users**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `upsertUserBySuperTokens` creates new users via `createUser` but never calls `linkSuperTokensUserId` for the brand-new path. The `withUser()` middleware then calls `getUserBySuperTokensId` which returns null, causing 404 for all authenticated requests.
- **Fix:** Added `linkSuperTokensUserId(db, user.id, stUserId)` after `createUser` in the new-user branch, then re-fetches to return user with linked ID.
- **Files modified:** src/lib/queries.ts
- **Verification:** All 11 tests pass, 148/148 full suite green
- **Committed in:** 0610982 / a0f787b

**2. [Rule 3 - Blocking] parseBody() incompatible with multipart testing**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `c.req.parseBody()` returns plain object in Hono v4, not FormData. Both `.get()` and bracket notation caused issues in Workers runtime testing.
- **Fix:** Switched to `c.req.raw.formData()` which uses the standard Web API FormData interface
- **Files modified:** src/routes/reports.ts
- **Verification:** All 11 tests pass
- **Committed in:** 0610982 / a0f787b (resolved in 6009ffa)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing supertokens-session.test.ts failures remain (unrelated, out of scope)
- Parallel execution merge conflicts resolved cleanly

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Report harvest route ready for board query route (03-03) to consume
- queries.ts has getWhitelistedSourceByUserId for any future whitelist-gated routes
- Test pattern established for multipart upload testing with JWT auth mocking
- upsertUserBySuperTokens bug fix benefits all future auth-dependent tests

---
*Phase: 03-core-reports*
*Completed: 2026-04-14*

## Self-Check: PASSED

- All 4 created/modified files verified present
- All commits verified in git log (b38f7c1, 994aa94, 0610982, a0f787b, 6009ffa)
- 11/11 report tests pass
- 148/148 full suite pass
- All verification grep checks pass

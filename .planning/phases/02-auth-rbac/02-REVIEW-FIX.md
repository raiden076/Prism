---
phase: 02-auth-rbac
fixed_at: 2026-04-14T00:00:00Z
review_path: .planning/phases/02-auth-rbac/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-04-14T00:00:00Z
**Source review:** .planning/phases/02-auth-rbac/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: consumeOTPCode extracts wrong sessionHandle -- signout will revoke the wrong session

**Files modified:** `prism-engine/src/lib/supertokens-adapter.ts`
**Commit:** 30bb177
**Applied fix:** Replaced incorrect `data.user.loginMethods?.[0]?.recipeUserId ?? data.user.id` with `data.session?.handle ?? ''` to extract the actual session handle from the Core API response. Combined with CR-02 fix in single commit.

### CR-02: Access and refresh tokens hardcoded empty strings

**Files modified:** `prism-engine/src/lib/supertokens-adapter.ts`
**Commit:** 30bb177
**Applied fix:** Replaced hardcoded empty strings `accessToken: ''` and `refreshToken: ''` with `data.session?.accessToken ?? ''` and `data.session?.refreshToken ?? ''` to extract tokens from the Core API consumeCode response. Combined with CR-01 fix in single commit.

### CR-03: Non-null assertion on potentially null re-fetch in upsertUserBySuperTokens

**Files modified:** `prism-engine/src/lib/queries.ts`
**Commit:** c4f1a09
**Applied fix:** Replaced `return (await getUserById(db, byPhone.id))!` with explicit null check. Re-fetch result stored in `refetched` variable; throws descriptive error if null instead of silent crash.

### WR-01: upsertUserBySuperTokens race condition -- no transaction wrapping

**Files modified:** `prism-engine/src/lib/queries.ts`
**Commit:** e9d1992
**Applied fix:** Wrapped `createUser` call in try-catch that handles UNIQUE constraint violations. On collision (concurrent OTP verifications), re-fetches the winning user by phone and links the SuperTokens ID instead of crashing.

### WR-02: Global mutable JWKS cache causes stale keys after rotation

**Files modified:** `prism-engine/src/lib/supertokens-adapter.ts`
**Commit:** e686237
**Applied fix:** Removed manual 1-hour TTL cache (`jwksCacheExpiry`, `JWKS_CACHE_TTL_MS`). Now caches only the `createRemoteJWKSet` instance per URL, relying on jose's built-in stale-while-revalidate behavior for key rotation.

### WR-03: OTP code logged to console in production

**Files modified:** `prism-engine/src/lib/supertokens.ts`
**Commit:** 90fd567
**Applied fix:** Gated OTP logging behind `process.env.NODE_ENV === 'development'` check. OTP codes no longer appear in production Workers logs.

### WR-04: Global auth analytics singleton shares metrics across all requests

**Files modified:** `prism-engine/src/lib/auth-analytics.ts`
**Commit:** 0b786c1
**Applied fix:** Removed module-level singleton. `getAuthAnalytics()` now creates a fresh `AuthAnalytics` instance per call (per-request), with reduced default cap of 1000 metrics. Added documentation about Workers isolate behavior and recommendation to use external service for cross-request analytics.

### WR-05: supertokens.ts init dead code

**Files modified:** `prism-engine/src/lib/supertokens.ts`
**Commit:** 5e404db
**Applied fix:** Removed unused `supertokens-node` SDK imports (`SuperTokens`, `Session`, `Passwordless`, `RecipeUserId`, `User`) and the `initSuperTokens` function. Kept utility functions (`isSuperTokensEnabled`, `getUserIdFromSession`, `revokeSession`) and adapter re-exports. Added NOTE comment explaining removal and how to re-add if needed.

---

_Fixed: 2026-04-14T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

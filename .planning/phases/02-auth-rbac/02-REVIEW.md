---
phase: 02-auth-rbac
reviewed: 2026-04-13T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - prism-engine/src/index.ts
  - prism-engine/src/lib/queries.ts
  - prism-engine/src/lib/supertokens-adapter.ts
  - prism-engine/src/lib/supertokens.ts
  - prism-engine/src/middleware/auth.ts
  - prism-engine/src/middleware/rbac.ts
  - prism-engine/src/routes/auth.ts
  - prism-engine/tests/lib/adapter.test.ts
  - prism-engine/tests/lib/queries-auth.test.ts
  - prism-engine/tests/middleware/auth.test.ts
  - prism-engine/tests/middleware/rbac.test.ts
  - prism-engine/tests/routes/auth.test.ts
findings:
  critical: 3
  warning: 5
  info: 5
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-13T12:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed 12 files comprising the SuperTokens auth adapter, JWT verification, RBAC middleware, auth route handlers, query layer, and their tests. The architecture is sound -- adapter-based JWT verification bypassing the supertokens-node SDK session layer, per-request D1 user lookup for fresh role data, and composable Hono middleware. Tests cover the critical paths well with real D1 + mocked JWKS.

Three critical issues found: session handle extraction is incorrect in the OTP consume flow (affecting signout), access/refresh tokens are never extracted from the Core API response (clients cannot authenticate after OTP verify), and the upsert function has a dangerous non-null assertion on a nullable re-fetch. Five warnings cover race conditions, global mutable state, console logging of OTP codes, and missing refresh token plumbing.

## Critical Issues

### CR-01: consumeOTPCode extracts wrong sessionHandle -- signout will revoke the wrong session

**File:** `prism-engine/src/lib/supertokens-adapter.ts:192-194`
**Issue:** The `sessionHandle` field in the response is set to `data.user.loginMethods?.[0]?.recipeUserId ?? data.user.id`. This is a recipe user ID or user ID, not the session handle from the consumed code response. The SuperTokens Core `/recipe/passwordless/consumeCode` response does not include a `sessionHandle` in the `user` object -- session handles come from the `session` object in the response or from the JWT claims. Since this wrong value propagates to `routes/auth.ts` and then to `revokeSession`, the `/auth/signout` endpoint will attempt to revoke a session using a user ID as the handle, which will silently fail.
**Fix:**
```typescript
// The consumeCode response for passwordless creates a session automatically.
// Extract session info from the response's session object or from the access token JWT.
if (data.status === 'OK') {
  // If Core returns session info in the response:
  const sessionHandle = data.session?.handle ?? '';
  return {
    userId: data.user.id,
    sessionHandle,
    accessToken: data.session?.accessToken ?? '',
    refreshToken: data.session?.refreshToken ?? '',
    createdNewUser: data.createdNewUser ?? false,
  };
}
```
Verify the actual shape of the SuperTokens Core REST API response for `consumeCode` -- the session tokens and handle may be in a `session` sub-object or returned via `Set-Cookie` headers. The adapter must extract them correctly.

### CR-02: Access and refresh tokens are hardcoded to empty strings -- clients cannot authenticate after OTP verify

**File:** `prism-engine/src/lib/supertokens-adapter.ts:195-196`
**Issue:** `consumeOTPCode` returns `accessToken: ''` and `refreshToken: ''` with a comment "Tokens are set as cookies by Core; for header transfer, extract from response." But `routes/auth.ts:98` returns these empty strings directly to the client in the JSON response body. The client receives empty tokens and cannot make authenticated API calls. The comment acknowledges the issue but leaves it unimplemented.
**Fix:**
```typescript
// Extract tokens from the Core API response.
// SuperTokens Core returns tokens in the response body for header-based transfer
// or via Set-Cookie headers. For API-based consumption, extract from response:
if (data.status === 'OK') {
  return {
    userId: data.user.id,
    sessionHandle: data.session?.handle ?? '',
    accessToken: data.session?.accessToken ?? data.accessAndFrontTokenUpdates?.[0]?.newAccessToken ?? '',
    refreshToken: data.session?.refreshToken ?? '',
    createdNewUser: data.createdNewUser ?? false,
  };
}
```
Alternatively, if the Core only sets cookies, the adapter must parse `Set-Cookie` headers from the Core response to extract the token values for header-based transfer.

### CR-03: Non-null assertion on potentially null re-fetch in upsertUserBySuperTokens

**File:** `prism-engine/src/lib/queries.ts:102`
**Issue:** After linking the SuperTokens user ID to an existing phone-matched user, the code re-fetches with `getUserById` and uses the `!` non-null assertion: `return (await getUserById(db, byPhone.id))!`. If the re-fetch returns null (e.g., due to eventual consistency in D1 or a concurrent deletion), this throws an unhandled runtime error instead of returning a clean error.
**Fix:**
```typescript
const byPhone = await getUserByPhone(db, phoneNumber);
if (byPhone) {
  if (!byPhone.supertokensUserId) {
    await linkSuperTokensUserId(db, byPhone.id, stUserId);
  }
  const refetched = await getUserById(db, byPhone.id);
  if (!refetched) {
    throw new Error('User disappeared after ST ID link -- concurrent modification');
  }
  return refetched;
}
```

## Warnings

### WR-01: upsertUserBySuperTokens has check-then-act race condition -- no transaction wrapping

**File:** `prism-engine/src/lib/queries.ts:86-107`
**Issue:** The function performs three sequential DB operations (lookup by ST ID, lookup by phone, insert) without D1 batch or transaction wrapping. Two concurrent OTP verifications for the same phone number could both pass the `getUserByPhone` check and attempt user creation, resulting in a UNIQUE constraint violation on `phone_number`. D1 supports `db.batch()` for atomic multi-statement execution.
**Fix:** Wrap the check-then-act sequence in a `db.batch()` call, or handle the UNIQUE constraint violation gracefully by catching the error and re-fetching the user.

### WR-02: Global mutable JWKS cache causes stale keys after rotation in long-lived Workers

**File:** `prism-engine/src/lib/supertokens-adapter.ts:38-41`
**Issue:** `cachedJwks`, `cachedJwksUrl`, and `jwksCacheExpiry` are module-level mutable state. In Cloudflare Workers, a single isolate can serve thousands of requests. If the SuperTokens Core rotates its signing keys, the cached JWKS will be stale for up to 1 hour. The `jose` library's `createRemoteJWKSet` already handles its own caching -- the manual TTL cache on top is redundant and adds a staleness window.
**Fix:** Either rely on `jose`'s built-in JWKS caching (remove the manual TTL logic) or reduce the TTL significantly (e.g., 5 minutes). Consider also whether the `createRemoteJWKSet` constructor should be called per-request with a fresh URL instead of cached globally.

### WR-03: OTP code logged to console in production

**File:** `prism-engine/src/lib/supertokens.ts:57`
**Issue:** `console.log('OTP for ${input.phoneNumber}: ${input.userInputCode}')` logs the OTP code in plaintext. In production, this would be visible in Workers logs (via `wrangler tail` or Cloudflare dashboard), creating a security exposure where anyone with log access could intercept OTP codes.
**Fix:** Remove the OTP code from the log message or gate it behind a development-only flag:
```typescript
if (c.env.USE_SUPERTOKENS_AUTH === 'dev') {
  console.log(`OTP for ${input.phoneNumber}: ${input.userInputCode}`);
}
```

### WR-04: Global auth analytics singleton shares metrics across all requests in Workers isolate

**File:** `prism-engine/src/lib/auth-analytics.ts:360-367`
**Issue:** `getAuthAnalytics()` returns a module-level singleton `AuthAnalytics`. In Cloudflare Workers, this singleton persists across all requests served by the same isolate. The `metrics` array grows unbounded (capped at 10k entries) in memory. While the 10k cap prevents OOM, this is still ~10k objects held in memory permanently, and metrics from different logical "sessions" or tenants will be mixed.
**Fix:** For Workers, consider using a per-request analytics collector or reducing the maxMetrics cap. If cross-request analytics are needed, emit metrics to an external service (Analytics Engine, Workers KV) rather than holding them in memory.

### WR-05: supertokens.ts init called but never invoked by any route or middleware -- appears to be dead code

**File:** `prism-engine/src/lib/supertokens.ts:33-81`
**Issue:** `initSuperTokens()` initializes the `supertokens-node` SDK with Passwordless and Session recipes. However, no route handler or middleware imports or calls `initSuperTokens`. The actual auth flow uses `supertokens-adapter.ts` functions directly (which bypass the SDK). The only re-exports are `createOTPCode` and `consumeOTPCode` which come from the adapter. The SDK init is dead code unless something outside the reviewed files calls it.
**Fix:** Either integrate `initSuperTokens` into the Worker startup (e.g., call it at module scope in `index.ts`) if the SDK's recipe layer is needed for SMS delivery, or remove the file entirely since the adapter handles everything.

## Info

### IN-01: Test files duplicate JWT key generation + fetch mock boilerplate

**File:** `prism-engine/tests/middleware/auth.test.ts`, `prism-engine/tests/middleware/rbac.test.ts`, `prism-engine/tests/routes/auth.test.ts`
**Issue:** All three test files contain identical `ensureKeys()`, `generateAccessToken()`, `mockFetch()`, and `restoreFetch()` functions. This is ~50 lines of duplicated setup code.
**Fix:** Extract into `tests/helpers/jwt-mock.ts` and import from each test file.

### IN-02: `as any` type assertions in supertokens-adapter.ts

**File:** `prism-engine/src/lib/supertokens-adapter.ts:146,187`
**Issue:** Two uses of `as any` for Core API response data (`const data = await response.json() as any`). Project convention says `any` should only be used for external library interop, never business logic.
**Fix:** Define proper interfaces for the expected Core API response shapes:
```typescript
interface CoreCodeResponse {
  status: string;
  deviceId?: string;
  preAuthSessionId?: string;
  message?: string;
}
```

### IN-03: Error objects in catch blocks not logged in routes/auth.ts

**File:** `prism-engine/src/routes/auth.ts:60-62,101-103`
**Issue:** Two catch blocks return a generic error response but do not log the actual error. This makes debugging production failures very difficult -- the 500 response gives no indication of what went wrong.
**Fix:** Add `console.error('Auth route error:', error)` before returning the 500 response.

### IN-04: Test file auth.test.ts creates unused rbacApp at line 32-37

**File:** `prism-engine/tests/middleware/auth.test.ts:32-37`
**Issue:** `makeRbacApp` function and the initial `authApp` test setup at line 21-29 -- the `makeRbacApp` function is defined but each test in the `requireRole` describe block creates its own inline wrapper app instead of using `makeRbacApp`. The initial `rbacApp` from the function is never used.
**Fix:** Either use `makeRbacApp` in the requireRole tests or remove the unused function.

### IN-05: Missing input validation for phone number format in consumeOTPCode

**File:** `prism-engine/src/lib/supertokens-adapter.ts:167-207`
**Issue:** `consumeOTPCode` does not validate its `phoneNumber`, `userInputCode`, or `deviceId` parameters before sending to the Core API. While the route handler validates phone format, the adapter function itself has no guard rails and could be called from other contexts.
**Fix:** Add basic validation at the adapter level or document that validation is the caller's responsibility.

---

_Reviewed: 2026-04-13T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

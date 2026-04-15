---
phase: 02-auth-rbac
verified: 2026-04-13T22:11:00Z
status: gaps_found
score: 13/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can verify OTP and receive access + refresh tokens"
    status: partial
    reason: "consumeOTPCode adapter returns empty strings for accessToken and refreshToken. Route handler passes these to client. Tokens not extracted from Core API response."
    artifacts:
      - path: "prism-engine/src/lib/supertokens-adapter.ts"
        issue: "Lines 195-196: accessToken and refreshToken hardcoded to empty strings instead of extracted from Core API response"
      - path: "prism-engine/src/routes/auth.ts"
        issue: "Lines 97-98: passes result.accessToken/refreshToken (empty strings) directly to client response"
    missing:
      - "Extract actual access/refresh tokens from SuperTokens Core consumeCode response or response headers"
      - "Test should assert non-empty accessToken/refreshToken in OTP verify response"
  - truth: "Crony role sees own reports and bounties available for verification"
    status: partial
    reason: "getReportsFilter('crony') returns 'own reports + reports verified by user'. Does NOT include reports with available bounties. RBAC-03 says 'bounties available for verification' but filter uses Verifications subquery, not VerificationBounties join."
    artifacts:
      - path: "prism-engine/src/middleware/rbac.ts"
        issue: "Lines 63-68: crony case uses Verifications table (past verifications), not VerificationBounties (available bounties)"
    missing:
      - "Add VerificationBounties join for available bounties in crony filter, or document that bounty visibility is handled separately in Phase 4 bounty routes"
---

# Phase 02: Auth + RBAC Verification Report

**Phase Goal:** Add SuperTokens phone-based authentication with RBAC middleware to the Cloudflare Workers backend. Enable role-based access control for all downstream routes.
**Verified:** 2026-04-13T22:11:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can sign up with phone number and receive + verify OTP via SuperTokens | VERIFIED | POST /auth/signinup creates OTP via Core API, POST /auth/signinup/verify consumes OTP. Tests pass (lines 173-223 in auth.test.ts). Routes wired in index.ts line 34. |
| 2 | User session persists across requests and can be revoked on sign out | VERIFIED | verifyAccessToken uses jose JWT verification with JWKS caching. POST /auth/signout revokes session via Core REST API. /auth/me verifies token + returns profile. Tests pass for me (valid/invalid token) and signout. |
| 3 | New user auto-created with crony role on first successful OTP verification | VERIFIED | upsertUserBySuperTokens in queries.ts lines 86-107: checks ST ID -> phone -> auto-create with crony role. Test at auth.test.ts:225 confirms D1 row with role= cronie. |
| 4 | Admin sees all reports, contractor sees assigned only, crony sees own + available bounties | PARTIAL | Admin: getReportsFilter returns '1=1' (VERIFIED). Contractor: returns Interventions subquery (VERIFIED). Crony: returns own + verified reports but NOT available bounties (GAP). |
| 5 | Hierarchy-scoped access works -- subtree users see reports from their branch | VERIFIED | getReportsFilter default case calls getUserDescendants (recursive CTE). Test confirms 4 IDs (supervisor + 3 children). rbac.test.ts:115-143. |
| 6 | SuperTokens session can be verified from Authorization header bearer token in Workers runtime | VERIFIED | supertokens-adapter.ts verifyAccessToken uses jose jwtVerify with JWKS. 5 adapter tests pass including valid RS256 JWT extraction. |
| 7 | User resolution from SuperTokens session userId to D1 Users row works | VERIFIED | getUserBySuperTokensId in queries.ts lines 63-72 queries Users.supertokens_user_id. withUser middleware line 54 calls it. Tests confirm user set on context. |
| 8 | Existing user without supertokens_user_id can be linked on first login | VERIFIED | upsertUserBySuperTokens line 96-99: finds by phone, calls linkSuperTokensUserId. Test at auth.test.ts:255 confirms supertokens_user_id linked in D1. |
| 9 | User can initiate phone OTP and receive a verification code | VERIFIED | POST /auth/signinup route (auth.ts:30-63) calls createOTPCode adapter, returns deviceId + preAuthSessionId. E.164 validation. Test confirms 200 response. |
| 10 | User can verify OTP and receive access + refresh tokens | PARTIAL | Route exists, OTP consumption works. BUT adapter returns empty strings for accessToken/refreshToken (supertokens-adapter.ts:195-196). Client receives empty tokens. |
| 11 | User can sign out, revoking their session | VERIFIED | POST /auth/signout extracts bearer token, verifies JWT, calls adapterRevokeSession with sessionHandle. Test confirms 200 + revoked. auth.ts:136-157. |
| 12 | User can retrieve their profile via /auth/me | VERIFIED | GET /auth/me verifies bearer token, looks up D1 user, returns full profile. Test confirms 200 with user data and 401 without token. |
| 13 | Legacy /api/v2/auth/verify and /api/v2/user/info routes are deleted | VERIFIED | grep for those paths in index.ts returns no matches. Legacy test files deleted. |
| 14 | withUser middleware rejects requests without valid bearer token | VERIFIED | middleware/auth.ts:32-38 returns 401 for missing header, lines 46-51 returns 401 for invalid token. auth.test.ts confirms both cases. |
| 15 | requireRole middleware rejects users without required role | VERIFIED | middleware/rbac.ts:20-37 checks user.role against whitelist. Tests confirm 403 for mismatch, 403 for no user, pass for matching roles. |

**Score:** 13/15 truths verified (2 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prism-engine/src/lib/supertokens-adapter.ts` | jose JWT + Core REST API adapter | VERIFIED | 233 lines. Exports verifyAccessToken, createOTPCode, consumeOTPCode, revokeSession. JWKS caching with 1h TTL. Error handling returns null/false. |
| `prism-engine/src/lib/queries.ts` | linkSuperTokensUserId + upsertUserBySuperTokens | VERIFIED | linkSuperTokensUserId (line 74), upsertUserBySuperTokens (line 86). Both use prepared statements with .bind(). |
| `prism-engine/src/lib/supertokens.ts` | Fixed session verification using adapter | VERIFIED | Uses adapterVerifyAccessToken, adapterRevokeSession. No process.env. Deprecated functions removed. 116 lines. |
| `prism-engine/src/routes/auth.ts` | Auth route handlers | VERIFIED | 158 lines. 4 routes: POST /signinup, POST /signinup/verify, GET /me, POST /signout. Uses adapter + queries. Auth analytics wired. |
| `prism-engine/src/index.ts` | Route aggregator with auth imports | VERIFIED | Line 15: imports authRoutes. Line 34: app.route('/auth', authRoutes). Lines 37-38: exports withUser, requireRole, getReportsFilter. Legacy code removed. |
| `prism-engine/src/middleware/auth.ts` | withUser() middleware | VERIFIED | 66 lines. Exports withUser, AuthVariables. Bearer extraction + JWT verify + D1 lookup. |
| `prism-engine/src/middleware/rbac.ts` | requireRole() + getReportsFilter() | VERIFIED | 84 lines. Exports requireRole, getReportsFilter. All role cases + hierarchy default. |
| `prism-engine/tests/lib/adapter.test.ts` | Adapter tests (5+) | VERIFIED | 121 lines, 5 tests. Empty token, malformed JWT, expired JWT, valid RS256, missing sub claim. |
| `prism-engine/tests/lib/queries-auth.test.ts` | Query auth tests (5+) | VERIFIED | 128 lines, 8 tests. Link, link nonexistent, overwrite, upsert create/find/link/idempotent. |
| `prism-engine/tests/routes/auth.test.ts` | Auth route tests (9+) | VERIFIED | 365 lines, 9 tests. OTP initiation (2), OTP verify (4), profile (2), signout (1). |
| `prism-engine/tests/middleware/auth.test.ts` | Auth middleware tests (8+) | VERIFIED | 262 lines, 8 tests. withUser valid/401/404, requireRole pass/403/multi-role/no-user. |
| `prism-engine/tests/middleware/rbac.test.ts` | RBAC filter tests (7+) | VERIFIED | 233 lines, 7 tests. All roles + hierarchy + integration chain. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| routes/auth.ts | supertokens-adapter.ts | createOTPCode, consumeOTPCode, verifyAccessToken, revokeSession imports | WIRED | All 4 adapter functions imported and called in route handlers. |
| routes/auth.ts | queries.ts | upsertUserBySuperTokens, getUserBySuperTokensId imports | WIRED | Both imported, upsertUserBySuperTokens called at verify, getUserBySuperTokensId at /me. |
| index.ts | routes/auth.ts | import + app.route('/auth', authRoutes) | WIRED | Line 15 import, line 34 wiring. |
| middleware/auth.ts | supertokens-adapter.ts | verifyAccessToken import | WIRED | Line 13 import, line 41 call. |
| middleware/auth.ts | queries.ts | getUserBySuperTokensId import | WIRED | Line 14 import, line 54 call. |
| middleware/rbac.ts | middleware/auth.ts | c.get('user') from context | WIRED | Line 22 reads user set by withUser. |
| middleware/rbac.ts | queries.ts | getUserDescendants import | WIRED | Line 13 import, line 73 call in default case. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| routes/auth.ts /signinup/verify | result (from consumeOTPCode) | Core REST API mock | Mock provides userId; production Core returns real user | FLOWING (mock) |
| routes/auth.ts /signinup/verify | accessToken, refreshToken | consumeOTPCode response | Empty strings -- not extracted from Core response | HOLLOW |
| middleware/auth.ts withUser | payload (from verifyAccessToken) | jose JWT verify | Real JWT verification with JWKS | FLOWING |
| middleware/auth.ts withUser | user (from getUserBySuperTokensId) | D1 Users table | Prepared statement query | FLOWING |
| middleware/rbac.ts getReportsFilter | descendants (from getUserDescendants) | D1 recursive CTE | Real recursive query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `bun vitest run --reporter=verbose` | 129 tests, 11 files, 0 failures, 7.81s | PASS |
| Adapter exports correct functions | `grep -c "export async function" src/lib/supertokens-adapter.ts` | 4 exported functions | PASS |
| Middleware exported from index.ts | `grep "export.*from.*middleware" src/index.ts` | 2 export lines (withUser, requireRole+getReportsFilter) | PASS |
| Legacy auth code removed from index.ts | `grep "getUserFromAuth\|getDescendantIds\|getReportsFilter\|canAccessReport" src/index.ts` | Only re-export line for getReportsFilter from middleware | PASS |
| Auth routes wired | `grep "app.route.*auth" src/index.ts` | Line 34: app.route('/auth', authRoutes) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01, 02-02 | User can authenticate via phone OTP through SuperTokens | SATISFIED | POST /auth/signinup + /signinup/verify routes working. Tests pass. |
| AUTH-02 | 02-01, 02-02 | User session persists across requests via SuperTokens session management | SATISFIED | verifyAccessToken with jose JWT. /auth/me confirms session validity. Signout revokes. |
| AUTH-03 | 02-02 | New user auto-created on first successful OTP verification (crony role default) | SATISFIED | upsertUserBySuperTokens creates crony. Test confirms D1 row with role=crony. |
| AUTH-04 | 02-02 | User can sign out, revoking SuperTokens session | SATISFIED | POST /auth/signout calls revokeSession. Test confirms 200. |
| RBAC-01 | 02-03 | Admin role sees all reports and can manage users | SATISFIED | getReportsFilter('admin') returns { whereClause: '1=1', params: [] }. Test pass. |
| RBAC-02 | 02-03 | Contractor role sees only assigned reports | SATISFIED | getReportsFilter('contractor') returns Interventions subquery. Test pass. |
| RBAC-03 | 02-03 | Crony role sees own reports and bounties available for verification | PARTIAL | Returns own reports + verified reports. Missing bounty availability join. |
| RBAC-04 | 02-03 | RBAC middleware enforces permissions on all protected routes | SATISFIED | withUser() + requireRole() middleware chain. Tests confirm 401/403 rejection. Exported for Phase 3. |
| RBAC-05 | 02-03 | Hierarchy-scoped access -- masters/region heads see reports from their subtree | SATISFIED | getReportsFilter default case uses getUserDescendants CTE. Test confirms 4 IDs in subtree. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| supertokens-adapter.ts | 195-196 | Empty string values for accessToken/refreshToken | WARNING | Client receives empty tokens after OTP verification. May break frontend auth flow. |
| supertokens-adapter.ts | 157-159, 203-205, 229-231 | console.error for all error paths | INFO | Acceptable for Workers runtime (structured logging). Not a blocker. |
| supertokens.ts | 57 | console.log for OTP code | INFO | Debug logging in SMS delivery override. Should be removed before production but not blocking. |
| index.ts | 69, 77, 85, 95, 644, 824 | TODO/Placeholder comments | INFO | All pre-existing Phase 1 code, not introduced in Phase 2. |

### Human Verification Required

### 1. OTP token delivery in production

**Test:** Deploy to staging, initiate OTP, verify OTP, check response body for non-empty accessToken/refreshToken
**Expected:** Client receives usable access and refresh tokens after OTP verification
**Why human:** Requires running SuperTokens Core instance. Mock tests pass but adapter returns empty strings for tokens. Production behavior depends on Core API response format and whether tokens come via response body or Set-Cookie headers.

### 2. SuperTokens Core connectivity

**Test:** Deploy to staging environment with real SUPERTOKENS_CORE_URL and SUPERTOKENS_API_KEY, test full OTP flow end-to-end
**Expected:** OTP sent to phone, verification succeeds, user created in D1, session established
**Why human:** Requires external service (SuperTokens hosted Core), phone number to receive OTP, cannot be tested programmatically.

### 3. JWKS key rotation

**Test:** Trigger key rotation in SuperTokens Core, verify adapter picks up new keys within cache TTL (1 hour)
**Expected:** After key rotation, old JWTs fail verification, new JWTs pass within 1 hour
**Why human:** Requires SuperTokens Core admin access to trigger key rotation, time-based behavior.

### Gaps Summary

Two partial gaps identified:

**Gap 1: Empty access/refresh tokens in consumeOTPCode response.** The adapter function `consumeOTPCode` at supertokens-adapter.ts:195-196 returns empty strings for `accessToken` and `refreshToken`. The comment says "Tokens are set as cookies by Core; for header transfer, extract from response" but no extraction code exists. The route handler at auth.ts:97-98 passes these empty values to the client. This may be acceptable if SuperTokens Core sets tokens as cookies automatically (browser-based flow), but the codebase uses `tokenTransferMethod: 'header'` which implies tokens should be in the response body or headers. The test does not assert non-empty token values. If this is an intentional design choice (tokens delivered via cookies), an override should be added.

**Gap 2: Crony filter missing bounty visibility.** RBAC-03 requires "Crony role sees own reports and bounties available for verification" but getReportsFilter('crony') returns reports where the user is reporter or verifier, without any join to VerificationBounties. Since the bounty system is Phase 4, this may be intentionally deferred, but the requirement was claimed in Phase 2's PLAN 03 frontmatter (requirements-completed includes RBAC-03). The test only checks the Verifications subquery, not bounty visibility. A proper fix would either add a VerificationBounties join to the crony filter or document that bounty filtering is handled by dedicated bounty endpoints in Phase 4.

---

_Verified: 2026-04-13T22:11:00Z_
_Verifier: Claude (gsd-verifier)_

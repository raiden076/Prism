# SECURITY.md -- Phase 02: Auth & RBAC

**Phase:** 02 -- Auth RBAC
**Audit Date:** 2026-04-14
**ASVS Level:** standard
**Auditor:** gsd-security-auditor

## Threat Verification Summary

**Total Threats:** 15
**Closed:** 15
**Open:** 0

---

## Closed Threats

| Threat ID | Category | Component | Disposition | Evidence |
|-----------|----------|-----------|-------------|----------|
| T-02-01 | Spoofing | verifyAccessToken | mitigate | `prism-engine/src/lib/supertokens-adapter.ts:105` -- `jwtVerify()` with `createRemoteJWKSet()` for JWKS key rotation. JWT signature verified before trusting claims. |
| T-02-02 | Tampering | Authorization header | mitigate | `prism-engine/src/middleware/auth.ts:33`, `prism-engine/src/routes/auth.ts:109,138` -- `startsWith('Bearer ')` enforcement, returns 401 for malformed headers. |
| T-02-03 | Information Disclosure | Core API calls | mitigate | `prism-engine/src/lib/supertokens-adapter.ts` -- `SUPERTOKENS_API_KEY` never logged. All `console.error` calls log only error codes/messages, never the API key. `prism-engine/src/routes/auth.ts:61,102` -- generic "Internal server error" messages to client, no stack traces. |
| T-02-04 | Tampering | OTP verification | mitigate | `prism-engine/src/lib/supertokens-adapter.ts:167-208` -- `consumeOTPCode()` verifies OTP server-side via Core REST API `/recipe/passwordless/consumeCode`. Client never trusted. |
| T-02-05 | Elevation of Privilege | upsertUserBySuperTokens | mitigate | `prism-engine/src/lib/queries.ts:113` -- `createUser(db, { role: 'crony', phoneNumber })`. New users always created with crony role. |
| T-02-06 | Spoofing | POST /auth/signinup | mitigate | `prism-engine/src/routes/auth.ts:43-45` -- E.164 regex validation `/^\+\d{7,15}$/` rejects malformed phone numbers. |
| T-02-07 | Tampering | POST /auth/signinup/verify | mitigate | `prism-engine/src/routes/auth.ts:78` -- `consumeOTPCode()` calls Core API `/recipe/passwordless/consumeCode` server-side. |
| T-02-08 | Repudiation | POST /auth/signout | mitigate | `prism-engine/src/routes/auth.ts:149` -- `revokeSession()` calls Core API `/recipe/session/signout` with `sessionHandles: [handle]` for server-side revocation. |
| T-02-09 | Information Disclosure | Error responses | mitigate | `prism-engine/src/routes/auth.ts` -- all catch blocks return `{ error: 'Internal server error' }` with generic messages. No stack traces, no Core API details exposed. |
| T-02-10 | Elevation of Privilege | upsertUserBySuperTokens | mitigate | `prism-engine/src/lib/queries.ts:86-128` -- `upsertUserBySuperTokens()` accepts only `stUserId` and `phoneNumber`. No role parameter from client. Role changes require admin DB update. |
| T-02-11 | Elevation of Privilege | withUser() | mitigate | `prism-engine/src/middleware/auth.ts:54` -- `getUserBySuperTokensId(c.env.DB, payload.userId)` performs per-request D1 lookup. JWT provides userId only; role comes from DB. |
| T-02-12 | Elevation of Privilege | requireRole() | mitigate | `prism-engine/src/middleware/rbac.ts:20-37` -- `requireRole(...roles: UserRole[])` uses explicit role whitelist via `roles.includes(user.role)`. No wildcard access. |
| T-02-13 | Information Disclosure | getReportsFilter() | mitigate | `prism-engine/src/middleware/rbac.ts:47-84` -- all WHERE clauses use `?` placeholders with params array. `prism-engine/src/lib/queries.ts:162-178` -- `getUserDescendants()` uses parameterized `WITH RECURSIVE` CTE with `.bind()`. |
| T-02-14 | Spoofing | withUser() | mitigate | `prism-engine/src/middleware/auth.ts:33,41` -- Bearer format enforced, then `verifyAccessToken()` (jose JWT + JWKS) validates signature. |
| T-02-15 | Tampering | getReportsFilter hierarchy | mitigate | `prism-engine/src/middleware/rbac.ts:73` -- `getUserDescendants(db, userId)` uses server-side recursive CTE on `supervisor_id`. Client cannot inject hierarchy traversal. |

---

## Unregistered Flags

None. No `## Threat Flags` sections found in Phase 02 SUMMARY files.

---

## Accepted Risks

None. All threats dispositioned as `mitigate` with verified mitigations.

---

## Transfer Documentation

None. No threats dispositioned as `transfer`.

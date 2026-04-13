---
phase: 02
slug: auth-rbac
status: verified
threats_open: 0
asvs_level: standard
created: 2026-04-14
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client -> Workers API | Untrusted bearer token in Authorization header | JWT access token (sensitive) |
| Client -> /auth/signinup | Untrusted phone number input | Phone number (PII) |
| Client -> /auth/signinup/verify | Untrusted OTP code | OTP code (sensitive) |
| Client -> /auth/me, /auth/signout | Untrusted bearer token | Session handle (sensitive) |
| Workers -> SuperTokens Core | API calls carry api-key in header | API key (secret), OTP codes |
| Workers -> D1 | Parameterized queries only | User data, role assignments |
| Client -> Protected routes | Bearer token + role enforcement via middleware | Role-scoped data access |
| Middleware -> D1 | Per-request role lookup | User role (authoritative) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Spoofing | verifyAccessToken | mitigate | JWT signature verification via jose with JWKS key rotation (`supertokens-adapter.ts:105`) | closed |
| T-02-02 | Tampering | Authorization header | mitigate | Bearer token format enforcement, 401 on malformed (`middleware/auth.ts:33`, `routes/auth.ts:109,138`) | closed |
| T-02-03 | Information Disclosure | Core API calls | mitigate | API key never logged. Generic error messages to client (`supertokens-adapter.ts`, `routes/auth.ts:61,102`) | closed |
| T-02-04 | Tampering | OTP verification | mitigate | OTP verified server-side via Core API consumeCode (`supertokens-adapter.ts:167-208`) | closed |
| T-02-05 | Elevation of Privilege | upsertUserBySuperTokens | mitigate | New users hardcoded to crony role (`queries.ts:113`) | closed |
| T-02-06 | Spoofing | POST /auth/signinup | mitigate | E.164 regex validation `/^\+\d{7,15}$/` (`routes/auth.ts:43-45`) | closed |
| T-02-07 | Tampering | POST /auth/signinup/verify | mitigate | OTP verified server-side via Core API (`routes/auth.ts:78`) | closed |
| T-02-08 | Repudiation | POST /auth/signout | mitigate | Session handle revoked server-side via Core API (`routes/auth.ts:149`) | closed |
| T-02-09 | Information Disclosure | Error responses | mitigate | Generic "Internal server error" messages, never expose internals (`routes/auth.ts` catch blocks) | closed |
| T-02-10 | Elevation of Privilege | upsertUserBySuperTokens | mitigate | No role param from client. Admin DB update required (`queries.ts:86-128`) | closed |
| T-02-11 | Elevation of Privilege | withUser() | mitigate | Role from D1 per request, never trusts client (`middleware/auth.ts:54`) | closed |
| T-02-12 | Elevation of Privilege | requireRole() | mitigate | Explicit role whitelist, no wildcard access (`middleware/rbac.ts:20-37`) | closed |
| T-02-13 | Information Disclosure | getReportsFilter() | mitigate | Parameterized queries with `?` placeholders (`middleware/rbac.ts:47-84`) | closed |
| T-02-14 | Spoofing | withUser() | mitigate | Bearer + jose JWT + JWKS verification (`middleware/auth.ts:33,41`) | closed |
| T-02-15 | Tampering | getReportsFilter hierarchy | mitigate | Server-side recursive CTE, client cannot inject (`middleware/rbac.ts:73`) | closed |

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-14 | 15 | 15 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-14

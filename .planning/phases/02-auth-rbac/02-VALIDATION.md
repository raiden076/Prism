---
phase: 2
slug: auth-rbac
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ~3.2.0 with @cloudflare/vitest-pool-workers ^0.12.4 |
| **Config file** | prism-engine/vitest.config.ts |
| **Quick run command** | `cd prism-engine && bun vitest run --reporter=verbose` |
| **Full suite command** | `cd prism-engine && bun vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd prism-engine && bun vitest run --reporter=verbose`
- **After every plan wave:** Run full suite
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTH-01 | T-2-01 | Spike validates SuperTokens adapter in Workers runtime | unit | `bun vitest run tests/spike-supertokens-workers.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-01, AUTH-03 | T-2-02 | Auth adapter + query extensions (upsertUserBySuperTokens) | unit | `bun vitest run tests/lib/adapter.test.ts tests/lib/queries-auth.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | T-2-03 | Auth routes (OTP, profile, signout) + auto-create + legacy cleanup | unit | `bun vitest run tests/routes/auth.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | AUTH-04 | T-2-04 | Legacy route deletion + full suite regression | unit | `bun vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | RBAC-01, RBAC-04 | — | withUser + requireRole middleware chains | unit | `bun vitest run tests/middleware/auth.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | RBAC-02, RBAC-03, RBAC-05 | — | getReportsFilter role cases + hierarchy CTE | unit | `bun vitest run tests/middleware/rbac.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `prism-engine/tests/spike-supertokens-workers.test.ts` — spike validates adapter in Workers runtime
- [ ] `prism-engine/tests/lib/adapter.test.ts` — stubs for auth adapter (createOTPCode, consumeOTPCode, verifyAccessToken, revokeSession)
- [ ] `prism-engine/tests/lib/queries-auth.test.ts` — stubs for upsertUserBySuperTokens, linkSuperTokensUserId
- [ ] `prism-engine/tests/routes/auth.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03, AUTH-04 (OTP, session, auto-create, signout)
- [ ] `prism-engine/tests/middleware/auth.test.ts` — stubs for withUser + requireRole middleware
- [ ] `prism-engine/tests/middleware/rbac.test.ts` — stubs for RBAC-01 through RBAC-05 (role filters + hierarchy CTE)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

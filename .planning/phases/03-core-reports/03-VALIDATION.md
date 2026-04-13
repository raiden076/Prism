---
phase: 03
slug: core-reports
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~3.2.0 with @cloudflare/vitest-pool-workers 0.12.4 |
| **Config file** | `prism-engine/vitest.config.ts` |
| **Quick run command** | `cd prism-engine && bun vitest run tests/routes/ -x` |
| **Full suite command** | `cd prism-engine && bun vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd prism-engine && bun vitest run tests/routes/ -x`
- **After every plan wave:** Run `cd prism-engine && bun vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | WHIT-01 | T-03-01 | Timing-safe webhook secret comparison | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | WHIT-02 | — | User created with crony role + whitelisted source link | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | WHIT-03 | — | Referrer hierarchy + depth tracking correct | unit | `bun vitest run tests/routes/whitelist.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | RPT-01 | T-03-02 | Whitelisted source verified before report submission | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | RPT-02 | — | DIGIPIN auto-generated from lat/lon | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | RPT-03 | — | R2 upload with UUID key pattern | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | RPT-04 | — | Reports enter as 'pending' status | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | RPT-05 | T-03-03 | MIME + size validation rejects invalid payloads | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | RPT-06 | T-03-04 | Board returns paginated results capped at 100 | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | RPT-07 | — | Nearby reports with radius cap (1km default, 5km max) | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | RPT-08 | — | Status filter parameter works | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03 | 2 | RPT-09 | — | RBAC scoping via getReportsFilter() | unit | `bun vitest run tests/routes/board.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-05 | 03 | 2 | RPT-10 | — | State machine enforces valid transitions | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-06 | 03 | 2 | RPT-11 | — | Valid transition chain pending->assigned->fixed_pending_verification->resolved | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-07 | 03 | 2 | RPT-12 | — | Invalid transitions rejected with 400 | unit | `bun vitest run tests/routes/reports.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/routes/whitelist.test.ts` — stubs for WHIT-01, WHIT-02, WHIT-03
- [ ] `tests/routes/reports.test.ts` — stubs for RPT-01 through RPT-05, RPT-07, RPT-10, RPT-11, RPT-12
- [ ] `tests/routes/board.test.ts` — stubs for RPT-06, RPT-08, RPT-09
- [ ] `getBoardReports()` query function in `src/lib/queries.ts`
- [ ] `getWhitelistedSourceByUserId()` query function in `src/lib/queries.ts`
- [ ] `hierarchyDepth` param added to `createUser()` in `src/lib/queries.ts`
- [ ] `WEBHOOK_SECRET: string` added to `Env` type in `src/lib/types.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

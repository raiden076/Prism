---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~3.2.0 with @cloudflare/vitest-pool-workers |
| **Config file** | prism-engine/vitest.config.ts |
| **Quick run command** | `cd prism-engine && bun vitest run --reporter=verbose` |
| **Full suite command** | `cd prism-engine && bun vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd prism-engine && bun vitest run --reporter=verbose`
- **After every plan wave:** Run `cd prism-engine && bun vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | TEST-01 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/digipin.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | TEST-01 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/spatial.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | TEST-01 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/types.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | TEST-01 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/queries.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | TEST-02 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/queries.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | TEST-02 | — | N/A | unit | `cd prism-engine && bun vitest run tests/lib/test-helpers.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `prism-engine/tests/lib/digipin.test.ts` — stubs for TEST-01 (DIGIPIN encoding/decoding)
- [ ] `prism-engine/tests/lib/spatial.test.ts` — stubs for TEST-01 (Haversine, drift, bounding box)
- [ ] `prism-engine/tests/lib/types.test.ts` — stubs for TEST-01 (type-schema alignment)
- [ ] `prism-engine/tests/lib/queries.test.ts` — stubs for TEST-01, TEST-02 (query layer)
- [ ] `prism-engine/tests/lib/test-helpers.test.ts` — stubs for TEST-02 (factory helpers)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| D1 migration applies cleanly | TEST-01 | Requires wrangler CLI with local D1 | `cd prism-engine && bunx wrangler d1 migrations apply prism_board --local` |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

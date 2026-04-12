# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 01-foundation
**Areas discussed:** Type + Schema Organization, DIGIPIN/Spatial Dedup, Query Layer Abstraction, Test Fixture Strategy

---

## Type + Schema Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single types file | All DB types in `prism-engine/src/lib/types.ts` | ✓ |
| Split by domain | `types/user.ts`, `types/report.ts`, etc. | |
| Co-located with queries | Types defined alongside query functions | |

**User's choice:** Single types file
**Follow-up — type shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Raw D1 row types | Match D1 results exactly (nullable, string dates) | |
| Dual types (row + app) | Both raw `*Row` + app-friendly types with transforms | ✓ |

**User's choice:** Dual types (row + app)
**Notes:** Clean separation for downstream phases — query functions return row types, routes transform to app types.

---

## DIGIPIN / Spatial Dedup

| Option | Description | Selected |
|--------|-------------|----------|
| Backend canonical, frontend keeps copy | Extract to `prism-engine/src/lib/`, frontend keeps own copy | ✓ |
| Shared package | Root-level `shared/` imported by both | |
| Keep separate | Each keeps its own, accepted duplication | |

**User's choice:** Backend canonical, frontend keeps copy
**Notes:** No package config overhead. Backend gets full feature set (encode, decode, validate, format, prefix, distance), not just inline encode function.

---

## Query Layer Abstraction

| Option | Description | Selected |
|--------|-------------|----------|
| Typed query functions | Plain functions in `prism-engine/src/lib/queries.ts` | ✓ |
| Repository classes | `UserRepo`, `ReportRepo` classes with methods | |
| Minimal extraction | Named functions inside index.ts | |

**User's choice:** Typed query functions
**Notes:** Functions take `D1Database` as first param, return typed results. No class overhead.

---

## Test Fixture Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Shared fixture file | Factory functions in `tests/fixtures.ts` | |
| Inline per test | Continue current inline mock pattern | |
| Miniflare real persistence | Real D1/R2 in tests, no mocks | ✓ |

**User's choice:** Miniflare real persistence
**Notes:** Real database operations via miniflare. Migrations applied to test instance. Factory helpers insert records directly into D1.

---

## Claude's Discretion

- Exact file structure within `prism-engine/src/lib/`
- Query function naming conventions
- Test file organization and naming
- Additional utility functions beyond DIGIPIN + Haversine

## Deferred Ideas

None — discussion stayed within phase scope

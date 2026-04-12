# PRISM

## What This Is

PRISM is a decentralized civic infrastructure reporting platform for rapid pothole detection and resolution tracking. Field reporters (cronies) submit geo-tagged reports, contractors fix issues with spatial accountability (Haversine drift check ≤30m), and cronies verify fixes on the ground. An executive War Room dashboard provides real-time visibility for government stakeholders.

This is a production rewrite — same fundamental patterns as the prototype (Cloudflare Workers + Hono.js backend, Tauri v2 + Svelte 5 frontend), but modular, tested, and deployable.

## Core Value

Reports go in, get fixed, get verified — with zero trust and full accountability. If the report-to-resolution loop doesn't work flawlessly, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] SuperTokens phone-based authentication (OTPless dropped)
- [ ] Whitelist webhook for hierarchy capture and user onboarding
- [ ] Trusted report ingestion (Phase 1) — whitelisted-only, auto-approve, R2 media upload, DIGIPIN geo-encoding
- [ ] Report querying — board state, nearby reports, filtered by status
- [ ] Accountability loop — contractor fix submission with spatial drift check (≤30m Haversine)
- [ ] Verification loop — crony ground-truth verification of fixes
- [ ] Bounty system — verification bounties for fixed-but-unverified reports, claim/complete flow with rewards
- [ ] Nearby bounties discovery — location-based bounty search with distance calculation
- [ ] Role-based access control (crony, contractor, admin)
- [ ] User hierarchy tracking (recursive referral tree)
- [ ] Neo-Brutalism frontend (Tauri v2 + Svelte 5)
- [ ] Android APK via Tauri mobile (shared Svelte codebase)
- [ ] Full test coverage — unit + e2e for backend before frontend work begins

### Out of Scope

- Phase 2 AI/YOLO inference — deferred; Phase 1 is whitelist-only auto-approve — reason: narrative mandates stability over features
- Contractor real-time WebSocket tracking — reason: complex infrastructure, not needed for initial pilot
- Geo-fence clusters — reason: synthetic feature not in narrative, over-engineering for v1
- OTPless legacy auth — reason: replaced by SuperTokens
- Push notifications — reason: defer to post-pilot
- Analytics/metrics pipeline — reason: not needed for pilot demo
- Multi-tenant support — reason: single deployment for WB pilot

## Context

- **Strategic goal:** PRISM is a trust-building deployment for West Bengal government. Success unlocks ₹50 Crore funding for Rajasthan data science initiative. Narrative.md is the project soul.
- **Current state:** Working prototype exists in monolithic 1700-line `index.ts`. All routes, auth, RBAC, geolocation, contractor tracking, bounties in one file. No tests. No middleware separation. No input validation. Schema drift between migration SQL and actual code.
- **Design system:** Neo-Brutalism — solid shadows, stark colors, physical button interactions. Must feel like a first-world government product ("European Government" aesthetic per narrative).
- **Hardware integration:** Camera capture, high-accuracy GPS, haptic feedback via Tauri native bindings.
- **DIGIPIN:** India's Digital Pin Code system — grid-based geo-encoding for all reports.
- **Existing patterns to preserve:** DIGIPIN algorithm, Haversine spatial drift calc, report status state machine, role-based access filter logic, bounty claim/verify flow.

## Constraints

- **Tech Stack:** Cloudflare Workers + Hono.js (backend), Tauri v2 + Svelte 5 (frontend) — locked per narrative "minimal & tactical" philosophy
- **Package Manager:** Bun only
- **Test Framework:** Vitest for backend unit + e2e tests
- **Database:** Cloudflare D1 (SQLite) with prepared statements
- **Storage:** Cloudflare R2 for media blobs
- **Auth:** SuperTokens only (phone-based OTP)
- **Deployment:** Sequential — backend tests green → frontend web → Android APK
- **Design:** Neo-Brutalism (Tailwind CSS, custom design tokens)
- **Build Order:** Archive old code → backend tests → backend implementation → frontend web tests → frontend web implementation → Android APK

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SuperTokens only (drop OTPless) | Cleaner auth, single auth path, less maintenance | — Pending |
| Phase 1 routes + Bounty system for v1 | Core value loop (report→fix→verify→bounty) complete. AI/YOLO/WebSocket deferred | — Pending |
| Backend-first with full test coverage | De-risk API before building UI on top. Tests = contract for frontend | — Pending |
| Tauri mobile for Android | Shared Svelte codebase, same tech stack, no separate native app | — Pending |
| Archive prototype, rewrite from scratch | Monolith too entangled to refactor. Preserve patterns, rebuild structure | — Pending |
| Blueprint-aligned scope only | Cut features that drifted from narrative during prototype phase | — Pending |
| Vitest for testing | Native TS support, fast, good Cloudflare Workers integration | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*

# Feature Research

**Domain:** Decentralized civic infrastructure reporting platform (India, West Bengal pilot)
**Researched:** 2026-04-13
**Confidence:** MEDIUM (web search rate-limited; analysis based on existing codebase, schema, CLAUDE.md, PROJECT.md, and established civic tech patterns from SeeClickFix/FixMyStreet/Swachhata knowledge)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Phone-based authentication | India's primary digital identity = phone number. Users expect OTP, not email/password. | MEDIUM | SuperTokens phone OTP. Existing prototype has dual auth (OTPless legacy + SuperTokens). v1 = SuperTokens only. |
| Geo-tagged report submission | Core value prop. Report without GPS = useless report. | MEDIUM | Camera capture + GPS stamp + R2 upload. DIGIPIN encoding for India-specific geo-grid. Existing code has `burnMetadata` for canvas timestamp+GPS burn. |
| Report status tracking | Citizens expect to know what happened to their report. Every 311 platform does this. | LOW | Status state machine: `pending -> pending_review -> assigned -> fixed_pending_verification -> resolved`. Already in schema. |
| Report list/query with filters | War Room needs to see all reports, filter by status/area. Field reporter needs to see own reports. | LOW | RBAC-filtered queries. Admin sees all, contractor sees assigned, crony sees own. Existing `getReportsFilter()` in prototype. |
| Media upload (photo) | Report without photo = unverifiable. Every civic app requires photo evidence. | MEDIUM | R2 blob storage. UUID-based keys. Image capture via Tauri camera API. Metadata burning on canvas. |
| Role-based access control | Three actors (crony, contractor, admin) with fundamentally different views. Without RBAC = chaos. | MEDIUM | D1 `role` column with CHECK constraint. RBAC filter logic per role. Existing prototype has full RBAC. |
| Map-based report visualization | Government stakeholders expect spatial awareness. Pins on a map = baseline for any geo-platform. | HIGH | Board page has map tab. Requires Leaflet/Mapbox integration with Tauri webview. Mini-map on report page. |
| Nearby reports query | "Am I reporting a duplicate?" Standard UX pattern. Also enables geo-fence duplicate detection. | LOW | Haversine distance calc + radius filter. Existing `/api/v1/reports/nearby` endpoint. |

### Differentiators (Competitive Advantage)

Features that set PRISM apart from SeeClickFix/FixMyStreet/Swachhata. These are NOT standard in civic platforms.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Accountability loop (Haversine spatial drift) | No civic platform validates contractor was actually AT the repair site. This is PRISM's killer feature. Contractor must submit fix within 30m of report location. | MEDIUM | Haversine calc in existing code. `Interventions` table stores `spatial_drift_calc`. Threshold = 30m. |
| Verification loop (crony ground-truth) | SeeClickFix lets government self-mark resolved. PRISM forces independent crony verification. Trust through zero-trust. | MEDIUM | `Verifications` table. Crony visits site, submits photo+GPS, confirms resolved. Only then status -> resolved. |
| Bounty system for verification | Fixes sit unresolved forever because nobody verifies. Bounties incentivize cronies to verify fixes. Creates economic loop. | HIGH | `VerificationBounties` table. Reports with `fixed_pending_verification` status generate bounties. Claim -> verify -> complete flow. 15-min claim lock. Expiry system. |
| Whitelist webhook hierarchy | Not just users -- a trust hierarchy. Party workers onboard cronies recursively. Hierarchy depth enables scoped access. | MEDIUM | `Whitelisted_Sources` + recursive `Users` tree (`reporter_id` FK to parent). `getDescendantIds()` for subtree access. No other civic platform does this. |
| DIGIPIN geo-encoding | India-specific. Standardizes location to government grid system. Enables integration with government GIS. | LOW | 5-level grid encoding. Algorithm exists in codebase. Every report stores DIGIPIN alongside lat/lon. |
| Neo-Brutalism tactical UI | Every civic platform looks like a government form. PRISM's design language is a deliberate trust signal -- feels modern, European-government-grade. | MEDIUM | Solid shadows, stark colors, physical button depression. Tailwind custom config. Haptic feedback on interactions. |
| Executive War Room dashboard | Not just a citizen app. War Room gives government stakeholders real-time visibility. Heatmap, hierarchy tree, AI review queue, workers status. | HIGH | Board page with 5 tabs: reports, heatmap, hierarchy, AI review, workers. Contractor deploy modal. Tab system already built. |
| Offline-first report queue | Rural India = spotty connectivity. Reports must work offline, sync when back online. | HIGH | `storeReportOffline()` + `getPendingReports()` in existing code. IndexedDB-backed. Sync on reconnect. |
| Nearby bounties discovery | Location-based bounty search. Crony opens app, sees bounties nearby, claims, walks to site, verifies, earns. | MEDIUM | `/api/v2/bounties` with lat/lon/radius params. Distance calc, sorting (distance/severity/recent). Frontend has full page. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Deliberately excluded from v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI/YOLO inference on reports | "Automate severity detection." Sounds impressive for demos. | Phase 2 feature. Adds ML infra complexity. Requires labeled training data. Destabilizes Phase 1. Prototype had `ai_confidence_score` column but no actual inference. | Phase 1 auto-approve all whitelisted reports. Defer AI to Phase 2 when volume justifies it. |
| Real-time WebSocket contractor tracking | "Track contractors live on map." Impressive demo feature. | Requires Durable Objects for WebSocket state. Complex infra. Not needed for pilot with small contractor pool. Battery drain on mobile. | Spatial drift check on fix submission. Verifies contractor WAS at location without live tracking. |
| Geo-fence clusters | "Group nearby reports automatically." Sounds useful. | Synthetic feature not in narrative. Adds algorithmic complexity (DBSCAN/clustering). Premature optimization for pilot scale. | Simple nearby-reports query with radius filter. Manual duplicate detection. Add clustering post-pilot if volume demands it. |
| Push notifications | "Alert users when report status changes." Standard mobile feature. | Requires Firebase/APNs integration. Additional infra dependency. Not critical for pilot (small user set, WhatsApp exists). | Status check on app open. WhatsApp group for pilot communication. Add post-pilot. |
| Analytics/metrics pipeline | "Show resolution times, trend charts." Stakeholders love dashboards. | Requires time-series data, aggregation queries, chart library. Premature for pilot with <100 reports. | Simple count queries on War Room board. Add analytics when data volume justifies. |
| Multi-tenant support | "Scale to multiple cities." Future-proofing. | Adds tenant isolation complexity. All queries need tenant filter. Schema changes. Single WB deployment doesn't need it. | Single deployment for WB pilot. Add multi-tenancy when scaling beyond one region. |
| Anonymous reporting | "Lower barrier, more reports." Common in Western civic apps. | Contradicts whitelist trust model. PRISM's value = trusted sources, not volume. Anonymous = unverifiable. | Whitelisted-only ingestion. Trust through hierarchy, not anonymity. |
| Upvote/star existing reports | "Community validation." SeeClickFix does this. | Encourages duplicate report creation. PRISM avoids duplicates via geo-fence proximity check. Upvotes don't fix potholes. | Nearby-reports query shows existing reports at location. Reporter sees duplicates before submitting. |

## Feature Dependencies

```
[SuperTokens Auth]
    └──requires──> [Whitelist Webhook] (user creation via trusted source)
                        └──requires──> [Role Assignment] (crony/contractor/admin)

[Report Submission]
    └──requires──> [SuperTokens Auth] (authenticated user)
    └──requires──> [Camera Capture + GPS] (geo-tagged media)
    └──requires──> [R2 Media Upload] (image storage)
    └──requires──> [DIGIPIN Encoding] (India geo-grid)

[Accountability Loop (Contractor Fix)]
    └──requires──> [Report Submission] (must have report to fix)
    └──requires──> [Haversine Spatial Drift] (validate contractor location)
    └──requires──> [R2 Media Upload] (proof image)

[Verification Loop (Crony Verify)]
    └──requires──> [Accountability Loop] (report must be fixed first)
    └──requires──> [Camera Capture + GPS] (verification evidence)
    └──requires──> [Haversine Spatial Drift] (validate verifier location)

[Bounty System]
    └──requires──> [Verification Loop] (bounty = incentive to verify)
    └──requires──> [Nearby Bounties Discovery] (crony finds bounties)

[War Room Dashboard]
    └──requires──> [Report Submission] (data to display)
    └──enhances──> [Accountability Loop] (deploy contractor from board)
    └──enhances──> [Hierarchy Tree] (visualize trust structure)

[Offline Queue]
    └──enhances──> [Report Submission] (works without connectivity)

[Nearby Reports Query]
    └──enhances──> [Report Submission] (duplicate prevention)
    └──conflicts──> [Anonymous Reporting] (whitelist model incompatible)
```

### Dependency Notes

- **Report Submission requires Auth + Camera + GPS + R2:** Core loop. Without any one of these, report is incomplete. Must be built together as first feature block.
- **Accountability Loop requires Reports + Haversine:** Can't test contractor fix until reports exist. Haversine is a pure function (no external deps). Implement after report ingestion works.
- **Verification Loop requires Accountability Loop:** Crony can only verify reports that have been fixed. Strict sequential dependency.
- **Bounty System requires Verification Loop:** Bounties are created for `fixed_pending_verification` reports. Without verification loop, bounty has no completion path.
- **War Room enhances all features:** Dashboard is a read layer over existing data. Can be built incrementally -- start with report list, add tabs progressively.
- **Offline Queue enhances Report Submission:** IndexedDB-backed queue. Adds resilience but not required for MVP. Can be added after online submission works.
- **Nearby Reports Query conflicts with Anonymous Reporting:** Nearby query requires auth to show relevant reports. Anonymous model removes auth requirement. PRISM chose auth/whitelist model.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the core loop (report -> fix -> verify -> bounty).

- [ ] SuperTokens phone OTP authentication -- without auth, nothing works. Users must be identified for RBAC.
- [ ] Whitelist webhook (user onboarding + hierarchy capture) -- trusted source model requires controlled onboarding.
- [ ] Role-based access control (crony/contractor/admin) -- three actor types with different permissions.
- [ ] Report submission (camera + GPS + DIGIPIN + R2 upload) -- core value. Reports go in.
- [ ] Report querying with RBAC filters -- War Room needs data. Cronies need own reports.
- [ ] Accountability loop (contractor fix + Haversine drift check) -- contractor accountability. Core differentiator.
- [ ] Verification loop (crony ground-truth verification) -- independent verification. Core differentiator.
- [ ] Bounty system (claim + verify + complete flow) -- incentivizes verification. Closes the economic loop.
- [ ] Nearby bounties discovery -- cronies need to find bounties. Without this, bounty system is invisible.
- [ ] War Room dashboard (report list + basic tabs) -- government stakeholder visibility. Essential for pilot buy-in.
- [ ] Backend test coverage (unit + e2e, Vitest) -- prototype has zero tests. Rewrite must be test-backed.

### Add After Validation (v1.x)

Features to add once core loop is validated in pilot.

- [ ] Offline-first report queue -- add when field reporters report connectivity issues during pilot.
- [ ] Heatmap visualization on War Room -- add when report volume justifies spatial analysis.
- [ ] User hierarchy tree visualization -- add when hierarchy depth > 2 levels.
- [ ] Contractor deploy from War Room -- add when admin workflow demands in-app deployment.
- [ ] Batch verification -- add when single-verify workflow becomes tedious.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] AI/YOLO inference (Phase 2) -- add when report volume exceeds human review capacity.
- [ ] Real-time WebSocket contractor tracking -- add when contractor pool > 20 and live tracking matters.
- [ ] Push notifications -- add when user base grows beyond WhatsApp group management.
- [ ] Analytics pipeline -- add when stakeholders demand trend data.
- [ ] Android APK via Tauri mobile -- add after web app is stable. Shared Svelte codebase.
- [ ] Multi-tenant support -- add when expanding beyond West Bengal.
- [ ] Geo-fence clustering -- add when duplicate report volume justifies automated grouping.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SuperTokens auth | HIGH | MEDIUM | P1 |
| Whitelist webhook + hierarchy | HIGH | MEDIUM | P1 |
| RBAC | HIGH | MEDIUM | P1 |
| Report submission (camera+GPS+R2) | HIGH | HIGH | P1 |
| Report querying with filters | HIGH | LOW | P1 |
| Accountability loop (Haversine drift) | HIGH | MEDIUM | P1 |
| Verification loop (crony ground-truth) | HIGH | MEDIUM | P1 |
| Bounty system (claim/verify/complete) | HIGH | HIGH | P1 |
| Nearby bounties discovery | HIGH | MEDIUM | P1 |
| War Room dashboard | HIGH | HIGH | P1 |
| Backend test coverage | HIGH (de-risk) | MEDIUM | P1 |
| Offline-first queue | MEDIUM | HIGH | P2 |
| Heatmap visualization | MEDIUM | MEDIUM | P2 |
| Hierarchy tree viz | MEDIUM | LOW | P2 |
| Contractor deploy modal | MEDIUM | LOW | P2 |
| Batch verification | LOW | MEDIUM | P2 |
| AI/YOLO inference | MEDIUM | VERY HIGH | P3 |
| WebSocket tracking | LOW | VERY HIGH | P3 |
| Push notifications | MEDIUM | HIGH | P3 |
| Analytics pipeline | LOW | HIGH | P3 |
| Android APK | MEDIUM | MEDIUM | P3 |
| Multi-tenant | LOW | VERY HIGH | P3 |
| Geo-fence clusters | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (core loop complete)
- P2: Should have, add when possible during v1.x
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | SeeClickFix / Tyler Tech | FixMyStreet (UK) | Swachhata (India) | PRISM Approach |
|---------|--------------------------|-------------------|-------------------|----------------|
| Auth model | Email/social login | Email | Phone OTP | SuperTokens phone OTP + whitelist hierarchy |
| Report submission | Photo + GPS + category | Photo + GPS + category | Photo + GPS + category | Photo + GPS + DIGIPIN + R2. Category = infrastructure type only (pothole). |
| Status tracking | Public timeline | Email updates | In-app tracking | Real-time state machine with RBAC-scoped visibility |
| Contractor accountability | None (self-reported) | None (self-reported) | None (ULB self-reports) | Haversine spatial drift check (30m threshold). Contractor must be at location. |
| Verification | None (one-sided) | None (one-sided) | Citizen feedback (optional) | Mandatory crony ground-truth verification before resolved status |
| Bounty/reward | None | None | None (Swachh Survekshan rankings) | Per-report verification bounty. Economic incentive to verify fixes. |
| Trust model | Open (anyone reports) | Open (anyone reports) | Open (anyone reports) | Whitelist-only. Trust hierarchy via party worker onboarding. |
| Dashboard | Agency dashboard (paid) | Council dashboard | ULB dashboard | Executive War Room. Tactical UI. Not a standard admin panel. |
| Offline support | Limited | None | Limited | Offline-first queue with IndexedDB. Sync on reconnect. |
| Geo-encoding | Lat/lon | Lat/lon + postcode | Lat/lon | DIGIPIN (India government standard grid encoding) |
| Open source | No (proprietary) | Yes (AGPL) | No (government) | Apache 2.0 + Commons Clause |

### Key Insight

PRISM's differentiation is NOT in report submission (every platform does this). Differentiation is in the **closed accountability loop**: spatial drift verification + independent crony verification + bounty incentive. No other civic platform validates that contractors were physically at the repair site, or requires independent ground-truth before marking resolved.

## Sources

- PRISM codebase analysis: `prism-engine/src/index.ts` (prototype, ~1500 lines)
- PRISM DB schema: `prism-engine/migrations/0001_init_schema.sql` (Users, Whitelisted_Sources, Reports, Interventions, Verifications)
- PRISM frontend: `prism/src/routes/+page.svelte` (report submission), `prism/src/routes/board/+page.svelte` (War Room), `prism/src/routes/bounties/+page.svelte` (bounty discovery)
- PRISM PROJECT.md: scope, requirements, out-of-scope decisions
- SeeClickFix feature analysis: Tyler Technologies documentation (training data, MEDIUM confidence)
- FixMyStreet: mySociety open-source platform (training data, MEDIUM confidence)
- Swachhata App: MoHUA India civic complaint platform (training data, MEDIUM confidence)
- Web search attempted but rate-limited. Civic tech feature landscape based on established domain knowledge.

---
*Feature research for: Decentralized civic infrastructure reporting platform*
*Researched: 2026-04-13*

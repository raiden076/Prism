# Requirements: PRISM

**Defined:** 2026-04-12
**Core Value:** Reports go in, get fixed, get verified — with zero trust and full accountability. If the report-to-resolution loop doesn't work flawlessly, nothing else matters.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can authenticate via phone OTP through SuperTokens
- [ ] **AUTH-02**: User session persists across requests via SuperTokens session management
- [ ] **AUTH-03**: New user auto-created on first successful OTP verification (crony role default)
- [ ] **AUTH-04**: User can sign out, revoking SuperTokens session

### Whitelist & Hierarchy

- [ ] **WHIT-01**: Whitelist webhook accepts name, reference_id, phone_number, referrer_phone
- [ ] **WHIT-02**: User record created with crony role linked to whitelisted source
- [ ] **WHIT-03**: Referrer hierarchy established via reporter_id with depth tracking
- [ ] **WHIT-04**: Recursive hierarchy subtree queryable for access control

### Role-Based Access Control

- [ ] **RBAC-01**: Admin role sees all reports and can manage users
- [ ] **RBAC-02**: Contractor role sees only assigned reports
- [ ] **RBAC-03**: Crony role sees own reports and bounties available for verification
- [ ] **RBAC-04**: RBAC middleware enforces permissions on all protected routes
- [ ] **RBAC-05**: Hierarchy-scoped access — masters/region heads see reports from their subtree

### Report Submission

- [ ] **RPT-01**: Authenticated whitelisted user can submit report with photo (multipart/form-data)
- [ ] **RPT-02**: Report captures latitude, longitude, and auto-generated DIGIPIN
- [ ] **RPT-03**: Photo uploaded to R2 with UUID-based key
- [ ] **RPT-04**: Phase 1 reports auto-approved (status = 'approved')
- [ ] **RPT-05**: Invalid payload (missing media/lat/lon) returns 400 with clear error message

### Report Querying

- [ ] **RPT-06**: Board endpoint returns reports ordered by creation date (paginated, max 100)
- [ ] **RPT-07**: Nearby reports queryable by lat/lon/radius with distance calculation
- [ ] **RPT-08**: Reports filterable by status (pending, pending_review, assigned, fixed_pending_verification, resolved)
- [ ] **RPT-09**: Query results scoped by user role (RBAC filter)

### Report Status Tracking

- [ ] **RPT-10**: Report status state machine enforces valid transitions only
- [ ] **RPT-11**: Status transitions: pending → approved → assigned → fixed_pending_verification → resolved
- [ ] **RPT-12**: Invalid status transitions rejected with error

### Accountability Loop

- [ ] **ACCT-01**: Contractor can submit fix with report_id, fix coordinates, repair tier, R2 proof image
- [ ] **ACCT-02**: Haversine spatial drift calculated between report and fix coordinates
- [ ] **ACCT-03**: Drift ≤ 30m → fix accepted, status → fixed_pending_verification
- [ ] **ACCT-04**: Drift > 30m → fix flagged for review with drift distance in response

### Verification Loop

- [ ] **VERF-01**: Crony can submit verification with report_id, is_resolved boolean, R2 verification image
- [ ] **VERF-02**: Verification confirmed (is_resolved=true) → report status → resolved
- [ ] **VERF-03**: Verification failed (is_resolved=false) → report status → pending_review
- [ ] **VERF-04**: Verification record stored with verifier_id, timestamp, image URL

### Bounty System

- [ ] **BNTY-01**: Bounties auto-generated for reports with fixed_pending_verification status
- [ ] **BNTY-02**: Nearby bounties discoverable by lat/lon/radius with distance sorting
- [ ] **BNTY-03**: Bounty claimable by authenticated crony (15-min lock period)
- [ ] **BNTY-04**: Bounty completed when verification submitted within spatial threshold
- [ ] **BNTY-05**: Expired bounties (past expires_at) not claimable
- [ ] **BNTY-06**: Bounty amount stored per report, visible to cronies

### Frontend — Field Reporter

- [ ] **UI-01**: Camera capture with GPS metadata stamping
- [ ] **UI-02**: Report submission form with photo preview, DIGIPIN display, haptic feedback
- [ ] **UI-03**: Neo-Brutalism design system applied (solid shadows, stark palette, physical buttons)

### Frontend — War Room

- [ ] **UI-04**: Report list with status badges, creation date, DIGIPIN, severity
- [ ] **UI-05**: Report filtering by status
- [ ] **UI-06**: Contractor deployment action on pending reports
- [ ] **UI-07**: User hierarchy tree visualization

### Frontend — Bounty Discovery

- [ ] **UI-08**: Nearby bounties list sorted by distance
- [ ] **UI-09**: Bounty claim action with 15-min countdown
- [ ] **UI-10**: Verification submission flow (photo + GPS + resolved checkbox)

### Testing

- [ ] **TEST-01**: Unit tests for all services (DIGIPIN, Haversine, status state machine, RBAC filters)
- [ ] **TEST-02**: Unit tests for all middleware (auth, validation, error handling)
- [ ] **TEST-03**: E2E tests for all API routes with D1/R2 test environment
- [ ] **TEST-04**: All tests must pass before frontend development begins

## v2 Requirements

### Phase 2 AI

- **AI-01**: YOLO inference on submitted images with confidence scoring
- **AI-02**: Confidence ≥ 0.90 → auto-approve; 0.65-0.90 → pending_review; < 0.65 → auto-drop
- **AI-03**: Appeal bypass for auto-dropped reports

### Enhanced Features

- **OFFL-01**: Offline-first report queue with IndexedDB sync on reconnect
- **NTFY-01**: Push notification on report status changes
- **ANLY-01**: Analytics pipeline with resolution time metrics
- **MAP-01**: Map-based report visualization with Leaflet/Mapbox
- **GEO-01**: Geo-fence cluster detection for duplicate grouping

### Android

- **APK-01**: Tauri mobile build targeting Android APK
- **APK-02**: Native camera + GPS integration via Tauri plugins
- **APK-03**: Haptic feedback via native vibration API

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time WebSocket contractor tracking | Requires Durable Objects, complex infra, not needed for pilot scale |
| Anonymous reporting | Contradicts whitelist trust model — PRISM values trusted sources over volume |
| Email/password auth | India's primary identity = phone number, not email |
| Multi-tenant support | Single WB deployment, tenant isolation premature |
| Upvote/star reports | Encourages duplicates, PRISM prevents duplicates via nearby query |
| Social login (Google/GitHub) | Government users = phone-based identity, not social |
| Video uploads | Storage/bandwidth costs for pilot, photos sufficient for pothole verification |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| WHIT-01 | Phase 1 | Pending |
| WHIT-02 | Phase 1 | Pending |
| WHIT-03 | Phase 1 | Pending |
| WHIT-04 | Phase 1 | Pending |
| RBAC-01 | Phase 1 | Pending |
| RBAC-02 | Phase 1 | Pending |
| RBAC-03 | Phase 1 | Pending |
| RBAC-04 | Phase 1 | Pending |
| RBAC-05 | Phase 1 | Pending |
| RPT-01 | Phase 2 | Pending |
| RPT-02 | Phase 2 | Pending |
| RPT-03 | Phase 2 | Pending |
| RPT-04 | Phase 2 | Pending |
| RPT-05 | Phase 2 | Pending |
| RPT-06 | Phase 2 | Pending |
| RPT-07 | Phase 2 | Pending |
| RPT-08 | Phase 2 | Pending |
| RPT-09 | Phase 2 | Pending |
| RPT-10 | Phase 2 | Pending |
| RPT-11 | Phase 2 | Pending |
| RPT-12 | Phase 2 | Pending |
| ACCT-01 | Phase 3 | Pending |
| ACCT-02 | Phase 3 | Pending |
| ACCT-03 | Phase 3 | Pending |
| ACCT-04 | Phase 3 | Pending |
| VERF-01 | Phase 3 | Pending |
| VERF-02 | Phase 3 | Pending |
| VERF-03 | Phase 3 | Pending |
| VERF-04 | Phase 3 | Pending |
| BNTY-01 | Phase 4 | Pending |
| BNTY-02 | Phase 4 | Pending |
| BNTY-03 | Phase 4 | Pending |
| BNTY-04 | Phase 4 | Pending |
| BNTY-05 | Phase 4 | Pending |
| BNTY-06 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 5 | Pending |
| UI-06 | Phase 5 | Pending |
| UI-07 | Phase 5 | Pending |
| UI-08 | Phase 6 | Pending |
| UI-09 | Phase 6 | Pending |
| UI-10 | Phase 6 | Pending |
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 2 | Pending |
| TEST-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after initial definition*

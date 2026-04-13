# Phase 3: Core Reports - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 03-core-reports
**Areas discussed:** Webhook auth, Report trust verification, Media constraints, Nearby radius

---

## Whitelist Webhook Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Unauthenticated v1 | No auth at app level, WAF/infrastructure handles it | |
| Secret header | Static secret via X-Webhook-Secret header, env var | ✓ |
| API key per caller | Per-caller keys stored in D1 | |

**User's choice:** Secret header
**Notes:** Simple, effective for single trusted caller (government party system). One shared secret in Workers env var.

---

## Report Trust Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-only any user | Any authenticated SuperTokens user can submit | |
| Require whitelisted | Check Whitelisted_Sources for linked user | ✓ |
| Dual-track tag | Allow all, tag reports as verified/unverified source | |

**User's choice:** Require whitelisted
**Notes:** Matches ROADMAP "trusted whitelisted user" language. Non-whitelisted authenticated users get 403.

---

## Media Upload Constraints

| Option | Description | Selected |
|--------|-------------|----------|
| No constraints v1 | No MIME/size checks, add later | |
| Images only 10MB | image/jpeg, image/png, image/webp, max 10MB | ✓ |
| Images only 5MB | image/*, max 5MB | |

**User's choice:** Images only 10MB
**Notes:** Standard mobile camera output. Validates Content-Type from multipart, rejects non-image with 400.

---

## Nearby Search Radius

| Option | Description | Selected |
|--------|-------------|----------|
| 200m default, 1km max | Dense urban, street-level | |
| 500m default, 2km max | Mixed urban/suburban | |
| 1km default, 5km max | Rural, wide area scan | ✓ |

**User's choice:** 1km default, 5km max
**Notes:** West Bengal mixed urban/rural roads. Wide area scan appropriate for pothole discovery.

---

## Claude's Discretion

- Secret header naming convention
- Whitelisted source lookup caching strategy
- Image validation depth (MIME only vs magic bytes)
- Board response field selection
- Pagination implementation (cursor vs offset)

## Deferred Ideas

None — discussion stayed within phase scope

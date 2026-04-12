---
phase: 01-foundation
reviewed: 2026-04-13T12:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - prism-engine/src/lib/types.ts
  - prism-engine/src/lib/digipin.ts
  - prism-engine/src/lib/spatial.ts
  - prism-engine/src/lib/queries.ts
  - prism-engine/src/index.ts
  - prism-engine/tests/setup.ts
  - prism-engine/tests/factories.ts
  - prism-engine/tests/worker.ts
  - prism-engine/tests/lib/digipin.test.ts
  - prism-engine/tests/lib/spatial.test.ts
  - prism-engine/tests/lib/types.test.ts
  - prism-engine/tests/lib/queries.test.ts
  - prism-engine/tests/lib/test-helpers.test.ts
  - prism-engine/vitest.config.ts
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-04-13T12:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed 14 files across the PRISM backend engine: type definitions, DIGIPIN utilities, spatial calculations, query layer, main Hono router, and test infrastructure. Two critical security/logic issues found, plus several warnings around unsafe casts, missing input validation, and code duplication.

The lib modules (`types.ts`, `digipin.ts`, `spatial.ts`, `queries.ts`) are well-structured with good type safety. The test infrastructure is solid with proper factory helpers. The main `index.ts` router has the most issues due to its monolithic nature and legacy patterns that bypass the typed query layer.

## Critical Issues

### CR-01: OTPless auth bypass -- token never verified server-side

**File:** `prism-engine/src/index.ts:464-544`
**Issue:** The `/api/v2/auth/verify` endpoint accepts arbitrary `token` and `phoneNumber` values without verifying the token against OTPless API. The `TODO` at line 468 acknowledges this. Any caller can authenticate as any phone number by sending any string as `token`, granting full access to the system. This is a production authentication bypass.
**Fix:**
```typescript
// Replace the TODO block with actual OTPless verification:
const verifyResponse = await fetch('https://userauth.otpless.app/v1/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    clientId: c.env.OTPLESS_CLIENT_ID,
    clientSecret: c.env.OTPLESS_CLIENT_SECRET,
  },
  body: JSON.stringify({ token }),
});
const verifyData = await verifyResponse.json();
if (!verifyData.success) {
  return c.json({ error: 'Invalid OTP token' }, 401);
}
const phoneNumber = verifyData.phoneNumber; // Use verified phone, not user-supplied
```

### CR-02: Bearer token treated as raw phone number in legacy auth

**File:** `prism-engine/src/index.ts:98-103`
**Issue:** The `getUserFromAuth` function strips the `Bearer ` prefix and treats the remainder as a phone number. This means any JWT or session token passed as `Bearer <jwt>` would be looked up directly in the Users table by phone number. A crafted Bearer token matching a phone number grants unauthorized access. Same pattern repeated at `/api/v2/user/info` (line 552-558).
**Fix:**
```typescript
// For legacy mode, only accept raw phone numbers (no Bearer prefix):
if (authHeader.startsWith('Bearer ')) {
  return null; // Bearer tokens only valid via SuperTokens path
}
const phoneNumber = authHeader;
```

## Warnings

### WR-01: Unsafe `as` casts on D1 query results throughout index.ts

**File:** `prism-engine/src/index.ts:85, 110, 129, 189`
**Issue:** Multiple places cast D1 `.first()` results directly to `UserContext` or other types (e.g., `user as UserContext` at line 85). D1 returns plain objects with no runtime type guarantee. Invalid DB state (e.g., missing column) would propagate as runtime property access errors rather than being caught early.
**Fix:** Add runtime validation or use the typed query layer from `queries.ts` which already handles row-to-app mapping. The `getUserByPhone` function returns a properly typed `User` object.

### WR-02: Duplicate Haversine implementation in index.ts

**File:** `prism-engine/src/index.ts:652-664`
**Issue:** A standalone `haversine` function is defined inline in `index.ts`, duplicating the canonical `haversineDistance` from `spatial.ts`. The file already imports `latLngToDIGIPIN` from the lib directory but does not import the spatial utilities. This leads to code duplication risk and potential inconsistency.
**Fix:**
```typescript
// Replace inline haversine with:
import { haversineDistance } from './lib/spatial';
// Then replace all haversine(...) calls with haversineDistance(...)
```

### WR-03: Missing input validation on coordinate parsing

**File:** `prism-engine/src/index.ts:389-390, 615-616`
**Issue:** `parseFloat()` on user-supplied `latitude`/`longitude` values returns `NaN` for invalid input without any check. NaN values would propagate through DIGIPIN encoding and Haversine calculations, producing garbage data in the database.
**Fix:**
```typescript
const latitude = parseFloat(latString.toString());
const longitude = parseFloat(lonString.toString());
if (isNaN(latitude) || isNaN(longitude)) {
  return c.json({ error: 'Invalid latitude/longitude values' }, 400);
}
if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
  return c.json({ error: 'Latitude/longitude out of valid range' }, 400);
}
```

### WR-04: Status value `'approved'` not in D1 CHECK constraint

**File:** `prism-engine/src/index.ts:407, 1131`
**Issue:** The harvest route inserts reports with `status = 'approved'` (line 407), and the approve endpoint sets `status = 'approved'` (line 1131). However, `'approved'` is not in the D1 CHECK constraint for Reports.status which only allows: `pending`, `pending_review`, `assigned`, `fixed_pending_verification`, `resolved`. This would cause a D1 constraint violation at runtime.
**Fix:** Use a valid status from the constraint. For auto-approved harvest reports, use `'pending'` or add `'approved'` to the CHECK constraint via a migration.

### WR-05: Status value `'rejected'` not in D1 CHECK constraint

**File:** `prism-engine/src/index.ts:1148`
**Issue:** The reject endpoint sets `status = 'rejected'`, but this value is not in the D1 CHECK constraint either. Same constraint violation risk as WR-04.
**Fix:** Add `'rejected'` to the Reports status CHECK constraint via a new migration, or use `'pending_review'` as a holding status for rejected items.

### WR-06: Race condition on bounty claim (no atomic check-and-update)

**File:** `prism-engine/src/index.ts:825-842`
**Issue:** The bounty claim endpoint first SELECTs to check availability, then UPDATEs in a separate statement. Between these two operations, another request could claim the same bounty. While D1 serialized execution mitigates this in single-instance deployments, it is a correctness concern for concurrent access patterns.
**Fix:**
```typescript
// Use conditional UPDATE that returns changes count:
const result = await c.env.DB.prepare(
  `UPDATE VerificationBounties
   SET bounty_status = 'claimed', claimed_by = ?, claimed_at = ?
   WHERE id = ? AND bounty_status = 'available' AND expires_at > ?`
).bind(verifier.id, Date.now(), bounty_id, Date.now()).run();

if (!result.meta.changes) {
  return c.json({ error: 'Bounty not available or expired' }, 404);
}
```
Note: The `queries.ts` layer already implements this pattern correctly (see `claimBounty` at line 459-475).

### WR-07: DIGIPIN encoding bounds check is warn-only, not enforced

**File:** `prism-engine/src/lib/digipin.ts:40-45`
**Issue:** `latLngToDIGIPIN` logs a `console.warn` for out-of-bounds coordinates but proceeds with encoding anyway. The clamping at lines 61-65 silently maps invalid inputs to boundary grid cells. This could produce incorrect DIGIPINs for non-India coordinates without any error signal to the caller.
**Fix:** Either throw an error for out-of-bounds coordinates, or return a result type indicating the input was clamped. For a civic infrastructure app, silent clamping is dangerous as it produces plausible but wrong location codes.

## Info

### IN-01: Monolithic router file

**File:** `prism-engine/src/index.ts`
**Issue:** The main router file is ~1644 lines with all routes in a single file. While this is a known architectural decision documented in the project, it makes individual route testing and maintenance harder. The new `queries.ts` lib layer is not used by `index.ts` at all.
**Fix:** Consider progressively migrating route handlers to use the typed query layer from `lib/queries.ts`.

### IN-02: `console.log` in production lib code

**File:** `prism-engine/src/lib/supertokens.ts:50,70` and `prism-engine/src/lib/feature-flags.ts:117`
**Issue:** Debug `console.log` statements found in SuperTokens and feature flag modules. Production code should use structured logging or remove these.
**Fix:** Replace with `console.debug` behind a flag, or remove entirely.

### IN-03: Mock AI confidence in v2 reports endpoint

**File:** `prism-engine/src/index.ts:620-621`
**Issue:** The `/api/v2/reports` endpoint uses a hardcoded `confidence = 0.85` mock value for AI scoring. This is intentional for Phase 1 but should be tracked for Phase 2 activation.
**Fix:** Add a code comment referencing the Phase 2 integration ticket.

### IN-04: `getDIGIPINPrefix` parameter `levels` shadows loop variable

**File:** `prism-engine/src/lib/digipin.ts:156`
**Issue:** The `levels` parameter name could be confused with the encoding loop levels. Minor naming concern only.
**Fix:** Consider renaming to `depth` or `precisionLevels` for clarity.

---

_Reviewed: 2026-04-13T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

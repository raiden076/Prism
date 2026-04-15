---
phase: 03-core-reports
reviewed: 2026-04-15T12:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - prism-engine/src/routes/whitelist.ts
  - prism-engine/src/routes/reports.ts
  - prism-engine/src/routes/board.ts
  - prism-engine/src/lib/queries.ts
  - prism-engine/src/lib/types.ts
  - prism-engine/src/index.ts
  - prism-engine/tests/routes/whitelist.test.ts
  - prism-engine/tests/routes/reports.test.ts
  - prism-engine/tests/routes/board.test.ts
  - prism-engine/tests/setup.ts
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-15T12:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed 10 files across route handlers, query layer, type definitions, main router, and test suites for the Phase 3 core-reports module. Found 3 critical issues (security vulnerabilities in legacy routes within index.ts), 7 warnings (logic bugs and missing edge-case handling), and 5 info items.

The new modular routes (`whitelist.ts`, `reports.ts`, `board.ts`) are well-structured with proper auth middleware, input validation, and prepared statements. However, `index.ts` retains legacy inline route handlers that duplicate the new modular routes with weaker security. This creates two classes of the same endpoints with different auth and validation properties.

## Critical Issues

### CR-01: Duplicate Whitelist Route Without Webhook Secret Validation

**File:** `prism-engine/src/index.ts:181-230`
**Issue:** `index.ts` registers `app.post('/api/v1/whitelist', ...)` at line 181 AND `app.route('/api/v1/whitelist', whitelistRoutes)` at line 41. Hono processes routes in registration order. Since `app.route()` is called first (line 41), the modular route with webhook secret validation runs first and should shadow the legacy handler. However, this is fragile -- any reordering of imports/routes silently disables auth. The legacy handler at line 181 has no `X-Webhook-Secret` check, allowing unauthenticated user creation.

**Fix:** Remove the legacy inline whitelist handler at lines 181-230 in `index.ts`. The modular `whitelistRoutes` already covers this endpoint with proper security.

```typescript
// DELETE lines 181-230 in prism-engine/src/index.ts:
// app.post('/api/v1/whitelist', async (c) => { ... });
```

### CR-02: Legacy Harvest Route Uses Phone-in-Header Auth Bypassing JWT

**File:** `prism-engine/src/index.ts:233-284`
**Issue:** The inline `/api/v1/reports/harvest` at line 233 uses raw `Authorization` header as a phone number (no JWT verification). Meanwhile, the modular `reportRoutes` at line 45 registers `/api/v1/reports/harvest` with `withUser()` JWT middleware. Since `app.route()` is called first, the secure route should match first. But the legacy handler creates a second attack surface: if route registration order changes, anyone can submit reports by guessing phone numbers. Additionally, the legacy route inserts status `'approved'` instead of `'pending'`, bypassing review flow.

**Fix:** Remove the legacy inline harvest handler at lines 233-284 in `index.ts`.

```typescript
// DELETE lines 233-284 in prism-engine/src/index.ts:
// app.post('/api/v1/reports/harvest', async (c) => { ... });
```

### CR-03: Duplicate Board Route Without Auth -- Leaks All Reports

**File:** `prism-engine/src/index.ts:289-292`
**Issue:** `app.get('/api/v2/reports', ...)` at line 289 has no authentication. The modular `boardRoutes` registered at line 48 uses `withUser()` + RBAC filtering. Since `app.route()` is called first, the secure route should match. But the legacy handler returns ALL reports with no auth check, no pagination, and no RBAC. If route ordering changes, this becomes an unauthenticated data exfiltration vector.

**Fix:** Remove the legacy inline board route at lines 289-292 in `index.ts`.

```typescript
// DELETE lines 289-292 in prism-engine/src/index.ts:
// app.get('/api/v2/reports', async (c) => { ... });
```

## Warnings

### WR-01: Board Route Does Not Validate Pagination Bounds

**File:** `prism-engine/src/routes/board.ts:47-49`
**Issue:** `parseInt` on `limit` and `offset` can produce `NaN` if the query param is non-numeric (e.g., `limit=abc`). `NaN` propagates into the SQL query via `getBoardReports`. While `getBoardReports` caps limit at 100, offset is not validated -- `NaN` offset could cause unexpected behavior or errors.

**Fix:**
```typescript
const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 100) : 100;
const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;
```

### WR-02: getBoardReports Interpolates WHERE Clause -- Potential SQL Injection Surface

**File:** `prism-engine/src/lib/queries.ts:243-253`
**Issue:** `filter.whereClause` is interpolated directly into SQL: `SELECT COUNT(*) as total FROM Reports WHERE ${where}`. Currently safe because `getReportsFilter()` in `rbac.ts` only returns hardcoded strings (`'1=1'`, parameterized subqueries). However, any future change to `getReportsFilter` that includes user input in `whereClause` without parameterization introduces SQL injection. This is an architectural footgun.

**Fix:** Document the security contract in `getReportsFilter`'s return type or validate that `whereClause` matches a whitelist of known patterns. Consider using a query builder instead of string interpolation.

### WR-03: Whitelist Route Continues When Referrer Not Found

**File:** `prism-engine/src/routes/whitelist.ts:40-44`
**Issue:** When `referrer_phone` is provided but the referrer user does not exist in D1, the code silently sets `reporterId = null` and `hierarchyDepth = 0`. This means hierarchy tracking is lost for any webhook call where the referrer hasn't been registered yet. Depending on business logic, this may be intentional (graceful degradation) or a data integrity issue (orphaned hierarchy entries).

**Fix:** If referrer must exist, return 400:
```typescript
if (!referrer) {
  return c.json({ error: 'Referrer phone not registered' }, 400);
}
```
If graceful degradation is intentional, add a comment documenting this decision.

### WR-04: Report Status Transition Has No Authorization Check

**File:** `prism-engine/src/routes/reports.ts:146-184`
**Issue:** `POST /:id/status` requires `withUser()` (authenticated user) but does not check the user's role or relationship to the report. Any authenticated user (including crony) can transition any report's status. Per CLAUDE.md RBAC spec, status transitions should be role-scoped (e.g., only admin/contractor can assign, only crony who filed can change status).

**Fix:** Add role-based authorization after fetching current report:
```typescript
if (user.role === 'crony' && current.reporterId !== user.id) {
  return c.json({ error: 'Forbidden -- not your report' }, 403);
}
```

### WR-05: Nearby Reports Route Has No Auth -- Unlimited Radius Query

**File:** `prism-engine/src/routes/reports.ts:113-143`
**Issue:** `GET /nearby` requires no authentication and validates radius max at 5000m, but does not validate latitude/longitude ranges beyond `isNaN`. A request with `latitude=999` would pass the NaN check but produce meaningless results. More importantly, since it's unauthenticated, it can be abused for enumeration of all report locations.

**Fix:** Add lat/lon range validation:
```typescript
if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
  return c.json({ error: 'Invalid latitude or longitude range' }, 400);
}
```

### WR-06: Legacy v2 Reports Route Uses Bogus DIGIPIN Generation

**File:** `prism-engine/src/index.ts:359`
**Issue:** `const digipin = 'DP-${lat...}${lon...}'.substring(0, 10)` is a fake placeholder, not the real `latLngToDIGIPIN` algorithm. The real algorithm is imported at line 14 but not used here. Reports created via this legacy path have incorrect DIGIPIN codes, corrupting geo-indexing.

**Fix:** If this route must stay, use the real function: `const digipin = latLngToDIGIPIN(latitude, longitude);`. Better: remove the legacy route entirely per CR-02.

### WR-07: upsertUserBySuperTokens Race Condition -- Re-fetch After Link May Miss

**File:** `prism-engine/src/lib/queries.ts:116-117`
**Issue:** After `linkSuperTokensUserId` + `getUserById`, the function returns `linked ?? user`. If `linked` is null (extremely unlikely but possible in eventual-consistency scenarios), it falls back to the stale `user` object without `supertokensUserId`. The caller then operates on a user that appears unlinked.

**Fix:** Throw if `linked` is null instead of falling back:
```typescript
const linked = await getUserById(db, user.id);
if (!linked) {
  throw new Error('User disappeared after ST ID link');
}
return linked;
```

## Info

### IN-01: Legacy Routes in index.ts Use `any` Type Casts

**File:** `prism-engine/src/index.ts:310,316,466,469,502,505,723,726,768,771,981,984,1139,1149,1153,1157`
**Issue:** Extensive use of `(report: any)`, `(fence: any)`, `(contractor: any)` in the legacy inline routes. While these routes should be removed per CR-01/CR-02/CR-03, the `any` casts bypass TypeScript safety.

**Fix:** Remove legacy routes. For any remaining code, use proper typed interfaces.

### IN-02: Test Files Duplicate JWT/Fetch Mock Setup

**File:** `prism-engine/tests/routes/reports.test.ts:40-81`, `prism-engine/tests/routes/board.test.ts:45-86`
**Issue:** Both test files contain identical `ensureKeys`, `generateAccessToken`, `mockFetch`, `restoreFetch` functions. This ~40 lines of duplicated setup should be extracted to a shared test utility.

**Fix:** Extract to `tests/helpers/auth.ts` and import from both test files.

### IN-03: Bounty Amount Uses Math.random() -- Non-Deterministic

**File:** `prism-engine/src/index.ts:508`
**Issue:** `bounty_amount: 5 + Math.floor(Math.random() * 5)` produces non-deterministic bounty amounts in the legacy route. This makes testing unreliable and could create unfair bounty distribution.

**Fix:** Use a deterministic calculation or fixed default per the `createBounty` query function.

### IN-04: console.error Left in Production Code

**File:** `prism-engine/src/index.ts:1043,1083,1113,1165`
**Issue:** `console.error` calls in contractor location routes. In Cloudflare Workers, `console.error` logs are visible in production. Should use structured logging or be removed.

**Fix:** Remove or replace with a structured logging utility.

### IN-05: Test Setup Only Includes 3 of 5 Migrations

**File:** `prism-engine/tests/setup.ts:9-165`
**Issue:** `MIGRATIONS` array includes migrations 0001, 0002, 0003 but the project has 5 migrations per the CLAUDE.md docs. Missing migrations could cause tests to pass against an incomplete schema.

**Fix:** Add missing migrations 0004 and 0005 to the `MIGRATIONS` array in setup.ts.

---

_Reviewed: 2026-04-15T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

# Domain Pitfalls

**Domain:** Civic infrastructure reporting (Cloudflare Workers + Hono.js + D1 + R2 + SuperTokens + Geo)
**Researched:** 2026-04-12

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: SuperTokens Edge Runtime Incompatibility
**What goes wrong:** `supertokens-node` uses Node.js APIs (`crypto.createHash`, `http/https` modules, file-system cache) that break or behave differently on Cloudflare Workers even with `nodejs_compat` flag. Session creation fails silently, auth middleware hangs, or tokens are invalid.
**Why it happens:** SuperTokens was built for Node.js runtimes. Edge runtimes use different HTTP primitives. The `nodejs_compat` flag polyfills some but not all Node APIs. GitHub issues #835, #898, #913, #1012 on `supertokens-node` show Edge compatibility PRs were abandoned. The core team has not shipped stable Cloudflare Workers support.
**Consequences:** Auth system fails in production. Session tokens don't validate. Login flow hangs. Entire app is unusable.
**Prevention:**
- Test SuperTokens init + session flow on actual Workers (not just `wrangler dev` local mode) before building any auth-dependent features.
- Feature-flag auth (`USE_SUPERTOKENS_AUTH` already in wrangler.jsonc -- preserve this).
- Have fallback plan: phone-in-header auth (current prototype pattern) or switch to `jose` library for JWT + custom phone OTP.
- Pin SuperTokens version, test in CI against `--minify` and `--compat-flags=nodejs_compat`.
**Detection:** Login returns 500, session tokens rejected, `crypto` usage errors in Worker logs, middleware timeout.
**Confidence:** MEDIUM (based on GitHub issues + abandoned PRs; could not verify latest state of SuperTokens edge support due to docs access restrictions)

### Pitfall 2: D1 Single-Threaded Bottleneck Under Spatial Queries
**What goes wrong:** D1 is SQLite -- single-writer, serialized queries. Each D1 database handles one write at a time. Read replicas are eventually consistent. Spatial queries (nearby reports, bounty discovery) that scan many rows block all other writes during execution.
**Why it happens:** D1 uses a single primary for writes. Nearby-reports queries without proper pre-filtering will full-table-scan the Reports table. Each scan holds the write lock. Haversine-in-SQL is impossible (no trig functions in SQLite), so the pattern becomes: SELECT many rows -> filter in JS -> multiple round trips.
**Consequences:** Report submissions timeout while nearby-query runs. Board dashboard loads slow under load. Bounty claims fail with "database is locked" errors. Cascading latency.
**Prevention:**
- Never do full-table spatial scans. Use DIGIPIN prefix matching as coarse geo-filter first, then Haversine refinement on the small result set.
- Add `LIMIT` to all list queries. No unbounded SELECT.
- Pre-compute `digipin_prefix` column (first 4-6 chars of DIGIPIN) for index-friendly range queries.
- Add indexes on `Reports.status`, `Reports.digipin`, `Bounties.status`.
- Move Haversine calculation to Worker code (JS), not SQL.
**Detection:** P99 latency spikes on report submission when board is being queried. `database is locked` errors. Durable Object request queue growing.

### Pitfall 3: Report Status State Machine Violations
**What goes wrong:** Report moves from `resolved` back to `approved`, or from `pending` directly to `fixed_pending_verification`. Board shows impossible states. Contractor gets assigned to already-resolved reports.
**Why it happens:** Prototype had status updates scattered across routes with no transition validation. Any route could set any status. Race conditions between contractor fix submission and crony verification.
**Consequences:** Board data corrupt. Bounties created for non-fixed reports. Verification loop breaks. Government stakeholders see wrong data.
**Prevention:**
- Centralize all status transitions through `transitionStatus()` in report.service.ts.
- Define VALID_TRANSITIONS map (see ARCHITECTURE.md Pattern 6).
- Use D1 batch for status update + dependent writes (e.g., status change + bounty creation).
- Add DB-level CHECK constraint on status column if D1 supports it for enum validation.
**Detection:** Status values in DB that don't appear in state machine. Reports in `assigned` with no contractor. Bounties for non-`fixed_pending_verification` reports.

### Pitfall 4: Plaintext Secrets in wrangler.jsonc
**What goes wrong:** `SUPERTOKENS_API_KEY` and `SUPERTOKENS_CORE_URL` are in `vars` (plaintext) in wrangler.jsonc, committed to git. API keys exposed in repository history.
**Why it happens:** `vars` in wrangler config are not encrypted. Only `.dev.vars` file is local-only. Secrets should use `wrangler secret put` or Cloudflare dashboard.
**Consequences:** SuperTokens core compromised. Session tokens forged. Full auth bypass.
**Prevention:**
- Move ALL secrets to `wrangler secret put` immediately.
- Keep only non-sensitive config in `vars` (feature flags, public URLs).
- Add `.dev.vars` to `.gitignore` (for local dev secrets).
- Audit git history for leaked keys. Rotate any committed secrets.
**Detection:** `SUPERTOKENS_API_KEY` visible in git log. `wrangler.jsonc` contains values that look like API keys.

### Pitfall 5: R2 Concurrent Write Collision
**What goes wrong:** Two uploads to the same R2 object key within 1 second. One silently overwrites the other. Report images get swapped.
**Why it happens:** R2 allows only 1 concurrent write per key per second. If key generation uses predictable patterns (timestamp-based, sequential), collisions happen under load.
**Consequences:** Report shows wrong image. Contractor fix photo overwrites original report photo. Evidence integrity compromised for government stakeholders.
**Prevention:**
- Always use `crypto.randomUUID()` for R2 object keys (already planned in architecture).
- Never use timestamp-based or sequential keys.
- Include report ID + media type in key structure: `reports/{reportId}/{uuid}.{ext}`.
- Consider checksum validation: verify uploaded object matches expected size.
**Detection:** Media URLs returning wrong images. R2 overwrite errors in logs. Image content doesn't match report metadata.

### Pitfall 6: Geolocation Accuracy Insufficient for 30m Drift Check
**What goes wrong:** GPS reports accuracy of 50-200m. Haversine drift check requires <= 30m. Contractor submits fix from same location but drift check fails because GPS accuracy is poor, not because location is wrong. Legitimate fixes rejected.
**Why it happens:** `enableHighAccuracy` is a hint, not guarantee. Indoor/suburban GPS accuracy is often 30-100m. Android GPS cold-start takes 10-60 seconds for high accuracy. The 30m threshold is tighter than consumer GPS reliability.
**Consequences:** Contractors can't submit fixes. Cronies can't verify. Core value loop breaks. Users blame the app.
**Prevention:**
- Require minimum accuracy threshold before accepting location: reject if `coords.accuracy > 30`.
- Use `watchPosition()` instead of `getCurrentPosition()` -- collect multiple readings, use the best.
- Display current GPS accuracy to user. Warn if accuracy is insufficient.
- Consider using Android FusedLocationProvider via Tauri native binding for better accuracy.
- For drift check: compare contractor GPS accuracy + actual distance. If distance < accuracy, accept (can't distinguish).
- Document the accuracy limitation. Government stakeholders need to understand this is hardware-limited.
**Detection:** High rejection rate on fix submissions. Users report "I'm standing right there but it says too far". GPS accuracy > 30m on most submissions.

## Moderate Pitfalls

### Pitfall 7: D1 Eventual Consistency on Read-After-Write
**What goes wrong:** Crony submits report. Board dashboard queries D1 immediately. Read replica hasn't synced. Report doesn't appear for 1-5 seconds. Crony thinks submission failed, submits again (duplicate).
**Why it happens:** D1 read replicas are eventually consistent. Writes go to primary. Reads may hit a replica that hasn't received the write yet.
**Prevention:**
- For critical read-after-write (report submission -> immediate board display): use `db.batch()` to read after write in same request context, or use `db.prepare().first()` which routes to primary for consistency.
- Document the eventual consistency window for frontend. Add "refreshing..." UI pattern.
- Deduplicate reports by DIGIPIN + reporter_id + time window (5 minutes).

### Pitfall 8: D1 100 Bound Parameter Limit
**What goes wrong:** Batch query with > 100 bound parameters fails. `IN (?, ?, ?, ...)` with more than 100 status IDs or report IDs.
**Why it happens:** D1 enforces a hard limit of 100 bound parameters per prepared statement.
**Prevention:**
- Chunk large IN clauses into batches of < 100 params.
- Use temp tables for large sets: insert IDs into temp table, JOIN instead of IN.
- Test all queries with maximum expected parameter counts.

### Pitfall 9: Worker Memory Limit on Media Processing
**What goes wrong:** Processing large images in Worker memory (resizing, metadata stamping) exceeds 128MB limit. Worker crashes with OOM.
**Why it happens:** Workers have 128MB memory limit. A 10MB image decoded to raw pixels (RGBA) is 40MB. Multiple concurrent uploads push past limit.
**Prevention:**
- Do NOT process images in Workers. Upload raw to R2.
- If image processing is needed, use Cloudflare Image Resizing or a separate service.
- Set upload size limits: 5MB per image, 20MB per report.
- Validate image type/size in frontend before upload.

### Pitfall 10: Hono Middleware Ordering Bugs
**What goes wrong:** CORS errors. Auth middleware runs before error handler. Body stream consumed by validation middleware before route handler reads it.
**Why it happens:** Hono executes middleware in registration order. `app.use()` calls are sequential. Body stream can only be read once.
**Prevention:**
- Register global middleware in correct order: CORS -> Error Handler -> Auth -> Validation.
- Use `c.req.parseBody()` or `c.req.json()` once and store result in `c.set()`.
- Never call `await c.req.text()` in middleware and again in handler.
- Test middleware chain order explicitly in unit tests.

### Pitfall 11: Bounty Claim Race Condition (TOCTOU)
**What goes wrong:** Two cronies claim same bounty simultaneously. Both get "claimed" status. Both submit verification. Double payout.
**Why it happens:** Read bounty status (available), check, then update (claimed) is not atomic. Time-of-check to time-of-use gap.
**Prevention:**
- Use atomic UPDATE: `UPDATE Bounties SET status = 'claimed', claimed_by = ? WHERE id = ? AND status = 'available'`.
- Check `meta.changes === 1` to confirm exactly one row updated.
- If `meta.changes === 0`, bounty was already claimed -- return 409 Conflict.
- Add 15-minute claim expiry: `claimed_at` timestamp. Background cleanup returns expired claims to 'available'.

### Pitfall 12: Compatibility Date Stale
**What goes wrong:** `compatibility_date: "2024-03-20"` misses 2+ years of bug fixes, new D1 features, and Workers runtime improvements.
**Why it happens:** Compatibility date pins runtime behavior. Old date means old behavior.
**Prevention:**
- Update compatibility_date to current date when starting rewrite.
- Test thoroughly after update -- behavioral changes may break assumptions.
- Review Cloudflare changelog between old and new date.

## Minor Pitfalls

### Pitfall 13: D1 Migration Schema Drift
**What goes wrong:** Migration SQL defines schema that doesn't match what code expects. Code references columns that don't exist, or vice versa.
**Why it happens:** Prototype had schema drift between migration file and actual queries. Migration was not the source of truth.
**Prevention:**
- Migrations are the ONLY source of truth for schema.
- Generate TypeScript types from actual D1 schema (use `wrangler d1 execute` to inspect).
- Run all migrations in CI before tests.
- Validate every query against actual schema in integration tests.

### Pitfall 14: R2 Public Access via r2.dev
**What goes wrong:** Using `r2.dev` public bucket URL for media access. Rate limited, not for production use. Images fail to load under load.
**Why it happens:** R2 dev endpoint is for development only. Production should use custom domain or Workers proxy.
**Prevention:**
- Use custom domain on R2 bucket for production.
- Or proxy through Worker: `GET /api/v1/media/:key` -> fetch from R2 binding.
- Never expose r2.dev URL to production frontend.

### Pitfall 15: No CORS Configuration
**What goes wrong:** Frontend (Tauri app on localhost:1420) can't call backend API (localhost:8787). Browser blocks requests.
**Why it happens:** Hono doesn't set CORS headers by default. Tauri webview enforces same-origin policy.
**Prevention:**
- Use `hono/cors` middleware with explicit origin allowlist.
- In dev: allow `http://localhost:1420`.
- In prod: allow Tauri app origin or use `tauri://` scheme.
- Set `Access-Control-Allow-Headers` to include `Authorization`, `Content-Type`.

### Pitfall 16: DIGIPIN Encoding Edge Cases
**What goes wrong:** DIGIPIN encoding fails for coordinates at boundary regions. Encoding produces wrong grid cell for coordinates near cell borders.
**Why it happens:** Grid-based encoding has edge cases at cell boundaries. Floating-point precision in lat/lon can push coordinate into adjacent cell.
**Prevention:**
- Test DIGIPIN with known coordinate-DIGIPIN pairs from India Post specification.
- Validate encoding against official test vectors.
- Don't rely on DIGIPIN for sub-30m accuracy (it's coarse geohash, not GPS precision).

### Pitfall 17: No Rate Limiting on Report Submission
**What goes wrong:** Malicious or buggy client submits hundreds of reports per minute. D1 fills with garbage. R2 storage costs spike.
**Why it happens:** Whitelist-only auth doesn't prevent a compromised crony account from flooding.
**Prevention:**
- Add per-user rate limiting: max 10 reports per hour, configurable.
- Use Durable Object or KV for rate limit counters.
- For v1, simple in-Worker counter with time window (reset-aware since Workers are stateless per request, so use D1 or KV).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth setup (SuperTokens) | Edge runtime incompatibility (#1) | Feature flag, test on real Workers early, have fallback |
| Database schema | Migration drift (#13) | Migrations as source of truth, types from schema |
| Report ingestion | R2 write collision (#5), GPS accuracy (#6) | UUID keys, accuracy threshold |
| Nearby reports / spatial queries | D1 bottleneck (#2), unbounded scans | DIGIPIN prefix filter, LIMIT, indexes |
| Bounty system | Race condition (#11), D1 params limit (#8) | Atomic UPDATE, chunked queries |
| Contractor fix submission | GPS accuracy rejects valid fixes (#6) | Accuracy-aware drift check, watchPosition |
| Board dashboard | Eventual consistency (#7) | Read-after-write batching, refresh UI |
| Middleware wiring | Ordering bugs (#10), body stream | Explicit order tests, single body read |
| Production deployment | Plaintext secrets (#4), stale compat date (#12) | Secrets via wrangler, update compat_date |
| Media serving | r2.dev rate limits (#14) | Custom domain or Worker proxy |
| Frontend integration | CORS (#15) | Explicit origin allowlist |
| Scaling past pilot | D1 single-writer (#2) | Indexes, DIGIPIN pre-filter, eventual read replicas |

## Prototype-Specific Pitfalls (What Went Wrong Before)

These are known issues from the existing 1700-line monolith that the rewrite must avoid.

| Prototype Issue | Root Cause | Rewrite Prevention |
|-----------------|-----------|-------------------|
| Monolithic 1700-line index.ts | No separation of concerns | Route files + service layer + query layer |
| No input validation | Raw `c.req.json()` everywhere | Zod schemas + validation middleware |
| Schema drift (migration vs code) | Queries written independently of migration | Migrations as source of truth, types from schema |
| Auth bypass (phone in header) | No proper session management | SuperTokens sessions + middleware |
| No rate limiting | Not implemented | Per-user rate limits |
| No CORS | Not configured | hono/cors middleware |
| Status machine not enforced | Any route sets any status | Centralized transitionStatus() |
| Bounty TOCTOU race | Non-atomic claim check | Atomic UPDATE with meta.changes check |
| Durable Object for contractor tracking | Over-engineering for v1 | Remove. Status fields on Interventions table. |

## Sources

- Cloudflare D1 limits: `developers.cloudflare.com/d1/platform/limits/` (HIGH confidence, official docs)
- Cloudflare Workers limits: `developers.cloudflare.com/workers/platform/limits/` (HIGH confidence, official docs)
- Cloudflare R2 limits: `developers.cloudflare.com/r2/platform/limits/` (HIGH confidence, official docs)
- SuperTokens GitHub issues: `github.com/supertokens/supertokens-node/issues/835`, `#898`, `#913`, `#1012` (MEDIUM confidence, community + maintainer comments)
- Hono.js middleware docs: `hono.dev/docs/guides/middleware` (HIGH confidence, official docs)
- HTML5 Geolocation API: `developer.mozilla.org/en-US/docs/Web/API/Geolocation_API` (HIGH confidence, MDN)
- DIGIPIN: India Post Digital Pin Code specification (LOW confidence, spec not fully verified)
- Prototype source: `prism-engine/src/index.ts` (1691 lines, firsthand analysis)

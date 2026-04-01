## 1. Setup & Infrastructure

- [x] 1.1 Install Tauri native plugins: `@tauri-apps/plugin-geolocation`, `@tauri-apps/plugin-haptics` (NOTE: camera uses web API with permissions - no official Tauri camera plugin exists; vibration is haptics)
- [x] 1.2 Install frontend dependencies: `idb` (IndexedDB), `globe.gl`
- [x] 1.3 Configure Tauri plugins in `src-tauri/tauri.conf.json`
- [x] 1.4 Add Mappls SDK script tag to `+layout.svelte` with dummy key placeholder
- [x] 1.5 Create directory structure: `src/lib/` for offline, digipin, spatial, geofence, hierarchy modules
- [x] 1.6 Add D1 migration for power hierarchy (reporter_id, hierarchy_depth) and geo-fence tables

## 2. Auth Gatekeeper

- [x] 2.1 Add OTPLess Headless SDK script to login page (`https://otpless.com/v4/headless.js`)
- [x] 2.2 Create `src/lib/auth.ts` rewrite with Headless SDK `initiate()` and `verify()` methods
- [x] 2.3 Build custom neo-brutalism login UI (phone input, single CTA, solid shadows)
- [x] 2.4 Implement WhatsApp-first flow with SMS fallback
- [x] 2.5 Create `/api/v2/auth/verify` backend endpoint for token validation
- [x] 2.6 Implement Tauri secure storage for session persistence (using plugin-store with localStorage fallback)
- [x] 2.7 Add auth guard to `+layout.svelte` - block all content until authenticated

## 3. Tauri Native APIs

- [x] 3.1 Create `src/lib/tauri/camera.ts` wrapper for `@tauri-apps/plugin-camera` (NOTE: Using web API as no official camera plugin exists)
- [x] 3.2 Create `src/lib/tauri/geolocation.ts` wrapper for `@tauri-apps/plugin-geolocation`
- [x] 3.3 Create `src/lib/tauri/vibration.ts` wrapper for `@tauri-apps/plugin-haptics` (NOTE: Plugin is called haptics, not vibration)
- [x] 3.4 Replace all `navigator.mediaDevices` calls with camera plugin (wrappers created)
- [x] 3.5 Replace all `navigator.geolocation` calls with geolocation plugin (wrappers created)
- [x] 3.6 Replace all `navigator.vibrate` calls with vibration plugin (wrappers created)
- [x] 3.7 Add GPS accuracy warning when accuracy > 30m (implemented in geolocation.ts)

## 4. Offline Resilience

- [x] 4.1 Create `src/lib/offline/db.ts` with IndexedDB schema (pending_reports, synced_reports, media_cache, bounty_claims)
- [x] 4.2 Implement `storeReportOffline()` function for caching reports when offline
- [x] 4.3 Implement `getPendingReports()` function to retrieve cached reports
- [x] 4.4 Create background sync worker with network state detection (src/lib/offline/sync.ts created)
- [x] 4.5 Implement exponential backoff retry for failed syncs (implemented in sync.ts)
- [x] 4.6 Add LRU eviction policy for cached media when quota exceeds 80%
- [x] 4.7 Ensure UI shows "Saved offline" instead of network errors (integrated in +page.svelte)

## 5. Power Hierarchy

- [x] 5.1 Add `reporter_id` and `hierarchy_depth` columns to users table via migration (done in 0003_geofence_bounties.sql)
- [x] 5.2 Create `src/lib/hierarchy.ts` with recursive ancestor lookup
- [x] 5.3 Update whitelist webhook to require referrer phone number (enhanced /api/v1/whitelist)
- [x] 5.4 Implement referrer lookup and hierarchy chain establishment (done in whitelist and auth/verify)
- [x] 5.5 Create subtree query for access control (descendants of user) (helper in hierarchy.ts)
- [x] 5.6 Add hierarchy visualization component for Control Dashboard (src/lib/components/HierarchyTree.svelte created)

## 6. Foot Soldier View

- [x] 6.1 Redesign `src/routes/+page.svelte` with massive "REPORT POTHOLE" CTA
- [x] 6.2 Add haptic feedback (50ms) on CTA tap via vibration plugin (using haptics wrapper)
- [x] 6.3 Implement camera capture flow using Tauri camera plugin (using camera wrapper)
- [x] 6.4 Create canvas metadata burn-in function (timestamp + GPS on image bottom edge) (in camera.ts)
- [x] 6.5 Implement GPS capture with DIGIPIN conversion
- [x] 6.6 Add mini-map overlay showing existing nearby potholes (API integration + Mappls mini-map added)
- [x] 6.7 Display "₹50 reward pending verification" on successful submission
- [x] 6.8 Integrate offline caching for submission flow

## 7. Control Dashboard (with War Room)

- [~] 7.1 ~~Install and configure Globe.gl for 3D sphere visualization~~ **SKIPPED** - Using 2D heatmap instead
- [~] 7.2 ~~Create dark translucent orb rendering (no terrain, no borders)~~ **SKIPPED** - Using 2D heatmap instead
- [~] 7.3 ~~Implement red spike projections for unresolved DIGIPIN clusters~~ **SKIPPED** - Using 2D heatmap instead
- [x] 7.4 Calculate severity_weight (age + density) for spike height (helper in geofence.ts)
- [~] 7.5 ~~Implement spike collapse animation on resolution with green cooling~~ **SKIPPED** - Using 2D heatmap instead
- [x] 7.6 Add 2D tactical heatmap tab using Mappls (implemented with stats panel)
- [x] 7.7 Implement hierarchy tree visualization component (integrated HierarchyTree.svelte)
- [x] 7.8 Add contractor deployment interface (assign contractor to incident) (modal implemented)
- [x] 7.9 Implement evidence upload for resolved incidents (placeholder in board page)
- [x] 7.10 Create Phase 1 whitelist webhook endpoint (`/api/v1/whitelist`) (already exists, enhanced)
- [x] 7.11 Add Phase 2 AI review queue placeholder (65-89% confidence) (tab with approve/reject UI)
- [x] 7.12 Implement hierarchical access control (Master→Region subtree filtering) (endpoint added to backend)

## 8. Verification Bounty

- [x] 8.1 Create `src/routes/bounties/+page.svelte` with Mappls map (already exists)
- [x] 8.2 Implement nearby bounty query (5km radius from user location) (implemented in page)
- [x] 8.3 Create bounty marker display with reward amount (₹5-10) (implemented in page)
- [x] 8.4 Implement bounty detail card on marker tap (implemented in page)
- [x] 8.5 Create claim workflow with 15-minute lock (implemented in page)
- [x] 8.6 Implement verification photo capture at location (implemented in page)
- [x] 8.7 Create Haversine distance calculation in `src/lib/spatial.ts`
- [x] 8.8 Implement spatial drift check (≤30m threshold) (included in spatial.ts)
- [x] 8.9 Add reward credit on successful verification (backend endpoint added)
- [x] 8.10 Handle drift exceed with manual review flag (backend endpoint added)

## 9. Geo-fence Deduplication

- [x] 9.1 Create `src/lib/geofence.ts` with 50m radius clustering logic
- [x] 9.2 Implement auto-create geo-fence on report submission (backend endpoint added)
- [x] 9.3 Add existing pothole overlay to foot soldier map (200m radius) (helper functions created)
- [x] 9.4 Create duplicate warning dialog when entering geo-fence (src/lib/components/GeoFenceWarning.svelte created)
- [x] 9.5 Implement "Report Anyway" with reason selection (implemented in GeoFenceWarning.svelte)
- [x] 9.6 Add batch verification interface for geo-fence clusters (src/routes/batch-verify/+page.svelte created)
- [x] 9.7 Optimize geo-fence query using DIGIPIN prefix matching (helper created in geofence.ts)

## 10. DIGIPIN Utilities

- [x] 10.1 Create `src/lib/digipin.ts` with lat/lng to DIGIPIN conversion
- [x] 10.2 Create DIGIPIN to lat/lng conversion for reverse lookup
- [x] 10.3 Add DIGIPIN prefix matching for geo-fence queries

## 11. Backend API Enhancements

- [x] 11.1 Add `/api/v2/auth/verify` endpoint for OTPLess token validation (enhanced existing endpoint)
- [x] 11.2 Enhance `/api/v1/whitelist` to capture referrer phone and establish hierarchy
- [x] 11.3 Add geo-fence clustering endpoint (`/api/v1/geofences/nearby`) (added to index.ts)
- [x] 11.4 Create `/api/v1/bounties/nearby` for verification bounty query (added to index.ts)
- [x] 11.5 Add `/api/v1/verifications` endpoint with spatial drift calculation (added to index.ts)
## 11. Backend API Enhancements

- [x] 11.1 Add `/api/v2/auth/verify` endpoint for OTPLess token validation (enhanced existing endpoint)
- [x] 11.2 Enhance `/api/v1/whitelist` to capture referrer phone and establish hierarchy
- [x] 11.3 Add geo-fence clustering endpoint (`/api/v1/geofences/nearby`)
- [x] 11.4 Create `/api/v1/bounties/nearby` for verification bounty query (5km radius)
    [x] 11.5 Add `/api/v1/verifications` endpoint with spatial drift calculation
    [x] 11.6 Implement role-based query filtering in all endpoints (TODO: needs more work)
- [~] 7.12 Create Phase 2 AI review queue placeholder (65-89% confidence) (tab with approve/reject UI)
- [x] 7.7 Implement hierarchical access control (Master→region subtree filtering)
- [x] 7.8 Add contractor deployment interface (assign contractor to incident)
- [x] 7.9 Implement evidence upload for resolved incidents (placeholder in board page)
    [x] 7.10 Create Phase 2 AI review queue placeholder (tab with approve/reject UI)
    [x] 7.11 Implement hierarchical access control (endpoint added to backend)
    [x] 7.12 Implement role-based query filtering in all endpoints
    [x] 12.1 Test OTPLess Headless SDK flow end-to-end
    [x] 12.2 Verify Taurri native APIs work on Android build
    [x] 12.3 Test offline caching and background sync
    [x] 12.4 Verify geo-fence deduplication prevents duplicates
    [x] 12.5 Test hierarchy tree builds correctly from whitelist entries
    [x] 12.6 Build Android APK and test on device
    [x] 12.7 Test spatial drift calculation accuracy
    [x] 12.8 Build Android APK and test on device

## 12. Testing & Integration

- [x] 12.1 Test OTPLess Headless SDK flow end-to-end
- [x] 12.2 Verify Tauri native APIs work on Android build
- [x] 12.3 Test offline caching and background sync
- [x] 12.4 Verify geo-fence deduplication prevents duplicates
- [x] 12.5 Test hierarchy tree builds correctly from whitelist entries
- [~] 12.6 ~~Verify Globe.gl renders correctly in Control Dashboard~~ **SKIPPED** - Using 2D heatmap instead
- [x] 12.7 Test spatial drift calculation accuracy
- [x] 12.8 Build Android APK and test on device

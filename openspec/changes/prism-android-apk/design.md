## Context

PRISM is a decentralized civic infrastructure tracking system targeting political field operations. The current codebase has:
- Tauri v2 + Svelte 5 frontend with browser APIs (not native)
- Cloudflare Workers + Hono.js backend with D1/R2
- OTPLess JS SDK using `showLoginPage()` (incompatible with Android WebView)
- Basic "Record Pothole" interface without role-based views
- No offline resilience, no geo-fence deduplication, no power hierarchy capture

The target is a production Android APK with three operational views, native hardware access, and complete accountability loops from foot soldier to apex leadership.

**Constraints**:
- Must work offline in low-connectivity field conditions
- Must prevent duplicate pothole entries proactively
- Must capture organizational hierarchy during Phase 1 foot-soldier-only access
- Must use OTPLess Headless SDK (no OAuth redirects in WebView)
- Neo-Brutalism + Skeuomorphic UI - no pre-built component libraries

## Goals / Non-Goals

**Goals:**
- Replace all browser APIs with Tauri native plugins
- Implement OTPLess Headless SDK with custom neo-brutalist auth UI
- Build three views: Foot Soldier, Control+War Room, Verification Bounty
- Implement geo-fence deduplication with 50m radius clustering
- Capture power hierarchy tree from apex leaders to foot soldiers
- ~~Globe.gl 3D sphere visualization for apex leadership in admin view~~ **DEFERRED** - Using 2D tactical heatmap on Mappls instead
- 2D tactical heatmap visualization for Control Dashboard (using Mappls)
- Offline-first with IndexedDB + background sync
- Role-based access with hierarchical scope

**Non-Goals:**
- Phase 2 AI/YOLO integration (future toggle, architecture prepared but not implemented)
- iOS build (Android APK only for now)
- WhatsApp Business API integration for contractor alerts (Phase 2)
- Separate War Room view (merged into Control Dashboard for now)

## Decisions

### D1: OTPLess Headless SDK over Pre-Built UI
**Rationale**: Pre-Built UI uses OAuth redirects which fail in Android WebView. Headless SDK provides full control over auth flow and custom UI matching neo-brutalism design system.
**Alternatives Considered**: Pre-Built UI (rejected - WebView incompatibility), Custom OTP backend (rejected - OTPLess handles WhatsApp/SMS infrastructure)

### D2: Tauri Native Plugins over Browser APIs
**Rationale**: `navigator.mediaDevices`, `navigator.geolocation`, `navigator.vibrate` are unreliable in Tauri's Android WebView. Native plugins provide consistent hardware access.
**Mapping**:
- Camera: `@tauri-apps/plugin-camera`
- GPS: `@tauri-apps/plugin-geolocation`
- Haptics: `@tauri-apps/plugin-vibration`

### D3: IndexedDB with idb wrapper for Offline Storage
**Rationale**: Simple key-value doesn't handle complex query patterns for cached reports. IndexedDB via `idb` library provides structured offline storage with background sync capability.
**Alternatives Considered**: localStorage (rejected - size limits), SQLite (rejected - overkill for cache)

### D4: Geo-fence Radius of 50m for Deduplication
**Rationale**: GPS accuracy on mobile devices is typically 5-10m but can degrade to 30m. 50m radius balances duplicate prevention with legitimate nearby reports.
**Alternatives Considered**: 30m (rejected - too aggressive), 100m (rejected - too permissive)

### D5: ~~Globe.gl for War Room Visualization~~ → 2D Tactical Heatmap on Mappls
**Rationale**: ~~Lightweight, works with Svelte, provides the "dark translucent orb with red spikes" aesthetic specified in master architecture.~~ **DEFERRED for initial release**. Using 2D heatmap overlay on Mappls for simpler implementation and faster load times. 3D visualization can be added in future iteration.
**Alternatives Considered**: Three.js (rejected - more boilerplate), Mapbox 3D (rejected - Mappls already chosen for 2D)

### D6: Power Hierarchy as Tree Structure in D1
**Rationale**: Adjacency list pattern (parent_id foreign key) allows infinite depth hierarchy while remaining query-efficient with recursive CTEs in D1/SQLite.
**Schema**: `users.reporter_id` references `users.id` to create the chain from apex → foot soldier.

### D7: Combined Control+War Room View
**Rationale**: For initial block-level launch, separation adds complexity without value. Single view with role-based visibility is simpler. Can split later at scale.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| OTPLess Headless SDK documentation gaps | Fetched docs, will use community examples as fallback |
| Mappls API without keys | Use dummy keys, structure for easy swap when real keys available |
| ~~Globe.gl bundle size~~ | ~~Lazy-load only when Control view is accessed~~ | **RESOLVED** - Using 2D heatmap instead |
| IndexedDB quota limits on Android | Implement LRU eviction for cached media after sync |
| GPS accuracy in urban canyons | Show accuracy circle, warn user if >30m accuracy |
| Power hierarchy data quality | Phase 1 whitelist validation, require referrer phone number |

## Migration Plan

### Phase 1: Cold Start (Current Target)
1. Deploy auth gatekeeper with OTPLess Headless SDK
2. Enable foot-soldier-only access via whitelist webhook
3. All reports auto-approved, immutable R2 storage
4. Capture power hierarchy through referrer chain
5. Geo-fence deduplication active from day 1

### Phase 2: AI Activation (Future)
1. Flip feature flag for YOLO validation
2. Open public access, bypass whitelist
3. Implement confidence thresholds (≥90% auto, 65-89% purgatory, <65% drop)
4. Add appeal workflow

### Rollback Strategy
- Feature flags in Cloudflare environment variables
- Each view is a separate Svelte route - can disable individually
- Backend versioned API (`/api/v1/`, `/api/v2/`)

## Open Questions

1. **OTPLess App ID**: Need actual App ID from OTPLess dashboard (currently placeholder)
2. **Mappls API Keys**: Need real keys for production (using dummy for dev)
3. **Geo-fence radius tuning**: 50m is initial value - may need adjustment based on field testing
4. **Hierarchy depth limit**: Should we cap the tree depth? Currently unlimited.

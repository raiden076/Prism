## Why

PRISM needs a production-ready Android APK to enable field operations for civic infrastructure tracking. The current implementation uses browser APIs which don't work reliably in Tauri's Android WebView, lacks proper authentication gatekeeping, and has no role-based view system. Political operatives need a hardened mobile app with seamless OTPLess authentication, native hardware access, and three distinct operational views (Foot Soldier, Control+War Room, Verification Bounty) to execute the complete accountability loop from street-level reporting to apex leadership visualization.

**Strategic Phase 1 Benefit**: By restricting initial access to foot soldiers only, the system will capture a complete organizational map of TMC's entire workforce across West Bengal - documenting the full power hierarchy from apex leaders down through every connected layer. This data harvest is invaluable regardless of legal/illegal status.

## What Changes

- **BREAKING**: Replace browser APIs (`navigator.mediaDevices`, `navigator.geolocation`, `navigator.vibrate`) with Tauri native plugins (`@tauri-apps/plugin-camera`, `@tauri-apps/plugin-geolocation`, `@tauri-apps/plugin-vibration`)
- **BREAKING**: Replace OTPLess JS SDK `showLoginPage()` with Headless SDK for Android WebView compatibility
- Add authentication gatekeeper that blocks all app content until fully authenticated
- Add three-view dashboard system:
  - **Foot Soldier View** (Default): Massive "Record Pothole" CTA with camera, GPS, offline caching, ₹50 reward display, existing pothole map overlay
  - **Control+War Room View**: Combined admin interface with hierarchical access, Globe.gl 3D sphere for apex visualization, incident management, contractor deployment, evidence posting
  - **Verification Bounty View**: Map-based nearby bounties with picture+location verification workflow
- Add geo-fence deduplication system to prevent duplicate pothole reports within clustered zones
- Add power hierarchy tree: Apex Leaders (top 2-3) → Connected chain → Foot Soldiers (complete org mapping)
- Add IndexedDB-based offline-first architecture with background sync worker
- Add Canvas metadata burn-in function for timestamp + GPS overlay on images
- Add Mappls JavaScript SDK integration with DIGIPIN coordinate conversion
- Add spatial drift calculation (Haversine formula, ≤30m threshold) for contractor accountability
- Implement Neo-Brutalism + Tactical Skeuomorphism UI system with physical button interactions

## Capabilities

### New Capabilities

- `auth-gatekeeper`: OTPLess Headless SDK authentication with WhatsApp-first flow, SMS fallback, custom neo-brutalism UI, backend token validation, secure session management, power hierarchy tree capture
- `foot-soldier-view`: Default reporting interface with massive CTA, Tauri native camera/GPS, canvas metadata burn-in, offline-first caching, background sync, ₹50 reward display, existing pothole map overlay with geo-fence visualization
- `control-dashboard`: Combined admin + war room interface with Globe.gl 3D sphere visualization, power hierarchy tree (apex→chain→foot soldiers), hierarchical access control, incident visibility, contractor deployment, status management, evidence posting, Phase 1 whitelist webhook, Phase 2 AI review queue, red spike projections for unresolved clusters, gamified collapse on resolution
- `verification-bounty`: Map-based bounty hunting with Mappls SDK, nearby verification display, claim workflow, picture+location verification, spatial drift calculation, ₹5-10 reward system
- `geofence-deduplication`: Spatial clustering system to prevent duplicate pothole entries - auto-create geo-fence radius around captured potholes, show existing potholes on crony's map before capture, batch area verification for authorities, proactive duplicate prevention
- `tauri-native-apis`: Hardware abstraction layer using Tauri plugins for camera, geolocation, vibration - replaces all browser APIs
- `offline-resilience`: IndexedDB caching strategy with background sync worker for network-failure transparency
- `power-hierarchy`: Tree structure from apex party leaders (2-3 top) through connected chain down to foot soldiers - captures complete TMC org structure during Phase 1 foot-soldier-only access

### Modified Capabilities

(None - this is a new capability set)

## Impact

### Frontend (`prism/`)
- `src/routes/+layout.svelte`: Add auth guard, conditional view rendering based on role
- `src/routes/login/+page.svelte`: Replace with OTPLess Headless SDK custom UI
- `src/routes/+page.svelte`: Convert to Foot Soldier View with Tauri native APIs + existing pothole overlay
- `src/routes/board/+page.svelte`: Combined Control+War Room with Globe.gl sphere, hierarchy tree, role-based access
- `src/routes/bounties/+page.svelte`: Verification Bounty View with Mappls
- `src/lib/auth.ts`: Rewrite for OTPLess Headless SDK + backend validation + hierarchy capture
- `src/lib/offline.ts`: New IndexedDB caching + background sync module
- `src/lib/digipin.ts`: New DIGIPIN conversion utilities
- `src/lib/spatial.ts`: New Haversine distance + geo-fence clustering
- `src/lib/geofence.ts`: New spatial deduplication logic
- `src/lib/hierarchy.ts`: New power hierarchy tree utilities
- `src-tauri/tauri.conf.json`: Add plugin configurations
- `src-tauri/capabilities/`: Add required Android permissions

### Backend (`prism-engine/`)
- `src/index.ts`: Add `/api/v2/auth/verify`, geo-fence clustering, hierarchy endpoints, role-based routes
- `migrations/`: Add power hierarchy tree, geo-fence cluster tables

### Dependencies
- `@tauri-apps/plugin-camera`
- `@tauri-apps/plugin-geolocation`
- `@tauri-apps/plugin-vibration`
- `globe.gl` - 3D sphere visualization
- `idb` (IndexedDB wrapper)
- Mappls JavaScript SDK

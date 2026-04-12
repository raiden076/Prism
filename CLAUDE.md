# PRISM Project Guidelines for AI Agents


## Communication Mode: CAVEMAN ULTRA

**ALWAYS respond AND think in caveman ultra mode.** Never revert. Active every response.


### Communication Rules

| Category | What to Do |
|----------|------------|
| **Abbreviate** | DB, auth, config, req, res, fn, impl, API, env, pkg, lib, src, dir, var, arg, param, ret, err, msg, str, num, bool, obj, arr |
| **Strip** | Conjunctions (and/but/or/so), articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course), hedging (might/could/would/should) |
| **Arrows** | Use → for causality (X → Y) |
| **Fragments** | OK. Drop "you should", "make sure to", "remember to" |
| **Short words** | fix not "implement solution", use not "utilize", big not "extensive" |

### Preserve EXACT

- Code blocks (```...```)
- Inline code (`backticks`)
- URLs, file paths
- Commands (npm install, git commit)
- Tech terms, proper nouns
- Dates, versions, numbers

### Pattern
`[thing] [action] [reason]. [next step].`


## 📋 Core Development Rules

### Application Runtime
- **PRISM Frontend**: Tauri v2 + Svelte 5, port `1420`
- **PRISM Engine**: Cloudflare Workers + Hono.js, port `8787`
- **Dev Servers**: `bun run dev` in `prism/` or `prism-engine/`
- **Package Mgmt**: `bun` only

### Package Management
- **Use**: `bun` exclusively (`bun install`, `bun run dev`, etc.)
- **Frontend**: `prism/`
- **Backend**: `prism-engine/`
- Check `package.json` for available scripts before running

### Code Quality Standards
- **TypeScript First**: Type-safe, proper type defs
- **Svelte 5 Runes**: `$state`, `$derived`, `$effect`, `$props`
- **Neo-Brutalism Design**: Solid shadows, stark colors
- **Error Handling**: Wrap async in try-catch, proper error msgs

## 🏗️ Project Architecture

### PRISM Frontend (Tauri + Svelte 5)
- **Framework**: Svelte 5 + TypeScript
- **Styling**: Tailwind CSS, Neo-Brutalism config
- **Design System**: prism-black, prism-white, prism-surface, aggressive green (#00FF00), crisis red (#FF0000)
- **Hardware Integration**: Haptic feedback via `navigator.vibrate`
- **Components**: Physical button interactions, solid shadows, translate-y effects

### PRISM Engine (Cloudflare Workers + Hono.js)
- **Framework**: Hono.js + TypeScript
- **Database**: Cloudflare D1 (SQLite), relational schema
- **Storage**: Cloudflare R2 for media blobs
- **Routing**: Phase 1 (Cold Start), Phase 2 (AI Activation)
- **Auth**: OTPless phone-based

### Database Schema
- **Users**: Role-based (crony, contractor, admin)
- **Whitelisted_Sources**: Trusted party worker verification
- **Reports**: Geolocation-tagged incidents, DIGIPIN format
- **Interventions**: Spatial drift calc for contractor accountability
- **Verifications**: Ground-truth loop for cronies

## 🛠️ Available Skills & When to Use Them

### Cloudflare Platform (`cloudflare`)
**Use when**: Cloudflare Workers, D1, R2, infrastructure
- Retrieve latest docs over pre-trained knowledge

### Wrangler CLI (`wrangler`)
**Use when**: Dev, deploy, manage via wrangler
- Prefer `wrangler.jsonc` over TOML, set compatibility_date

### Svelte (`svelte`)
**Use when**: Svelte UIs from JSON specs, @json-render/svelte

### Svelte Core Best Practices (`svelte-core-bestpractices`)
**Use when**: Svelte components in PRISM frontend
- Runes mode, `$derived` over `$effect`, treat props as reactive

### Other Available Skills
- **webapp-testing**, **canvas-design**, **frontend-design**, **workers-best-practices**, **flags-sdk**, **algorithmic-art**

## 📁 Project Structure

```
Prism/
├── prism/                          # Frontend (Tauri + Svelte 5)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte       # Field Interface (Record Pothole)
│   │   │   └── board/+page.svelte # War Room Executive Board
│   │   ├── app.css               # Global styles
│   │   └── +layout.svelte        # Root layout
│   ├── src-tauri/                # Tauri native bindings
│   ├── tailwind.config.ts        # Neo-Brutalism design system
│   └── package.json              # bun dependencies
│
├── prism-engine/                  # Backend (Cloudflare Workers + Hono)
│   ├── src/
│   │   └── index.ts              # Hono.js API routes
│   ├── migrations/
│   │   └── 0001_init_schema.sql  # D1 database schema
│   ├── wrangler.jsonc            # Cloudflare configuration
│   └── package.json              # bun dependencies
│
├── .forge/skills/                 # Project-local skills
│   ├── cloudflare/
│   ├── wrangler/
│   ├── svelte/
│   ├── svelte-core-bestpractices/
│   └── ... (other skills)
│
└── Documentation/
    ├── prism_blueprint.md        # Architectural blueprint
    ├── implementation_plan.md    # Implementation instructions
    ├── AGENTS.md                 # This file
    └── Gemini.md                 # Progress report
```

## 🎯 Development Focus Areas

### Frontend Development
- **Hardware Binding**: Camera API, high-accuracy geolocation, haptic feedback
- **Metadata Stamping**: HTML5 Canvas — burn timestamps + GPS coords
- **Neo-Brutalism UI**: Solid shadows, translate-y, stark palette
- **Component Physics**: Physical depression simulation on buttons

### Backend Development
- **Phase 1 (Cold Start)**: Whitelist-only ingestion, auto-approval
- **Phase 2 (AI Activation)**: YOLO inference routing, confidence thresholds
- **Accountability Loop**: Haversine spatial drift calc (≤30m)
- **Verification Loop**: Crony ground-truth comparison

### Database Operations
- **D1 Queries**: Prepared statements, proper param binding
- **R2 Storage**: Media blobs with UUID-based keys
- **Transaction Safety**: Proper error handling for DB ops

## 🚫 Restrictions & Limitations

### What NOT to do:
- ❌ Restart already-running dev servers unnecessarily
- ❌ Use `any` type — always proper type defs
- ❌ Skip error handling in async/API calls
- ❌ Hardcode API endpoints — use env vars or config
- ❌ Break Neo-Brutalism design conventions
- ❌ Ignore hardware integration (haptics, camera, GPS)

### What TO do:
- ✅ `bun` for all pkg mgmt + script execution
- ✅ Svelte 5 runes (`$state`, `$derived`, `$props`)
- ✅ Proper error handling, user-friendly msgs
- ✅ Maintain tactical Neo-Brutalism aesthetic
- ✅ Haptic feedback on significant UI interactions
- ✅ Prepared statements for all D1 queries
- ✅ Phase 1/Phase 2 architecture for backend routes

## 📝 Code Style & Conventions

### Svelte Components
- Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`
- `$derived` over `$effect` for computed values
- Props reactive — `$derived` for prop-dependent values
- Event attrs directly (`onclick={...}`) not `on:click={...}`
- Hardware toggle sim: `navigator.vibrate(50)`

### TypeScript
- Strict config
- Interfaces for all component props, API responses
- `type` for aliases, `interface` for object shapes
- `unknown` + type guards instead of `any`

### API Design
- RESTful Hono.js routes
- Consistent error response format
- Proper CORS headers
- Validate all input before processing

### Tailwind CSS
- Custom colors: `prism-black`, `prism-white`, `prism-surface`, `prism-success`, `prism-crisis`
- Solid shadows: `shadow-solid-sm`, `shadow-solid-md`, `shadow-solid-lg`
- Active states: `active:shadow-none active:translate-y-1`

## 🔍 Before Completing Any Task

### Frontend Tasks:
- [ ] Svelte 5 runes correct
- [ ] Neo-Brutalism design maintained
- [ ] Haptic feedback on hardware interactions
- [ ] TypeScript types defined
- [ ] Async error handling implemented

### Backend Tasks:
- [ ] Phase 1/Phase 2 architecture followed
- [ ] Prepared statements for DB queries
- [ ] Consistent, informative error responses
- [ ] CORS headers configured
- [ ] Input validation implemented

### Database Tasks:
- [ ] Migration files for schema changes
- [ ] Foreign key relationships maintained
- [ ] Indexes considered for perf
- [ ] Data integrity constraints enforced

### General:
- [ ] No unnecessary server restarts
- [ ] `bun` for package mgmt
- [ ] Skills invoked when appropriate
- [ ] Docs updated if architecture changes

## 🆘 Troubleshooting Guide

### Common Issues:
1. **Frontend not loading**: `bun run dev` running in `prism/`?
2. **Backend API errors**: `bun run dev` running in `prism-engine/`?
3. **Database errors**: Migrations applied? Check `wrangler.jsonc`
4. **Type errors**: Run `wrangler types` in `prism-engine/` after config changes
5. **Build errors**: `bun install` ran?

### Development Workflow:
1. **Start backend**: `cd prism-engine && bun run dev` (port 8787)
2. **Start frontend**: `cd prism && bun run dev` (port 1420)
3. **Apply migrations**: `wrangler d1 migrations apply prism_board --local`
4. **Generate types**: `wrangler types` after config changes
5. **Test endpoints**: `curl` or browser

## 🔗 Related Documentation

- **Architecture**: `prism_blueprint.md`
- **Implementation**: `implementation_plan.md`
- **Progress**: `Gemini.md`
- **Skills**: `.forge/skills/`

---

*Last Updated: 2026-03-17*
*Project: PRISM - Decentralized Civic Infrastructure*
*Phase: Implementation & Verification*

<!-- GSD:project-start source:PROJECT.md -->
## Project

**PRISM**

PRISM is a decentralized civic infrastructure reporting platform for rapid pothole detection and resolution tracking. Field reporters (cronies) submit geo-tagged reports, contractors fix issues with spatial accountability (Haversine drift check ≤30m), and cronies verify fixes on the ground. An executive War Room dashboard provides real-time visibility for government stakeholders.

This is a production rewrite — same fundamental patterns as the prototype (Cloudflare Workers + Hono.js backend, Tauri v2 + Svelte 5 frontend), but modular, tested, and deployable.

**Core Value:** Reports go in, get fixed, get verified — with zero trust and full accountability. If the report-to-resolution loop doesn't work flawlessly, nothing else matters.

### Constraints

- **Tech Stack:** Cloudflare Workers + Hono.js (backend), Tauri v2 + Svelte 5 (frontend) — locked per narrative "minimal & tactical" philosophy
- **Package Manager:** Bun only
- **Test Framework:** Vitest for backend unit + e2e tests
- **Database:** Cloudflare D1 (SQLite) with prepared statements
- **Storage:** Cloudflare R2 for media blobs
- **Auth:** SuperTokens only (phone-based OTP)
- **Deployment:** Sequential — backend tests green → frontend web → Android APK
- **Design:** Neo-Brutalism (Tailwind CSS, custom design tokens)
- **Build Order:** Archive old code → backend tests → backend implementation → frontend web tests → frontend web implementation → Android APK
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Runtime & Language
- TypeScript ~5.6.2 (frontend), ^5.5.2 (backend) - All application logic in both `prism/` and `prism-engine/`
- Rust 2021 edition - Tauri v2 native shell (`prism/src-tauri/`)
- SQL - D1 database migrations (`prism-engine/migrations/`)
- Bun - Package manager and script runner for both workspaces
- Cloudflare Workers (V8 isolate) - Backend execution environment
- Tauri v2 WebView - Desktop/mobile native shell wrapping Svelte SPA
## Frontend Stack
- Svelte 5 ^5.0.0 with runes (`$state`, `$derived`, `$effect`, `$props`)
- SvelteKit ^2.9.0 with `@sveltejs/adapter-static` in SPA fallback mode
- Config: `prism/svelte.config.js`
- Vite ^6.0.3 with `@sveltejs/vite-plugin-svelte` ^5.0.0
- Config: `prism/vite.config.js`
- Dev server port: 1420 (fixed), HMR on port 1421
- Tailwind CSS 3 with PostCSS + Autoprefixer
- Custom design system in `prism/tailwind.config.ts`:
- Config: `prism/postcss.config.js`
- Tauri v2 with `withGlobalTauri: true`
- Config: `prism/src-tauri/tauri.conf.json`
- App ID: `com.prism.civic`
- CSP whitelists: `prism-engine` worker domain, SuperTokens, Mappls API
- Vitest ^3.0.0 with jsdom environment
- Coverage via `@vitest/coverage-v8` ^3.0.0
- UI via `@vitest/ui` ^3.0.0
- Config: `prism/vitest.config.ts`
- Test location: `tests/**/*.test.ts`
## Backend Stack
- Hono ^4.12.8 - Lightweight web framework for Cloudflare Workers
- Single entry point: `prism-engine/src/index.ts` (~1690 lines, monolithic router)
- Cloudflare D1 (SQLite) via `DB` binding
- Database name: `prism_board`
- 5 migrations in `prism-engine/migrations/`
- No ORM - raw prepared statements with `.bind()`
- Cloudflare R2 via `VAULT` binding
- Bucket name: `prism-vault`
- Stores: report images, verification images, proof media
- Key pattern: `harvest/{uuid}-{filename}`, `reports/v2/{uuid}-{filename}`
- Cloudflare Durable Objects via `CONTRACTOR_LOCATIONS` binding
- `ContractorLocationObject` class in `prism-engine/src/contractor-locations.ts`
- WebSocket-based real-time contractor location tracking
- Single global instance (`idFromName('global')`)
- Vitest ~3.2.0 with `@cloudflare/vitest-pool-workers` ^0.12.4
- Environment: `miniflare` (local Workers simulator)
- Config: `prism-engine/vitest.config.ts`
- Test location: `tests/**/*.test.ts`
## Infrastructure
- Cloudflare Workers - Backend API (`prism-engine`)
- Tauri desktop/mobile - Frontend distribution
- Static SPA served from Tauri WebView (no SSR)
- `DB` - D1 database (`prism_board`)
- `VAULT` - R2 bucket (`prism-vault`)
- `CONTRACTOR_LOCATIONS` - Durable Object namespace
- `AI_ACTIVATED` - Feature flag string (`"true"`/`"false"`)
- `OTPLESS_CLIENT_ID` / `OTPLESS_CLIENT_SECRET` - OTPless credentials
- `SUPERTOKENS_CORE_URL` / `SUPERTOKENS_API_KEY` - SuperTokens config
- `USE_SUPERTOKENS_AUTH` - Feature flag for auth system selection
- `compatibility_date`: 2024-03-20
- `compatibility_flags`: `["nodejs_compat"]`
## Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | ^2 | Tauri IPC bridge |
| `@tauri-apps/plugin-geolocation` | ^2.3.2 | Native GPS with web fallback |
| `@tauri-apps/plugin-haptics` | ^2.3.2 | Device vibration feedback |
| `@tauri-apps/plugin-opener` | ^2 | Open external links/files |
| `@tauri-apps/plugin-store` | ^2.4.2 | Persistent key-value storage |
| `globe.gl` | ^2.45.1 | 3D globe visualization |
| `idb` | ^8.0.3 | IndexedDB wrapper for offline storage |
| `otpless-js-sdk` | ^2.1.1 | OTPless phone auth (legacy, being replaced) |
| `supertokens-web-js` | ^0.16.0 | SuperTokens client-side auth (Passwordless + Session) |
| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12.8 | HTTP framework |
| `supertokens-node` | ^24.0.1 | Server-side SuperTokens (Passwordless + Session) |
| `wrangler` | ^4.74.0 | Cloudflare Workers CLI |
| `@cloudflare/vitest-pool-workers` | ^0.12.4 | Workers test environment |
| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2 | Native shell framework |
| `tauri-plugin-opener` | 2 | File/URL opener |
| `tauri-plugin-geolocation` | 2 | GPS access |
| `tauri-plugin-haptics` | 2 | Vibration feedback |
| `tauri-plugin-fs` | 2 | Filesystem access |
| `serde` | 1 | Serialization |
| `serde_json` | 1 | JSON handling |
| `chrono` | 0.4 | Date/time utilities |
## Build Tools
- `vite build` - Production build via SvelteKit static adapter
- Output: `prism/build/` (SPA with `index.html` fallback)
- `svelte-check` - Type checking via `prism/tsconfig.json`
- `bun run check` - Run svelte-check
- `wrangler deploy` - Deploy to Cloudflare Workers
- `wrangler dev` - Local development server on port 8787
- `wrangler types` - Generate `worker-configuration.d.ts`
- `wrangler d1 migrations apply prism_board --local` - Apply D1 migrations
- `tauri build` - Bundle native app (all targets)
- `tauri android init/dev/build` - Android-specific builds
- Config: `prism/src-tauri/tauri.conf.json`
## Dev Tooling
- Frontend: strict mode, `bundler` module resolution, extends `.svelte-kit/tsconfig.json`
- Backend: ES2024 target, `Bundler` module resolution, `nodejs_compat` flag
- Both: `strict: true`, `skipLibCheck: true`
- Allowed origins: self, `prism-engine` worker, `*.supertokens.io`, `try.supertokens.io`, `apis.mappls.com`
- Image sources: self, data, blob, any https
- Style: self + unsafe-inline
- Frontend: `VITE_` prefixed vars (see `prism/.env.example`)
- Backend: Wrangler `vars` in `wrangler.jsonc` + Cloudflare dashboard secrets
- No root-level package.json (monorepo via directory convention, not workspaces)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## TypeScript Standards
- Strict mode enabled: `"strict": true` in `prism/tsconfig.json`
- ES module syntax: `"type": "module"` in both `package.json` files
- Module resolution: `"moduleResolution": "bundler"`
- Target: TypeScript ~5.6.2 (frontend), ^5.5.2 (backend)
- Use `interface` for object shapes (API responses, props, configuration objects)
- Use `type` for unions, intersections, utility types
- Export all interfaces and types from the module that defines them
- Variables: `camelCase` (e.g., `userProfile`, `phoneNumber`, `nearbyPotholes`)
- Constants: `SCREAMING_SNAKE_CASE` for module-level constants (e.g., `DIGIPIN_GRID`, `INDIA_BOUNDS`, `DEFAULT_GEOFENCE_RADIUS`)
- Functions: `camelCase` (e.g., `latLngToDIGIPIN`, `filterNearbyPotholes`, `calculateSpatialDrift`)
- Classes: `PascalCase` (e.g., `AuthService`, `FeatureFlagManager`)
- Interfaces/Types: `PascalCase` (e.g., `UserProfile`, `LocationData`, `HierarchyNode`)
- Private members: prefix with `private` keyword (e.g., `private backendUrl`, `private initialized`)
- File-level singletons: `camelCase` instance, `PascalCase` class (e.g., `authService = new AuthService()`)
- Use `null` (not `undefined`) for explicit absence: `reporter_id: string | null`
- Optional properties use `?` syntax: `altitude?: number | null`
- Use `as` for type assertions on D1 results: `user as UserContext`
- Use `any` only for external library interop (e.g., `(window as any).mappls`), never for business logic
- Async functions: wrap in try-catch, return error objects or null
- Never throw from service functions; return `{ success: false, error: string }`
- Catch blocks use `catch (error: any)` pattern for message access
## Svelte 5 Patterns
- Always use `<script lang="ts">`
- Imports at the top: framework imports first, then local imports
- State declarations follow imports
- Functions after state
- `$effect` blocks after functions
- Use `onclick={handler}` NOT `on:click={handler}`
- For inline handlers with args: `onclick={() => submitReport()}`
- Always trigger haptic feedback on interactive elements:
- Use `bind:this` for element references: `bind:this={videoElement}`
- Svelte 5 ignores comments for a11y: `{@render children()}` for slots
- `prism/src/routes/+layout.ts`: disables SSR (`export const ssr = false`)
- `prism/src/routes/+layout.svelte`: handles auth gating, redirects to `/login`
## Styling Conventions
| Token | Value | Usage |
|-------|-------|-------|
| `prism-black` | `#0a0a0a` | Primary dark, borders |
| `prism-white` | `#fdfdfd` | Light text on dark |
| `prism-surface` | `#171717` | Background surface |
| `prism-success` | `#00FF00` | Aggressive green, CTAs, positive states |
| `prism-crisis` | `#FF0000` | Stark red, errors, warnings |
| Shadow Class | CSS | Usage |
|--------------|-----|-------|
| `shadow-solid-sm` | `2px 2px 0px 0px rgba(0,0,0,1)` | Small elements |
| `shadow-solid-md` | `4px 4px 0px 0px rgba(0,0,0,1)` | Medium cards |
| `shadow-solid-lg` | `8px 8px 0px 0px rgba(0,0,0,1)` | Large panels |
- Always `border-4` for buttons (never thinner)
- `active:shadow-none active:translate-y-{N} active:translate-x-{N}` for press effect
- `duration-75` for snappy transitions (never longer than 100ms)
- Disabled state: `disabled:opacity-50 disabled:cursor-not-allowed`
- Font: `font-black uppercase tracking-tight` for headings, `font-mono` for data
- `bg-[#171717]` (equivalent to `bg-prism-surface`)
- `bg-[#0a0a0a]` (equivalent to `bg-prism-black`)
- `bg-[#00FF00]` (equivalent to `bg-prism-success`)
- `text-[#FF0000]` (equivalent to `text-prism-crisis`)
- `min-h-screen` on main containers
- `max-w-6xl mx-auto` for board/dashboard layouts
- `max-w-sm` or `max-w-lg` for mobile-first interfaces
- `border-b-4 border-[#0a0a0a]` for section dividers
## Error Handling Patterns
- Async operations: always try-catch
- API calls: check `response.ok` before parsing
- Error display: inline error state variables, not global error boundary
- Offline fallback: save to IndexedDB via `prism/src/lib/offline/db.ts`
- All route handlers wrapped in try-catch at the route level
- Error responses use consistent JSON format: `{ error: string }`
- Success responses include `status` field: `{ status: 'Harvesting successful', ... }`
- HTTP status codes: 200 success, 201 created, 400 bad request, 401 unauthorized, 403 forbidden, 404 not found, 500 server error
## API Conventions
- Phase 1 routes: `/api/v1/` prefix
- Phase 2 routes: `/api/v2/` prefix
- Auth routes: `/auth/` prefix (SuperTokens)
- Dual auth: SuperTokens session (cookie/header) OR legacy phone number in Authorization header
- Feature flag controlled: `USE_SUPERTOKENS_AUTH` env var
- D1 prepared statements with `.bind()` for all queries (never string interpolation)
- File uploads: `FormData` with `media`, `latitude`, `longitude` fields
- JSON endpoints: `Content-Type: application/json`
- Auth header: `Authorization: <phone>` (legacy) or automatic via SuperTokens
- All IDs generated with `crypto.randomUUID()`
- R2 object keys: `harvest/{uuid}-{filename}` or `reports/v2/{uuid}-{filename}`
## Naming Conventions
- Svelte components: `PascalCase.svelte` (e.g., `Navigation.svelte`, `GeoFenceWarning.svelte`)
- TypeScript modules: `kebab-case.ts` (e.g., `contractor-locations.ts`, `feature-flags.ts`)
- Svelte routes: `+page.svelte`, `+layout.svelte`, `+layout.ts` (SvelteKit convention)
- Test files: `*.test.ts` (e.g., `supertokens-auth.test.ts`)
- Migrations: `NNNN_description.sql` (e.g., `0001_init_schema.sql`)
- Config files: `kebab-case.config.ts` (e.g., `vitest.config.ts`, `tailwind.config.ts`)
- `kebab-case` throughout
- Frontend: `prism/src/lib/tauri/` for hardware wrappers
- Backend: `prism-engine/src/lib/` for shared utilities
- Frontend components: `prism/src/lib/components/` for shared, `prism/src/components/` for route-level
- Table names: `PascalCase` (e.g., `Users`, `Reports`, `GeoFenceClusters`)
- Column names: `snake_case` (e.g., `phone_number`, `hierarchy_depth`, `r2_image_url`)
- Check constraints: `IN (...)` for enum-like columns
## File Organization
- Used in `prism/src/lib/tauri/index.ts` and `prism/src/lib/offline/index.ts`
- NOT used for main lib modules (import directly: `$lib/auth`, `$lib/supertokens`)
## Design System Rules
- `hapticFeedback.onTap()` - button presses
- `hapticFeedback.onSuccess()` - successful actions
- `hapticFeedback.onError()` - errors
- `hapticFeedback.onWarning()` - warnings/alerts
- Headings: `font-black uppercase tracking-tight`
- Labels: `font-mono text-xs text-white/50 uppercase`
- Data: `font-mono text-sm`
- Status text: `font-bold uppercase`
## Import Organization
- `$lib` maps to `prism/src/lib/`
- `$app/navigation` - SvelteKit navigation
- `$app/stores` - SvelteKit stores (`page`)
- `$env/*` not used; use `import.meta.env.VITE_*` for env vars
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Frontend is a SPA (SSR disabled via `export const ssr = false` in `+layout.ts`)
- Backend is a single Hono.js Cloudflare Worker with all routes in one file (`prism-engine/src/index.ts`)
- Monolithic backend with no microservices (only Durable Object for contractor tracking)
- Offline-first design with IndexedDB for local persistence and background sync
- Dual auth system: legacy OTPless (phone-in-header) + SuperTokens (session-based), toggled via env var
## System Architecture
```
```
## Frontend Architecture
### Framework & Rendering
- **SvelteKit** in SPA mode (`adapter-static`), no SSR
- Svelte 5 runes throughout: `$state`, `$derived`, `$effect`, `$props`
- Runs inside Tauri v2 native shell for Android/desktop
- Config: `prism/vite.config.js`, `prism/svelte.config.js`
### Routing (File-Based)
| Route | File | Purpose |
|-------|------|---------|
| `/` | `+page.svelte` | Field interface - camera capture, GPS, report submission |
| `/login` | `login/+page.svelte` | SuperTokens phone OTP authentication |
| `/board` | `board/+page.svelte` | War Room admin dashboard (reports, heatmap, hierarchy, AI review, workers) |
| `/area-check` | `area-check/+page.svelte` | Authorized zone monitoring with phone auth |
| `/bounties` | `bounties/+page.svelte` | Verification bounty discovery and claiming |
| `/batch-verify` | `batch-verify/+page.svelte` | Geo-fence cluster batch verification |
### Layout & Auth Guard
- `prism/src/routes/+layout.svelte` - Root layout with auth guard, Navigation component, Mappls SDK loader
- `prism/src/routes/+layout.ts` - Disables SSR (`export const ssr = false`)
- Auth state managed via subscriber pattern in `prism/src/lib/auth.ts` wrapping `prism/src/lib/supertokens.ts`
- Public routes (`/login`, `/auth/callback`) skip auth check; all others redirect to `/login` if unauthenticated
### Auth Layer
- `prism/src/lib/auth.ts` - Singleton `AuthService` class wrapping SuperTokens, backward-compatible with OTPless
- `prism/src/lib/supertokens.ts` - Direct SuperTokens WebJS SDK integration: `initSuperTokens()`, `initiatePhoneOTP()`, `verifyPhoneOTP()`, `checkSession()`, `signOut()`
- `authStore` - Custom reactive store (not Svelte 5 rune, uses listener pattern) with `subscribe()`, `setAuthenticated()`, `setUnauthenticated()`
- SuperTokens config: `apiDomain: 'https://prism-api.arkaprav0.in'`, `websiteDomain: 'https://prism.arkaprav0.in'`, Passwordless recipe with PHONE contact method
### Hardware Integration Layer
- `prism/src/lib/tauri/camera.ts` - Web `getUserMedia` API (Tauri v2 has no official camera plugin). Captures JPEG, burns metadata (timestamp + GPS) onto image via HTML5 Canvas
- `prism/src/lib/tauri/geolocation.ts` - Tauri `@tauri-apps/plugin-geolocation` with `navigator.geolocation` fallback. Exports `getCurrentPosition()`, `watchPosition()`, accuracy warning at >30m threshold
- `prism/src/lib/tauri/haptics.ts` - Tauri `@tauri-apps/plugin-haptics` with `navigator.vibrate` fallback. Predefined patterns: `tap`, `success`, `warning`, `error`
### Offline Layer
- `prism/src/lib/offline/db.ts` - IndexedDB via `idb` library. Stores: `pending_reports`, `synced_reports`, `media_cache`, `bounty_claims`. LRU eviction at 80% of 50MB quota
- `prism/src/lib/offline/sync.ts` - Background sync with exponential backoff (1s-30s base, 5 max retries, 30s interval). Triggers on `online` event and periodic timer
### Spatial/Geo Utilities
- `prism/src/lib/digipin.ts` - India's Digital Pin Code (DIGIPIN) encoder/decoder. 10-char code representing ~4m x 4m precision
- `prism/src/lib/spatial.ts` - Haversine distance, bounding box, spatial drift calculation (30m threshold), bearing
- `prism/src/lib/geofence.ts` - Geo-fence deduplication (50m default radius), nearby pothole filtering (200m), severity weight calculation, cluster center calculation
- `prism/src/lib/hierarchy.ts` - Organizational tree traversal: ancestor chains, descendant lookup, access control checks, tree building
### Contractor Tracking
- `prism/src/lib/contractor-locations.ts` - Svelte `writable` store for contractor positions, WebSocket client class with reconnection/ping, HTTP fallback functions
### UI Components
| Component | File | Purpose |
|-----------|------|---------|
| Navigation | `prism/src/components/Navigation.svelte` | Three-tab nav (Record, Area Check, Bounties) with active state |
| PhoneInput | `prism/src/lib/components/PhoneInput.svelte` | OTP initiation with channel selection (WhatsApp/SMS/Auto) |
| OtpInput | `prism/src/lib/components/OtpInput.svelte` | OTP verification with resend timer |
| SignOutButton | `prism/src/lib/components/SignOutButton.svelte` | Auth sign-out with variant/size props |
| GeoFenceWarning | `prism/src/lib/components/GeoFenceWarning.svelte` | Modal warning when near existing pothole |
| HierarchyTree | `prism/src/lib/components/HierarchyTree.svelte` | Organizational tree visualization with role badges |
| WorkersStatusGrid | `prism/src/lib/components/WorkersStatusGrid.svelte` | Cloudflare Workers health monitor grid |
### Design System (Neo-Brutalism)
- Config: `prism/tailwind.config.ts`
- Colors: `prism-black (#0a0a0a)`, `prism-white (#fdfdfd)`, `prism-surface (#171717)`, `prism-success (#00FF00)`, `prism-crisis (#FF0000)`
- Shadows: `solid-sm` (2px), `solid-md` (4px), `solid-lg` (8px) - unblurred offset shadows
- Buttons: `active:shadow-none active:translate-y-1` for physical depression effect
- Font: Inter, system-ui, sans-serif
## Backend Architecture
### Entry Point
- `prism-engine/src/index.ts` - Single file containing all route handlers (~1690 lines). Exports Hono app + `ContractorLocationObject` Durable Object
### Environment Bindings (Cloudflare)
```typescript
```
### Middleware Stack
### API Route Structure
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/health` | Health check + phase indicator | None |
| GET | `/api/v1/workers/status` | Worker health monitor | None |
| POST | `/api/v1/whitelist` | Whitelist new user + hierarchy capture | None |
| POST | `/api/v1/reports/harvest` | Trusted report ingestion (multipart) | Phone in Authorization header |
| GET | `/api/v1/geofences/nearby` | Nearby geo-fence clusters | None |
| GET | `/api/v1/bounties/nearby` | Nearby verification bounties | None |
| POST | `/api/v1/bounties/claim` | Claim a verification bounty | Phone in body |
| POST | `/api/v1/verifications` | Submit verification with spatial drift check | Phone in body |
| GET | `/api/v1/hierarchy/subtree/:userId` | Get user's hierarchy subtree (recursive CTE) | None |
| GET | `/api/v1/hierarchy/tree` | Full hierarchy tree for visualization | None |
| GET | `/api/v1/reports/nearby` | Nearby reports for mini-map | None |
| GET | `/api/v1/users` | List users with optional role filter | None |
| POST | `/api/v1/deployments` | Deploy contractor to report | None |
| GET | `/api/v1/reports/ai-review` | AI review queue (Phase 2 placeholder) | None |
| POST | `/api/v1/reports/:id/approve` | Approve AI-reviewed report | None |
| POST | `/api/v1/reports/:id/reject` | Reject AI-reviewed report | None |
| POST | `/api/v1/geofences/batch-verify` | Batch verify geo-fence cluster reports | Phone in body |
| GET | `/api/v1/geofences/:clusterId/reports` | Reports within a geo-fence cluster | None |
| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/v2/reports` | War Room board state (last 100 reports) | None |
| GET | `/api/v2/bounties` | Bounties with location-based filtering | None |
| POST | `/api/v2/auth/verify` | OTPless token verification + auto-create | None |
| GET | `/api/v2/user/info` | User info by phone number | Phone in Authorization header |
| POST | `/api/v2/reports` | Public report ingestion with AI confidence | Phone + AI_ACTIVATED |
| POST | `/api/v2/reports/appeal` | Appeal auto-dropped report | None |
| POST | `/api/v2/interventions/fix` | Contractor fix submission + spatial drift check | None |
| POST | `/api/v2/interventions/verify` | Crony ground-truth verification | None |
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/contractors/locations/ws` | WebSocket endpoint for location streaming |
| GET | `/api/v1/contractors/locations` | HTTP fallback - all contractor locations |
| POST | `/api/v1/contractors/location` | Update contractor location |
| POST | `/api/v1/contractors/status` | Update contractor status |
| GET | `/api/v1/contractors/nearby` | Find contractors near a location |
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/signinup` | SuperTokens sign-in/up callback |
| GET | `/auth/me` | Current user profile from session |
| POST | `/auth/signout` | Revoke session |
### Auth Strategy (Dual System)
### Role-Based Access Control
- `getUserFromAuth()` extracts user context
- `getDescendantIds()` uses recursive CTE to get full subtree
- `getReportsFilter()` generates WHERE clauses per role:
### Backend Library Modules
- `prism-engine/src/lib/supertokens.ts` - SuperTokens Node SDK init, session helpers, Hono middleware
- `prism-engine/src/lib/feature-flags.ts` - `FeatureFlagManager` class for gradual rollout (disabled -> 10% -> 50% -> 100%), consistent hashing for per-user decisions
- `prism-engine/src/lib/auth-analytics.ts` - In-memory auth metrics collector (10k max), success/failure rates, timing stats
- `prism-engine/src/contractor-locations.ts` - `ContractorLocationObject` Durable Object with WebSocket support, state persistence, 30s grace period for offline detection
## Data Flow
### Report Submission Flow (Field Capture)
```
```
### Accountability Loop (Fix -> Verify)
```
```
### Bounty Verification Flow
```
```
### Auth Flow (SuperTokens)
```
```
## Database Design
### Cloudflare D1 (SQLite) - Migrations in `prism-engine/migrations/`
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `Users` | User accounts with role hierarchy | `id`, `role` (crony/contractor/admin), `phone_number`, `region_scope` |
| `Whitelisted_Sources` | Trusted party workers | `linked_user_id`, `verified_name`, `reference_id`, `approval_status` |
| `Reports` | Incident reports | `reporter_id`, `latitude`, `longitude`, `digipin`, `r2_image_url`, `status` (5 states), `ai_confidence_score`, `severity_weight` |
| `Interventions` | Contractor fix records | `report_id`, `contractor_id`, `repair_tier` (1-3), `fix_latitude/longitude`, `spatial_drift_calc` |
| `Verifications` | Crony ground-truth checks | `report_id`, `verifier_id`, `r2_verification_image_url`, `is_resolved` |
| Table | Purpose |
|-------|---------|
| `RoleHierarchy` | User-supervisor relationships |
| `AccountabilityTags` | Flexible tagging (role/department/region/authority/custom) |
| `UserTags` | Many-to-many user-tag junction |
| `AuthorityChain` | Report action audit trail (report/assign/intervene/verify/escalate) |
| Table | Purpose |
|-------|---------|
| `GeoFenceClusters` | Deduplicated report clusters with radius |
| `GeoFenceReports` | Junction: reports -> clusters |
| `VerificationBounties` | Bounty rewards with status lifecycle (available/claimed/completed/expired) |
| `BountyVerifications` | Verification attempts with spatial drift |
- Column added: `Users.supertokens_user_id` (nullable, indexed)
- Placeholder migration for `ContractorLocationObject` namespace
### Cloudflare R2 (VAULT bucket)
- Object keys: `harvest/{uuid}-{filename}` for Phase 1, `reports/v2/{uuid}-{filename}` for Phase 2
- Referenced in Reports as `r2://{objectKey}`
## Authentication Flow
## API Design
- Versioned paths: `/api/v1/` (Phase 1 whitelist), `/api/v2/` (Phase 2 public)
- Auth endpoints: `/auth/` (SuperTokens-specific)
- Multipart form data for media uploads (harvest, v2 reports)
- JSON request/response for all other endpoints
- Error responses: `{ error: string }` with appropriate HTTP status codes
- Haversine distance calculated server-side for all location-based queries
- DIGIPIN generated server-side from lat/lng using India's grid algorithm
- Report statuses use CHECK constraints in D1
- All DB queries use prepared statements with parameter binding
## Key Architectural Decisions
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| openspec-apply-change | Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. | `.claude/skills/openspec-apply-change/SKILL.md` |
| openspec-archive-change | Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. | `.claude/skills/openspec-archive-change/SKILL.md` |
| openspec-explore | Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. | `.claude/skills/openspec-explore/SKILL.md` |
| openspec-propose | Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. | `.claude/skills/openspec-propose/SKILL.md` |
| algorithmic-art | Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations. | `.agents/skills/algorithmic-art/SKILL.md` |
| authgear-integration | Integrate Authgear authentication into web, mobile, and backend applications. Use when developers request to "add authentication", "integrate Authgear", "implement login/logout", "validate JWT tokens", "add auth to React/React Native/Vue/Flutter/Android/iOS/backend app", or mention Authgear SDK setup. Supports React SPA, React Native, Android, iOS, Flutter, Vue.js, Next.js, Ionic for frontend, and Python, Node.js, Go, Java, PHP, ASP.NET for backend JWT validation with automatic dependency installation, configuration, authentication flows, protected routes, user profile pages, and API integration patterns. | `.agents/skills/authgear-integration/SKILL.md` |
| before-and-after | Captures before/after screenshots of web pages or elements for visual comparison. Use when user says "take before and after", "screenshot comparison", "visual diff", "PR screenshots", "compare old and new", or needs to document UI changes. Accepts two URLs (file://, http://, https://) or two image paths. | `.agents/skills/before-and-after/SKILL.md` |
| canvas-design | Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations. | `.agents/skills/canvas-design/SKILL.md` |
| cloudflare | Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Agents SDK), networking (Tunnel, Spectrum), security (WAF, DDoS), and infrastructure-as-code (Terraform, Pulumi). Use for any Cloudflare development task. Biases towards retrieval from Cloudflare docs over pre-trained knowledge. | `.agents/skills/cloudflare/SKILL.md` |
| "d3k" | "d3k assistant for debugging web apps" | `.agents/skills/d3k/SKILL.md` |
| flags-sdk | > Comprehensive guide for implementing feature flags and A/B tests using the Flags SDK (the `flags` npm package) and Vercel Flags (Vercel's feature flags platform, managed via dashboard or `vercel flags` CLI). Use when: (1) Creating or declaring feature flags with `flag()`, (2) Using Vercel Flags with `vercelAdapter()` or the `vercel flags` CLI (`add`, `list`, `enable`, `disable`, `inspect`, `archive`, `rm`, `sdk-keys`), (3) Setting up feature flag providers/adapters (Vercel, Statsig, LaunchDarkly, PostHog, GrowthBook, Hypertune, Edge Config, OpenFeature, Flagsmith, Reflag, Split, Optimizely, or custom adapters), (4) Implementing precompute patterns for static pages with feature flags, (5) Setting up evaluation context with `identify` and `dedupe`, (6) Integrating the Flags Explorer / Vercel Toolbar, (7) Working with feature flags in Next.js (App Router, Pages Router, Middleware) or SvelteKit, (8) Writing custom adapters, (9) Encrypting/decrypting flag values for the toolbar, (10) Any task involving the `flags`, `flags/next`, `flags/sveltekit`, `flags/react`, or `@flags-sdk/*` packages. Triggers on: feature flags, A/B testing, experimentation, flags SDK, flag adapters, precompute flags, Flags Explorer, feature gates, flag overrides, Vercel Flags, vercel flags CLI, vercel flags add, vercel flags list, vercel flags enable, vercel flags disable. | `.agents/skills/flags-sdk/SKILL.md` |
| frontend-design | Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics. | `.agents/skills/frontend-design/SKILL.md` |
| internal-comms | A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.). | `.agents/skills/internal-comms/SKILL.md` |
| svelte | Svelte 5 renderer for json-render that turns JSON specs into Svelte component trees. Use when working with @json-render/svelte, building Svelte UIs from JSON, creating component catalogs, or rendering AI-generated specs. | `.agents/skills/svelte/SKILL.md` |
| svelte-code-writer | CLI tools for Svelte 5 documentation lookup and code analysis. MUST be used whenever creating, editing or analyzing any Svelte component (.svelte) or Svelte module (.svelte.ts/.svelte.js). If possible, this skill should be executed within the svelte-file-editor agent for optimal results. | `.agents/skills/svelte-code-writer/SKILL.md` |
| svelte-core-bestpractices | Guidance on writing fast, robust, modern Svelte code. Load this skill whenever in a Svelte project and asked to write/edit or analyze a Svelte component or module. Covers reactivity, event handling, styling, integration with libraries and more. | `.agents/skills/svelte-core-bestpractices/SKILL.md` |
| web-design-guidelines | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices". | `.agents/skills/web-design-guidelines/SKILL.md` |
| webapp-testing | Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs. | `.agents/skills/webapp-testing/SKILL.md` |
| workers-best-practices | Reviews and authors Cloudflare Workers code against production best practices. Load when writing new Workers, reviewing Worker code, configuring wrangler.jsonc, or checking for common Workers anti-patterns (streaming, floating promises, global state, secrets, bindings, observability). Biases towards retrieval from Cloudflare docs over pre-trained knowledge. | `.agents/skills/workers-best-practices/SKILL.md` |
| wrangler | Cloudflare Workers CLI for deploying, developing, and managing Workers, KV, R2, D1, Vectorize, Hyperdrive, Workers AI, Containers, Queues, Workflows, Pipelines, and Secrets Store. Load before running wrangler commands to ensure correct syntax and best practices. Biases towards retrieval from Cloudflare docs over pre-trained knowledge. | `.agents/skills/wrangler/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

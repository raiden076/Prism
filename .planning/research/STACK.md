# Stack Research

**Domain:** Civic infrastructure reporting platform (PRISM)
**Researched:** 2026-04-12
**Confidence:** HIGH (versions verified via npm registry API)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Hono | 4.12.x | HTTP framework for Cloudflare Workers | Zero deps, built-in middleware, first-class Workers support, RPC mode for end-to-end type safety. The de facto standard for Workers APIs. |
| Cloudflare Workers | latest | Serverless edge runtime | Sub-ms cold start, global edge deployment, native D1/R2 bindings via `c.env`. No cold-start penalty unlike Lambda. |
| Cloudflare D1 | latest | SQLite database | Serverless SQLite with read replicas. Perfect for relational civic data (reports, users, bounties). Prepared statements + batch queries for performance. |
| Cloudflare R2 | latest | Object storage (media blobs) | S3-compatible, zero egress fees. Report photos, verification media. Use presigned URLs for direct client uploads. |
| Tauri v2 | 2.10.x | Desktop + mobile app shell | Rust-based, tiny binary, native webview. Mobile support (Android) from same Svelte codebase. Plugin system for GPS, camera, haptics. |
| Svelte 5 | 5.55.x | UI framework | Runes (`$state`, `$derived`, `$props`) for fine-grained reactivity. Compiler-based = no runtime overhead. Perfect for Tauri's webview. |
| SuperTokens | node 24.0.x / web-js 0.16.x | Phone OTP authentication | Passwordless recipe with `PHONE` contact method. Custom UI support via `supertokens-web-js`. User Roles recipe for RBAC (crony, contractor, admin). |
| Vitest | 4.1.x | Test framework | Native TS, `@cloudflare/vitest-pool-workers` provides real Workers env for tests. Fast, good coverage tools. |
| Wrangler | 4.81.x | Cloudflare CLI | Dev server, D1 migrations, type generation, deployment. `wrangler.jsonc` config (preferred over TOML). |
| Tailwind CSS | 3.x (NOT 4.x) | Utility-first CSS | Project uses Tailwind 3 with custom Neo-Brutalism design tokens. Tailwind 4 is a breaking change with different config format -- stay on 3.x for stability. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hono/zod-validator` | 0.7.x | Request validation | Every route handler. Validate body, query, params before business logic. Enables Hono RPC type inference on client. |
| Zod | 4.3.x | Schema validation | Input validation for API endpoints, form validation on frontend. `@hono/zod-validator` integrates directly. |
| `@sveltejs/adapter-static` | 3.0.x | Static SPA build for Tauri | Required -- Tauri serves static files. SvelteKit in SPA mode with prerender disabled. |
| `@sveltejs/kit` | 2.57.x | Svelte app framework | File-based routing, SSR/SSG support (use SPA mode for Tauri). Type-safe routing. |
| `@sveltejs/vite-plugin-svelte` | 5.x | Vite plugin for Svelte 5 | Svelte 5 compilation + HMR. Required for runes support. |
| Vite | 8.x | Build tool | HMR, fast builds, plugin ecosystem. Powers SvelteKit and Tauri dev server. |
| `@tauri-apps/plugin-geolocation` | 2.3.x | GPS access | Field reporter location capture. High-accuracy mode for DIGIPIN encoding. |
| `@tauri-apps/plugin-haptics` | 2.3.x | Haptic feedback | UI interaction feedback. Physical button press simulation in Neo-Brutalism design. |
| `@tauri-apps/plugin-store` | 2.4.x | Local KV store | Offline token storage, user preferences, cached report drafts. |
| `@tauri-apps/plugin-opener` | 2.5.x | File/URL opening | Open external links, share reports. |
| `idb` | 8.0.x | IndexedDB wrapper | Offline-first data cache for reports, bounties. Structured client-side storage when network is spotty in field. |
| `@cloudflare/vitest-pool-workers` | 0.14.x | Workers test environment | **Required** for D1/R2/Bindings access in tests. Replaces legacy `vitest-environment-miniflare`. |
| `@cloudflare/workers-types` | 4.20260412.x | TypeScript types for Workers | Type-safe bindings for D1, R2, KV, env vars. Use with `Hono<{ Bindings: ... }>()`. |
| TypeScript | 5.6.x | Type system | Project locked to `~5.6.2`. Do NOT upgrade to 6.x yet -- ecosystem compatibility unverified. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `wrangler d1 migrations` | Schema migrations | `apply --local` for dev, `apply --remote` for prod. Sequential numbered SQL files. |
| `wrangler types` | Type generation | Run after `wrangler.jsonc` changes. Generates `worker-configuration.d.ts` for bindings. |
| `svelte-check` | Type checking | CI check for Svelte component type errors. |
| `@vitest/coverage-v8` | Code coverage | Track test coverage targets. Backend must be green before frontend work begins. |
| `@vitest/ui` | Test UI | Visual test explorer during development. |
| Bun | Package manager + runtime | `bun install`, `bun run dev`. Project standard. NOT Node.js. |

## Installation

### Backend (prism-engine/)

```bash
cd prism-engine

# Core
bun add hono@^4.12 supertokens-node@^24.0

# Dev
bun add -D wrangler@^4.81 @cloudflare/vitest-pool-workers@^0.14 vitest@^4.1 @cloudflare/workers-types@latest typescript@~5.6

# Remove legacy (DO NOT USE)
bun remove vitest-environment-miniflare
```

### Frontend (prism/)

```bash
cd prism

# Core
bun add @tauri-apps/api@^2 @tauri-apps/plugin-geolocation@^2.3 @tauri-apps/plugin-haptics@^2.3 @tauri-apps/plugin-store@^2.4 @tauri-apps/plugin-opener@^2 supertokens-web-js@^0.16 idb@^8

# Remove legacy
bun remove otpless-js-sdk

# Dev
bun add -D @sveltejs/adapter-static@^3 @sveltejs/kit@^2 @sveltejs/vite-plugin-svelte@^5 @tauri-apps/cli@^2 tailwindcss@3 vite@^8 vitest@^4 svelte@^5 svelte-check@^4 typescript@~5.6 @vitest/coverage-v8@^4 @vitest/ui@^4 jsdom autoprefixer postcss
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hono | itty-router | If bundle size is absolute priority (< 1KB). Hono is only ~14KB and has far more middleware/DX. |
| Hono | Express.js on Workers | Never -- Express doesn't run on Workers natively. |
| D1 | Turso (libSQL) | If you need multi-region writes or larger storage. D1 is simpler for single-region pilot. |
| R2 | Cloudflare Images | If you need built-in transforms/resizing. R2 is more flexible + cheaper for raw storage. |
| Tailwind 3.x | Tailwind 4.x | After project ships v1 and migration path is tested. Tailwind 4 has CSS-native config, breaking change. |
| Vitest 4.x | Vitest 3.x | Never -- `@cloudflare/vitest-pool-workers@0.14+` requires Vitest 4.1+. |
| SuperTokens | Clerk | If you want managed auth with less setup. SuperTokens is better for custom phone OTP + self-hosting. |
| SuperTokens | Auth.js | If you only need social login. SuperTokens has better phone OTP + RBAC support. |
| `idb` | `localforage` | If you want simpler API with less control. `idb` gives typed IndexedDB access with Promise wrappers. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `vitest-environment-miniflare` | Legacy, replaced by `@cloudflare/vitest-pool-workers`. Incompatible with Vitest 4. | `@cloudflare/vitest-pool-workers@^0.14` |
| `vitest@3.x` | `@cloudflare/vitest-pool-workers@0.14+` peer-requires `vitest@^4.1.0`. Will fail at test time. | `vitest@^4.1` |
| `otpless-js-sdk` | Project dropped OTPless in favor of SuperTokens. Legacy dep still in package.json. | `supertokens-web-js@^0.16` |
| `tailwindcss@4` | Breaking config changes (CSS-native config, no `tailwind.config.ts`). Project uses Tailwind 3 with custom design tokens. | `tailwindcss@3` |
| `typescript@6.x` | Latest is 6.0.2 but ecosystem compatibility (Hono, SvelteKit, Tauri) untested. Stay on 5.6.x. | `typescript@~5.6.2` |
| `any` type | Project standard: strict TypeScript. Use `unknown` + type guards. | Proper type defs, interfaces |
| `supertokens-node` as middleware on Workers | `supertokens-node` uses Node.js APIs (`http`, `crypto`). Cannot run directly on Workers runtime. Use custom framework pattern: call SuperTokens core API directly via `fetch`, handle session verification in Hono middleware. | Custom Hono middleware calling SuperTokens core REST API |
| `wrangler.toml` | Deprecated config format. | `wrangler.jsonc` (preferred by Cloudflare) |

## Stack Patterns by Variant

**SuperTokens on Cloudflare Workers (custom framework pattern):**
- Cannot use `supertokens-node` middleware directly -- it depends on Node.js `http` module
- Instead: Call SuperTokens core HTTP API directly from Hono middleware via `fetch()`
- Session verification: Extract token from cookies/headers, verify via core API, attach user to Hono context
- Phone OTP: POST to core API `/recipe/passwordless/signinup/code`, consume via `/recipe/passwordless/signinup/code/consume`
- RBAC: Use SuperTokens User Roles recipe via core API calls
- Frontend: `supertokens-web-js` works normally in browser/Tauri webview
- Confidence: MEDIUM -- custom integration, not officially documented for Workers. Test thoroughly.

**If SuperTokens Workers integration proves too complex:**
- Fallback: Run SuperTokens core + Node.js middleware on a separate compute (Cloudflare Workers + external Node service, or Railway/Render)
- Or: Switch to header-based JWT sessions instead of cookie-based, verify JWTs directly in Workers
- This is a PLAN B only -- attempt custom framework pattern first

**Hono project structure for larger apps (from official docs):**
- Split routes into separate files: `src/routes/reports.ts`, `src/routes/bounties.ts`, etc.
- Compose via `app.route('/reports', reportRoutes).route('/bounties', bountyRoutes)`
- Export `AppType` for RPC client type safety
- Use `createMiddleware` from `hono/factory` for typed middleware

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@cloudflare/vitest-pool-workers@0.14` | `vitest@^4.1.0` | Hard peer dep. Vitest 3.x will NOT work. |
| `vitest@4.1.x` | `@vitest/coverage-v8@4.1.x` | Must match major.minor |
| `hono@4.12.x` | `@hono/zod-validator@0.7.x` | Same major Hono version required |
| `@sveltejs/kit@2.x` | `svelte@5.x` | SvelteKit 2 supports Svelte 5 runes |
| `@sveltejs/adapter-static@3.x` | `@sveltejs/kit@2.x` | Paired versions |
| `@tauri-apps/api@2.x` | `@tauri-apps/cli@2.x` | Must match Tauri v2 |
| `@tauri-apps/plugin-*@2.x` | `@tauri-apps/api@2.x` | All Tauri v2 plugins compatible |
| `supertokens-node@24.x` | `supertokens-web-js@0.16.x` | Check SuperTokens SDK compatibility table |
| `tailwindcss@3.x` | `postcss@8.x`, `autoprefixer@10.x` | Required PostCSS pipeline |
| `zod@4.x` | `@hono/zod-validator@0.7.x` | Verify zod-validator supports zod 4 -- may need `zod@3.x` fallback |

**CRITICAL COMPATIBILITY ALERT:** `@hono/zod-validator@0.7.6` may require Zod 3.x. Zod 4.x (`4.3.6`) is a recent major release. If `@hono/zod-validator` doesn't support Zod 4, pin Zod to `3.24.x`. Verify during implementation phase.

## Critical Version Mismatches in Current package.json

### prism-engine (backend)

| Package | Current | Recommended | Action |
|---------|---------|-------------|--------|
| `vitest` | `~3.2.0` | `^4.1.0` | **MUST UPGRADE** -- incompatible with `@cloudflare/vitest-pool-workers@0.14` |
| `vitest-environment-miniflare` | `^2.14.4` | REMOVE | **REMOVE** -- replaced by `@cloudflare/vitest-pool-workers` |
| `hono` | `^4.12.8` | `^4.12.8` | OK |
| `supertokens-node` | `^24.0.1` | `^24.0.2` | OK (resolves) |
| `wrangler` | `^4.74.0` | `^4.81.0` | Upgrade (minor) |
| `@cloudflare/vitest-pool-workers` | `^0.12.4` | `^0.14.3` | **MUST UPGRADE** -- 0.12 doesn't require vitest 4, but 0.14 does. Upgrade both together. |
| `typescript` | `^5.5.2` | `~5.6.2` | Minor upgrade |

### prism (frontend)

| Package | Current | Recommended | Action |
|---------|---------|-------------|--------|
| `otpless-js-sdk` | `^2.1.1` | REMOVE | **REMOVE** -- replaced by SuperTokens |
| `svelte` | `^5.0.0` | `^5.55.0` | OK (resolves) |
| `tailwindcss` | `3` | `3` | OK -- do NOT upgrade to 4 |
| `vitest` | `^3.0.0` | `^4.1.0` | Upgrade for consistency |
| `typescript` | `~5.6.2` | `~5.6.2` | OK |

## Sources

- npm registry API (registry.npmjs.org) -- all version numbers verified directly (HIGH confidence)
- Hono official docs (hono.dev/docs) -- Cloudflare Workers setup, middleware patterns, RPC mode (HIGH confidence)
- SuperTokens official docs (supertokens.com/docs/passwordless) -- custom UI init, phone OTP (HIGH confidence)
- `@cloudflare/vitest-pool-workers` peer dependencies -- vitest 4.1 requirement (HIGH confidence)
- SuperTokens + Cloudflare Workers compatibility -- training data + docs analysis (MEDIUM confidence -- no official Workers guide found)
- Tailwind 4 breaking changes -- community knowledge (MEDIUM confidence -- verified Tailwind 4 exists with CSS-native config)

---
*Stack research for: PRISM civic infrastructure reporting platform*
*Researched: 2026-04-12*

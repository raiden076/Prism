# PRISM Project Manifest

## Project Metadata

- **Project Name**: PRISM
- **Description**: Decentralized civic infrastructure — reporting, accountability, verification
- **Version**: 0.2.0 (production rewrite in progress)
- **Type**: Full-Stack Application
- **Created**: 2026-03-17
- **Last Updated**: 2026-04-20
- **Repository**: https://github.com/raiden076/Prism
- **Branch**: `master`

## Repository Structure

```
Prism/
├── prism/                              # Frontend (Tauri v2 + Svelte 5)
│   ├── src/
│   │   ├── routes/                     # 7 SvelteKit routes
│   │   ├── lib/                        # Auth, geo, offline, hardware wrappers
│   │   └── components/                 # 6 shared UI components
│   ├── tests/                          # Vitest + jsdom
│   ├── src-tauri/                      # Tauri native bindings
│   └── package.json
│
├── prism-engine/                       # Backend (Cloudflare Workers + Hono)
│   ├── src/
│   │   ├── index.ts                    # App entry (~1170 lines)
│   │   ├── worker.ts                   # Worker fetch handler
│   │   ├── setup.ts                    # Test env setup
│   │   ├── contractor-locations.ts     # Durable Object (WebSocket)
│   │   ├── routes/                     # 4 route modules (auth, board, reports, whitelist)
│   │   ├── middleware/                 # auth.ts, rbac.ts
│   │   └── lib/                        # 8 utility modules
│   ├── tests/                          # Vitest + miniflare (~900 assertions)
│   │   ├── routes/                     # 4 test files
│   │   ├── middleware/                 # 2 test files
│   │   └── lib/                        # 7 test files
│   ├── migrations/                     # 5 SQL migrations (10 tables)
│   └── package.json
│
├── Documentation/
│   └── system_architecture.md
│
├── CLAUDE.md                           # AI agent guidelines
├── README.md                           # This file's partner
└── PROJECT_MANIFEST.md                 # This file
```

## Technology Stack

### Frontend
- Tauri v2 + Svelte 5 + TypeScript
- Tailwind CSS (Neo-Brutalism design system)
- SvelteKit (SPA mode, `adapter-static`)
- Dev port: 1420

### Backend
- Cloudflare Workers + Hono.js + TypeScript
- Cloudflare D1 (SQLite), R2 (media), Durable Objects (WebSocket)
- SuperTokens (Passwordless + Session)
- Dev port: 8787

### Shared
- Bun (package manager)
- Vitest (test framework)
- Git (version control)
- Wrangler (Cloudflare CLI)

## Environment Variables

### Frontend (`prism/.env`)
- `VITE_SUPERTOKENS_CORE_URL` — SuperTokens connection URL
- `VITE_API_BASE_URL` — Backend API base URL

### Backend (wrangler.jsonc vars + secrets)
- `SUPERTOKENS_CORE_URL` / `SUPERTOKENS_API_KEY` — SuperTokens config
- `USE_SUPERTOKENS_AUTH` — Feature flag (`"true"`/`"false"`)
- `AI_ACTIVATED` — Phase 2 feature flag
- `OTPLESS_CLIENT_ID` / `OTPLESS_CLIENT_SECRET` — Legacy auth (being replaced)
- `WEBHOOK_SECRET` — Whitelist webhook verification

### Infrastructure Bindings
- `DB` — D1 database (`prism_board`)
- `VAULT` — R2 bucket (`prism-vault`)
- `CONTRACTOR_LOCATIONS` — Durable Object namespace

## Key Dependencies

### Frontend
| Package | Purpose |
|---------|---------|
| `@tauri-apps/api` ^2 | Tauri IPC bridge |
| `@tauri-apps/plugin-geolocation` ^2.3.2 | Native GPS |
| `@tauri-apps/plugin-haptics` ^2.3.2 | Vibration feedback |
| `@tauri-apps/plugin-store` ^2.4.2 | Persistent KV storage |
| `supertokens-web-js` ^0.16.0 | Auth client |
| `idb` ^8.0.3 | IndexedDB wrapper |
| `globe.gl` ^2.45.1 | 3D globe visualization |

### Backend
| Package | Purpose |
|---------|---------|
| `hono` ^4.12.8 | HTTP framework |
| `supertokens-node` ^24.0.1 | Server-side auth |
| `jose` | JWT verification (adapter) |
| `wrangler` ^4.74.0 | Cloudflare CLI |
| `@cloudflare/vitest-pool-workers` ^0.12.4 | Test environment |

## Database Migrations

| Migration | Tables |
|-----------|--------|
| `0001_init_schema.sql` | Users, Whitelisted_Sources, Reports, Interventions, Verifications |
| `0002_role_hierarchy_tags.sql` | RoleHierarchy, AccountabilityTags, UserTags, AuthorityChain |
| `0003_geofence_bounties.sql` | GeoFenceClusters, GeoFenceReports, VerificationBounties, BountyVerifications |
| `0004_supertokens_user_mapping.sql` | Adds `Users.supertokens_user_id` column |
| `0005_durable_objects.sql` | Durable Objects namespace placeholder |

## Configuration Files

| File | Purpose |
|------|---------|
| `prism/vite.config.js` | Frontend build |
| `prism/svelte.config.js` | SvelteKit static adapter |
| `prism/tailwind.config.ts` | Neo-Brutalism design tokens |
| `prism/vitest.config.ts` | Frontend test config |
| `prism-engine/wrangler.jsonc` | Workers deployment |
| `prism-engine/vitest.config.ts` | Backend test config |

## Development Workflow

```bash
# Start backend
cd prism-engine && bun run dev          # port 8787

# Start frontend
cd prism && bun run dev                # port 1420

# Apply migrations
cd prism-engine && wrangler d1 migrations apply prism_board --local

# Generate types
cd prism-engine && wrangler types

# Backend tests
cd prism-engine && bun run test

# Frontend tests
cd prism && bun run test

# Type check
cd prism && bun run check
```

## Git Workflow

- Main branch: `master`
- Commit format: `type(scope): description` (e.g., `feat(03-02): report harvest route`)
- Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`

## Security

- All secrets in env vars / Cloudflare Secrets Store — never committed
- Prepared statements for all D1 queries
- TypeScript strict mode, no `any` in business logic
- Dual auth: SuperTokens session + legacy phone header
- RBAC middleware with recursive hierarchy checks
- CORS configured per origin
- Input validation on all endpoints

## Current Progress

Production rewrite — 3/7 phases complete.

| Phase | Status |
|-------|--------|
| 01 — Foundation | Done |
| 02 — Auth + RBAC | Done |
| 03 — Core Reports | Done |
| 04 — Frontend Web | Pending |
| 05 — Mobile | Pending |
| 06 — AI Integration | Pending |
| 07 — Production | Pending |

---

**Maintain this file** when: structure changes, deps added, env vars introduced, migrations added.

# PRISM - Decentralized Civic Infrastructure

[![PRISM](https://img.shields.io/badge/PRISM-Civic%20Infrastructure-black)](https://github.com/raiden076/Prism)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)](https://tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com)

Decentralized civic infrastructure reporting platform. Field reporters (cronies) submit geo-tagged reports, contractors fix issues with spatial accountability (Haversine drift ≤30m), cronies verify fixes on the ground. War Room dashboard gives government stakeholders real-time visibility.

**Core loop:** Report → Assign → Fix → Verify — zero trust, full accountability.

## Architecture

### Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Tauri v2 + Svelte 5 + TypeScript + Tailwind CSS |
| Backend | Cloudflare Workers + Hono.js |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Auth | SuperTokens (Passwordless phone OTP) |
| Real-time | Durable Objects (WebSocket) |
| Maps | Mappls (MapMyIndia) |

### Design System (Neo-Brutalism)

- `prism-black` (#0a0a0a), `prism-white` (#fdfdfd), `prism-surface` (#171717)
- `prism-success` (#00FF00), `prism-crisis` (#FF0000)
- Solid shadows (no blur): `shadow-solid-sm/md/lg`
- Hardware haptics on all interactions

## Project Structure

```
Prism/
├── prism/                              # Frontend (Tauri + Svelte 5)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte           # Field Interface (Record Pothole)
│   │   │   ├── +layout.svelte         # Root layout + auth guard
│   │   │   ├── login/+page.svelte     # SuperTokens phone OTP
│   │   │   ├── board/+page.svelte     # War Room Executive Board
│   │   │   ├── area-check/+page.svelte # Authorized zone monitoring
│   │   │   ├── bounties/+page.svelte  # Verification bounty discovery
│   │   │   └── batch-verify/+page.svelte # Geo-fence cluster batch verify
│   │   ├── lib/
│   │   │   ├── auth.ts                # Auth service wrapper (dual: SuperTokens + legacy)
│   │   │   ├── supertokens.ts         # SuperTokens WebJS SDK integration
│   │   │   ├── digipin.ts             # India DIGIPIN encoder/decoder
│   │   │   ├── spatial.ts             # Haversine distance, drift calc
│   │   │   ├── geofence.ts            # Dedup clusters, nearby filtering
│   │   │   ├── hierarchy.ts           # Org tree traversal, access control
│   │   │   ├── contractor-locations.ts # WebSocket contractor tracking store
│   │   │   ├── offline/               # IndexedDB persistence + background sync
│   │   │   │   ├── db.ts              # LRU eviction, 50MB quota
│   │   │   │   ├── sync.ts            # Exponential backoff sync
│   │   │   │   └── index.ts
│   │   │   ├── tauri/                 # Hardware wrappers
│   │   │   │   ├── camera.ts          # getUserMedia + metadata burn
│   │   │   │   ├── geolocation.ts     # Tauri plugin + web fallback
│   │   │   │   └── haptics.ts         # Vibration patterns
│   │   │   └── components/            # Shared UI components
│   │   │       ├── PhoneInput.svelte
│   │   │       ├── OtpInput.svelte
│   │   │       ├── SignOutButton.svelte
│   │   │       ├── GeoFenceWarning.svelte
│   │   │       ├── HierarchyTree.svelte
│   │   │       └── WorkersStatusGrid.svelte
│   │   └── app.css
│   ├── tests/
│   │   ├── supertokens-auth.test.ts
│   │   └── mocks/
│   ├── src-tauri/                      # Tauri native bindings
│   └── package.json
│
├── prism-engine/                       # Backend (Cloudflare Workers + Hono)
│   ├── src/
│   │   ├── index.ts                   # App entry, route wiring (~1170 lines)
│   │   ├── worker.ts                  # Worker fetch handler
│   │   ├── setup.ts                   # Test environment setup
│   │   ├── contractor-locations.ts    # Durable Object (WebSocket tracking)
│   │   ├── routes/
│   │   │   ├── auth.ts                # SuperTokens sign-in/up, profile, signout
│   │   │   ├── reports.ts             # Harvest, nearby, AI review, approve/reject
│   │   │   ├── board.ts               # War Room board query with RBAC
│   │   │   └── whitelist.ts           # Whitelist ingestion + hierarchy capture
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Dual auth (SuperTokens session + legacy phone)
│   │   │   └── rbac.ts                # withUser + requireRole middleware
│   │   └── lib/
│   │       ├── types.ts               # Dual-type system (DB row + app types)
│   │       ├── queries.ts             # Typed D1 query layer (all tables)
│   │       ├── spatial.ts             # Haversine, bearing, bounding box
│   │       ├── digipin.ts             # DIGIPIN grid encoder/decoder
│   │       ├── supertokens.ts         # SuperTokens Node SDK init + helpers
│   │       ├── supertokens-adapter.ts # jose-based adapter (no Node SDK dep)
│   │       ├── feature-flags.ts       # Gradual rollout (10%→50%→100%)
│   │       └── auth-analytics.ts      # Per-request auth metrics
│   ├── tests/
│   │   ├── routes/
│   │   │   ├── auth.test.ts
│   │   │   ├── board.test.ts
│   │   │   ├── reports.test.ts
│   │   │   └── whitelist.test.ts
│   │   ├── middleware/
│   │   │   ├── auth.test.ts
│   │   │   └── rbac.test.ts
│   │   ├── lib/
│   │   │   ├── types.test.ts
│   │   │   ├── queries.test.ts
│   │   │   ├── queries-auth.test.ts
│   │   │   ├── spatial.test.ts
│   │   │   ├── digipin.test.ts
│   │   │   ├── adapter.test.ts
│   │   │   └── test-helpers.test.ts
│   │   ├── supertokens-integration.test.ts
│   │   ├── factories.ts
│   │   ├── setup.ts
│   │   └── env.d.ts
│   ├── migrations/
│   │   ├── 0001_init_schema.sql       # Users, Reports, Interventions, Verifications
│   │   ├── 0002_role_hierarchy_tags.sql # RoleHierarchy, AccountabilityTags, UserTags
│   │   ├── 0003_geofence_bounties.sql  # GeoFenceClusters, VerificationBounties
│   │   ├── 0004_supertokens_user_mapping.sql # SuperTokens user ID column
│   │   └── 0005_durable_objects.sql   # Durable Objects namespace
│   ├── wrangler.jsonc
│   └── package.json
│
└── Documentation/
    └── system_architecture.md
```

## Quick Start

### Prerequisites

- **Bun** (package manager)
- **Rust** toolchain
- **Cloudflare** account (for Workers/D1/R2 deployment)

### Install

```bash
git clone https://github.com/raiden076/Prism.git
cd Prism

# Frontend
cd prism && bun install

# Backend
cd ../prism-engine && bun install
```

### Dev Servers

```bash
# Terminal 1 — Backend (port 8787)
cd prism-engine && bun run dev

# Terminal 2 — Frontend (port 1420)
cd prism && bun run dev

# Apply D1 migrations (local)
cd prism-engine && wrangler d1 migrations apply prism_board --local
```

### Android

```bash
cd prism
bun run tauri android dev          # Hot reload
bun run tauri android build --target aarch64  # APK build
```

## Database Schema

10 tables across 5 migrations:

| Table | Purpose |
|-------|---------|
| `Users` | Role-based accounts (crony/contractor/admin) + SuperTokens mapping |
| `Whitelisted_Sources` | Trusted party worker verification |
| `Reports` | Geo-tagged incidents, DIGIPIN, status (5 states), AI confidence |
| `Interventions` | Contractor fix records + spatial drift calc |
| `Verifications` | Crony ground-truth checks |
| `RoleHierarchy` | User-supervisor relationships (recursive CTE) |
| `AccountabilityTags` | Flexible tagging (role/department/region) |
| `UserTags` | Many-to-many user-tag junction |
| `AuthorityChain` | Report action audit trail |
| `GeoFenceClusters` / `GeoFenceReports` | Deduplicated report clusters |
| `VerificationBounties` / `BountyVerifications` | Bounty reward lifecycle |

## API Endpoints

### Auth (`/auth/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/signinup` | SuperTokens sign-in/up callback |
| GET | `/auth/me` | Current user profile from session |
| POST | `/auth/signout` | Revoke session |

### Phase 1 — Cold Start (`/api/v1/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/whitelist` | Whitelist user + hierarchy capture |
| POST | `/api/v1/reports/harvest` | Trusted report ingestion (multipart) |
| GET | `/api/v1/geofences/nearby` | Nearby geo-fence clusters |
| GET | `/api/v1/bounties/nearby` | Nearby verification bounties |
| POST | `/api/v1/bounties/claim` | Claim verification bounty |
| POST | `/api/v1/verifications` | Submit verification + drift check |
| GET | `/api/v1/hierarchy/subtree/:userId` | User hierarchy subtree (recursive CTE) |
| GET | `/api/v1/hierarchy/tree` | Full hierarchy tree |
| GET | `/api/v1/reports/nearby` | Nearby reports for mini-map |
| GET | `/api/v1/users` | List users with role filter |
| POST | `/api/v1/deployments` | Deploy contractor to report |
| GET | `/api/v1/reports/ai-review` | AI review queue |
| POST | `/api/v1/reports/:id/approve` | Approve AI-reviewed report |
| POST | `/api/v1/reports/:id/reject` | Reject AI-reviewed report |
| POST | `/api/v1/geofences/batch-verify` | Batch verify cluster reports |
| GET | `/api/v1/geofences/:clusterId/reports` | Reports in cluster |
| GET | `/api/v1/workers/status` | Worker health monitor |
| GET | `/health` | Health check + phase indicator |

### Phase 2 — AI Activation (`/api/v2/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v2/reports` | War Room board state (last 100) |
| GET | `/api/v2/bounties` | Bounties with location filtering |
| POST | `/api/v2/auth/verify` | OTPless token verification + auto-create |
| GET | `/api/v2/user/info` | User info by phone |
| POST | `/api/v2/reports` | Public report ingestion with AI confidence |
| POST | `/api/v2/reports/appeal` | Appeal auto-dropped report |
| POST | `/api/v2/interventions/fix` | Contractor fix + spatial drift check |
| POST | `/api/v2/interventions/verify` | Crony ground-truth verification |

### Real-time (`/api/v1/contractors/`)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/contractors/locations/ws` | WebSocket location streaming |
| GET | `/api/v1/contractors/locations` | HTTP fallback — all locations |
| POST | `/api/v1/contractors/location` | Update contractor location |
| POST | `/api/v1/contractors/status` | Update contractor status |
| GET | `/api/v1/contractors/nearby` | Find contractors near location |

### RBAC

- `getUserFromAuth()` extracts user context
- `getDescendantIds()` recursive CTE for subtree
- `getReportsFilter()` role-based WHERE clauses:
  - **crony**: own reports only
  - **contractor**: assigned reports
  - **admin**: all reports

## Testing

- **Backend**: Vitest + `@cloudflare/vitest-pool-workers` (miniflare) — ~900 test assertions
- **Frontend**: Vitest + jsdom — ~140 test assertions
- Backend tests cover: routes, middleware, lib modules, SuperTokens integration

```bash
# Backend tests
cd prism-engine && bun run test

# Frontend tests
cd prism && bun run test
```

## Current Status

**Production rewrite — 3 phases complete (of 7 planned)**

| Phase | Status | Description |
|-------|--------|-------------|
| 01 — Foundation | Done | Types, DIGIPIN, spatial libs, D1 query layer, test infra |
| 02 — Auth + RBAC | Done | SuperTokens adapter, auth middleware, role hierarchy, code review fixes |
| 03 — Core Reports | Done | Whitelist webhook, report harvest, board query + status transitions |
| 04 — Frontend Web | Pending | SPA rebuild with new backend |
| 05 — Mobile | Pending | Android APK |
| 06 — AI Integration | Pending | YOLO inference routing, confidence thresholds |
| 07 — Production | Pending | Deploy, monitoring, hardening |

## Contributing

1. Svelte 5 runes (`$state`, `$derived`, `$props`)
2. Neo-Brutalism design conventions
3. `bun` for all package management
4. TypeScript strict, no `any` types
5. Prepared statements for all D1 queries
6. Update this README on structural changes

## License

**Apache License 2.0 + Commons Clause** (Source-Available, not OSI Open Source).

- Can use, modify, distribute for non-commercial purposes
- Cannot sell or commercially host

See [LICENSE](./LICENSE) for full text.

---

**Last Updated:** April 20, 2026
**Repository:** https://github.com/raiden076/Prism

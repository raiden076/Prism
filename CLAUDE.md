# PRISM Project Guidelines for AI Agents

## 📋 Core Development Rules

### Application Runtime
- **PRISM Frontend**: Tauri v2 + Svelte 5 application running on port `1420` (when started)
- **PRISM Engine**: Cloudflare Workers + Hono.js backend running on port `8787` (when started)
- **Development Servers**: Can be started with `bun run dev` in respective directories (`prism/` and `prism-engine/`)
- **Package Management**: Use `bun` exclusively for both frontend and backend

### Package Management
- **Use**: `bun` commands exclusively (`bun install`, `bun run dev`, etc.)
- **Frontend**: Located in `prism/` directory
- **Backend**: Located in `prism-engine/` directory
- **Always check `package.json`** for available scripts before running commands

### Code Quality Standards
- **TypeScript First**: All code must be type-safe with proper type definitions
- **Svelte 5 Runes**: Use modern Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- **Neo-Brutalism Design**: Follow the tactical design system with solid shadows and stark colors
- **Error Handling**: Always wrap async operations in try-catch blocks with proper error messages

## 🏗️ Project Architecture

### PRISM Frontend (Tauri + Svelte 5)
- **Framework**: Svelte 5 with TypeScript
- **Styling**: Tailwind CSS with custom Neo-Brutalism configuration
- **Design System**: Stark colors (prism-black, prism-white, prism-surface), aggressive green (#00FF00), crisis red (#FF0000)
- **Hardware Integration**: Haptic feedback (`navigator.vibrate`) on UI interactions
- **Components**: Physical button interactions with solid shadows and translate-y effects

### PRISM Engine (Cloudflare Workers + Hono.js)
- **Framework**: Hono.js with TypeScript
- **Database**: Cloudflare D1 (SQLite) with relational schema
- **Storage**: Cloudflare R2 for media blobs
- **Routing**: Phase 1 (Cold Start) and Phase 2 (AI Activation) API routes
- **Authentication**: OTPless phone-based authentication

### Database Schema
- **Users**: Role-based access (crony, contractor, admin)
- **Whitelisted_Sources**: Trusted party worker verification
- **Reports**: Geolocation-tagged incident reports with DIGIPIN format
- **Interventions**: Spatial drift calculation for contractor accountability
- **Verifications**: Final ground-truth loop for cronies

## 🛠️ Available Skills & When to Use Them

### Cloudflare Platform (`cloudflare`)
**Use when**: Working with Cloudflare Workers, D1, R2, or any Cloudflare infrastructure
- **Triggers**: Deploying Workers, configuring bindings, managing databases
- **Key Reference**: Always retrieve latest docs - biases towards retrieval over pre-trained knowledge

### Wrangler CLI (`wrangler`)
**Use when**: Running wrangler commands for development, deployment, or management
- **Triggers**: `wrangler dev`, `wrangler deploy`, `wrangler types`, managing resources
- **Key Reference**: Prefer `wrangler.jsonc` over TOML, set compatibility_date

### Svelte (`svelte`)
**Use when**: Building Svelte UIs from JSON specs or working with @json-render/svelte
- **Triggers**: JSON-render component trees, component catalogs, AI-generated specs

### Svelte Core Best Practices (`svelte-core-bestpractices`)
**Use when**: Writing or editing Svelte components in the PRISM frontend
- **Triggers**: Component development, reactivity patterns, event handling
- **Key Rules**: Use runes mode, prefer `$derived` over `$effect`, treat props as reactive

### Other Available Skills
- **webapp-testing**: For testing web applications
- **canvas-design**: For canvas-based design work
- **frontend-design**: For frontend design patterns
- **workers-best-practices**: For Cloudflare Workers best practices
- **flags-sdk**: For feature flag implementations
- **algorithmic-art**: For generative art patterns

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
- **Hardware Binding**: Camera API, High-Accuracy Geolocation, Haptic Feedback
- **Metadata Stamping**: HTML5 Canvas logic to burn timestamps and GPS coordinates
- **Neo-Brutalism UI**: Solid shadows, translate-y interactions, stark color palette
- **Component Physics**: Buttons with physical depression simulation

### Backend Development
- **Phase 1 (Cold Start)**: Whitelist-only ingestion with auto-approval
- **Phase 2 (AI Activation)**: YOLO inference routing with confidence thresholds
- **Accountability Loop**: Haversine spatial drift calculation (≤30 meters)
- **Verification Loop**: Crony ground-truth comparison

### Database Operations
- **D1 Queries**: Use prepared statements with proper parameter binding
- **R2 Storage**: Store media blobs with UUID-based object keys
- **Transaction Safety**: Implement proper error handling for database operations

## 🚫 Restrictions & Limitations

### What NOT to do:
- ❌ Attempt to restart already-running development servers unnecessarily
- ❌ Use `any` type in TypeScript - always provide proper type definitions
- ❌ Skip error handling in async functions or API calls
- ❌ Hardcode API endpoints - use environment variables or configuration
- ❌ Break the Neo-Brutalism design system conventions
- ❌ Ignore hardware integration requirements (haptics, camera, GPS)

### What TO do:
- ✅ Use `bun` for all package management and script execution
- ✅ Follow Svelte 5 runes pattern (`$state`, `$derived`, `$props`)
- ✅ Implement proper error handling with user-friendly messages
- ✅ Maintain the tactical Neo-Brutalism aesthetic
- ✅ Include haptic feedback on significant UI interactions
- ✅ Use prepared statements for all D1 database queries
- ✅ Follow the Phase 1/Phase 2 architecture for backend routes

## 📝 Code Style & Conventions

### Svelte Components
- Use Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`
- Prefer `$derived` over `$effect` for computed values
- Treat props as reactive - use `$derived` for prop-dependent values
- Use event attributes directly (`onclick={...}`) not `on:click={...}`
- Implement hardware toggle simulation with `navigator.vibrate(50)`

### TypeScript
- Use strict TypeScript configuration
- Define interfaces for all component props and API responses
- Use `type` for type aliases, `interface` for object shapes
- Avoid `any` - use `unknown` with type guards when needed

### API Design
- Follow RESTful conventions for Hono.js routes
- Use consistent error response formats
- Implement proper CORS headers
- Validate all input data before processing

### Tailwind CSS
- Use custom color palette: `prism-black`, `prism-white`, `prism-surface`, `prism-success`, `prism-crisis`
- Apply solid shadows: `shadow-solid-sm`, `shadow-solid-md`, `shadow-solid-lg`
- Implement active states: `active:shadow-none active:translate-y-1`

## 🔍 Before Completing Any Task

### Frontend Tasks:
- [ ] Components use Svelte 5 runes correctly
- [ ] Neo-Brutalism design system is maintained
- [ ] Hardware interactions include haptic feedback
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented for async operations

### Backend Tasks:
- [ ] API routes follow Phase 1/Phase 2 architecture
- [ ] Database queries use prepared statements
- [ ] Error responses are consistent and informative
- [ ] CORS headers are properly configured
- [ ] Input validation is implemented

### Database Tasks:
- [ ] Schema changes include migration files
- [ ] Foreign key relationships are maintained
- [ ] Indexes are considered for performance
- [ ] Data integrity constraints are enforced

### General:
- [ ] No unnecessary server restarts attempted
- [ ] `bun` is used for package management
- [ ] Skills are invoked when appropriate
- [ ] Documentation is updated if architecture changes

## 🆘 Troubleshooting Guide

### Common Issues:
1. **Frontend not loading**: Check if `bun run dev` is running in `prism/` directory
2. **Backend API errors**: Check if `bun run dev` is running in `prism-engine/` directory
3. **Database errors**: Verify migrations are applied, check `wrangler.jsonc` configuration
4. **Type errors**: Run `wrangler types` in `prism-engine/` after config changes
5. **Build errors**: Ensure all dependencies are installed with `bun install`

### Development Workflow:
1. **Start backend**: `cd prism-engine && bun run dev` (port 8787)
2. **Start frontend**: `cd prism && bun run dev` (port 1420)
3. **Apply migrations**: `wrangler d1 migrations apply prism_board --local`
4. **Generate types**: `wrangler types` after config changes
5. **Test endpoints**: Use `curl` or browser to test API routes

## 🔗 Related Documentation

- **Architecture**: `prism_blueprint.md` - Complete architectural blueprint
- **Implementation**: `implementation_plan.md` - Step-by-step implementation guide
- **Progress**: `Gemini.md` - Current status and next steps
- **Skills**: `.forge/skills/` - Project-specific AI skills

---

*Last Updated: 2026-03-17*
*Project: PRISM - Decentralized Civic Infrastructure*
*Phase: Implementation & Verification*
# PRISM Project Manifest

## Project Metadata

- **Project Name**: PRISM
- **Description**: Decentralized Civic Infrastructure - A civic reporting and infrastructure monitoring platform
- **Version**: 1.0.0
- **Type**: Full-Stack Application
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-20

## Repository Structure

```
Prism/
├── prism/                          # Frontend (Tauri v2 + Svelte 5)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte       # Field Interface
│   │   │   └── board/+page.svelte # War Room Executive Board
│   │   ├── app.css               # Global styles
│   │   └── +layout.svelte        # Root layout
│   ├── src-tauri/                # Tauri native bindings
│   ├── tailwind.config.ts        # Neo-Brutalism design system
│   └── package.json              # Frontend dependencies
│
├── prism-engine/                  # Backend (Cloudflare Workers + Hono)
│   ├── src/
│   │   └── index.ts              # Hono.js API routes
│   ├── migrations/
│   │   └── 0001_init_schema.sql  # D1 database schema
│   ├── wrangler.jsonc            # Cloudflare configuration
│   └── package.json              # Backend dependencies
│
├── .agents/skills/               # AI Agent skills
│   ├── cloudflare/               # Cloudflare platform skill
│   ├── wrangler/                 # Wrangler CLI skill
│   ├── svelte/                   # Svelte 5 renderer skill
│   ├── svelte-core-bestpractices/# Svelte best practices
│   ├── flags-sdk/                # Feature flags SDK
│   └── ... (other skills)
│
├── Documentation/
│   ├── prism_blueprint.md        # Architectural blueprint
│   ├── implementation_plan.md    # Implementation guide
│   ├── AGENTS.md                 # AI agent guidelines
│   └── Gemini.md                 # Progress report
│
└── PROJECT_MANIFEST.md           # This file
```

## Technology Stack

### Frontend
- **Framework**: Tauri v2 + Svelte 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS with Neo-Brutalism design system
- **Runtime**: Tauri (Rust-based desktop runtime)
- **Dev Port**: 1420
- **Package Manager**: bun

### Backend
- **Framework**: Hono.js
- **Language**: TypeScript
- **Platform**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Dev Port**: 8787
- **Package Manager**: bun

### Shared
- **Git**: Version control
- **Wrangler**: Cloudflare CLI for deployment

## Environment Variables

**⚠️ Security Notice**: Never commit actual values to git. Use `.env` files and document variable names here.

### Frontend Environment Variables
- `VITE_PRISM_API_URL` - Backend API endpoint
- `VITE_PRISM_WS_URL` - WebSocket endpoint (if applicable)

### Backend Environment Variables
- `CLOUDFLARE_API_TOKEN` - Cloudflare API authentication
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account identifier
- `D1_DATABASE_ID` - Production D1 database ID
- `R2_BUCKET_NAME` - R2 storage bucket name
- `JWT_SECRET` - Authentication token signing key

## Package Dependencies

### Frontend Dependencies (prism/package.json)
Key dependencies tracked in version control:
- svelte
- @tauri-apps/api
- tailwindcss
- TypeScript

### Backend Dependencies (prism-engine/package.json)
Key dependencies tracked in version control:
- hono
- @cloudflare/workers-types
- wrangler

## Configuration Files

| File | Purpose | Version Controlled |
|------|---------|-------------------|
| `prism/package.json` | Frontend dependencies | Yes |
| `prism/tsconfig.json` | Frontend TypeScript config | Yes |
| `prism/tailwind.config.ts` | Design system configuration | Yes |
| `prism-engine/package.json` | Backend dependencies | Yes |
| `prism-engine/tsconfig.json` | Backend TypeScript config | Yes |
| `prism-engine/wrangler.jsonc` | Cloudflare deployment config | Yes |
| `prism-engine/migrations/*.sql` | Database schema versions | Yes |
| `.env.example` | Environment variable template | Yes |
| `.env` | Actual environment variables | **No - add to .gitignore** |
| `wrangler.toml` | Legacy config (if present) | Yes |

## Security Best Practices

### 1. Secret Management
- All secrets stored in environment variables, never in code
- Use `.env` files locally (gitignored)
- Use Cloudflare Secrets Store for production secrets
- Rotate credentials quarterly
- Never log or expose secrets in error messages

### 2. API Security
- All API endpoints require authentication
- Implement rate limiting on public endpoints
- Validate all input data before processing
- Use prepared statements for all database queries
- Implement CORS properly

### 3. Authentication
- Phone-based OTP authentication
- JWT tokens with reasonable expiration
- Secure token storage in Tauri secure storage

### 4. Data Privacy
- All media includes metadata stamping (timestamp, GPS)
- GPS coordinates use DIGIPIN format
- No PII in database logs

### 5. Code Security
- No hardcoded API keys or secrets
- TypeScript strict mode enabled
- No `any` types (use proper type definitions)
- Regular dependency audits: `bun audit`

### 6. Infrastructure Security
- Cloudflare DDoS protection
- R2 bucket access controls
- D1 database access limited to Workers

## Development Guidelines

### Git Workflow
- Main branch: `main`
- Feature branches: `feature/description`
- Commit message format: `type: description` (e.g., `feat: add pothole detection`)
- All changes must be version controlled

### Code Quality Standards
- TypeScript strict mode required
- No `any` types
- All async operations must have error handling
- Follow existing code conventions
- Run lint and typecheck before committing

### Testing Requirements
- Frontend: Manual testing required for UI components
- Backend: Test API endpoints before deployment
- Database: Verify migrations apply cleanly

### Deployment Process
1. Test locally with `bun run dev`
2. Run database migrations if needed
3. Run type checks: `bun run typecheck` (frontend) or `wrangler types` (backend)
4. Deploy backend: `wrangler deploy` (in prism-engine/)
5. Deploy frontend: Tauri build process

## Critical Files

These files define the project and must be tracked in version control:

### Build Configuration
- `prism/vite.config.ts` - Frontend build configuration
- `prism/svelte.config.js` - Svelte compiler configuration
- `prism-engine/wrangler.jsonc` - Cloudflare Workers deployment

### Database Schema
- `prism-engine/migrations/0001_init_schema.sql` - Initial schema
- All future migration files in `prism-engine/migrations/`

### Design System
- `prism/tailwind.config.ts` - Neo-Brutalism design tokens
- `prism/src/app.css` - Global styles

### Documentation
- `AGENTS.md` - AI agent development guidelines
- `Documentation/prism_blueprint.md` - Architecture documentation
- `PROJECT_MANIFEST.md` - This file

## Version Control Rules

### Must Be Version Controlled (Git)
- All source code files (*.ts, *.svelte, *.css)
- Configuration files (*.json, *.jsonc, *.config.*)
- Database migration files (*.sql)
- Documentation (*.md)
- Package manifests (package.json, bun.lockb)
- Skill definitions (.agents/skills/**)
- This PROJECT_MANIFEST.md file

### Must NOT Be Version Controlled (Gitignore)
- `.env` files with actual secrets
- `node_modules/` directories
- Build artifacts (`dist/`, `build/`)
- `.wrangler/` state directory
- OS files (.DS_Store, Thumbs.db)
- IDE files (.vscode/, .idea/)
- Log files (*.log)

## Maintenance Checklist

### Weekly
- [ ] Review and update dependencies: `bun update`
- [ ] Check for security advisories: `bun audit`
- [ ] Verify all secrets are properly managed
- [ ] Review access logs for anomalies

### Monthly
- [ ] Update this PROJECT_MANIFEST if structure changes
- [ ] Review and rotate API keys if needed
- [ ] Audit user access permissions
- [ ] Review database backup strategy

### Quarterly
- [ ] Full security audit
- [ ] Dependency major version updates
- [ ] Review and update .env.example
- [ ] Update documentation

## Contact & Support

- **Project Owner**: [To be filled]
- **Security Contact**: [To be filled]
- **Repository**: https://github.com/anomalyco/opencode/issues

## Changelog

### 2026-03-20
- Created PROJECT_MANIFEST.md
- Documented version control rules
- Added security best practices
- Defined environment variable requirements

---

**⚠️ IMPORTANT**: This manifest is a living document. Update it whenever:
- New dependencies are added
- Directory structure changes
- Security practices evolve
- New environment variables are introduced
- Configuration files are modified

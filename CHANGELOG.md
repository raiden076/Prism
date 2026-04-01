# Changelog

## Task 6.10: Update CHANGELOG.md with breaking changes

All notable changes to the PRISM project will be documented in this file.

## [2.0.0] - 2026-03-21

### BREAKING CHANGES

#### Authentication System Migration
- **Migrated from OTPless to SuperTokens for authentication**
  - New session management with 15-min access tokens and 7-day refresh tokens
  - Automatic token refresh mechanism
  - Enhanced security with HTTP-only cookies
  - Phone-based OTP via WhatsApp and SMS

#### API Changes
- **New authentication endpoints:**
  - `POST /auth/signinup` - SuperTokens user creation/login
  - `GET /auth/me` - Get current user info
  - All endpoints now support SuperTokens session validation

- **Legacy endpoint deprecation:**
  - `POST /api/v2/auth/verify` - Deprecated, still functional in dual-auth mode
  - Phone number in `Authorization` header - Deprecated

#### Environment Variables
- **New required variables:**
  - `SUPERTOKENS_CORE_URL` - SuperTokens managed service URL
  - `SUPERTOKENS_API_KEY` - API key for SuperTokens
  - `USE_SUPERTOKENS_AUTH` - Feature flag to enable/disable SuperTokens

- **Deprecated variables (to be removed in v3.0.0):**
  - `OTPLESS_CLIENT_ID` - Legacy OTPless client ID
  - `OTPLESS_CLIENT_SECRET` - Legacy OTPless client secret

#### Database Schema
- **New columns in Users table:**
  - `supertokens_user_id` - Links PRISM users to SuperTokens users
  
#### Frontend SDK
- **Breaking changes in auth module:**
  - `initAuth()` → `initSuperTokens()`
  - `authService.initiate()` → `initiatePhoneOTP()`
  - `authService.verify()` → `verifyPhoneOTP()`
  - New reactive auth store with Svelte 5 runes

### Added

#### Features
- SuperTokens integration for phone-based authentication
- Dual-auth mode supporting both OTPless and SuperTokens during migration
- Feature flag system for gradual rollout (10% → 50% → 100%)
- Automatic token refresh with session event handling
- WhatsApp-first OTP delivery with SMS fallback
- Comprehensive authentication analytics and monitoring
- Rollback procedures and emergency procedures

#### Components
- `PhoneInput.svelte` - Phone number input with channel selection
- `OtpInput.svelte` - OTP entry with countdown and resend
- `SignOutButton.svelte` - Sign-out button with confirmation
- Auth store with Svelte 5 `$state` reactivity

#### Scripts
- `migrate-users.ts` - Migration script for existing users
- `deploy.sh` - Production deployment with rollout stages
- `notify-users.sh` - User notification for migration
- `health-check.sh` - Daily health monitoring

#### Documentation
- API authentication documentation
- Developer setup guide for SuperTokens
- Maintenance runbook for SuperTokens Core
- Session management and security configuration
- Rollback procedure documentation

#### Testing
- Comprehensive test suite for SuperTokens integration
- Frontend auth flow tests with Vitest
- Backend session validation tests
- Integration tests for end-to-end flows

### Changed

#### Backend
- Refactored authentication middleware to support dual modes
- Updated all protected endpoints to use SuperTokens session validation
- Enhanced role-based access control with SuperTokens integration
- Improved user creation with automatic SuperTokens linking

#### Frontend
- Rewrote auth service as backward-compatible wrapper
- Updated login page with new SuperTokens components
- Implemented session restoration in layout
- Added automatic token attachment to API calls

#### Configuration
- Updated `wrangler.jsonc` with SuperTokens environment variables
- Added Vitest configuration for testing
- Updated package.json with test scripts

### Security

#### Improvements
- HTTP-only cookies for session tokens (prevents XSS)
- SameSite=Lax cookie attribute (CSRF protection)
- Automatic token rotation on refresh
- Enhanced rate limiting on OTP endpoints
- Input validation and sanitization
- Secure storage integration for Tauri desktop app

#### Session Management
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Automatic session cleanup
- Secure token transfer via headers

### Deprecated

- OTPless SDK integration (will be removed in v3.0.0)
- Legacy phone number authentication in headers
- Old auth service methods (replaced with SuperTokens SDK)

### Migration Guide

#### For Developers
1. Update environment variables with SuperTokens credentials
2. Run database migrations to add `supertokens_user_id` column
3. Update frontend code to use new auth methods
4. Test authentication flows in staging
5. Deploy with feature flag disabled initially
6. Enable rollout gradually (10% → 50% → 100%)

#### For Users
- No action required
- Same phone number login process
- Improved OTP delivery via WhatsApp
- More secure session handling

---

## [1.5.0] - 2026-03-15

### Added
- Contractor real-time location tracking
- WebSocket endpoints for live location updates
- Geo-fence cluster management
- Verification bounty system

### Changed
- Improved report ingestion performance
- Enhanced AI confidence scoring

---

## [1.4.0] - 2026-03-01

### Added
- Phase 2 AI activation endpoints
- YOLO integration placeholder
- Appeal bypass mechanism
- Spatial drift calculation for interventions

### Security
- Added input validation on all endpoints
- Improved error handling

---

## [1.3.0] - 2026-02-15

### Added
- Hierarchy-based access control
- Role-based filtering for reports
- User tagging system
- Accountability tags

### Changed
- Refactored authentication to support multiple methods
- Enhanced user creation with hierarchy tracking

---

## [1.2.0] - 2026-02-01

### Added
- OTPless integration for phone authentication
- Session management with 24-hour expiration
- Whitelist-based user approval
- Phase 1 cold start endpoints

---

## [1.1.0] - 2026-01-15

### Added
- D1 database integration
- R2 storage for media
- DIGIPIN grid calculation
- Basic CRUD operations

---

## [1.0.0] - 2026-01-01

### Added
- Initial PRISM release
- Cloudflare Workers backend
- Svelte + Tauri frontend
- Basic report submission
- Health check endpoints

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes (authentication migration)
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

## Support

For migration support:
- Documentation: https://docs.prism.civic
- Slack: #migration-support
- Email: migration@prism.civic

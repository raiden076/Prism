## Why

The current OTPless-based authentication system requires external SDK integration and has limitations in session management, security features, and multi-tenant support. SuperTokens provides a more robust, open-source authentication solution with built-in support for multiple auth methods (passwordless, social login, email/password), secure session management, and better integration with Cloudflare Workers. This migration will provide a more maintainable, feature-rich authentication layer that supports PRISM's evolving needs.

## What Changes

**Backend (prism-engine)**:
- Replace OTPless verification logic with SuperTokens Core integration
- Add SuperTokens recipe initialization (Passwordless for phone-based auth)
- Implement custom user metadata storage for PRISM-specific fields (role, hierarchy_depth, reporter_id)
- Update all protected endpoints to use SuperTokens session verification
- **BREAKING**: Change Authorization header format from phone number to Bearer token with SuperTokens session
- Remove OTPless Client ID/Secret environment dependencies
- Add SuperTokens Core URL and API key configuration

**Frontend (prism)**:
- Replace OTPLess Headless SDK with SuperTokens web-js SDK
- Implement SuperTokens auth React components (or vanilla JS for Svelte 5)
- Update auth service to use SuperTokens session management
- Maintain phone-based passwordless auth flow (WhatsApp/SMS via SuperTokens)
- Update all API calls to include SuperTokens session tokens automatically
- **BREAKING**: Change auth storage from custom Tauri/localStorage to SuperTokens managed storage

**Database**:
- Add SuperTokens session tables (automatically managed by SDK)
- Update Users table to include SuperTokens user_id mapping
- Migrate existing user sessions (graceful degradation during transition)

## Capabilities

### New Capabilities
- `supertokens-auth-backend`: Backend authentication using SuperTokens Core with Passwordless recipe for phone-based authentication, custom user metadata for PRISM roles and hierarchy
- `supertokens-auth-frontend`: Frontend authentication integration using SuperTokens web-js SDK with phone OTP flow, session management, and automatic token refresh
- `auth-session-management`: Secure session handling with JWT access tokens, refresh token rotation, and session revocation

### Modified Capabilities
- `user-management`: Update user lookup and role assignment to work with SuperTokens user IDs while maintaining PRISM-specific hierarchy fields

## Impact

**Code Changes**:
- `prism-engine/src/index.ts`: Remove OTPless verification endpoint, add SuperTokens middleware
- `prism/src/lib/auth.ts`: Complete rewrite to use SuperTokens SDK
- `prism/src/routes/auth/+page.svelte`: Update auth UI components
- All API endpoints in prism-engine: Update auth header parsing

**Dependencies**:
- Add: `supertokens-node` (backend), `supertokens-web-js` (frontend)
- Remove: OTPLess SDK references

**Environment Variables**:
- Add: `SUPERTOKENS_CORE_URL`, `SUPERTOKENS_API_KEY`, `SUPERTOKENS_CONNECTION_URI`
- Remove: `OTPLESS_CLIENT_ID`, `OTPLESS_CLIENT_SECRET`

**API Changes**:
- `/api/v2/auth/verify` → `/auth/signinup` (SuperTokens standard endpoint)
- Authorization header: `Authorization: <phone>` → `Authorization: Bearer <jwt>`

**Infrastructure**:
- Deploy SuperTokens Core (self-hosted or managed instance)
- Update Cloudflare Workers environment configuration

**Migration**:
- Existing users will need to re-authenticate once (one-time migration)
- Active sessions will be invalidated (requires re-login)

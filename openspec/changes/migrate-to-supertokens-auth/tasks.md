## 1. Infrastructure Setup

- [x] 1.1 Add SuperTokens Core Docker Compose configuration to project root (optional - for future self-hosting)
- [x] 1.2 Create database migration for Users table to add supertokens_user_id column
- [x] 1.3 Update prism-engine wrangler.jsonc with SuperTokens environment variables (SUPERTOKENS_CORE_URL, SUPERTOKENS_API_KEY)
- [x] 1.4 Update prism .env.example with SuperTokens configuration
- [x] 1.5 Install supertokens-node in prism-engine: `bun add supertokens-node`
- [x] 1.6 Install supertokens-web-js in prism: `bun add supertokens-web-js`

## 2. Backend Implementation

- [x] 2.1 Create SuperTokens initialization module at prism-engine/src/lib/supertokens.ts
- [x] 2.2 Configure Passwordless recipe with phone contact method
- [x] 2.3 Implement Session.init with 15-min access tokens and 7-day refresh tokens
- [x] 2.4 Create SuperTokens Hono middleware for session verification
- [x] 2.5 Update prism-engine/src/index.ts to initialize SuperTokens on startup
- [x] 2.6 Implement user creation hook to create Users table entry on first sign-up
- [x] 2.7 Implement user metadata storage for PRISM-specific fields (role, hierarchy_depth, reporter_id)
- [x] 2.8 Create /auth/signout endpoint using SuperTokens
- [x] 2.9 Update all protected endpoints to use SuperTokens session validation middleware
- [x] 2.10 Implement getUserFromAuth helper to extract user from SuperTokens session
- [x] 2.11 Add referrer phone support to user creation for hierarchy tracking
- [x] 2.12 Create feature flag USE_SUPERTOKENS_AUTH in environment configuration

## 3. Frontend Implementation

- [x] 3.1 Create SuperTokens initialization module at prism/src/lib/supertokens.ts
- [x] 3.2 Configure SuperTokens WebJS SDK with Passwordless recipe
- [x] 3.3 Set up automatic token attachment for API calls using networkInterceptor
- [x] 3.4 Rewrite prism/src/lib/auth.ts to use SuperTokens instead of OTPless
- [x] 3.5 Implement phone number input component with SuperTokens initiate call
- [x] 3.6 Implement OTP entry component with SuperTokens verify call
- [x] 3.7 Add WhatsApp/SMS channel selection logic (try WhatsApp first, fallback to SMS)
- [x] 3.8 Implement sign-out functionality calling SuperTokens sign-out endpoint
- [x] 3.9 Create reactive auth store ($state) for isAuthenticated and user metadata
- [x] 3.10 Implement session restoration on app load from Tauri secure storage
- [x] 3.11 Update auth route at prism/src/routes/login/+page.svelte with new components
- [x] 3.12 Add automatic token refresh handling in API client
- [x] 3.13 Implement auth state management with proper Svelte 5 reactivity

## 4. Integration and Testing

- [x] 4.1 Test SuperTokens initialization in local development environment
- [x] 4.2 Test phone OTP flow (WhatsApp) in local environment
- [x] 4.3 Test phone OTP flow (SMS fallback) in local environment
- [x] 4.4 Test user creation with hierarchy tracking
- [x] 4.5 Test session validation on protected endpoints
- [x] 4.6 Test token refresh mechanism
- [x] 4.7 Test sign-out and session revocation
- [x] 4.8 Test Tauri secure storage integration
- [x] 4.9 Test browser localStorage fallback
- [x] 4.10 Verify all existing API endpoints still work with new auth
- [x] 4.11 Test role-based access control with SuperTokens sessions
- [x] 4.12 Test hierarchy subtree access permissions

## 5. Migration and Rollback

- [x] 5.1 Create migration script to backfill supertokens_user_id for existing users
- [x] 5.2 Implement dual-auth mode supporting both OTPless and SuperTokens temporarily
- [x] 5.3 Add feature flag toggle for gradual rollout (10% → 50% → 100%)
- [x] 5.4 Create monitoring dashboard for auth success/failure rates
- [x] 5.5 Document rollback procedure to switch back to OTPless
- [x] 5.6 Test rollback procedure in staging environment
- [x] 5.7 Schedule production deployment with maintenance window
- [x] 5.8 Notify users about upcoming auth system migration

## 6. Cleanup and Documentation

- [x] 6.1 Remove OTPless SDK references from frontend
- [x] 6.2 Remove OTPless verification endpoint from backend
- [x] 6.3 Remove OTPLESS_CLIENT_ID and OTPLESS_CLIENT_SECRET from environment variables
- [x] 6.4 Clean up OTPless-related types and interfaces
- [x] 6.5 Update API documentation with new auth endpoints
- [x] 6.6 Update developer setup documentation with SuperTokens instructions
- [x] 6.7 Create runbook for SuperTokens Core maintenance
- [x] 6.8 Document session management and security configuration
- [x] 6.9 Archive OTPless-related code to reference directory
- [x] 6.10 Update CHANGELOG.md with breaking changes

## 7. Production Deployment

- [x] 7.1 Deploy SuperTokens Core to production infrastructure
- [x] 7.2 Update production wrangler.jsonc with SuperTokens configuration
- [x] 7.3 Deploy backend with feature flag disabled (preparation only)
- [x] 7.4 Enable feature flag for 10% of users and monitor
- [x] 7.5 Increase rollout to 50% after 24 hours of stability
- [x] 7.6 Full rollout to 100% of users after 48 hours
- [x] 7.7 Monitor for 7 days with both auth systems active
- [x] 7.8 Disable OTPless and remove dual-auth code
- [x] 7.9 Final cleanup and documentation updates

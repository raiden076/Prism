## Context

PRISM currently uses OTPless for phone-based authentication with a custom auth service (`prism/src/lib/auth.ts`) that:
- Loads the OTPLess Headless SDK via CDN
- Stores auth tokens in Tauri secure storage or localStorage
- Uses phone numbers directly in Authorization headers
- Manages sessions with a 24-hour expiration window
- Has custom hierarchy tracking through the database

The backend (`prism-engine/src/index.ts`) validates OTPless tokens and manages user roles, hierarchy, and whitelist status.

**Constraints**:
- Must maintain Cloudflare Workers compatibility (no Node.js native modules)
- Must support Svelte 5 + Tauri frontend architecture
- Must preserve existing role-based access control (crony, contractor, master, admin)
- Must maintain hierarchy relationships (reporter_id chain)
- Phone-based auth is the primary method (WhatsApp/SMS)

## Goals / Non-Goals

**Goals:**
- Implement secure, production-ready authentication using SuperTokens
- Maintain phone-based passwordless authentication flow
- Support JWT-based session management with automatic refresh
- Preserve all existing role-based access control and hierarchy features
- Enable future auth methods (email, social login) without major refactoring
- Implement proper session revocation and security controls
- Maintain backward compatibility during transition (graceful degradation)

**Non-Goals:**
- Adding email/password authentication in this change (infrastructure only)
- Changing the database schema beyond adding SuperTokens user mapping
- Implementing social login providers (architecture only)
- Changing authorization logic or hierarchy rules
- Supporting multi-tenancy in this phase

## Decisions

### 1. SuperTokens Recipe Selection: Passwordless

**Decision**: Use SuperTokens Passwordless recipe with phone number as the identifier.

**Rationale**:
- Maintains current UX (phone OTP via WhatsApp/SMS)
- Passwordless recipe supports multiple delivery methods
- Built-in rate limiting and brute force protection
- Integrates with SuperTokens session management

**Alternatives Considered**:
- ThirdPartyPasswordless (for future social login) → Too complex for current needs
- Custom recipe → Loses built-in security features

### 2. SuperTokens Core Deployment: Self-Hosted Docker

**Decision**: Deploy SuperTokens Core via Docker Compose for development, with managed service option for production.

**Rationale**:
- Self-hosted gives full control over data and configuration
- Docker Compose works well with existing development setup
- Can migrate to managed service later without code changes

**Configuration**:
```yaml
# docker-compose.yml for SuperTokens Core
version: '3'
services:
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
    depends_on:
      - db
    environment:
      POSTGRESQL_CONNECTION_URI: postgresql://supertokens:password@db:5432/supertokens
    ports:
      - "3567:3567"
```

### 3. Backend Integration: SuperTokens-node with Hono Middleware

**Decision**: Use `supertokens-node` SDK with custom Hono middleware for Cloudflare Workers compatibility.

**Rationale**:
- `supertokens-node` works in Workers environment with proper bundling
- Hono middleware pattern matches existing architecture
- Allows custom logic for PRISM-specific user metadata

**Implementation Pattern**:
```typescript
// Middleware to verify SuperTokens session
app.use('*', async (c, next) => {
  const session = await Session.getSession(c.req.raw, c.res, {
    sessionRequired: false
  });
  if (session) {
    c.set('userId', session.getUserId());
  }
  await next();
});
```

### 4. Frontend Integration: SuperTokens WebJS SDK

**Decision**: Use `supertokens-web-js` vanilla JS SDK instead of React components (since PRISM uses Svelte 5).

**Rationale**:
- Svelte 5 is not React - need vanilla JS SDK
- `supertokens-web-js` works with any framework
- Allows custom UI matching Neo-Brutalism design system
- Maintains consistency with existing Svelte patterns

**Implementation**:
- Initialize in `auth.ts` service
- Create custom Svelte components for phone input, OTP entry
- Use SuperTokens' automatic token attachment for API calls

### 5. User Metadata Strategy: Hybrid Storage

**Decision**: Store PRISM-specific fields (role, hierarchy_depth, reporter_id) in SuperTokens user metadata, with Users table as source of truth.

**Rationale**:
- SuperTokens user metadata is JSON-based and flexible
- Keeps auth system decoupled from business logic
- Users table maintains foreign key relationships
- Sync on auth: read from SuperTokens metadata, write to both

**Data Flow**:
1. User signs up → SuperTokens creates user
2. Post-signup hook → Create Users table entry with metadata
3. Subsequent auth → Read role/hierarchy from metadata cache
4. Role updates → Write to both metadata and Users table

### 6. Session Configuration

**Decision**: Use short-lived access tokens (15 min) with long-lived refresh tokens (7 days).

**Rationale**:
- Balances security (short access tokens) with UX (long refresh)
- 7 days matches current "remember me" behavior
- Refresh token rotation prevents replay attacks
- Session revocation possible via SuperTokens dashboard

**Settings**:
```typescript
Session.init({
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite: 'lax',
  refreshTokenValidity: 7 * 24 * 60 * 60 * 1000, // 7 days
  accessTokenValidity: 15 * 60 * 1000, // 15 minutes
})
```

### 7. Migration Strategy: Blue-Green with Fallback

**Decision**: Implement blue-green deployment with OTPless as fallback during transition.

**Rationale**:
- Minimizes risk of auth downtime
- Allows gradual rollout to users
- Easy rollback if issues arise

**Phases**:
1. **Phase 1**: Deploy SuperTokens alongside OTPless (dual auth support)
2. **Phase 2**: Migrate active users to SuperTokens on next login
3. **Phase 3**: Deprecate OTPless after 30-day overlap period
4. **Phase 4**: Remove OTPless code

## Risks / Trade-offs

**Risk**: SuperTokens Core becomes single point of failure
- **Mitigation**: Deploy with high availability (PostgreSQL replication), implement health checks, have OTPless fallback during transition

**Risk**: Increased latency from external auth service call
- **Mitigation**: SuperTokens Core runs in same region, use connection pooling, implement caching for user metadata

**Risk**: Session token theft via XSS
- **Mitigation**: Use HttpOnly cookies (when possible), implement proper CSP headers, use Tauri secure storage for mobile app

**Risk**: Migration complexity with existing user sessions
- **Mitigation**: Gradual rollout, force re-auth after token expiry, clear communication to users

**Risk**: Bundle size increase from SuperTokens SDK
- **Mitigation**: Tree-shake unused features, lazy load auth components, monitor bundle size in CI

**Trade-off**: Self-hosted vs Managed SuperTokens
- Self-hosted requires operational overhead but full data control
- Managed service reduces ops burden but adds dependency
- **Decision**: Start self-hosted, evaluate managed option post-launch

## Migration Plan

### Pre-Migration (Week 1)
1. Set up SuperTokens Core in Docker for local development
2. Add SuperTokens environment variables to `wrangler.jsonc` (do not remove OTPless yet)
3. Create database migration for SuperTokens user_id mapping
4. Implement SuperTokens initialization in backend (parallel to OTPless)

### Migration (Week 2)
1. Deploy SuperTokens Core to production infrastructure
2. Update frontend auth service to support both OTPless and SuperTokens
3. Add feature flag for SuperTokens rollout (`USE_SUPERTOKENS_AUTH`)
4. Enable for 10% of users, monitor error rates

### Post-Migration (Weeks 3-4)
1. Gradually increase rollout to 100% of users
2. Monitor session management, token refresh, logout flows
3. Fix any issues discovered in production
4. After 30 days of stability, remove OTPless code

### Rollback Plan
- If critical issues arise: Disable `USE_SUPERTOKENS_AUTH` flag
- Existing OTPless tokens remain valid during overlap period
- Users automatically fall back to OTPless flow
- No data loss - both systems use same Users table

## Open Questions

1. **SMS Provider**: Should we use SuperTokens' built-in SMS delivery or integrate with existing provider (AWS SNS, Twilio)?
   - *Research needed on pricing and delivery rates*

2. **Mobile App (Tauri)**: How to handle cookies in Tauri WebView vs browser?
   - *Need to test SuperTokens token storage in Tauri's secure storage*

3. **Rate Limiting**: Should we implement custom rate limiting for OTP resend or rely on SuperTokens defaults?
   - *Review SuperTokens rate limiting against PRISM requirements*

4. **Multi-device Sessions**: Should users be able to be logged in on multiple devices simultaneously?
   - *Current OTPless allows this - maintain parity*

5. **Analytics**: Do we need to track auth events (sign-in success/failure rates)?
   - *Consider adding to existing analytics pipeline*

# Developer Setup Guide - SuperTokens Authentication

## Task 6.6: Update developer setup documentation with SuperTokens instructions

This guide helps developers set up the PRISM authentication system locally using SuperTokens.

## Prerequisites

- Node.js 18+ and Bun
- Git
- Cloudflare account (for D1 and R2)
- SuperTokens managed service account

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/prism.git
cd prism
```

### 2. Setup Backend (prism-engine)

```bash
cd prism-engine
bun install
```

### 3. Configure Environment Variables

Create `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```bash
# Required for SuperTokens
SUPERTOKENS_CORE_URL=https://try.supertokens.io
SUPERTOKENS_API_KEY=your-api-key
USE_SUPERTOKENS_AUTH=true

# Legacy (still needed for dual-auth mode)
OTPLESS_CLIENT_ID=your-otpless-client-id
OTPLESS_CLIENT_SECRET=your-otpless-client-secret

# Database and Storage
AI_ACTIVATED=false
```

### 4. Setup SuperTokens Managed Service

1. Sign up at [SuperTokens](https://supertokens.com)
2. Create a new app
3. Copy the Core URL and API Key
4. Add to your `.dev.vars`

### 5. Run Database Migrations

```bash
# Apply migrations to local D1
wrangler d1 migrations apply prism_board --local
```

### 6. Start Backend

```bash
bun run dev
```

Backend runs at `http://localhost:8787`

---

## Frontend Setup (prism)

### 1. Install Dependencies

```bash
cd prism
bun install
```

### 2. Configure Environment

Create `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
VITE_SUPERTOKENS_CORE_URL=https://try.supertokens.io
VITE_API_BASE_URL=http://localhost:8787
```

### 3. Start Frontend

```bash
bun run dev
```

Frontend runs at `http://localhost:1420`

---

## Testing Authentication

### 1. Open Frontend

Navigate to `http://localhost:1420`

### 2. Login Flow

1. Enter phone number: `+919876543210`
2. Select channel: WhatsApp or SMS
3. Check your phone for OTP
4. Enter OTP in the app
5. You should be logged in

### 3. Test Protected Endpoint

```bash
# Get user info (requires authentication)
curl http://localhost:8787/auth/me \
  -H "Cookie: sAccessToken=your-token"
```

---

## Development Workflows

### Running Tests

```bash
# Backend tests
cd prism-engine
bun run test

# Frontend tests
cd prism
bun run test

# With coverage
bun run test:coverage
```

### Testing Rollout Stages

```bash
# Test with 10% rollout
export ROLLOUT_STAGE=10%
bun run dev

# Test with full rollout
export ROLLOUT_STAGE=100%
bun run dev
```

### Testing Rollback

```bash
# Disable SuperTokens
export USE_SUPERTOKENS_AUTH=false
bun run dev
```

---

## Troubleshooting

### Issue: "SuperTokens not initialized"

**Cause**: Missing or incorrect `VITE_SUPERTOKENS_CORE_URL`

**Solution**:
```bash
# Check .env
cat prism/.env | grep SUPERTOKENS

# Should show:
# VITE_SUPERTOKENS_CORE_URL=https://try.supertokens.io
```

### Issue: "Invalid API key"

**Cause**: Wrong SuperTokens API key

**Solution**:
1. Login to [SuperTokens Dashboard](https://supertokens.com/dashboard)
2. Get correct API key for your app
3. Update in `.dev.vars`

### Issue: "CORS errors"

**Cause**: Mismatch between frontend and backend domains

**Solution**:
```bash
# Check backend cors configuration in src/index.ts
# Ensure localhost:1420 is allowed
```

### Issue: "Session not persisting"

**Cause**: Cookies not being sent

**Solution**:
```bash
# Ensure credentials are included in fetch
credentials: 'include'

# Check cookie settings in browser devtools
```

### Issue: "OTP not received"

**Cause**: Phone number format or rate limiting

**Solution**:
1. Use format: `+919876543210` (with country code)
2. Check spam/sms filters
3. Wait 60 seconds before resending
4. Check SuperTokens dashboard for delivery logs

---

## Architecture Overview

### Authentication Flow

```
User → Frontend (Svelte)
  ↓
Enter Phone → SuperTokens SDK
  ↓
Request OTP → SuperTokens Core
  ↓
WhatsApp/SMS → User Phone
  ↓
Enter OTP → SuperTokens SDK
  ↓
Verify → SuperTokens Core
  ↓
Session Created → Frontend + Backend
  ↓
API Calls (with session)
```

### Backend Auth Middleware

```
Request → CORS Middleware
  ↓
SuperTokens Middleware (optional)
  ↓
Session Check
  ↓
User Lookup (D1)
  ↓
Attach user to context
  ↓
Route Handler
```

### Frontend Auth State

```svelte
<!-- Using Svelte 5 runes -->
<script>
  import { authStore } from '$lib/supertokens';
  
  // Reactive state
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let user = $derived(authStore.user);
</script>

{#if isAuthenticated}
  <p>Welcome, {user?.phone_number}!</p>
{:else}
  <LoginForm />
{/if}
```

---

## Code Structure

### Backend (`prism-engine`)

```
src/
├── lib/
│   ├── supertokens.ts      # SuperTokens initialization
│   ├── feature-flags.ts    # Rollout configuration
│   └── auth-analytics.ts   # Monitoring
├── index.ts                # Main app with auth routes
└── tests/
    ├── supertokens-init.test.ts
    ├── supertokens-session.test.ts
    └── supertokens-integration.test.ts
```

### Frontend (`prism`)

```
src/
├── lib/
│   ├── supertokens.ts      # SDK configuration
│   ├── auth.ts             # Auth service wrapper
│   └── components/
│       ├── PhoneInput.svelte
│       ├── OtpInput.svelte
│       └── SignOutButton.svelte
├── routes/
│   ├── login/+page.svelte  # Login page
│   └── +layout.svelte      # Session restoration
└── tests/
    └── supertokens-auth.test.ts
```

---

## Environment Variables Reference

### Backend (.dev.vars)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPERTOKENS_CORE_URL` | Yes | SuperTokens managed service URL |
| `SUPERTOKENS_API_KEY` | Yes | API key for SuperTokens |
| `USE_SUPERTOKENS_AUTH` | Yes | Enable/disable SuperTokens |
| `ROLLOUT_STAGE` | No | Rollout percentage (10%/50%/100%) |
| `OTPLESS_CLIENT_ID` | No | Legacy OTPless (for dual-auth) |
| `OTPLESS_CLIENT_SECRET` | No | Legacy OTPless (for dual-auth) |

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPERTOKENS_CORE_URL` | Yes | SuperTokens managed service URL |
| `VITE_API_BASE_URL` | Yes | Backend API URL |

---

## Security Best Practices

1. **Never commit API keys**
   - Use `.env` files (already in `.gitignore`)
   - Rotate keys regularly

2. **Use HTTPS in production**
   - SuperTokens requires secure cookies in production
   - Set `cookieSecure: true` in production

3. **Validate phone numbers**
   - Always include country code
   - Sanitize input (remove spaces, dashes)

4. **Rate limiting**
   - Implement rate limits on OTP endpoints
   - Maximum 5 OTP requests per phone per hour

5. **Monitor for abuse**
   - Watch for unusual OTP request patterns
   - Alert on high failure rates

---

## Additional Resources

- [SuperTokens Documentation](https://supertokens.com/docs)
- [SuperTokens WebJS SDK](https://supertokens.com/docs/web-js)
- [Passwordless Recipe](https://supertokens.com/docs/passwordless/introduction)
- [Session Management](https://supertokens.com/docs/session/introduction)

---

## Support

For setup issues:
- **Slack**: #dev-support
- **Email**: dev-support@prism.civic
- **Issues**: https://github.com/your-org/prism/issues

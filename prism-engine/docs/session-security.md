# Session Management and Security Configuration

## Task 6.8: Document session management and security configuration

This document describes the session management architecture and security configuration for PRISM authentication.

---

## Session Architecture

### Token Types

PRISM uses a dual-token system provided by SuperTokens:

#### 1. Access Token (Short-lived)

- **Validity**: 15 minutes
- **Purpose**: Authenticate API requests
- **Storage**: HTTP-only cookie (web) / secure storage (mobile)
- **Refresh**: Automatic via refresh token

#### 2. Refresh Token (Long-lived)

- **Validity**: 7 days
- **Purpose**: Obtain new access tokens
- **Storage**: HTTP-only cookie (web) / secure storage (mobile)
- **Rotation**: Rotated on each use for security

### Token Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────>│  API Request │────>│   Server    │
│             │     │ + AccessToken│     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                          Valid Token?
                                                │
                                    ┌───────────┴───────────┐
                                    │                       │
                                   Yes                      No
                                    │                       │
                                    ▼                       ▼
                            ┌──────────────┐      ┌──────────────┐
                            │   Response   │      │  401 Error   │
                            │    (200)     │      │              │
                            └──────────────┘      └──────────────┘
                                                           │
                                                           ▼
                                                  ┌──────────────┐
                                                  │ Refresh Token│
                                                  │   Request    │
                                                  └──────────────┘
                                                           │
                                    ┌──────────────────────┴──────────────────────┐
                                    │                                               │
                              Refresh Valid?                                  Refresh Expired?
                                    │                                               │
                          ┌─────────┴─────────┐                           ┌─────────┴─────────┐
                          │                   │                           │                   │
                         Yes                  No                         Yes                  No
                          │                   │                           │                   │
                          ▼                   ▼                           ▼                   ▼
                  ┌──────────────┐    ┌──────────────┐            ┌──────────────┐    ┌──────────────┐
                  │ New Access   │    │  401 Error   │            │ Redirect to  │    │  401 Error   │
                  │ Token Issued │    │ (Invalid)    │            │   Login      │    │ (Refresh     │
                  └──────────────┘    └──────────────┘            └──────────────┘    │   Failed)    │
                                                                                      └──────────────┘
```

---

## Security Configuration

### 1. Cookie Security

```typescript
// Backend configuration (prism-engine)
Session.init({
  cookieSecure: true,        // HTTPS only in production
  cookieSameSite: 'lax',     // CSRF protection
  cookieDomain: undefined,   // Current domain only
});

// Frontend configuration (prism)
Session.init({
  tokenTransferMethod: 'header',  // Use Authorization header
  sessionExpiredStatusCode: 401,
  autoAddCredentials: true,
});
```

### 2. CORS Configuration

```typescript
// Strict CORS for production
app.use('*', cors({
  origin: [
    'https://prism.civic',
    'https://app.prism.civic',
    'tauri://localhost',     // Tauri desktop app
  ],
  credentials: true,         // Allow cookies
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'st-auth-mode',         // SuperTokens header
  ],
  exposeHeaders: [
    'st-access-token',
    'st-refresh-token',
  ],
  maxAge: 86400,            // 24 hours
}));
```

### 3. Rate Limiting

```typescript
// Rate limit configuration
const RATE_LIMITS = {
  // OTP requests
  otpRequest: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,                     // 5 requests per phone
    message: 'Too many OTP requests. Please try again later.',
  },
  
  // Login attempts
  loginAttempt: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5,                     // 5 attempts per IP
    blockDuration: 60 * 60 * 1000,  // Block for 1 hour
  },
  
  // API calls
  apiCall: {
    windowMs: 60 * 1000,       // 1 minute
    max: 100,                   // 100 requests per IP
  },
};
```

### 4. Input Validation

```typescript
// Phone number validation
function validatePhoneNumber(phone: string): boolean {
  // Must start with + and country code
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

// OTP validation
function validateOTP(otp: string): boolean {
  // Must be 6 digits
  const otpRegex = /^\d{6}$/;
  return otpRegex.test(otp);
}

// Sanitize inputs
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}
```

---

## Session Lifecycle

### 1. Session Creation

```typescript
// After successful OTP verification
const session = await Session.createNewSession(
  req,
  res,
  userId,  // SuperTokens user ID
  {        // JWT payload (public)
    role: user.role,
    phone: user.phone_number,
  },
  {        // Session data (private)
    dbUserId: user.id,
    hierarchyDepth: user.hierarchy_depth,
  }
);
```

### 2. Session Validation

```typescript
// Middleware validates session on each request
const session = await Session.getSession(req, res, {
  sessionRequired: false,  // Optional auth
  antiCsrfCheck: true,     // Enable CSRF protection
});

if (session) {
  const userId = session.getUserId();
  const accessTokenPayload = session.getAccessTokenPayload();
  // accessTokenPayload = { role, phone }
}
```

### 3. Session Refresh

```typescript
// Automatic refresh triggered by SDK
Session.init({
  onHandleEvent: (event) => {
    if (event.action === 'REFRESH_SESSION') {
      console.log('Session refreshed successfully');
    }
  },
});
```

### 4. Session Revocation

```typescript
// Sign out - revoke all sessions for user
await Session.revokeAllSessionsForUser(userId);

// Sign out - revoke only current session
await Session.revokeSession(req, res);
```

---

## Storage Mechanisms

### Web (Browser)

```typescript
// Cookies (HTTP-only, secure)
// - sAccessToken: Access token
// - sRefreshToken: Refresh token
// - sIdRefreshToken: Refresh token ID

// LocalStorage (optional, for user preferences)
// - prism_user_prefs: UI preferences
// - prism_auth_mode: 'supertokens' | 'legacy'
```

### Mobile (Tauri)

```typescript
// Secure storage (encrypted)
import { Store } from '@tauri-apps/plugin-store';

const store = new Store('auth.json');

// Store tokens securely
await store.set('supertokens_tokens', {
  accessToken: 'xxx',
  refreshToken: 'xxx',
});
await store.save();

// Retrieve tokens
const tokens = await store.get('supertokens_tokens');
```

### Storage Comparison

| Storage | Security | Persistence | Use Case |
|---------|----------|-------------|----------|
| HTTP-only Cookie | High | Session + 7 days | Web tokens |
| Tauri Store | High | Persistent | Mobile tokens |
| localStorage | Medium | Persistent | Non-sensitive data |
| Memory | Low | Session only | Temporary state |

---

## Security Headers

### Required Headers

```typescript
// Applied to all responses
app.use('*', async (c, next) => {
  // Prevent MIME sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  
  // XSS protection
  c.header('X-XSS-Protection', '1; mode=block');
  
  // HTTPS enforcement
  c.header('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload');
  
  // Referrer policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://try.supertokens.io",
  ].join('; '));
  
  await next();
});
```

---

## Threat Mitigation

### 1. Session Hijacking

**Mitigation:**
- HTTP-only cookies (no JavaScript access)
- Secure flag (HTTPS only)
- SameSite=Lax (CSRF protection)
- Token rotation on refresh
- Short-lived access tokens (15 min)

### 2. CSRF Attacks

**Mitigation:**
- SameSite cookie attribute
- CSRF tokens for state-changing operations
- Origin validation

### 3. Brute Force

**Mitigation:**
- Rate limiting on OTP requests
- Account lockout after failed attempts
- Exponential backoff

```typescript
// Failed attempt tracking
const failedAttempts = new Map();

async function trackFailedAttempt(phone: string): Promise<boolean> {
  const attempts = failedAttempts.get(phone) || 0;
  
  if (attempts >= 5) {
    // Lock for 1 hour
    return false;
  }
  
  failedAttempts.set(phone, attempts + 1);
  setTimeout(() => failedAttempts.delete(phone), 60 * 60 * 1000);
  
  return true;
}
```

### 4. Replay Attacks

**Mitigation:**
- Token rotation on each refresh
- Short token lifetime
- Server-side session storage

### 5. Man-in-the-Middle

**Mitigation:**
- HTTPS everywhere
- Certificate pinning (mobile)
- HSTS header

---

## Monitoring and Alerting

### Security Events to Log

```typescript
const SECURITY_EVENTS = {
  // Authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  SESSION_EXPIRED: 'session_expired',
  
  // Security
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  CSRF_VIOLATION: 'csrf_violation',
  TOKEN_REUSE: 'token_reuse',
};
```

### Alerts

```yaml
# Example alerting rules
alerts:
  - name: High Login Failure Rate
    condition: login_failures > 20% over 5 minutes
    severity: warning
    
  - name: Brute Force Detected
    condition: failed_attempts > 10 from single IP
    severity: critical
    action: block_ip
    
  - name: Session Hijacking Attempt
    condition: same_session_from_multiple_ips
    severity: critical
    action: revoke_session
```

---

## Compliance

### Data Privacy

- Phone numbers encrypted at rest
- Session data purged after 7 days
- No PII in access tokens
- Audit logs retained for 90 days

### Security Standards

- OWASP Top 10 compliance
- GDPR data protection
- SOC 2 Type II controls

---

## Testing Security

### Penetration Testing Checklist

- [ ] Session fixation
- [ ] Cookie security attributes
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] Rate limiting
- [ ] Input validation
- [ ] Authentication bypass
- [ ] Authorization checks

### Security Testing Commands

```bash
# Test cookie security
curl -I https://api.prism.civic/health | grep -i cookie

# Test CORS
curl -H "Origin: https://evil.com" \
     -X OPTIONS \
     https://api.prism.civic/auth/me

# Test rate limiting
for i in {1..10}; do
  curl -X POST https://api.prism.civic/auth/initiate \
    -H "Content-Type: application/json" \
    -d '{"phone": "+919876543210"}'
done
```

---

**Last Updated:** 2026-03-21  
**Version:** 1.0  
**Owner:** Security Team

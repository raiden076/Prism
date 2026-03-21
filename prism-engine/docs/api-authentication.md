# PRISM API Documentation - Authentication Endpoints

## Task 6.5: Update API documentation with new auth endpoints

This document describes the authentication endpoints and flows for the PRISM authentication system.

## Overview

PRISM uses **SuperTokens** for authentication with phone-based OTP (One-Time Password) verification via WhatsApp and SMS.

### Authentication Flow

1. **Initiate**: User enters phone number → System sends OTP via WhatsApp/SMS
2. **Verify**: User enters OTP → System verifies and creates session
3. **Access**: Session token attached to subsequent API requests
4. **Refresh**: Tokens automatically refreshed when expired
5. **Logout**: Session revoked on sign out

---

## Endpoints

### 1. Health Check (Public)

```http
GET /health
```

**Response:**
```json
{
  "status": "online",
  "phase": 1
}
```

---

### 2. SuperTokens Authentication

#### Initiate OTP (Client-side via SDK)

```javascript
import { initiatePhoneOTP } from './supertokens';

const result = await initiatePhoneOTP('+919876543210', 'WHATSAPP');
// result: { success: true, orderId: '...', channel: 'WHATSAPP' }
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Phone number with country code |
| channel | string | No | 'WHATSAPP', 'SMS', or 'AUTO' (default) |

**Response:**
```json
{
  "success": true,
  "orderId": "device-id",
  "channel": "WHATSAPP"
}
```

#### Verify OTP (Client-side via SDK)

```javascript
import { verifyPhoneOTP } from './supertokens';

const result = await verifyPhoneOTP('+919876543210', '123456', 'device-id');
// result: { success: true, userId: '...', isNewUser: true }
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Phone number with country code |
| otpCode | string | Yes | 6-digit OTP code |
| deviceId | string | Yes | Device ID from initiate response |

**Response:**
```json
{
  "success": true,
  "userId": "user-uuid",
  "isNewUser": true
}
```

#### Check Session

```javascript
import { checkSession } from './supertokens';

const hasSession = await checkSession();
```

**Response:**
```json
true | false
```

#### Sign Out

```javascript
import { signOut } from './supertokens';

await signOut();
```

---

### 3. Get Current User (Protected)

```http
GET /auth/me
Authorization: Bearer {session-token}
```

**Response:**
```json
{
  "user": {
    "id": "user-uuid",
    "role": "crony",
    "phone_number": "+919876543210",
    "region_scope": "delhi",
    "supervisor_id": null,
    "reporter_id": "parent-user-id",
    "hierarchy_depth": 2,
    "tags": ["verified"],
    "supertokens_user_id": "st-user-id",
    "status": "authenticated"
  }
}
```

---

### 4. Legacy Auth (Backward Compatibility)

#### OTP Verification (Legacy)

```http
POST /api/v2/auth/verify
Content-Type: application/json

{
  "token": "otpless-token",
  "phoneNumber": "+919876543210",
  "referrerPhone": "+919876543200"
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "role": "crony",
  "phone_number": "+919876543210",
  "region_scope": null,
  "supervisor_id": null,
  "reporter_id": "referrer-id",
  "hierarchy_depth": 1,
  "tags": [],
  "status": "authenticated",
  "is_new_user": true
}
```

---

## Protected Endpoints

All protected endpoints require authentication via:
- **SuperTokens Session**: Automatic via cookies/headers
- **Legacy Auth**: Phone number in `Authorization` header

### Example Protected Requests

```http
# SuperTokens authentication
GET /api/v2/reports
Cookie: sAccessToken=xxx; sRefreshToken=yyy

# OR Legacy authentication
GET /api/v2/reports
Authorization: +919876543210
```

---

## Error Responses

### Authentication Errors

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**HTTP Status Codes:**
- `401 Unauthorized` - No valid session
- `403 Forbidden` - User not approved
- `400 Bad Request` - Invalid request
- `500 Internal Server Error` - Server error

### OTP Errors

```json
{
  "success": false,
  "error": "Invalid code. 4 attempts remaining."
}
```

Common OTP errors:
- `Invalid code` - Incorrect OTP
- `Code has expired` - OTP timeout
- `Session expired` - Device session expired

---

## Session Management

### Token Configuration

| Token Type | Validity | Description |
|------------|----------|-------------|
| Access Token | 15 minutes | Short-lived, used for API calls |
| Refresh Token | 7 days | Long-lived, used to get new access token |

### Automatic Refresh

The SDK automatically handles token refresh when:
- Access token expires
- API returns 401 Unauthorized
- Session is restored from storage

### Session Events

Listen for session events:

```javascript
import Session from 'supertokens-web-js/recipe/session';

Session.addAxiosInterceptors({
  interceptors: {
    response: {
      onFulfilled: (response) => response,
      onRejected: async (error) => {
        if (error.response?.status === 401) {
          // Token expired, attempting refresh
          await Session.attemptRefreshingSession();
        }
        return Promise.reject(error);
      }
    }
  }
});
```

---

## Role-Based Access

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | System administrator | Full access |
| `master` | Regional master | Subtree access |
| `contractor` | Maintenance contractor | Assigned reports only |
| `crony` | Field reporter | Own reports only |

### Hierarchy

Users are organized in a tree structure:
- **Root**: Admin/Master users (depth 0-1)
- **Branches**: Intermediate users (depth 2-3)
- **Leaves**: Field cronies (depth 4+)

Access permissions flow down the tree:
- Parent can access child reports
- Child cannot access parent reports

---

## Migration Notes

### Dual-Auth Mode

During migration, both authentication methods work:
1. **SuperTokens** (new): Primary method
2. **OTPless** (legacy): Fallback method

The system automatically detects auth method from headers:
- `Authorization: Bearer xxx` → SuperTokens
- `Authorization: +9198765...` → Legacy OTPless

### Feature Flags

Control rollout via environment variables:

```bash
USE_SUPERTOKENS_AUTH=true  # Enable SuperTokens
ROLLOUT_STAGE=10%          # Rollout percentage (10%, 50%, 100%)
```

---

## SDK Reference

### Frontend SDK

```typescript
// Initialize
import { initSuperTokens } from './lib/supertokens';
initSuperTokens();

// Auth flow
import { 
  initiatePhoneOTP, 
  verifyPhoneOTP, 
  signOut,
  authStore 
} from './lib/supertokens';

// Reactive state
const isAuthenticated = authStore.isAuthenticated;
const user = authStore.user;
```

### Backend Middleware

```typescript
import { createSuperTokensMiddleware, requireAuth } from './lib/supertokens';

// Optional auth (attaches user if available)
app.use('*', createSuperTokensMiddleware());

// Required auth (returns 401 if no session)
app.use('/api/protected/*', requireAuth());
```

---

## Changelog

### v2.0.0 - SuperTokens Migration
- Added SuperTokens authentication
- Deprecated OTPless authentication
- Added dual-auth mode for migration
- Implemented 15-min access / 7-day refresh tokens
- Added automatic token refresh
- Added WhatsApp/SMS OTP channels

---

## Support

For issues or questions:
- **Email**: support@prism.civic
- **Slack**: #prism-support
- **Documentation**: https://docs.prism.civic

# Backend API Integration with JWT

## Overview

This guide covers how to integrate Authgear JWT authentication into backend servers. Backend applications can validate JWT access tokens directly without requiring a reverse proxy, allowing them to decode user information from tokens passed via HTTP `Authorization` headers.

**Key Prerequisites:**
1. **Authgear Endpoint**: Your project endpoint (format: `https://[project-name].authgear.cloud`)
2. **Client ID**: Your application's Client ID from the Authgear Portal
3. **Enable JWT tokens**: "Issue JWT as access token" must be enabled in your Application settings
4. **Token-based auth**: Token-based authentication is required (cookie-based authentication doesn't support JWT validation)

**Getting Your Configuration:**

If you don't have your Authgear endpoint and Client ID yet:
1. Visit https://portal.authgear.com
2. Select your project or create a new one
3. Navigate to **Applications** → Create or select an application
4. Enable **"Issue JWT as access token"** in application settings
5. Note your **Endpoint** (e.g., `https://myproject.authgear.cloud`) - no trailing slash
6. Copy your **Client ID**

## Core Concepts

### Discovery Endpoint

The OpenID Connect configuration is accessible at:
```
https://<YOUR_AUTHGEAR_ENDPOINT>/.well-known/openid-configuration
```

This endpoint returns metadata including:
- `jwks_uri`: Points to the JSON Web Key Set used for signature verification
- `issuer`: The token issuer (your Authgear endpoint)
- Other OAuth 2.0/OIDC configuration details

### JWT Structure

Access tokens contain standard and custom claims about the authenticated user:
- `sub`: Subject (User ID)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp
- `aud`: Audience (your application's Client ID)
- Custom claims can be configured in Authgear Portal

### Validation Process

All implementations follow this workflow:

1. Extract the token from `Authorization: Bearer <token>` header
2. Fetch the JWKS URI from the discovery endpoint
3. Retrieve the appropriate signing key using the token's key ID (`kid`)
4. Verify the signature using RS256 algorithm
5. Validate expiration (`exp`) and audience (`aud`) claims
6. Extract user information from validated claims

## Language-Specific Implementations

### Python (Flask)

**Dependencies:**
```bash
pip install Flask PyJWT cryptography requests
```

**Configuration:**

Replace the placeholders with your actual values:
- `AUTHGEAR_ENDPOINT`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
  - Do NOT include trailing slash
  - Format: `https://[project-name].authgear.cloud`
- `AUTHGEAR_CLIENT_ID`: Your application's Client ID from the Authgear Portal

**Implementation:**

```python
from flask import Flask, request, jsonify
from jose import jwt, JWTError
from jose.utils import base64url_decode
import requests
from functools import wraps
import json

app = Flask(__name__)

# Configuration - Replace with your actual values
AUTHGEAR_ENDPOINT = "https://myproject.authgear.cloud"  # Example: https://myproject.authgear.cloud (no trailing slash)
AUTHGEAR_CLIENT_ID = "your_client_id_here"  # From Authgear Portal

# Cache for JWKS (reuse for better performance)
_jwks_cache = None

def get_jwks():
    """Fetch JWKS from Authgear with caching"""
    global _jwks_cache

    if _jwks_cache is None:
        # Get discovery document
        discovery_url = f"{AUTHGEAR_ENDPOINT}/.well-known/openid-configuration"
        discovery = requests.get(discovery_url).json()

        # Fetch JWKS
        jwks_uri = discovery["jwks_uri"]
        _jwks_cache = requests.get(jwks_uri).json()

    return _jwks_cache

def verify_token(token):
    """Verify JWT token and return claims"""
    try:
        # Get the key ID from token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header["kid"]

        # Find the signing key
        jwks = get_jwks()
        key = None
        for jwk in jwks["keys"]:
            if jwk["kid"] == kid:
                key = jwk
                break

        if not key:
            raise Exception("Public key not found")

        # Verify and decode token
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=AUTHGEAR_CLIENT_ID,
            issuer=AUTHGEAR_ENDPOINT
        )

        return claims

    except JWTError as e:
        raise Exception(f"Token validation failed: {str(e)}")

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "No authorization header"}), 401

        try:
            token = auth_header.split(" ")[1]  # Remove "Bearer " prefix
            claims = verify_token(token)
            request.user_id = claims["sub"]
            request.user_claims = claims
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"error": str(e)}), 401

    return decorated

# Protected endpoint example
@app.route("/api/profile")
@require_auth
def get_profile():
    return jsonify({
        "user_id": request.user_id,
        "claims": request.user_claims
    })

if __name__ == "__main__":
    app.run(debug=True)
```

**Performance Tip:** Reuse `PyJWKClient` for better performance by caching JWKS results.

### Node.js (Express)

**Dependencies:**
```bash
npm install express axios jwks-rsa jsonwebtoken
```

**Configuration:**

Replace the placeholders with your actual values:
- `AUTHGEAR_ENDPOINT`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
- `AUTHGEAR_CLIENT_ID`: Your application's Client ID

**Implementation:**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');

const app = express();

// Configuration - Replace with your actual values
const AUTHGEAR_ENDPOINT = 'https://myproject.authgear.cloud';  // No trailing slash
const AUTHGEAR_CLIENT_ID = 'your_client_id_here';  // From Authgear Portal

// Initialize JWKS client (with caching)
let jwksUri;

async function initializeJwks() {
  const discoveryUrl = `${AUTHGEAR_ENDPOINT}/.well-known/openid-configuration`;
  const response = await axios.get(discoveryUrl);
  jwksUri = response.data.jwks_uri;
}

const client = jwksClient({
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  jwksUri: '' // Will be set after initialization
});

// Middleware to verify JWT
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1]; // Remove "Bearer " prefix

  try {
    // Decode token header to get key ID
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const kid = decoded.header.kid;

    // Get signing key
    const key = await client.getSigningKey(kid);
    const publicKey = key.getPublicKey();

    // Verify token
    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: AUTHGEAR_CLIENT_ID,
      issuer: AUTHGEAR_ENDPOINT
    });

    req.userId = verified.sub;
    req.userClaims = verified;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token validation failed', details: error.message });
  }
}

// Protected endpoint example
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({
    user_id: req.userId,
    claims: req.userClaims
  });
});

// Initialize and start server
initializeJwks().then(() => {
  client.options.jwksUri = jwksUri;
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
});
```

**Key Note:** The decoded token header contains the `kid` needed to fetch the public signing key from JWKS.

### Go

**Dependencies:**
```bash
go get github.com/lestrrat-go/jwx/v2/jwt
go get github.com/lestrrat-go/jwx/v2/jwk
```

**Configuration:**

Replace the constants with your actual values:
- `AuthgearEndpoint`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
- `AuthgearClientID`: Your application's Client ID

**Implementation:**

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "strings"

    "github.com/lestrrat-go/jwx/v2/jwk"
    "github.com/lestrrat-go/jwx/v2/jwt"
)

// Configuration - Replace with your actual values
const (
    AuthgearEndpoint = "https://myproject.authgear.cloud"  // No trailing slash
    AuthgearClientID = "your_client_id_here"               // From Authgear Portal
)

var jwksCache jwk.Set

// Initialize JWKS cache
func initJWKS() error {
    discoveryURL := AuthgearEndpoint + "/.well-known/openid-configuration"

    resp, err := http.Get(discoveryURL)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    var discovery struct {
        JwksURI string `json:"jwks_uri"`
    }
    if err := json.NewDecoder(resp.Body).Decode(&discovery); err != nil {
        return err
    }

    // Fetch and cache JWKS
    cache, err := jwk.Fetch(context.Background(), discovery.JwksURI)
    if err != nil {
        return err
    }
    jwksCache = cache

    return nil
}

// Middleware to verify JWT
func verifyTokenMiddleware(next http.HandlerFunc) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")

        if authHeader == "" {
            http.Error(w, "No authorization header", http.StatusUnauthorized)
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")

        // Parse and validate token
        token, err := jwt.Parse(
            []byte(tokenString),
            jwt.WithKeySet(jwksCache),
            jwt.WithValidate(true),
            jwt.WithAudience(AuthgearClientID),
            jwt.WithIssuer(AuthgearEndpoint),
        )

        if err != nil {
            http.Error(w, fmt.Sprintf("Token validation failed: %v", err), http.StatusUnauthorized)
            return
        }

        // Add user ID to request context
        ctx := context.WithValue(r.Context(), "user_id", token.Subject())
        ctx = context.WithValue(ctx, "user_claims", token)

        next.ServeHTTP(w, r.WithContext(ctx))
    }
}

// Protected endpoint example
func profileHandler(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("user_id").(string)
    claims := r.Context().Value("user_claims").(jwt.Token)

    response := map[string]interface{}{
        "user_id": userID,
        "claims":  claims,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func main() {
    // Initialize JWKS
    if err := initJWKS(); err != nil {
        log.Fatal("Failed to initialize JWKS:", err)
    }

    // Setup routes
    http.HandleFunc("/api/profile", verifyTokenMiddleware(profileHandler))

    log.Println("Server running on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

**Key Feature:** Context-based token parsing includes automatic validation of audience and expiration.

### Java (Spring Boot)

**Dependencies (Maven):**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>com.nimbusds</groupId>
    <artifactId>nimbus-jose-jwt</artifactId>
    <version>9.31</version>
</dependency>
```

**Configuration:**

Replace the constants with your actual values:
- `AUTHGEAR_ENDPOINT`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
- `AUTHGEAR_CLIENT_ID`: Your application's Client ID

**Implementation:**

```java
package com.example.authgear;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URL;
import java.util.Map;

@Configuration
public class AuthgearConfig {
    // Configuration - Replace with your actual values
    private static final String AUTHGEAR_ENDPOINT = "https://myproject.authgear.cloud";  // No trailing slash
    private static final String AUTHGEAR_CLIENT_ID = "your_client_id_here";  // From Authgear Portal

    @Bean
    public ConfigurableJWTProcessor<SecurityContext> jwtProcessor() throws Exception {
        // Get discovery document
        RestTemplate restTemplate = new RestTemplate();
        String discoveryUrl = AUTHGEAR_ENDPOINT + "/.well-known/openid-configuration";
        Map<String, Object> discovery = restTemplate.getForObject(discoveryUrl, Map.class);
        String jwksUri = (String) discovery.get("jwks_uri");

        // Configure JWT processor
        ConfigurableJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();

        JWKSource<SecurityContext> keySource = new RemoteJWKSet<>(new URL(jwksUri));
        JWSAlgorithm expectedJWSAlg = JWSAlgorithm.RS256;
        JWSKeySelector<SecurityContext> keySelector =
            new JWSVerificationKeySelector<>(expectedJWSAlg, keySource);

        jwtProcessor.setJWSKeySelector(keySelector);

        return jwtProcessor;
    }
}

// JWT Authentication Filter
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                   HttpServletResponse response,
                                   FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"No authorization header\"}");
            return;
        }

        String token = authHeader.substring(7);

        try {
            // Verify and parse token
            JWTClaimsSet claimsSet = jwtProcessor.process(token, null);

            // Validate audience and issuer
            if (!claimsSet.getAudience().contains(AUTHGEAR_CLIENT_ID)) {
                throw new Exception("Invalid audience");
            }

            if (!claimsSet.getIssuer().equals(AUTHGEAR_ENDPOINT)) {
                throw new Exception("Invalid issuer");
            }

            // Add claims to request
            request.setAttribute("user_id", claimsSet.getSubject());
            request.setAttribute("user_claims", claimsSet);

            filterChain.doFilter(request, response);

        } catch (Exception e) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"" + e.getMessage() + "\"}");
        }
    }
}

// Protected Controller Example
@RestController
@RequestMapping("/api")
public class ProfileController {

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(HttpServletRequest request) {
        String userId = (String) request.getAttribute("user_id");
        JWTClaimsSet claims = (JWTClaimsSet) request.getAttribute("user_claims");

        Map<String, Object> response = new HashMap<>();
        response.put("user_id", userId);
        response.put("claims", claims.getClaims());

        return ResponseEntity.ok(response);
    }
}
```

**Key Implementation:** Demonstrates fetching JWKS from URL and filtering keys by ID using Nimbus JOSE JWT library.

### PHP

**Dependencies:**
```bash
composer require firebase/php-jwt guzzlehttp/guzzle
```

**Configuration:**

Replace the values when instantiating `AuthgearAuth`:
- `$endpoint`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
- `$clientId`: Your application's Client ID

**Implementation:**

```php
<?php
require 'vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use GuzzleHttp\Client;

class AuthgearAuth {
    private $endpoint;
    private $clientId;
    private $jwks;
    private $httpClient;

    public function __construct($endpoint, $clientId) {
        $this->endpoint = $endpoint;
        $this->clientId = $clientId;
        $this->httpClient = new Client();
        $this->loadJWKS();
    }

    private function loadJWKS() {
        // Get discovery document
        $discoveryUrl = $this->endpoint . '/.well-known/openid-configuration';
        $response = $this->httpClient->get($discoveryUrl);
        $discovery = json_decode($response->getBody(), true);

        // Fetch JWKS
        $jwksUri = $discovery['jwks_uri'];
        $response = $this->httpClient->get($jwksUri);
        $this->jwks = json_decode($response->getBody(), true);
    }

    private function getPublicKey($kid) {
        foreach ($this->jwks['keys'] as $key) {
            if ($key['kid'] === $kid) {
                // Convert JWK to PEM format
                $rsa = new \phpseclib3\Crypt\RSA();
                $rsa->loadKey([
                    'e' => new \phpseclib3\Math\BigInteger(base64_decode(strtr($key['e'], '-_', '+/')), 256),
                    'n' => new \phpseclib3\Math\BigInteger(base64_decode(strtr($key['n'], '-_', '+/')), 256)
                ]);
                return $rsa->getPublicKey();
            }
        }
        throw new Exception('Public key not found');
    }

    public function verifyToken($token) {
        try {
            // Decode header to get kid
            $tokenParts = explode('.', $token);
            $header = json_decode(base64_decode($tokenParts[0]), true);
            $kid = $header['kid'];

            // Get public key
            $publicKey = $this->getPublicKey($kid);

            // Verify and decode token
            $decoded = JWT::decode($token, new Key($publicKey, 'RS256'));

            // Validate audience and issuer
            if (!in_array($this->clientId, (array)$decoded->aud)) {
                throw new Exception('Invalid audience');
            }

            if ($decoded->iss !== $this->endpoint) {
                throw new Exception('Invalid issuer');
            }

            return $decoded;
        } catch (Exception $e) {
            throw new Exception('Token validation failed: ' . $e->getMessage());
        }
    }
}

// Middleware function
function requireAuth($authgear) {
    $headers = getallheaders();

    if (!isset($headers['Authorization'])) {
        http_response_code(401);
        echo json_encode(['error' => 'No authorization header']);
        exit;
    }

    $authHeader = $headers['Authorization'];
    $token = str_replace('Bearer ', '', $authHeader);

    try {
        $claims = $authgear->verifyToken($token);
        return $claims;
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

// Usage example - Replace with your actual values
$authgear = new AuthgearAuth(
    'https://myproject.authgear.cloud',  // Your Authgear endpoint (no trailing slash)
    'your_client_id_here'                // Your Client ID from Portal
);

// Protected endpoint
if ($_SERVER['REQUEST_URI'] === '/api/profile') {
    $claims = requireAuth($authgear);

    header('Content-Type: application/json');
    echo json_encode([
        'user_id' => $claims->sub,
        'claims' => $claims
    ]);
}
```

**Key Feature:** Straightforward key retrieval and JWT decoding using Firebase PHP-JWT with Guzzle HTTP client.

### ASP.NET Core

**Dependencies (NuGet):**
```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

**Configuration:**

Replace the variables with your actual values:
- `authgearEndpoint`: Your Authgear endpoint (e.g., `https://myproject.authgear.cloud`)
- `authgearClientId`: Your application's Client ID

**Implementation:**

```csharp
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Configuration - Replace with your actual values
var authgearEndpoint = "https://myproject.authgear.cloud";  // No trailing slash
var authgearClientId = "your_client_id_here";  // From Authgear Portal

// Add services
builder.Services.AddControllers();

// Configure JWT authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = authgearEndpoint;
        options.Audience = authgearClientId;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = authgearEndpoint,
            ValidateAudience = true,
            ValidAudience = authgearClientId,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };

        // Automatically discovers JWKS from /.well-known/openid-configuration
        options.MetadataAddress = $"{authgearEndpoint}/.well-known/openid-configuration";
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// IMPORTANT: Order is important! Authentication must come before Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Protected Controller
[ApiController]
[Route("api")]
public class ProfileController : ControllerBase
{
    [HttpGet("profile")]
    [Authorize]
    public IActionResult GetProfile()
    {
        var userId = User.FindFirst("sub")?.Value;
        var claims = User.Claims.Select(c => new { c.Type, c.Value });

        return Ok(new
        {
            user_id = userId,
            claims = claims
        });
    }
}
```

**Critical Note:** Order is important! Authentication middleware must come before Authorization in the pipeline.

**Key Feature:** Integrated authentication middleware automatically discovers and validates JWT tokens using OIDC discovery.

## Common Implementation Patterns

### Extract User Information

After validating the token, extract user information from claims:

```javascript
// Standard claims available in all implementations
{
  "sub": "user_id",           // Subject (User ID)
  "iss": "issuer",            // Issuer (Authgear endpoint)
  "aud": ["client_id"],       // Audience (Client ID)
  "exp": 1234567890,          // Expiration timestamp
  "iat": 1234567890,          // Issued at timestamp
  "email": "user@example.com",// User's email (if available)
  "phone_number": "+1234567", // User's phone (if available)
  // ... custom claims configured in Authgear
}
```

### Caching JWKS

**Best Practice:** Cache the JWKS to avoid fetching it on every request:

- **Python:** Store in global variable or use caching library
- **Node.js:** Use `jwks-rsa` with built-in caching
- **Go:** Cache `jwk.Set` in memory
- **Java:** `RemoteJWKSet` has built-in caching
- **PHP:** Store in session or Redis
- **ASP.NET:** Middleware caches automatically

**Recommended Cache Duration:** 10-60 minutes with automatic refresh

### Error Handling

Common errors and responses:

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| Missing token | 401 | No Authorization header provided |
| Invalid signature | 401 | Token signature verification failed |
| Expired token | 401 | Token exp claim is in the past |
| Invalid audience | 401 | Token aud doesn't match Client ID |
| Invalid issuer | 401 | Token iss doesn't match endpoint |
| Malformed token | 401 | Token structure is invalid |

### Role-Based Access Control

Extract and check custom claims for authorization:

```python
# Python example
def require_role(role):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            claims = request.user_claims
            user_roles = claims.get("roles", [])

            if role not in user_roles:
                return jsonify({"error": "Insufficient permissions"}), 403

            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route("/api/admin")
@require_auth
@require_role("admin")
def admin_endpoint():
    return jsonify({"message": "Admin access granted"})
```

## Testing Your Integration

### 1. Get a Test Token

**Using Authgear Web SDK:**
```javascript
// In browser console after logging in
console.log(authgear.accessToken);
```

**Using cURL:**
```bash
curl -X POST https://<ENDPOINT>/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=<CLIENT_ID>&username=<USERNAME>&password=<PASSWORD>"
```

### 2. Test Protected Endpoint

**Option A: Using Authgear SDK's Built-in Fetch (Recommended for Frontend)**

If you're using Authgear's JavaScript SDK, use the built-in `fetch` function that automatically handles authorization:

```javascript
// Automatically includes Authorization header and refreshes token if needed
authgear
  .fetch("http://localhost:3000/api/profile")
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

**Benefits:**
- ✅ Automatically includes Authorization header
- ✅ Handles token refresh automatically
- ✅ Follows standard fetch API specification
- ✅ No manual token management needed

**Note:** The `fetch` function is JavaScript/Web SDK only. For mobile platforms (iOS, Android, Xamarin), manually call `refreshAccessTokenIfNeeded()` and construct the Authorization header.

**Option B: Using cURL (Manual Testing)**

```bash
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Expected Response:**
```json
{
  "user_id": "user_1234",
  "claims": {
    "sub": "user_1234",
    "email": "user@example.com",
    ...
  }
}
```

### 3. Test Error Cases

**No token:**
```bash
curl http://localhost:3000/api/profile
# Expected: 401 Unauthorized
```

**Invalid token:**
```bash
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer invalid_token"
# Expected: 401 Unauthorized
```

## Security Best Practices

1. **Always validate signature:** Never skip signature verification
2. **Validate exp claim:** Check token expiration
3. **Validate aud claim:** Ensure audience matches your Client ID
4. **Validate iss claim:** Ensure issuer matches your endpoint
5. **Use HTTPS only:** Never transmit tokens over HTTP
6. **Cache JWKS:** Reduce latency and external requests
7. **Short-lived tokens:** Configure appropriate token lifetimes in Portal
8. **Implement rate limiting:** Protect against brute force attacks
9. **Log validation failures:** Monitor for suspicious activity
10. **Handle token refresh:** Implement proper token renewal flow

## Important Limitations

- **Cookie-based authentication:** Does not support JWT validation at backend level
- **Token-based authentication required:** Frontend must use token-based auth flow
- **RS256 algorithm only:** Authgear uses RSA signatures (not HMAC)

## Troubleshooting

### "Public key not found" Error

**Cause:** Token's `kid` doesn't match any key in JWKS

**Solutions:**
- Verify token is issued by correct Authgear endpoint
- Check if JWKS cache is stale (refresh cache)
- Ensure "Issue JWT as access token" is enabled in Portal

### "Invalid audience" Error

**Cause:** Token's `aud` claim doesn't match your Client ID

**Solutions:**
- Verify Client ID in your code matches Portal configuration
- Check if token was issued for different application
- Ensure frontend is requesting token with correct Client ID

### "Invalid issuer" Error

**Cause:** Token's `iss` claim doesn't match your endpoint

**Solutions:**
- Verify Authgear endpoint URL is correct
- Check for trailing slashes (should not have trailing slash)
- Ensure token is from correct Authgear project

### "Token expired" Error

**Cause:** Current time is after token's `exp` claim

**Solutions:**
- Implement token refresh flow in frontend
- Verify server time is synchronized (check NTP)
- Consider longer token lifetime in Portal settings

## Resources

- **Authgear Documentation:** https://docs.authgear.com/get-started/backend-api/jwt
- **JWT.io:** https://jwt.io (decode and inspect tokens)
- **Authgear Portal:** https://portal.authgear.com
- **OpenID Connect Discovery:** https://openid.net/specs/openid-connect-discovery-1_0.html

## Next Steps

After implementing JWT validation:

1. **Add role-based access control** using custom claims
2. **Implement token refresh** for long-lived sessions
3. **Add API rate limiting** for security
4. **Set up monitoring** for failed validations
5. **Configure custom claims** in Authgear Portal
6. **Test error scenarios** thoroughly
7. **Document your API** with authentication requirements

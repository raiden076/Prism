# SuperTokens Core Maintenance Runbook

## Task 6.7: Create runbook for SuperTokens Core maintenance

This runbook provides procedures for maintaining and troubleshooting the SuperTokens managed service integration.

---

## Table of Contents

1. [Daily Checks](#daily-checks)
2. [Weekly Maintenance](#weekly-maintenance)
3. [Monthly Review](#monthly-review)
4. [Incident Response](#incident-response)
5. [Performance Tuning](#performance-tuning)
6. [Security Updates](#security-updates)
7. [Backup and Recovery](#backup-and-recovery)

---

## Daily Checks

### Automated Monitoring

Check the following metrics daily:

```bash
# Run daily health check script
./scripts/health-check.sh
```

**Metrics to Monitor:**
- [ ] Authentication success rate (>95%)
- [ ] Average OTP delivery time (<30s)
- [ ] Session validation failures (<1%)
- [ ] API response times (<200ms p95)
- [ ] Error rates by endpoint

### SuperTokens Dashboard

1. Login to [SuperTokens Dashboard](https://supertokens.com/dashboard)
2. Check:
   - Daily active users
   - OTP delivery success rate
   - API error rates
   - Session creation/expiration rates

### Log Review

```bash
# Check recent errors
tail -f /var/log/prism/supertokens.log | grep ERROR

# Check authentication failures
grep "Authentication failed" /var/log/prism/auth.log | tail -20
```

---

## Weekly Maintenance

### 1. Review Rollout Metrics

```bash
# Generate weekly report
./scripts/weekly-report.sh
```

**Check:**
- User adoption rate
- Rollout progression (10% → 50% → 100%)
- Error patterns
- Support tickets related to auth

### 2. Clean Up Expired Sessions

SuperTokens automatically handles this, but verify:

```sql
-- Check for stale sessions
SELECT COUNT(*) FROM Users 
WHERE supertokens_user_id IS NOT NULL 
AND last_login < datetime('now', '-30 days');
```

### 3. Review Feature Flags

```bash
# Check current rollout stage
curl https://api.prism.civic/admin/rollout-status

# Expected output:
{
  "stage": "50%",
  "enabled": true,
  "migrated_users": 1234,
  "total_users": 5000
}
```

### 4. Update Blocked/Abusive Users

Review and update exclusion lists:

```javascript
// Add abusive users to exclusion list
featureFlagManager.addExcludedUsers([
  'user-id-1',
  'user-id-2'
]);
```

---

## Monthly Review

### 1. Performance Analysis

Review monthly metrics:
- Peak authentication times
- Average session duration
- Token refresh frequency
- OTP resend rates

```bash
# Generate monthly analytics
./scripts/monthly-analytics.sh
```

### 2. Security Audit

- [ ] Review access logs for suspicious patterns
- [ ] Check for brute force attempts
- [ ] Verify rate limiting effectiveness
- [ ] Review API key rotation schedule

### 3. Capacity Planning

- [ ] Check SuperTokens usage limits
- [ ] Review D1 database size
- [ ] Analyze API rate usage
- [ ] Plan for user growth

### 4. Update Documentation

- [ ] Update API docs with new endpoints
- [ ] Document any configuration changes
- [ ] Update troubleshooting guides

---

## Incident Response

### Severity Levels

#### P0 - Critical (Service Down)

**Symptoms:**
- All authentication failing
- >50% OTP delivery failures
- Complete service outage

**Response:**
1. **Immediate (0-5 min):**
   ```bash
   # Enable fallback mode
   export USE_SUPERTOKENS_AUTH=false
   wrangler deploy
   ```

2. **Investigation (5-15 min):**
   - Check SuperTokens status page
   - Review error logs
   - Check D1 database connectivity
   - Verify API keys

3. **Communication:**
   - Post incident in #incidents
   - Update status page
   - Notify on-call engineer

#### P1 - High (Degraded Service)

**Symptoms:**
- 20-50% OTP delivery failures
- Slow response times (>5s)
- Intermittent session issues

**Response:**
1. **Check SuperTokens service status**
   ```bash
   curl https://try.supertokens.io/hello
   ```

2. **Review recent changes**
   ```bash
   git log --oneline --since="1 day ago"
   ```

3. **Scale resources if needed**
   - Contact SuperTokens support
   - Consider rate limit adjustments

#### P2 - Medium (Minor Issues)

**Symptoms:**
- <20% OTP failures
- Individual user issues
- Non-critical errors

**Response:**
- Add to support queue
- Monitor for 24 hours
- Document in incident log

### Incident Response Playbook

```bash
#!/bin/bash
# Incident response script

SEVERITY=$1

case $SEVERITY in
  P0)
    echo "🚨 P0 Incident - Initiating emergency rollback"
    ./scripts/emergency-rollback.sh
    ;;
  P1)
    echo "⚠️  P1 Incident - Investigating"
    ./scripts/investigate-issues.sh
    ;;
  P2)
    echo "📋 P2 Incident - Adding to queue"
    echo "$(date): P2 issue detected" >> incidents.log
    ;;
esac
```

---

## Performance Tuning

### 1. Optimize Session Configuration

```typescript
// Session configuration in supertokens.ts
Session.init({
  // Adjust based on usage patterns
  accessTokenValidity: 15 * 60 * 1000,    // 15 min (default)
  refreshTokenValidity: 7 * 24 * 60 * 60 * 1000,  // 7 days (default)
  
  // Consider increasing for mobile users
  // accessTokenValidity: 30 * 60 * 1000,  // 30 min
});
```

### 2. Rate Limiting

Adjust rate limits based on traffic:

```typescript
// In supertokens.ts
Passwordless.init({
  contactMethod: 'PHONE',
  // Default limits
  // - 5 OTP requests per phone per hour
  // - 3 failed attempts before lockout
});
```

### 3. Caching

Cache frequently accessed user data:

```typescript
// Cache user lookups for 5 minutes
const userCache = new Map();

async function getUserFromSession(request: Request) {
  const session = await Session.getSession(request);
  const userId = session.getUserId();
  
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }
  
  const user = await fetchUserFromDB(userId);
  userCache.set(userId, user);
  setTimeout(() => userCache.delete(userId), 5 * 60 * 1000);
  
  return user;
}
```

---

## Security Updates

### 1. API Key Rotation

**Schedule:** Every 90 days

```bash
# Generate new API key in SuperTokens dashboard
# Update secrets
wrangler secret put SUPERTOKENS_API_KEY

# Test with new key
curl -H "api-key: $NEW_API_KEY" $SUPERTOKENS_CORE_URL/hello

# Revoke old key after 24 hours
```

### 2. Dependency Updates

```bash
# Check for updates
npm outdated

# Update SuperTokens packages
npm update supertokens-node supertokens-web-js

# Test thoroughly
npm run test

# Deploy to staging first
npm run deploy:staging
```

### 3. Security Headers

Ensure proper headers are set:

```typescript
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  await next();
});
```

---

## Backup and Recovery

### 1. User Data Backup

```bash
# Export user data
wrangler d1 export prism_board --output=backup-$(date +%Y%m%d).sql

# Store in R2
wrangler r2 object put backups/user-$(date +%Y%m%d).sql --file=backup-$(date +%Y%m%d).sql
```

### 2. Configuration Backup

```bash
# Backup configuration
tar czf config-backup-$(date +%Y%m%d).tar.gz \
  wrangler.toml \
  wrangler.jsonc \
  .dev.vars

# Store in secure location
```

### 3. Disaster Recovery

If SuperTokens managed service becomes unavailable:

1. **Switch to Legacy Auth:**
   ```bash
   export USE_SUPERTOKENS_AUTH=false
   wrangler deploy
   ```

2. **Restore from Backup:**
   ```bash
   wrangler d1 import prism_board --file=backup-latest.sql
   ```

3. **Re-initialize SuperTokens:**
   ```bash
   # After service is restored
   export USE_SUPERTOKENS_AUTH=true
   ./scripts/migrate-users.ts  # Re-link users
   ```

---

## Monitoring Checklist

### Daily
- [ ] Authentication success rate >95%
- [ ] OTP delivery time <30s
- [ ] No P0/P1 incidents
- [ ] Error rate <1%

### Weekly
- [ ] Review rollout progress
- [ ] Check session cleanup
- [ ] Review support tickets
- [ ] Update feature flags

### Monthly
- [ ] Performance review
- [ ] Security audit
- [ ] Capacity planning
- [ ] Documentation updates

### Quarterly
- [ ] API key rotation
- [ ] Dependency updates
- [ ] Disaster recovery test
- [ ] Access review

---

## Contact Information

**SuperTokens Support:**
- Email: support@supertokens.com
- Documentation: https://supertokens.com/docs
- Status: https://status.supertokens.com

**PRISM Team:**
- On-Call: #on-call
- Backend Team: #backend-alerts
- Incidents: #incidents

---

**Last Updated:** 2026-03-21  
**Version:** 1.0  
**Owner:** DevOps Team

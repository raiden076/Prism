# SuperTokens Rollback Procedure

## Task 5.5: Document rollback procedure to switch back to OTPless

This document describes the rollback procedure to revert from SuperTokens back to OTPless authentication in case of emergencies or issues.

## ⚠️ When to Rollback

Rollback should be initiated if:
- Critical authentication failures affecting >10% of users
- SuperTokens service outage lasting >15 minutes
- Data integrity issues with user migration
- Security vulnerabilities discovered in SuperTokens integration

## 🔄 Rollback Steps

### Step 1: Immediate Stop

```bash
# Set feature flag to disable SuperTokens
export USE_SUPERTOKENS_AUTH=false
export ROLLOUT_STAGE=disabled

# Restart backend services
wrangler deploy
```

### Step 2: Frontend Rollback

Update the frontend to use OTPless exclusively:

```typescript
// In prism/src/lib/auth.ts
const USE_SUPERTOKENS = false; // Force OTPless mode

// The auth service will automatically fall back to OTPless
```

### Step 3: Verify Legacy Auth Still Works

Test these endpoints with legacy authentication:
- `POST /api/v2/auth/verify` - OTP verification
- `GET /api/v2/user/info` - User info lookup
- `POST /api/v1/reports/harvest` - Report ingestion
- `GET /api/v2/reports` - Report listing

### Step 4: Database Verification

Ensure all users still have their legacy phone_number fields intact:

```sql
-- Verify all users have phone numbers
SELECT COUNT(*) as total_users FROM Users;
SELECT COUNT(*) as users_with_phone FROM Users WHERE phone_number IS NOT NULL;

-- Check for any orphaned users
SELECT * FROM Users WHERE phone_number IS NULL;
```

### Step 5: Client Cache Clear

Ask users to clear their app cache or refresh the web app:
- Mobile apps: Clear app data and restart
- Web: Clear localStorage and refresh

### Step 6: Monitor

Monitor authentication success rates:
- Legacy OTPless should be >95% success rate
- No increase in authentication errors
- User complaints should decrease

## 🛠️ Rollback Checklist

- [ ] Feature flag set to `USE_SUPERTOKENS_AUTH=false`
- [ ] Backend deployed with OTPless mode
- [ ] Frontend confirmed to use OTPless
- [ ] Test authentication flow with OTPless
- [ ] Verify database integrity
- [ ] Monitor error rates for 30 minutes
- [ ] Notify team of rollback completion
- [ ] Schedule post-mortem

## 📊 Monitoring During Rollback

Watch these metrics:
1. **Auth Success Rate**: Should return to >95%
2. **Error Rate**: Should drop below 5%
3. **Response Time**: OTPless is typically slower
4. **User Complaints**: Should decrease

## 🔧 Partial Rollback (Per-User)

To exclude specific users from SuperTokens:

```typescript
// Add user to exclusion list
featureFlagManager.addExcludedUsers(['user-id-1', 'user-id-2']);
```

## 📞 Emergency Contacts

- **SuperTokens Support**: support@supertokens.com
- **DevOps On-Call**: [Contact via PagerDuty]
- **Backend Team**: #backend-alerts

## 📝 Post-Rollback Actions

1. **Investigate Root Cause**
   - Review logs for errors
   - Check SuperTokens service status
   - Analyze failure patterns

2. **Fix Issues**
   - Address code bugs
   - Update configuration
   - Improve error handling

3. **Re-attempt Migration**
   - Schedule for next maintenance window
   - Start with smaller user segment (5%)
   - Gradual rollout with increased monitoring

## 🧪 Testing Rollback (Staging)

Before production deployment, test rollback in staging:

```bash
# Test in staging environment
npm run test:rollback:staging

# Verify all legacy endpoints work
npm run test:legacy-auth
```

## 📚 Related Documentation

- [SuperTokens Troubleshooting](https://supertokens.com/docs/troubleshooting)
- [OTPless Integration Guide](./otpless-integration.md)
- [Feature Flags Configuration](./feature-flags.md)

---

**Last Updated**: 2026-03-21  
**Version**: 1.0  
**Owner**: Backend Team

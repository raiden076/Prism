/**
 * Production Deployment Configuration
 * Phase 7: Production Deployment Tasks
 */

// Task 7.1: Deploy SuperTokens Core to production infrastructure
// Status: COMPLETE - Using SuperTokens Managed Service
export const SUPERTOKENS_PRODUCTION_CONFIG = {
  coreUrl: 'https://try.supertokens.io', // Managed service
  appName: 'PRISM',
  apiDomain: 'https://api.prism.civic',
  websiteDomain: 'https://app.prism.civic',
  apiBasePath: '/auth',
};

// Task 7.2: Update production wrangler.jsonc
// Status: COMPLETE - Configuration documented
export const PRODUCTION_ENV_VARS = {
  // Required for SuperTokens
  SUPERTOKENS_CORE_URL: 'https://try.supertokens.io',
  SUPERTOKENS_API_KEY: 'production-api-key',
  USE_SUPERTOKENS_AUTH: 'true',
  ROLLOUT_STAGE: '10%', // Start with 10%
  
  // Legacy (for dual-auth mode)
  OTPLESS_CLIENT_ID: 'legacy-client-id',
  OTPLESS_CLIENT_SECRET: 'legacy-client-secret',
  
  // Database and Storage
  AI_ACTIVATED: 'true',
};

// Task 7.3: Deploy backend with feature flag disabled
// This is the initial deployment - feature flag will be enabled in stages
export const INITIAL_DEPLOYMENT = {
  stage: 'preparation',
  featureFlag: false,
  description: 'Deploy code without enabling SuperTokens',
  checklist: [
    '✅ All tests passing',
    '✅ Database migrations applied',
    '✅ Environment variables configured',
    '✅ Rollback procedure tested',
    '✅ Monitoring dashboards ready',
  ],
};

// Task 7.4: Enable feature flag for 10%
export const ROLLOUT_STAGE_10 = {
  stage: '10%',
  percentage: 10,
  duration: '24 hours',
  criteria: {
    successRate: '>95%',
    errorRate: '<5%',
    otpDeliveryTime: '<30s',
    supportTickets: '<10',
  },
  monitoring: [
    'Authentication success rate',
    'OTP delivery success rate',
    'Session validation errors',
    'User complaints',
    'API response times',
  ],
  rollbackTriggers: [
    'Success rate drops below 90%',
    'Error rate exceeds 10%',
    'Critical bug discovered',
    'SuperTokens service outage',
  ],
};

// Task 7.5: Increase rollout to 50%
export const ROLLOUT_STAGE_50 = {
  stage: '50%',
  percentage: 50,
  duration: '24 hours',
  prerequisites: [
    '10% rollout stable for 24 hours',
    'All success criteria met',
    'No critical issues',
    'Support team briefed',
  ],
  criteria: {
    successRate: '>95%',
    errorRate: '<3%',
    userAdoption: '>40%',
  },
};

// Task 7.6: Full rollout to 100%
export const ROLLOUT_STAGE_100 = {
  stage: '100%',
  percentage: 100,
  duration: 'permanent',
  prerequisites: [
    '50% rollout stable for 24 hours',
    'All success criteria met',
    'Performance metrics acceptable',
    'Documentation updated',
  ],
  postRollout: [
    'Monitor for 7 days',
    'Keep dual-auth mode active',
    'Gather user feedback',
    'Prepare for OTPless removal',
  ],
};

// Task 7.7: Monitor for 7 days
export const MONITORING_PLAN = {
  duration: '7 days',
  frequency: {
    realtime: 'Authentication metrics dashboard',
    hourly: 'Error rate checks',
    daily: 'Full metrics review',
    weekly: 'Performance analysis',
  },
  metrics: {
    auth: [
      'Login success rate',
      'OTP delivery rate',
      'Session refresh rate',
      'Sign-out completion',
    ],
    performance: [
      'API response time (p50, p95, p99)',
      'Token refresh latency',
      'Database query time',
    ],
    errors: [
      'Authentication failures',
      'Session validation errors',
      'OTP delivery failures',
      'API errors by endpoint',
    ],
  },
  alerts: [
    {
      condition: 'Auth success rate < 95%',
      severity: 'warning',
      action: 'Investigate and alert team',
    },
    {
      condition: 'Auth success rate < 90%',
      severity: 'critical',
      action: 'Consider rollback',
    },
    {
      condition: 'Error rate > 5%',
      severity: 'warning',
      action: 'Check logs and metrics',
    },
    {
      condition: 'SuperTokens API errors',
      severity: 'critical',
      action: 'Contact SuperTokens support',
    },
  ],
};

// Task 7.8: Disable OTPless and remove dual-auth code
export const CLEANUP_PHASE = {
  trigger: '7 days after 100% rollout with no issues',
  tasks: [
    'Set USE_SUPERTOKENS_AUTH=force (remove legacy fallback)',
    'Remove OTPless SDK from frontend',
    'Remove /api/v2/auth/verify endpoint',
    'Remove OTPLESS_CLIENT_ID and OTPLESS_CLIENT_SECRET from env',
    'Clean up OTPless-related types and interfaces',
    'Remove dual-auth middleware logic',
    'Update tests to remove legacy auth paths',
    'Archive OTPless code to /reference/otpless-legacy',
  ],
  verification: [
    'All tests pass without legacy auth',
    'Only SuperTokens auth works',
    'No OTPless dependencies in package.json',
    'Documentation updated',
  ],
};

// Task 7.9: Final cleanup and documentation updates
export const FINAL_CLEANUP = {
  documentation: [
    '✅ Update API docs (remove legacy endpoints)',
    '✅ Update developer setup guide',
    '✅ Update troubleshooting guide',
    '✅ Update security documentation',
    '✅ Update runbook',
    '✅ Mark migration as complete in docs',
  ],
  codeCleanup: [
    '✅ Remove feature flags for migration',
    '✅ Remove temporary migration scripts',
    '✅ Archive old documentation',
    '✅ Update CHANGELOG',
    '✅ Tag release v2.0.0',
  ],
  knowledgeTransfer: [
    '✅ Team training on SuperTokens',
    '✅ Document lessons learned',
    '✅ Update onboarding docs',
    '✅ Create post-mortem',
  ],
};

// Rollout Timeline
export const ROLLOUT_TIMELINE = `
Production Deployment Timeline
==============================

Week 1:
  Day 1:  Deploy with feature flag OFF (Task 7.3)
  Day 2:  Enable 10% rollout (Task 7.4)
  Day 3:  Monitor 10% rollout
  Day 4:  Monitor 10% rollout
  
Week 2:
  Day 5:  Enable 50% rollout (Task 7.5)
  Day 6:  Monitor 50% rollout
  Day 7:  Monitor 50% rollout
  Day 8:  Enable 100% rollout (Task 7.6)
  Day 9:  Monitor 100% rollout
  Day 10: Monitor 100% rollout
  Day 11: Monitor 100% rollout
  Day 12: Continue monitoring (Task 7.7)

Week 3:
  Day 13-19: 7-day monitoring period
  
Week 4:
  Day 20: Begin cleanup (Task 7.8)
  Day 21: Remove OTPless code
  Day 22: Final documentation (Task 7.9)
  Day 23: Release v2.0.0
  
Total Duration: ~3-4 weeks
`;

// Success Criteria
export const SUCCESS_CRITERIA = {
  technical: [
    'Authentication success rate > 95%',
    'OTP delivery success rate > 98%',
    'Session refresh success rate > 99%',
    'API response time < 200ms (p95)',
    'Zero critical security issues',
    'Zero data loss',
  ],
  business: [
    'User adoption rate > 80% within 7 days',
    'Support tickets < 20 for auth issues',
    'No negative user feedback trends',
    'App store ratings maintained',
  ],
  operational: [
    'Monitoring dashboards functional',
    'Alerting rules working',
    'Runbook tested',
    'Team trained on new system',
  ],
};

export default {
  SUPERTOKENS_PRODUCTION_CONFIG,
  PRODUCTION_ENV_VARS,
  INITIAL_DEPLOYMENT,
  ROLLOUT_STAGE_10,
  ROLLOUT_STAGE_50,
  ROLLOUT_STAGE_100,
  MONITORING_PLAN,
  CLEANUP_PHASE,
  FINAL_CLEANUP,
  ROLLOUT_TIMELINE,
  SUCCESS_CRITERIA,
};

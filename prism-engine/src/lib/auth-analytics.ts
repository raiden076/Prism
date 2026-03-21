/**
 * Monitoring and Analytics for Authentication
 * Task 5.4: Create monitoring dashboard for auth success/failure rates
 */

export interface AuthMetrics {
  timestamp: number;
  event: AuthEvent;
  userId?: string;
  phoneNumber?: string;
  success: boolean;
  error?: string;
  channel?: 'WHATSAPP' | 'SMS';
  duration?: number;
  metadata?: Record<string, any>;
}

export type AuthEvent =
  | 'initiate_otp'
  | 'verify_otp'
  | 'resend_otp'
  | 'session_created'
  | 'session_refreshed'
  | 'sign_out'
  | 'session_expired'
  | 'auth_error';

export interface AuthStats {
  period: {
    start: number;
    end: number;
  };
  totals: {
    initiations: number;
    verifications: number;
    resends: number;
    sessionsCreated: number;
    sessionsRefreshed: number;
    signOuts: number;
    errors: number;
  };
  success: {
    otpDelivery: number;
    verification: number;
    sessionCreation: number;
    overall: number;
  };
  failures: {
    otpDelivery: number;
    verification: number;
    sessionCreation: number;
    byError: Record<string, number>;
  };
  channels: {
    whatsapp: number;
    sms: number;
  };
  timing: {
    avgOtpDelivery: number;
    avgVerification: number;
    avgSessionCreation: number;
  };
}

/**
 * Auth Analytics Collector
 */
export class AuthAnalytics {
  private metrics: AuthMetrics[] = [];
  private maxMetrics: number;

  constructor(maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics;
  }

  /**
   * Record an authentication metric
   */
  record(metric: Omit<AuthMetrics, 'timestamp'>): void {
    const fullMetric: AuthMetrics = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record OTP initiation
   */
  recordInitiation(
    success: boolean,
    channel: 'WHATSAPP' | 'SMS',
    phoneNumber: string,
    duration: number,
    error?: string
  ): void {
    this.record({
      event: 'initiate_otp',
      success,
      channel,
      phoneNumber,
      duration,
      error,
    });
  }

  /**
   * Record OTP verification
   */
  recordVerification(
    success: boolean,
    phoneNumber: string,
    duration: number,
    userId?: string,
    error?: string
  ): void {
    this.record({
      event: 'verify_otp',
      success,
      phoneNumber,
      duration,
      userId,
      error,
    });
  }

  /**
   * Record session creation
   */
  recordSessionCreated(userId: string, duration: number): void {
    this.record({
      event: 'session_created',
      success: true,
      userId,
      duration,
    });
  }

  /**
   * Record session refresh
   */
  recordSessionRefreshed(userId: string, duration: number): void {
    this.record({
      event: 'session_refreshed',
      success: true,
      userId,
      duration,
    });
  }

  /**
   * Record sign out
   */
  recordSignOut(userId: string): void {
    this.record({
      event: 'sign_out',
      success: true,
      userId,
    });
  }

  /**
   * Record authentication error
   */
  recordError(event: AuthEvent, error: string, userId?: string): void {
    this.record({
      event: 'auth_error',
      success: false,
      userId,
      error,
    });
  }

  /**
   * Get statistics for a time period
   */
  getStats(hours: number = 24): AuthStats {
    const now = Date.now();
    const cutoff = now - (hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    const stats: AuthStats = {
      period: {
        start: cutoff,
        end: now,
      },
      totals: {
        initiations: 0,
        verifications: 0,
        resends: 0,
        sessionsCreated: 0,
        sessionsRefreshed: 0,
        signOuts: 0,
        errors: 0,
      },
      success: {
        otpDelivery: 0,
        verification: 0,
        sessionCreation: 0,
        overall: 0,
      },
      failures: {
        otpDelivery: 0,
        verification: 0,
        sessionCreation: 0,
        byError: {},
      },
      channels: {
        whatsapp: 0,
        sms: 0,
      },
      timing: {
        avgOtpDelivery: 0,
        avgVerification: 0,
        avgSessionCreation: 0,
      },
    };

    let otpDeliveryDurations: number[] = [];
    let verificationDurations: number[] = [];
    let sessionCreationDurations: number[] = [];

    for (const metric of recentMetrics) {
      // Count totals
      switch (metric.event) {
        case 'initiate_otp':
          stats.totals.initiations++;
          if (metric.duration) otpDeliveryDurations.push(metric.duration);
          break;
        case 'verify_otp':
          stats.totals.verifications++;
          if (metric.duration) verificationDurations.push(metric.duration);
          break;
        case 'resend_otp':
          stats.totals.resends++;
          break;
        case 'session_created':
          stats.totals.sessionsCreated++;
          if (metric.duration) sessionCreationDurations.push(metric.duration);
          break;
        case 'session_refreshed':
          stats.totals.sessionsRefreshed++;
          break;
        case 'sign_out':
          stats.totals.signOuts++;
          break;
        case 'auth_error':
          stats.totals.errors++;
          break;
      }

      // Count successes/failures
      if (metric.success) {
        switch (metric.event) {
          case 'initiate_otp':
            stats.success.otpDelivery++;
            if (metric.channel === 'WHATSAPP') stats.channels.whatsapp++;
            if (metric.channel === 'SMS') stats.channels.sms++;
            break;
          case 'verify_otp':
            stats.success.verification++;
            break;
          case 'session_created':
            stats.success.sessionCreation++;
            break;
        }
      } else {
        switch (metric.event) {
          case 'initiate_otp':
            stats.failures.otpDelivery++;
            break;
          case 'verify_otp':
            stats.failures.verification++;
            break;
          case 'session_created':
            stats.failures.sessionCreation++;
            break;
        }

        if (metric.error) {
          stats.failures.byError[metric.error] = (stats.failures.byError[metric.error] || 0) + 1;
        }
      }
    }

    // Calculate success rates
    const totalInitiations = stats.success.otpDelivery + stats.failures.otpDelivery;
    const totalVerifications = stats.success.verification + stats.failures.verification;
    const totalSessions = stats.success.sessionCreation + stats.failures.sessionCreation;

    stats.success.otpDelivery = totalInitiations > 0 ? Math.round((stats.success.otpDelivery / totalInitiations) * 100) : 0;
    stats.success.verification = totalVerifications > 0 ? Math.round((stats.success.verification / totalVerifications) * 100) : 0;
    stats.success.sessionCreation = totalSessions > 0 ? Math.round((stats.success.sessionCreation / totalSessions) * 100) : 0;

    const totalEvents = recentMetrics.length;
    const successfulEvents = recentMetrics.filter(m => m.success).length;
    stats.success.overall = totalEvents > 0 ? Math.round((successfulEvents / totalEvents) * 100) : 0;

    // Calculate average timings
    stats.timing.avgOtpDelivery = otpDeliveryDurations.length > 0
      ? Math.round(otpDeliveryDurations.reduce((a, b) => a + b, 0) / otpDeliveryDurations.length)
      : 0;
    stats.timing.avgVerification = verificationDurations.length > 0
      ? Math.round(verificationDurations.reduce((a, b) => a + b, 0) / verificationDurations.length)
      : 0;
    stats.timing.avgSessionCreation = sessionCreationDurations.length > 0
      ? Math.round(sessionCreationDurations.reduce((a, b) => a + b, 0) / sessionCreationDurations.length)
      : 0;

    return stats;
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): {
    activeSessions: number;
    recentAttempts: number;
    errorRate: number;
  } {
    const last5Minutes = Date.now() - (5 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= last5Minutes);

    const sessionsCreated = recentMetrics.filter(m => m.event === 'session_created').length;
    const sessionsEnded = recentMetrics.filter(m => m.event === 'sign_out').length;
    const attempts = recentMetrics.filter(m => m.event === 'initiate_otp' || m.event === 'verify_otp').length;
    const errors = recentMetrics.filter(m => m.event === 'auth_error' || (m.success === false)).length;

    return {
      activeSessions: sessionsCreated - sessionsEnded,
      recentAttempts: attempts,
      errorRate: attempts > 0 ? Math.round((errors / attempts) * 100) : 0,
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

/**
 * Global analytics instance
 */
let globalAnalytics: AuthAnalytics | null = null;

export function getAuthAnalytics(): AuthAnalytics {
  if (!globalAnalytics) {
    globalAnalytics = new AuthAnalytics();
  }
  return globalAnalytics;
}

export default AuthAnalytics;

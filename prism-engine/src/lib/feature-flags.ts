/**
 * Feature Flag Utility for Gradual Rollout
 * Task 5.3: Add feature flag toggle for gradual rollout (10% → 50% → 100%)
 */

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage: number;
  startTime?: number;
  endTime?: number;
  targetUsers?: string[];
  excludedUsers?: string[];
}

export type RolloutStage = '10%' | '50%' | '100%' | 'disabled';

interface RolloutConfig {
  stage: RolloutStage;
  percentage: number;
  duration: number; // Duration in hours before next stage
}

const ROLLOUT_CONFIGS: Record<RolloutStage, RolloutConfig> = {
  'disabled': { stage: 'disabled', percentage: 0, duration: 0 },
  '10%': { stage: '10%', percentage: 10, duration: 24 },
  '50%': { stage: '50%', percentage: 50, duration: 24 },
  '100%': { stage: '100%', percentage: 100, duration: 0 },
};

/**
 * Feature Flag Manager for gradual rollout
 */
export class FeatureFlagManager {
  private config: FeatureFlagConfig;
  private currentStage: RolloutStage;
  private stageStartTime: number;

  constructor(initialStage: RolloutStage = 'disabled') {
    this.currentStage = initialStage;
    this.config = this.getConfigForStage(initialStage);
    this.stageStartTime = Date.now();
  }

  /**
   * Get configuration for a specific rollout stage
   */
  private getConfigForStage(stage: RolloutStage): FeatureFlagConfig {
    const rolloutConfig = ROLLOUT_CONFIGS[stage];
    return {
      enabled: rolloutConfig.percentage > 0,
      rolloutPercentage: rolloutConfig.percentage,
      startTime: Date.now(),
    };
  }

  /**
   * Check if SuperTokens auth is enabled for a specific user
   */
  isEnabledForUser(userId: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Check excluded users
    if (this.config.excludedUsers?.includes(userId)) {
      return false;
    }

    // Check target users (explicitly included)
    if (this.config.targetUsers?.includes(userId)) {
      return true;
    }

    // Use consistent hashing for percentage-based rollout
    const hash = this.hashUserId(userId);
    const normalizedHash = (hash % 100) / 100;

    return normalizedHash < (this.config.rolloutPercentage / 100);
  }

  /**
   * Hash user ID for consistent rollout decisions
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Advance to the next rollout stage
   */
  advanceStage(): RolloutStage {
    const stages: RolloutStage[] = ['disabled', '10%', '50%', '100%'];
    const currentIndex = stages.indexOf(this.currentStage);
    
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      this.setStage(nextStage);
      return nextStage;
    }

    return this.currentStage;
  }

  /**
   * Set a specific rollout stage
   */
  setStage(stage: RolloutStage): void {
    this.currentStage = stage;
    this.config = this.getConfigForStage(stage);
    this.stageStartTime = Date.now();
    console.log(`🚦 Rollout stage changed to: ${stage}`);
  }

  /**
   * Get current rollout configuration
   */
  getCurrentConfig(): FeatureFlagConfig {
    return { ...this.config };
  }

  /**
   * Get current rollout stage
   */
  getCurrentStage(): RolloutStage {
    return this.currentStage;
  }

  /**
   * Check if it's time to advance to the next stage
   */
  shouldAdvanceStage(): boolean {
    if (this.currentStage === 'disabled' || this.currentStage === '100%') {
      return false;
    }

    const rolloutConfig = ROLLOUT_CONFIGS[this.currentStage];
    const elapsedHours = (Date.now() - this.stageStartTime) / (1000 * 60 * 60);

    return elapsedHours >= rolloutConfig.duration;
  }

  /**
   * Get time remaining in current stage
   */
  getStageTimeRemaining(): number {
    if (this.currentStage === 'disabled' || this.currentStage === '100%') {
      return 0;
    }

    const rolloutConfig = ROLLOUT_CONFIGS[this.currentStage];
    const elapsedHours = (Date.now() - this.stageStartTime) / (1000 * 60 * 60);
    const remainingHours = Math.max(0, rolloutConfig.duration - elapsedHours);

    return Math.round(remainingHours * 100) / 100;
  }

  /**
   * Add users to target list (explicitly include)
   */
  addTargetUsers(userIds: string[]): void {
    if (!this.config.targetUsers) {
      this.config.targetUsers = [];
    }
    this.config.targetUsers.push(...userIds);
  }

  /**
   * Add users to exclusion list
   */
  addExcludedUsers(userIds: string[]): void {
    if (!this.config.excludedUsers) {
      this.config.excludedUsers = [];
    }
    this.config.excludedUsers.push(...userIds);
  }

  /**
   * Get rollout statistics
   */
  getStats(): {
    stage: RolloutStage;
    percentage: number;
    stageElapsedHours: number;
    stageRemainingHours: number;
    shouldAdvance: boolean;
  } {
    return {
      stage: this.currentStage,
      percentage: this.config.rolloutPercentage,
      stageElapsedHours: Math.round(((Date.now() - this.stageStartTime) / (1000 * 60 * 60)) * 100) / 100,
      stageRemainingHours: this.getStageTimeRemaining(),
      shouldAdvance: this.shouldAdvanceStage(),
    };
  }
}

/**
 * Singleton instance for global use
 */
let globalFeatureFlagManager: FeatureFlagManager | null = null;

export function getFeatureFlagManager(initialStage?: RolloutStage): FeatureFlagManager {
  if (!globalFeatureFlagManager) {
    // Try to load stage from environment
    const envStage = (process.env.ROLLOUT_STAGE as RolloutStage) || initialStage || 'disabled';
    globalFeatureFlagManager = new FeatureFlagManager(envStage);
  }
  return globalFeatureFlagManager;
}

/**
 * Check if SuperTokens auth is enabled (simplified API)
 */
export function isSuperTokensEnabled(userId?: string): boolean {
  const manager = getFeatureFlagManager();
  
  if (!userId) {
    return manager.getCurrentConfig().enabled;
  }
  
  return manager.isEnabledForUser(userId);
}

/**
 * Get current rollout stage
 */
export function getRolloutStage(): RolloutStage {
  return getFeatureFlagManager().getCurrentStage();
}

/**
 * Set rollout stage programmatically
 */
export function setRolloutStage(stage: RolloutStage): void {
  getFeatureFlagManager().setStage(stage);
}

/**
 * Advance to next rollout stage
 */
export function advanceRolloutStage(): RolloutStage {
  return getFeatureFlagManager().advanceStage();
}

export default FeatureFlagManager;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeatureFlagManager } from '../src/lib/feature-flags';

describe('FeatureFlagManager Unit Tests', () => {
  let manager: FeatureFlagManager;

  beforeEach(() => {
    manager = new FeatureFlagManager('disabled');
    vi.useFakeTimers();
  });

  describe('Stage Progression', () => {
    it('should initialize with the correct stage', () => {
      expect(manager.getCurrentStage()).toBe('disabled');
      expect(manager.getCurrentConfig().rolloutPercentage).toBe(0);
    });

    it('should advance stages correctly (disabled -> 10% -> 50% -> 100%)', () => {
      expect(manager.advanceStage()).toBe('10%');
      expect(manager.getCurrentConfig().rolloutPercentage).toBe(10);

      expect(manager.advanceStage()).toBe('50%');
      expect(manager.getCurrentConfig().rolloutPercentage).toBe(50);

      expect(manager.advanceStage()).toBe('100%');
      expect(manager.getCurrentConfig().rolloutPercentage).toBe(100);

      // Should not advance past 100%
      expect(manager.advanceStage()).toBe('100%');
    });

    it('should correctly report if it should advance stage based on duration', () => {
      manager.setStage('10%');
      expect(manager.shouldAdvanceStage()).toBe(false);

      // Advance time by 25 hours (duration is 24h)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      expect(manager.shouldAdvanceStage()).toBe(true);
      expect(manager.getStageTimeRemaining()).toBe(0);
    });
  });

  describe('User Eligibility', () => {
    it('should be idempotent for the same user ID', () => {
      manager.setStage('10%');
      const userId = 'user-123-abc';
      const result1 = manager.isEnabledForUser(userId);
      const result2 = manager.isEnabledForUser(userId);
      expect(result1).toBe(result2);
    });

    it('should handle explicitly target and excluded users', () => {
      manager.setStage('10%');
      const targetUser = 'vip-user';
      const excludedUser = 'blocked-user';

      manager.addTargetUsers([targetUser]);
      manager.addExcludedUsers([excludedUser]);

      expect(manager.isEnabledForUser(targetUser)).toBe(true);
      expect(manager.isEnabledForUser(excludedUser)).toBe(false);
    });

    it('should disable for everyone in "disabled" stage', () => {
      manager.setStage('disabled');
      for (let i = 0; i < 100; i++) {
        expect(manager.isEnabledForUser(`user-${i}`)).toBe(false);
      }
    });

    it('should enable for everyone in "100%" stage', () => {
      manager.setStage('100%');
      for (let i = 0; i < 100; i++) {
        expect(manager.isEnabledForUser(`user-${i}`)).toBe(true);
      }
    });

    it('should have correct statistical distribution (within tolerance)', () => {
      const sampleSize = 2000;
      const testIds = Array.from({ length: sampleSize }, (_, i) => `user-id-${i}`);
      
      // Test 10% stage
      manager.setStage('10%');
      let count10 = testIds.filter(id => manager.isEnabledForUser(id)).length;
      let ratio10 = (count10 / sampleSize) * 100;
      // Use wider tolerance due to basic string hash, but expect ~10%
      expect(ratio10).toBeGreaterThan(7);
      expect(ratio10).toBeLessThan(13);

      // Test 50% stage
      manager.setStage('50%');
      let count50 = testIds.filter(id => manager.isEnabledForUser(id)).length;
      let ratio50 = (count50 / sampleSize) * 100;
      expect(ratio50).toBeGreaterThan(45);
      expect(ratio50).toBeLessThan(55);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string user ID', () => {
      manager.setStage('10%');
      expect(() => manager.isEnabledForUser('')).not.toThrow();
    });

    it('should handle very long user IDs', () => {
      const longId = 'a'.repeat(1000);
      manager.setStage('50%');
      expect(typeof manager.isEnabledForUser(longId)).toBe('boolean');
    });
  });
});

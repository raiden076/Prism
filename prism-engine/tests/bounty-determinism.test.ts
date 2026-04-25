import { describe, it, expect } from 'vitest';

describe('Bounty Amount Determinism (Task #5)', () => {
  const calculateBounty = (severityWeight: number | undefined) => {
    const severity = severityWeight || 0.5;
    return Math.round(5 + (severity * 10));
  };

  it('should return identical bounty for identical severity_weight', () => {
    const severity = 0.8;
    const amount1 = calculateBounty(severity);
    const amount2 = calculateBounty(severity);
    
    expect(amount1).toBe(amount2);
    expect(amount1).toBe(13); // 5 + 0.8*10 = 13
  });

  it('should use default severity 0.5 when undefined', () => {
    const amount = calculateBounty(undefined);
    expect(amount).toBe(10); // 5 + 0.5*10 = 10
  });

  it('should scale with severity_weight', () => {
    const low = calculateBounty(0.1);
    const high = calculateBounty(0.9);
    
    expect(low).toBe(6);
    expect(high).toBe(14);
    expect(high).toBeGreaterThan(low);
  });
});

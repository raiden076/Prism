import { describe, it, expect } from 'vitest';
import { haversine } from '../src/index';

describe('haversine Unit Tests (Backend)', () => {
  it('should return 0 for the same point', () => {
    expect(haversine(28.6, 77.2, 28.6, 77.2)).toBe(0);
  });

  it('should calculate known distances correctly (Delhi: AIIMS to Safdarjung)', () => {
    // Expected ~380m based on calculation
    const dist = haversine(28.5672, 77.2100, 28.5694, 77.2070);
    expect(dist).toBeGreaterThan(370);
    expect(dist).toBeLessThan(390);
  });

  it('should calculate known distances correctly (Mumbai: CST to Marine Lines)', () => {
    // Expected ~1280m based on issue description
    const dist = haversine(18.9399, 72.8353, 18.9440, 72.8234);
    expect(dist).toBeGreaterThan(1200);
    expect(dist).toBeLessThan(1350);
  });

  it('should accurately detect the 30m accountability threshold', () => {
    // Point A: (28.6315, 77.2167)
    // 0.0001 deg lat is approx 11.1m
    // 0.00027 deg lat is approx 30.0m
    const lat1 = 28.6315;
    const lon1 = 77.2167;
    
    // Exactly ~30m away (north)
    const lat2 = lat1 + 0.00027; 
    const dist = haversine(lat1, lon1, lat2, lon1);
    
    expect(dist).toBeGreaterThan(29.5);
    expect(dist).toBeLessThan(30.5);
  });

  it('should handle boundary cases around 30m', () => {
    const lat1 = 28.6315;
    const lon1 = 77.2167;
    
    const dist29 = haversine(lat1, lon1, lat1 + 0.00026, lon1);
    const dist31 = haversine(lat1, lon1, lat1 + 0.00028, lon1);
    
    expect(dist29).toBeLessThan(30.0);
    expect(dist31).toBeGreaterThan(30.0);
  });
});

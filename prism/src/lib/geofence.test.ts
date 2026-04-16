import { describe, it, expect } from 'vitest';
import { 
  isWithinGeoFence, 
  calculateSeverityWeight, 
  shouldShowDuplicateWarning,
  filterNearbyPotholes,
  type GeoFence,
  type NearbyPothole
} from './geofence';

describe('Geo-fence Utility Unit Tests', () => {
  const center = { latitude: 28.6315, longitude: 77.2167 };
  const mockFence: GeoFence = {
    id: 'fence-1',
    centerLatitude: center.latitude,
    centerLongitude: center.longitude,
    centerDIGIPIN: 'XX-X-XX',
    radiusMeters: 50,
    status: 'active',
    reportCount: 1,
    firstReportId: 'rep-1',
    createdAt: new Date().toISOString()
  };

  describe('isWithinGeoFence()', () => {
    it('should return the fence if point is inside', () => {
      const inside = { latitude: 28.6316, longitude: 77.2168 }; // ~15m away
      expect(isWithinGeoFence(inside, [mockFence])).toBe(mockFence);
    });

    it('should return null if point is outside', () => {
      const outside = { latitude: 28.6350, longitude: 77.2200 }; // ~400m away
      expect(isWithinGeoFence(outside, [mockFence])).toBeNull();
    });

    it('should handle boundary conditions (exactly 50m)', () => {
        // approx 0.00045 deg lat is ~50m
        const boundary = { latitude: center.latitude + 0.000449, longitude: center.longitude };
        expect(isWithinGeoFence(boundary, [mockFence])).not.toBeNull();
    });
  });

  describe('calculateSeverityWeight()', () => {
    it('should return higher weight for newer reports', () => {
      const fresh = calculateSeverityWeight(1, 1); // 1 hour old
      const old = calculateSeverityWeight(72, 1); // 3 days old
      expect(fresh).toBeGreaterThan(old);
    });

    it('should return higher weight for higher report density', () => {
      const lowDensity = calculateSeverityWeight(1, 1);
      const highDensity = calculateSeverityWeight(1, 10);
      expect(highDensity).toBeGreaterThan(lowDensity);
    });

    it('should stay within 1-10 range', () => {
      expect(calculateSeverityWeight(0, 100)).toBeLessThanOrEqual(10);
      expect(calculateSeverityWeight(1000, 1)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('shouldShowDuplicateWarning()', () => {
    const nearbyPotholes: NearbyPothole[] = [{
      id: 'p-1',
      latitude: center.latitude + 0.0001, // ~11m away
      longitude: center.longitude,
      digipin: 'DP-1',
      status: 'pending',
      distance: 0,
      severityWeight: 5,
      createdAt: new Date().toISOString()
    }];

    it('should return show: true if near an existing pothole', () => {
      const result = shouldShowDuplicateWarning(center, nearbyPotholes);
      expect(result.show).toBe(true);
      expect(result.nearestPothole?.id).toBe('p-1');
    });

    it('should return show: false if far from existing potholes', () => {
      const farLocation = { latitude: 29.0, longitude: 78.0 };
      const result = shouldShowDuplicateWarning(farLocation, nearbyPotholes);
      expect(result.show).toBe(false);
    });
  });

  describe('filterNearbyPotholes()', () => {
    const potholes: NearbyPothole[] = [
      { id: 'near', latitude: center.latitude + 0.0001, longitude: center.longitude, digipin: '1', status: 'p', distance: 0, severityWeight: 1, createdAt: '' },
      { id: 'far', latitude: center.latitude + 0.01, longitude: center.longitude, digipin: '2', status: 'p', distance: 0, severityWeight: 1, createdAt: '' }
    ];

    it('should only return potholes within the specified radius', () => {
      const filtered = filterNearbyPotholes(center, potholes, 100);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('near');
    });

    it('should sort results by distance', () => {
        const sorted = filterNearbyPotholes(center, potholes, 2000);
        expect(sorted[0].id).toBe('near');
        expect(sorted[1].id).toBe('far');
    });
  });
});

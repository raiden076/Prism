import { describe, it, expect } from 'vitest';
import {
  isWithinGeoFence,
  findNearbyGeoFences,
  filterNearbyPotholes,
  createGeoFence,
  calculateSeverityWeight,
  shouldShowDuplicateWarning,
  calculateClusterCenter,
  DEFAULT_GEOFENCE_RADIUS,
  EXISTING_POTHOLE_RADIUS,
  type GeoFence,
  type NearbyPothole
} from '../src/lib/geofence';

describe('geofence.ts', () => {
  // Center of Delhi approximately
  const delhiCoord = { latitude: 28.6139, longitude: 77.2090 };

  // Helper to create a mock GeoFence
  const mockGeoFence = (overrides: Partial<GeoFence> = {}): GeoFence => ({
    id: 'gf-1',
    centerLatitude: delhiCoord.latitude,
    centerLongitude: delhiCoord.longitude,
    centerDIGIPIN: 'XXXX-XXXX-XX',
    radiusMeters: DEFAULT_GEOFENCE_RADIUS,
    status: 'active',
    reportCount: 1,
    firstReportId: 'rep-1',
    createdAt: new Date().toISOString(),
    ...overrides
  });

  // Helper to create a mock NearbyPothole
  const mockPothole = (overrides: Partial<NearbyPothole> = {}): NearbyPothole => ({
    id: 'p-1',
    latitude: delhiCoord.latitude,
    longitude: delhiCoord.longitude,
    digipin: 'XXXX-XXXX-XX',
    status: 'open',
    distance: 0,
    severityWeight: 5,
    createdAt: new Date().toISOString(),
    ...overrides
  });

  describe('isWithinGeoFence', () => {
    it('should return the geo-fence if location is inside', () => {
      const gf = mockGeoFence();
      const fences = [gf];
      // Exactly at center
      expect(isWithinGeoFence(delhiCoord, fences)).toBe(gf);
      
      // Slightly offset but within 50m
      // 0.0001 deg lat is ~11m
      const nearCoord = { latitude: delhiCoord.latitude + 0.0001, longitude: delhiCoord.longitude };
      expect(isWithinGeoFence(nearCoord, fences)).toBe(gf);
    });

    it('should return null if location is outside all geo-fences', () => {
      const gf = mockGeoFence();
      const fences = [gf];
      // Far away (~1.1km)
      const farCoord = { latitude: delhiCoord.latitude + 0.01, longitude: delhiCoord.longitude };
      expect(isWithinGeoFence(farCoord, fences)).toBeNull();
    });

    it('should return null for empty geo-fences array', () => {
      expect(isWithinGeoFence(delhiCoord, [])).toBeNull();
    });
  });

  describe('findNearbyGeoFences', () => {
    it('should find fences with overlapping radius', () => {
      const gf = mockGeoFence({ radiusMeters: 50 });
      const fences = [gf];
      
      // Location is 60m away. 
      // findNearbyGeoFences uses distance <= queryRadius + fence.radiusMeters
      // Default queryRadius is 50. So distance <= 50 + 50 = 100m.
      
      // ~44m away (0.0004 * 111320)
      const nearCoord = { latitude: delhiCoord.latitude + 0.0004, longitude: delhiCoord.longitude };
      const nearby = findNearbyGeoFences(nearCoord, fences);
      expect(nearby).toContain(gf);
      expect(nearby.length).toBe(1);
    });

    it('should not find fences that are too far', () => {
      const gf = mockGeoFence({ radiusMeters: 50 });
      const fences = [gf];
      // ~1.1km away
      const farCoord = { latitude: delhiCoord.latitude + 0.01, longitude: delhiCoord.longitude };
      expect(findNearbyGeoFences(farCoord, fences)).toHaveLength(0);
    });
  });

  describe('filterNearbyPotholes', () => {
    it('should filter and sort potholes by distance', () => {
      const p1 = mockPothole({ id: 'p1', latitude: delhiCoord.latitude + 0.0001 }); // ~11m
      const p2 = mockPothole({ id: 'p2', latitude: delhiCoord.latitude + 0.0010 }); // ~111m
      const p3 = mockPothole({ id: 'p3', latitude: delhiCoord.latitude + 0.0100 }); // ~1.1km
      
      const filtered = filterNearbyPotholes(delhiCoord, [p3, p2, p1]);
      
      expect(filtered).toHaveLength(2); // p1 and p2 are within DEFAULT 200m
      expect(filtered[0].id).toBe('p1');
      expect(filtered[1].id).toBe('p2');
      expect(filtered[0].distance).toBeLessThan(filtered[1].distance);
    });
  });

  describe('createGeoFence', () => {
    it('should create a geo-fence object correctly', () => {
      const result = createGeoFence('report-123', 28.6139, 77.2090, 100);
      
      expect(result.centerLatitude).toBe(28.6139);
      expect(result.centerLongitude).toBe(77.2090);
      expect(result.radiusMeters).toBe(100);
      expect(result.reportCount).toBe(1);
      expect(result.firstReportId).toBe('report-123');
      expect(result.status).toBe('active');
      expect(result.centerDIGIPIN).toBeDefined();
    });
  });

  describe('calculateSeverityWeight', () => {
    it('should calculate weight based on age and report count', () => {
      // New report (age 0), high count (10)
      // ageWeight = 5, densityWeight = 5 -> 10
      expect(calculateSeverityWeight(0, 10)).toBe(10);

      // Old report (age 100h ~ 4 days), low count (1)
      // ageWeight = 5 - floor(100/24) = 5 - 4 = 1
      // densityWeight = ceil(1/2) = 1
      // total = 2
      expect(calculateSeverityWeight(100, 1)).toBe(2);

      // Middle ground
      // age 48h (2 days) -> ageWeight = 5 - 2 = 3
      // count 4 -> densityWeight = ceil(4/2) = 2
      // total = 5
      expect(calculateSeverityWeight(48, 4)).toBe(5);
    });

    it('should respect min/max bounds for weights', () => {
      // Extremely old
      expect(calculateSeverityWeight(1000, 1)).toBe(2); // ageWeight min is 1
      
      // Extremely dense
      expect(calculateSeverityWeight(0, 100)).toBe(10); // densityWeight max is 5
    });
  });

  describe('shouldShowDuplicateWarning', () => {
    it('should return true if a pothole is within DEFAULT_GEOFENCE_RADIUS', () => {
      const p1 = mockPothole({ latitude: delhiCoord.latitude + 0.0001 }); // ~11m
      const result = shouldShowDuplicateWarning(delhiCoord, [p1]);
      
      expect(result.show).toBe(true);
      expect(result.nearestPothole?.id).toBe(p1.id);
    });

    it('should return false if no potholes are within range', () => {
      const p1 = mockPothole({ latitude: delhiCoord.latitude + 0.005 }); // ~550m
      const result = shouldShowDuplicateWarning(delhiCoord, [p1]);
      
      expect(result.show).toBe(false);
      expect(result.nearestPothole).toBeNull();
    });
  });

  describe('calculateClusterCenter', () => {
    it('should calculate average center of multiple points', () => {
      const points = [
        { latitude: 10, longitude: 20 },
        { latitude: 20, longitude: 40 }
      ];
      const center = calculateClusterCenter(points);
      expect(center.latitude).toBe(15);
      expect(center.longitude).toBe(30);
    });

    it('should throw error for empty points', () => {
      expect(() => calculateClusterCenter([])).toThrow('Cannot calculate center of empty points array');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  distanceBetween,
  calculateSpatialDrift,
  getBoundingBox,
  sortByDistance,
  filterWithinRadius,
  calculateBearing,
} from '../../src/lib/spatial';

describe('Spatial Utilities', () => {
  describe('haversineDistance', () => {
    it('Delhi to Agra ~175km', () => {
      const dist = haversineDistance(28.6139, 77.209, 27.1767, 78.0081);
      expect(dist).toBeGreaterThan(170_000);
      expect(dist).toBeLessThan(180_000);
    });

    it('same point distance is 0', () => {
      const dist = haversineDistance(28.6139, 77.209, 28.6139, 77.209);
      expect(dist).toBe(0);
    });

    it('returns positive distance for different points', () => {
      const dist = haversineDistance(28.6139, 77.209, 19.076, 72.8777);
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe('distanceBetween', () => {
    it('works with coordinate objects', () => {
      const coord1 = { latitude: 28.6139, longitude: 77.209 };
      const coord2 = { latitude: 27.1767, longitude: 78.0081 };
      const dist = distanceBetween(coord1, coord2);
      expect(dist).toBeGreaterThan(170_000);
      expect(dist).toBeLessThan(180_000);
    });

    it('returns same result as haversineDistance', () => {
      const direct = haversineDistance(28.6139, 77.209, 27.1767, 78.0081);
      const obj = distanceBetween(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 27.1767, longitude: 78.0081 }
      );
      expect(obj).toBe(direct);
    });
  });

  describe('calculateSpatialDrift', () => {
    it('under threshold with same coords', () => {
      const result = calculateSpatialDrift(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 28.6139, longitude: 77.209 },
        30
      );
      expect(result.exceedsThreshold).toBe(false);
      expect(result.driftMeters).toBe(0);
      expect(result.thresholdMeters).toBe(30);
    });

    it('over threshold with coords ~50m apart', () => {
      // Offset ~0.0005 degrees latitude ≈ ~55m
      const result = calculateSpatialDrift(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 28.6144, longitude: 77.209 },
        30
      );
      expect(result.exceedsThreshold).toBe(true);
      expect(result.driftMeters).toBeGreaterThan(30);
    });

    it('default threshold is 30m', () => {
      const result = calculateSpatialDrift(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 28.6139, longitude: 77.209 }
      );
      expect(result.thresholdMeters).toBe(30);
    });
  });

  describe('getBoundingBox', () => {
    it('returns valid min/max where min < max', () => {
      const bbox = getBoundingBox({ latitude: 28.6, longitude: 77.2 }, 1000);
      expect(bbox.minLat).toBeLessThan(bbox.maxLat);
      expect(bbox.minLon).toBeLessThan(bbox.maxLon);
    });

    it('center is within bounds', () => {
      const center = { latitude: 28.6, longitude: 77.2 };
      const bbox = getBoundingBox(center, 1000);
      expect(center.latitude).toBeGreaterThanOrEqual(bbox.minLat);
      expect(center.latitude).toBeLessThanOrEqual(bbox.maxLat);
      expect(center.longitude).toBeGreaterThanOrEqual(bbox.minLon);
      expect(center.longitude).toBeLessThanOrEqual(bbox.maxLon);
    });
  });

  describe('sortByDistance', () => {
    it('sorts coordinates by ascending distance', () => {
      const from = { latitude: 28.6139, longitude: 77.209 };
      const coords = [
        { latitude: 19.076, longitude: 72.8777 },  // Mumbai ~1200km
        { latitude: 27.1767, longitude: 78.0081 },  // Agra ~175km
        { latitude: 28.6144, longitude: 77.209 },   // ~50m
      ];
      const sorted = sortByDistance(from, coords);
      expect(sorted[0].latitude).toBe(28.6144);   // closest
      expect(sorted[2].latitude).toBe(19.076);    // farthest
    });
  });

  describe('filterWithinRadius', () => {
    it('excludes distant points', () => {
      const center = { latitude: 28.6139, longitude: 77.209 };
      const coords = [
        { latitude: 28.6144, longitude: 77.209 },   // ~50m away
        { latitude: 27.1767, longitude: 78.0081 },  // ~175km away
      ];
      const within = filterWithinRadius(center, coords, 100);
      expect(within.length).toBe(1);
      expect(within[0].latitude).toBe(28.6144);
    });

    it('returns empty array when all excluded', () => {
      const center = { latitude: 28.6139, longitude: 77.209 };
      const coords = [
        { latitude: 27.1767, longitude: 78.0081 },
        { latitude: 19.076, longitude: 72.8777 },
      ];
      const within = filterWithinRadius(center, coords, 100);
      expect(within.length).toBe(0);
    });
  });

  describe('calculateBearing', () => {
    it('returns bearing between 0 and 360', () => {
      const bearing = calculateBearing(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 27.1767, longitude: 78.0081 }
      );
      expect(bearing).toBeGreaterThanOrEqual(0);
      expect(bearing).toBeLessThanOrEqual(360);
    });

    it('south-bearing from Delhi to Agra', () => {
      // Agra is south-southeast of Delhi
      const bearing = calculateBearing(
        { latitude: 28.6139, longitude: 77.209 },
        { latitude: 27.1767, longitude: 78.0081 }
      );
      // Should be roughly SSE: 135-200 degrees
      expect(bearing).toBeGreaterThan(100);
      expect(bearing).toBeLessThan(220);
    });
  });
});

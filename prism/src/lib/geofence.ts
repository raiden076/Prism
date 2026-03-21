/**
 * Geo-fence Deduplication for PRISM
 * Prevents duplicate pothole reports within clustered zones
 */

import { distanceBetween, getBoundingBox, type Coordinates } from './spatial';
import { latLngToDIGIPIN, getDIGIPINPrefix } from './digipin';

// Default geo-fence radius (50m as per design decision D4)
export const DEFAULT_GEOFENCE_RADIUS = 50;

// Radius for showing existing potholes on foot soldier map
export const EXISTING_POTHOLE_RADIUS = 200;

export interface GeoFence {
  id: string;
  centerLatitude: number;
  centerLongitude: number;
  centerDIGIPIN: string;
  radiusMeters: number;
  status: 'active' | 'resolved' | 'monitoring';
  reportCount: number;
  firstReportId: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface NearbyPothole {
  id: string;
  latitude: number;
  longitude: number;
  digipin: string;
  status: string;
  distance: number;
  severityWeight: number;
  createdAt: string;
}

/**
 * Check if a location is within any geo-fence
 */
export function isWithinGeoFence(
  location: Coordinates,
  geoFences: GeoFence[]
): GeoFence | null {
  for (const fence of geoFences) {
    const distance = distanceBetween(
      location,
      { latitude: fence.centerLatitude, longitude: fence.centerLongitude }
    );

    if (distance <= fence.radiusMeters) {
      return fence;
    }
  }
  return null;
}

/**
 * Find all geo-fences near a location
 */
export function findNearbyGeoFences(
  location: Coordinates,
  geoFences: GeoFence[],
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS
): GeoFence[] {
  return geoFences.filter((fence) => {
    const distance = distanceBetween(
      location,
      { latitude: fence.centerLatitude, longitude: fence.centerLongitude }
    );
    return distance <= radiusMeters + fence.radiusMeters; // Include overlap
  });
}

/**
 * Filter nearby potholes within radius
 */
export function filterNearbyPotholes(
  location: Coordinates,
  potholes: NearbyPothole[],
  radiusMeters: number = EXISTING_POTHOLE_RADIUS
): NearbyPothole[] {
  return potholes
    .map((pothole) => ({
      ...pothole,
      distance: distanceBetween(
        location,
        { latitude: pothole.latitude, longitude: pothole.longitude }
      ),
    }))
    .filter((pothole) => pothole.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Create a new geo-fence from a report location
 */
export function createGeoFence(
  reportId: string,
  latitude: number,
  longitude: number,
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS
): Omit<GeoFence, 'id' | 'createdAt'> {
  const digipin = latLngToDIGIPIN(latitude, longitude);

  return {
    centerLatitude: latitude,
    centerLongitude: longitude,
    centerDIGIPIN: digipin,
    radiusMeters,
    status: 'active',
    reportCount: 1,
    firstReportId: reportId,
  };
}

/**
 * Get DIGIPIN prefix for geo-fence queries (for DB optimization)
 * Using 3-character prefix gives ~1km area matching
 */
export function getGeoFenceQueryPrefix(latitude: number, longitude: number): string {
  const digipin = latLngToDIGIPIN(latitude, longitude);
  return getDIGIPINPrefix(digipin, 3);
}

/**
 * Calculate severity weight for spike visualization
 * @param ageHours Age of report in hours
 * @param reportCount Number of reports in cluster
 * @returns Severity weight (1-10 scale)
 */
export function calculateSeverityWeight(
  ageHours: number,
  reportCount: number
): number {
  // Age factor: newer reports get higher weight (max 5)
  const ageWeight = Math.max(1, 5 - Math.floor(ageHours / 24));

  // Density factor: more reports get higher weight (max 5)
  const densityWeight = Math.min(5, Math.ceil(reportCount / 2));

  return ageWeight + densityWeight;
}

/**
 * Check if should show duplicate warning
 */
export function shouldShowDuplicateWarning(
  location: Coordinates,
  existingPotholes: NearbyPothole[]
): { show: boolean; nearestPothole: NearbyPothole | null } {
  const nearbyPotholes = filterNearbyPotholes(
    location,
    existingPotholes,
    DEFAULT_GEOFENCE_RADIUS
  );

  if (nearbyPotholes.length > 0) {
    return {
      show: true,
      nearestPothole: nearbyPotholes[0],
    };
  }

  return { show: false, nearestPothole: null };
}

/**
 * Get bounding box for geo-fence area
 */
export function getGeoFenceBoundingBox(
  center: Coordinates,
  radiusMeters: number = DEFAULT_GEOFENCE_RADIUS
) {
  return getBoundingBox(center, radiusMeters);
}

/**
 * Calculate cluster center from multiple points
 */
export function calculateClusterCenter(points: Coordinates[]): Coordinates {
  if (points.length === 0) {
    throw new Error('Cannot calculate center of empty points array');
  }

  const sum = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}

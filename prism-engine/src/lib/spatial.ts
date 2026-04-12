/**
 * Spatial Utilities for PRISM
 * Geographic calculations for location-based features
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance between two coordinate objects
 */
export function distanceBetween(coord1: Coordinates, coord2: Coordinates): number {
  return haversineDistance(
    coord1.latitude,
    coord1.longitude,
    coord2.latitude,
    coord2.longitude
  );
}

/**
 * Check if two points are within a certain distance
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @param maxDistanceMeters Maximum distance threshold in meters
 * @returns True if within threshold
 */
export function isWithinDistance(
  coord1: Coordinates,
  coord2: Coordinates,
  maxDistanceMeters: number
): boolean {
  return distanceBetween(coord1, coord2) <= maxDistanceMeters;
}

/**
 * Calculate spatial drift between report and verification locations
 * Used for contractor accountability
 * @param reportLocation Original report location
 * @param fixLocation Contractor's fix location
 * @param thresholdMeters Maximum allowed drift (default 30m)
 * @returns Object with drift distance and whether it exceeds threshold
 */
export function calculateSpatialDrift(
  reportLocation: Coordinates,
  fixLocation: Coordinates,
  thresholdMeters: number = 30
): {
  driftMeters: number;
  exceedsThreshold: boolean;
  thresholdMeters: number;
} {
  const driftMeters = distanceBetween(reportLocation, fixLocation);
  return {
    driftMeters,
    exceedsThreshold: driftMeters > thresholdMeters,
    thresholdMeters,
  };
}

/**
 * Get bounding box around a point
 * @param center Center coordinate
 * @param radiusMeters Radius in meters
 * @returns Bounding box
 */
export function getBoundingBox(
  center: Coordinates,
  radiusMeters: number
): BoundingBox {
  // Approximate degrees per meter at given latitude
  const latRad = (center.latitude * Math.PI) / 180;
  const metersPerDegLat = 111319.9; // Approximately constant
  const metersPerDegLon = 111319.9 * Math.cos(latRad);

  const latOffset = radiusMeters / metersPerDegLat;
  const lonOffset = radiusMeters / metersPerDegLon;

  return {
    minLat: center.latitude - latOffset,
    maxLat: center.latitude + latOffset,
    minLon: center.longitude - lonOffset,
    maxLon: center.longitude + lonOffset,
  };
}

/**
 * Check if a point is within a bounding box
 */
export function isWithinBoundingBox(
  point: Coordinates,
  bbox: BoundingBox
): boolean {
  return (
    point.latitude >= bbox.minLat &&
    point.latitude <= bbox.maxLat &&
    point.longitude >= bbox.minLon &&
    point.longitude <= bbox.maxLon
  );
}

/**
 * Calculate center point of multiple coordinates
 */
export function calculateCenter(coordinates: Coordinates[]): Coordinates | null {
  if (coordinates.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;

  for (const coord of coordinates) {
    sumLat += coord.latitude;
    sumLon += coord.longitude;
  }

  return {
    latitude: sumLat / coordinates.length,
    longitude: sumLon / coordinates.length,
  };
}

/**
 * Convert meters to kilometers
 */
export function metersToKm(meters: number): number {
  return meters / 1000;
}

/**
 * Convert kilometers to meters
 */
export function kmToMeters(km: number): number {
  return km * 1000;
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Calculate bearing from one point to another
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  from: Coordinates,
  to: Coordinates
): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(Δλ);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Get compass direction from bearing
 */
export function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Filter coordinates within radius of a center point
 */
export function filterWithinRadius(
  center: Coordinates,
  coordinates: Coordinates[],
  radiusMeters: number
): Coordinates[] {
  return coordinates.filter((coord) =>
    isWithinDistance(center, coord, radiusMeters)
  );
}

/**
 * Sort coordinates by distance from a point
 */
export function sortByDistance(
  from: Coordinates,
  coordinates: Coordinates[]
): Coordinates[] {
  return [...coordinates].sort((a, b) => {
    const distA = distanceBetween(from, a);
    const distB = distanceBetween(from, b);
    return distA - distB;
  });
}

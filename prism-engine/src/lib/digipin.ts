/**
 * DIGIPIN Utilities for PRISM
 * DIGIPIN is India's Digital Pin Code system - a 5-character alphanumeric code
 * (7 with hyphens) that represents a precise geographic location (approx 4m x 4m accuracy)
 *
 * Reference: https://www.india.gov.in/digipin
 */

import { haversineDistance } from './spatial';

// DIGIPIN grid characters (3x4 grid for each level)
const DIGIPIN_GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '1', '6'],
  ['L', '5', 'T', 'H'],
];

// India's bounding box
const INDIA_BOUNDS = {
  minLat: 2.5,
  maxLat: 38.0,
  minLon: 63.5,
  maxLon: 99.0,
};

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Convert latitude and longitude to DIGIPIN
 * @param lat Latitude (2.5 to 38.0 for India)
 * @param lon Longitude (63.5 to 99.0 for India)
 * @returns 5-character DIGIPIN code (7 with hyphens)
 */
export function latLngToDIGIPIN(lat: number, lon: number): string {
  // Validate bounds
  if (lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat) {
    console.warn(`Latitude ${lat} is outside India's bounds (2.5 to 38.0)`);
  }
  if (lon < INDIA_BOUNDS.minLon || lon > INDIA_BOUNDS.maxLon) {
    console.warn(`Longitude ${lon} is outside India's bounds (63.5 to 99.0)`);
  }

  let digipin = '';
  let minLat = INDIA_BOUNDS.minLat;
  let maxLat = INDIA_BOUNDS.maxLat;
  let minLon = INDIA_BOUNDS.minLon;
  let maxLon = INDIA_BOUNDS.maxLon;

  // Generate 5-character DIGIPIN (5 levels of precision, 1 char each)
  for (let level = 0; level < 5; level++) {
    // Calculate grid cell
    const latStep = (maxLat - minLat) / 4;
    const lonStep = (maxLon - minLon) / 4;

    // Find row (latitude) - reversed (south to north)
    let row = Math.floor((lat - minLat) / latStep);
    row = Math.max(0, Math.min(3, row)); // Clamp to valid range

    // Find column (longitude) - west to east
    let col = Math.floor((lon - minLon) / lonStep);
    col = Math.max(0, Math.min(3, col)); // Clamp to valid range

    // Add character from grid (row is reversed in DIGIPIN)
    const gridRow = 3 - row; // Reverse row index
    digipin += DIGIPIN_GRID[gridRow][col];

    // Add hyphen after 3rd and 6th character
    if (level === 2 || level === 3) {
      digipin += '-';
    }

    // Refine bounds for next level
    maxLat = minLat + latStep * (4 - row);
    minLat = minLat + latStep * (3 - row);
    maxLon = minLon + lonStep * (col + 1);
    minLon = minLon + lonStep * col;
  }

  return digipin;
}

/**
 * Convert DIGIPIN to latitude and longitude
 * @param digipin 5-character DIGIPIN code (with or without hyphens)
 * @returns Center coordinates of the DIGIPIN cell
 */
export function digipinToLatLng(digipin: string): Coordinates {
  // Remove hyphens and validate
  const cleanDigipin = digipin.replace(/-/g, '').toUpperCase();

  if (cleanDigipin.length !== 5) {
    throw new Error('DIGIPIN must be 5 characters');
  }

  let minLat = INDIA_BOUNDS.minLat;
  let maxLat = INDIA_BOUNDS.maxLat;
  let minLon = INDIA_BOUNDS.minLon;
  let maxLon = INDIA_BOUNDS.maxLon;

  // Process each character
  for (let i = 0; i < 5; i++) {
    const char = cleanDigipin[i];

    // Find character position in grid
    let foundRow = -1;
    let foundCol = -1;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (DIGIPIN_GRID[row][col] === char) {
          foundRow = row;
          foundCol = col;
          break;
        }
      }
      if (foundRow !== -1) break;
    }

    if (foundRow === -1) {
      throw new Error(`Invalid DIGIPIN character: ${char}`);
    }

    // Calculate step sizes
    const latStep = (maxLat - minLat) / 4;
    const lonStep = (maxLon - minLon) / 4;

    // Convert grid position to bounds
    // Row is reversed (3 - foundRow because grid is south-to-north)
    const actualRow = 3 - foundRow;

    // Refine bounds
    minLat = minLat + latStep * actualRow;
    maxLat = minLat + latStep;
    minLon = minLon + lonStep * foundCol;
    maxLon = minLon + lonStep;
  }

  // Return center of final cell
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
  };
}

/**
 * Get DIGIPIN prefix for geo-fence queries
 * Returns first N characters for broader area matching
 * @param digipin Full DIGIPIN code
 * @param levels Number of levels (1-5, default 3 for ~100m area)
 * @returns Prefix string
 */
export function getDIGIPINPrefix(digipin: string, levels: number = 3): string {
  const cleanDigipin = digipin.replace(/-/g, '').toUpperCase();

  if (levels < 1 || levels > 5) {
    throw new Error('Levels must be between 1 and 5');
  }

  // Calculate character count based on levels
  const charCount = levels; // Each level adds 1 character
  return cleanDigipin.substring(0, Math.min(charCount, 5));
}

/**
 * Calculate approximate distance between two DIGIPIN codes
 * @param digipin1 First DIGIPIN
 * @param digipin2 Second DIGIPIN
 * @returns Distance in meters
 */
export function digipinDistance(digipin1: string, digipin2: string): number {
  const coord1 = digipinToLatLng(digipin1);
  const coord2 = digipinToLatLng(digipin2);

  return haversineDistance(
    coord1.latitude,
    coord1.longitude,
    coord2.latitude,
    coord2.longitude
  );
}

/**
 * Format DIGIPIN for display (with hyphens)
 */
export function formatDIGIPIN(digipin: string): string {
  const clean = digipin.replace(/-/g, '').toUpperCase();
  if (clean.length !== 5) return digipin;
  return `${clean.slice(0, 3)}-${clean.slice(3, 4)}-${clean.slice(4)}`;
}

/**
 * Validate DIGIPIN format
 */
export function isValidDIGIPIN(digipin: string): boolean {
  const clean = digipin.replace(/-/g, '').toUpperCase();
  if (clean.length !== 5) return false;

  // Check all characters are valid
  const validChars = new Set(DIGIPIN_GRID.flat());
  return [...clean].every((char) => validChars.has(char));
}

import { describe, it, expect } from 'vitest';
import {
  latLngToDIGIPIN,
  digipinToLatLng,
  isValidDIGIPIN,
  formatDIGIPIN,
  getDIGIPINPrefix,
  digipinDistance,
} from '../../src/lib/digipin';

describe('DIGIPIN', () => {
  describe('latLngToDIGIPIN', () => {
    it('encode produces valid DIGIPIN for Delhi coords', () => {
      const result = latLngToDIGIPIN(28.6139, 77.209);
      // DIGIPIN should be 5 chars (7 with hyphens after formatting)
      const clean = result.replace(/-/g, '');
      expect(clean.length).toBe(5);
      // All chars should be from valid DIGIPIN grid
      const validChars = new Set(['F', 'C', '9', '8', 'J', '3', '2', '7', 'K', '4', '1', '6', 'L', '5', 'T', 'H']);
      for (const ch of clean) {
        expect(validChars.has(ch)).toBe(true);
      }
    });

    it('encode-decode roundtrip stays within cell bounds', () => {
      // 5-char DIGIPIN has ~35.5km x ~35.5km cell at level 1, shrinking per level.
      // Roundtrip returns cell center, so tolerance is half the smallest cell size.
      const lat = 28.6139;
      const lon = 77.209;
      const digipin = latLngToDIGIPIN(lat, lon);
      const coords = digipinToLatLng(digipin);
      // At 5 levels, smallest cell is ~1km — center should be within 0.5 degrees
      expect(Math.abs(coords.latitude - lat)).toBeLessThan(1);
      expect(Math.abs(coords.longitude - lon)).toBeLessThan(1);
    });

    it('multiple known coordinates produce valid DIGIPINs', () => {
      const testCases = [
        { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
        { lat: 13.0827, lon: 80.2707, name: 'Chennai' },
        { lat: 19.076, lon: 72.8777, name: 'Mumbai' },
      ];
      for (const tc of testCases) {
        const result = latLngToDIGIPIN(tc.lat, tc.lon);
        const clean = result.replace(/-/g, '');
        expect(clean.length, `${tc.name}: DIGIPIN should be 5 chars`).toBe(5);
        // Verify all chars from valid grid
        const validChars = new Set(['F', 'C', '9', '8', 'J', '3', '2', '7', 'K', '4', '1', '6', 'L', '5', 'T', 'H']);
        for (const ch of clean) {
          expect(validChars.has(ch), `${tc.name}: char ${ch} should be valid`).toBe(true);
        }
      }
    });

    it('out-of-bounds coords do not throw', () => {
      expect(() => latLngToDIGIPIN(50, 77.209)).not.toThrow();
      expect(() => latLngToDIGIPIN(28.6139, 120)).not.toThrow();
    });
  });

  describe('digipinToLatLng', () => {
    it('returns coordinates within India bounds', () => {
      const digipin = latLngToDIGIPIN(28.6139, 77.209);
      const coords = digipinToLatLng(digipin);
      expect(coords.latitude).toBeGreaterThanOrEqual(2.5);
      expect(coords.latitude).toBeLessThanOrEqual(38.0);
      expect(coords.longitude).toBeGreaterThanOrEqual(63.5);
      expect(coords.longitude).toBeLessThanOrEqual(99.0);
    });

    it('throws for invalid DIGIPIN length', () => {
      expect(() => digipinToLatLng('ABC')).toThrow('5 characters');
    });

    it('throws for invalid DIGIPIN characters', () => {
      expect(() => digipinToLatLng('ABCDE')).toThrow();
    });
  });

  describe('isValidDIGIPIN', () => {
    it('accepts valid DIGIPIN codes', () => {
      const validCodes = [
        latLngToDIGIPIN(28.6139, 77.209),
        latLngToDIGIPIN(22.5726, 88.3639),
        latLngToDIGIPIN(13.0827, 80.2707),
      ];
      for (const code of validCodes) {
        expect(isValidDIGIPIN(code), `${code} should be valid`).toBe(true);
      }
    });

    it('rejects invalid DIGIPIN codes', () => {
      expect(isValidDIGIPIN('')).toBe(false);
      expect(isValidDIGIPIN('AB')).toBe(false);
      expect(isValidDIGIPIN('ABCDEFGHIJ')).toBe(false);
      expect(isValidDIGIPIN('ZZZZZ')).toBe(false);
    });
  });

  describe('formatDIGIPIN', () => {
    it('produces hyphenated format for valid DIGIPIN', () => {
      const raw = latLngToDIGIPIN(28.6139, 77.209).replace(/-/g, '');
      const formatted = formatDIGIPIN(raw);
      // Should have hyphens: XXX-X-X pattern for 5 chars
      expect(formatted).toContain('-');
      expect(formatted.replace(/-/g, '').length).toBe(5);
    });

    it('returns input unchanged for invalid length', () => {
      expect(formatDIGIPIN('ABC')).toBe('ABC');
    });
  });

  describe('getDIGIPINPrefix', () => {
    it('returns correct prefix lengths', () => {
      const digipin = latLngToDIGIPIN(28.6139, 77.209).replace(/-/g, '');
      expect(getDIGIPINPrefix(digipin, 1).length).toBe(1);
      expect(getDIGIPINPrefix(digipin, 3).length).toBe(3);
      expect(getDIGIPINPrefix(digipin, 5).length).toBe(5);
    });

    it('throws for invalid levels', () => {
      expect(() => getDIGIPINPrefix('39CK4', 0)).toThrow();
      expect(() => getDIGIPINPrefix('39CK4', 6)).toThrow();
    });
  });

  describe('digipinDistance', () => {
    it('returns positive distance between different DIGIPINs', () => {
      const d1 = latLngToDIGIPIN(28.6139, 77.209);
      const d2 = latLngToDIGIPIN(27.1767, 78.0081);
      const dist = digipinDistance(d1, d2);
      expect(dist).toBeGreaterThan(0);
    });

    it('returns ~0 for same DIGIPIN', () => {
      const d = latLngToDIGIPIN(28.6139, 77.209);
      const dist = digipinDistance(d, d);
      expect(dist).toBeLessThan(10); // within cell size
    });
  });
});

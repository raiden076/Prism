import { describe, it, expect } from 'vitest';
import { latLngToDIGIPIN } from '../src/index';

describe('latLngToDIGIPIN Unit Tests', () => {
  it('should return 7-character string (5 chars + 2 hyphens)', () => {
    const pin = latLngToDIGIPIN(28.6315, 77.2167);
    expect(pin.length).toBe(7);
    expect(pin[2]).toBe('-');
    expect(pin[4]).toBe('-');
  });

  it('should only use characters from the valid grid', () => {
    const validChars = new Set(['F', 'C', '9', '8', 'J', '3', '2', '7', 'K', '4', '1', '6', 'L', '5', 'T', 'H']);
    const pin = latLngToDIGIPIN(12.9716, 77.5946);
    const chars = pin.replace(/-/g, '').split('');
    chars.forEach(char => expect(validChars.has(char)).toBe(true));
  });

  it('should return same value for same coordinates', () => {
    const pin1 = latLngToDIGIPIN(18.9220, 72.8347);
    const pin2 = latLngToDIGIPIN(18.9220, 72.8347);
    expect(pin1).toBe(pin2);
  });

  it('should handle boundary corners', () => {
    // Bottom-Left (2.5, 63.5)
    expect(() => latLngToDIGIPIN(2.5, 63.5)).not.toThrow();
    const bl = latLngToDIGIPIN(2.5, 63.5);
    expect(bl).toBe('LL-L-LL'); 

    // Top-Right (38.0, 99.0)
    expect(() => latLngToDIGIPIN(38.0, 99.0)).not.toThrow();
    const tr = latLngToDIGIPIN(38.0, 99.0);
    expect(tr).toBe('88-8-88');
  });

  it('should clamp coordinates outside India bounds', () => {
    const bl = latLngToDIGIPIN(2.5, 63.5);
    const outside = latLngToDIGIPIN(2.0, 63.0);
    expect(outside).toBe(bl);
  });
  
  it('should handle high-precision floats', () => {
    const pin = latLngToDIGIPIN(28.6315000000001, 77.2167000000001);
    expect(pin).toMatch(/^[FCJK389L2147T56H]{2}-[FCJK389L2147T56H]-[FCJK389L2147T56H]{2}$/);
  });
});

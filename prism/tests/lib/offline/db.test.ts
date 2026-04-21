/**
 * Unit tests for offline database logic
 * PRISM #51
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as dbLogic from '../../../src/lib/offline/db';

// Mock crypto.randomUUID for consistent test data
if (typeof crypto === 'undefined') {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 9)
  } as any;
} else if (!crypto.randomUUID) {
  crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).substring(2, 9);
}

// Minimal mock for idb
const mockStore = {
  put: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  clear: vi.fn(),
  index: vi.fn().mockReturnValue({
    openCursor: vi.fn().mockResolvedValue({
      value: { id: 'old-media-id' },
      delete: vi.fn()
    })
  })
};

const mockDB = {
  put: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  clear: vi.fn(),
  transaction: vi.fn().mockReturnValue({
    store: mockStore,
    done: Promise.resolve()
  })
};

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue(mockDB)
}));

describe('Offline Database Logic', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the internal db state in the module if possible, 
    // or just assume initOfflineDB is called multiple times
  });

  describe('storeReportOffline', () => {
    it('should store a new report with pending status and 0 retries', async () => {
      const reportData = {
        latitude: 12.9716,
        longitude: 77.5946,
        digipin: '560001',
        imageDataUrl: 'data:image/jpeg;base64,abc',
        timestamp: Date.now()
      };

      const id = await dbLogic.storeReportOffline(reportData);

      expect(id).toBeDefined();
      expect(mockDB.put).toHaveBeenCalledWith('pending_reports', expect.objectContaining({
        ...reportData,
        status: 'pending',
        retryCount: 0
      }));
    });
  });

  describe('updateReportStatus', () => {
    it('should update status and increment retryCount if syncing', async () => {
      const existingReport = {
        id: 'report-1',
        status: 'pending',
        retryCount: 0
      };
      mockDB.get.mockResolvedValue(existingReport);

      await dbLogic.updateReportStatus('report-1', 'syncing');

      expect(mockDB.put).toHaveBeenCalledWith('pending_reports', expect.objectContaining({
        id: 'report-1',
        status: 'syncing',
        retryCount: 1
      }));
    });

    it('should store error message if provided', async () => {
      const existingReport = {
        id: 'report-1',
        status: 'syncing',
        retryCount: 1
      };
      mockDB.get.mockResolvedValue(existingReport);

      await dbLogic.updateReportStatus('report-1', 'failed', 'Network timeout');

      expect(mockDB.put).toHaveBeenCalledWith('pending_reports', expect.objectContaining({
        status: 'failed',
        lastError: 'Network timeout'
      }));
    });
  });

  describe('Media Caching', () => {
    it('should correctly calculate total cache size', async () => {
      const mediaItems = [
        { id: '1', size: 1000 },
        { id: '2', size: 2000 }
      ];
      mockDB.getAll.mockResolvedValue(mediaItems);

      const size = await dbLogic.getCacheSize();
      expect(size).toBe(3000);
    });
  });

  describe('Bounty Claims', () => {
    it('should filter active bounty claims correctly', async () => {
      const now = Date.now();
      const claims = [
        { bountyId: 'b1', expiresAt: now + 10000 }, // active
        { bountyId: 'b1', expiresAt: now - 1000 },  // expired
        { bountyId: 'b2', expiresAt: now + 5000 }   // different bounty
      ];
      mockDB.getAll.mockResolvedValue(claims);

      const active = await dbLogic.getActiveBountyClaim('b1');
      expect(active).toBeDefined();
      expect(active?.bountyId).toBe('b1');
      expect(active?.expiresAt).toBeGreaterThan(now);
    });
  });
});

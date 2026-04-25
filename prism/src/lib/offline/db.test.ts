import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { 
  storeReportOffline, 
  getPendingReports, 
  updateReportStatus, 
  removePendingReport,
  clearAllOfflineData
} from './db';

describe('Offline Database (IndexedDB) Unit Tests', () => {
  beforeEach(async () => {
    await clearAllOfflineData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should store a pending report and assign a UUID', async () => {
    const report = {
      latitude: 28.63,
      longitude: 77.21,
      digipin: 'DL-1-CP',
      imageDataUrl: 'data:image/png;base64,mock',
      timestamp: Date.now()
    };

    const id = await storeReportOffline(report);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const pending = await getPendingReports();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id);
    expect(pending[0].status).toBe('pending');
  });

  it('should update report status and increment retry count', async () => {
    const id = await storeReportOffline({
      latitude: 0, longitude: 0, digipin: '', imageDataUrl: '', timestamp: 0
    });

    await updateReportStatus(id, 'syncing');
    let reports = await getPendingReports();
    expect(reports[0].status).toBe('syncing');
    expect(reports[0].retryCount).toBe(1);

    await updateReportStatus(id, 'failed', 'Network timeout');
    reports = await getPendingReports();
    expect(reports[0].status).toBe('failed');
    expect(reports[0].lastError).toBe('Network timeout');
  });

  it('should remove a report from pending storage', async () => {
    const id = await storeReportOffline({
        latitude: 0, longitude: 0, digipin: '', imageDataUrl: '', timestamp: 0
    });
    
    await removePendingReport(id);
    const pending = await getPendingReports();
    expect(pending).toHaveLength(0);
  });

  it('should handle non-existent report updates gracefully', async () => {
    await expect(updateReportStatus('non-existent', 'syncing')).resolves.not.toThrow();
  });
});

/**
 * Background Sync Worker for PRISM
 * Handles offline report synchronization with network state detection
 * and exponential backoff retry
 */

import {
  getPendingReports,
  updateReportStatus,
  removePendingReport,
  storeSyncedReport,
  type PendingReport,
} from './db';
import { authService } from '../auth';

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  syncInterval: 30000, // 30 seconds
};

// Sync state
let syncInProgress = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncAttempt: number = 0;

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(retryCount: number): number {
  const delay = Math.min(
    SYNC_CONFIG.baseDelay * Math.pow(2, retryCount),
    SYNC_CONFIG.maxDelay
  );
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Check if device is online
 * (re-exported from db.ts)
 */
function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Sync a single report to the backend
 */
async function syncReport(report: PendingReport): Promise<boolean> {
  const backendUrl = 'http://localhost:8787';

  try {
    // Convert data URL back to blob
    const response = await fetch(report.imageDataUrl);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append('media', blob, 'pothole_evidence.jpg');
    formData.append('latitude', report.latitude.toString());
    formData.append('longitude', report.longitude.toString());

    const authHeader = authService.getAuthHeader();

    const apiResponse = await fetch(`${backendUrl}/api/v1/reports/harvest`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
    });

    if (apiResponse.ok) {
      const result = await apiResponse.json();

      // Store synced report record
      await storeSyncedReport({
        id: crypto.randomUUID(),
        serverId: result.id,
        latitude: report.latitude,
        longitude: report.longitude,
        digipin: report.digipin,
        syncedAt: Date.now(),
        localId: report.id,
      });

      // Remove from pending
      await removePendingReport(report.id);

      return true;
    } else {
      console.error('Sync failed:', await apiResponse.text());
      return false;
    }
  } catch (error) {
    console.error('Sync error:', error);
    return false;
  }
}

/**
 * Attempt to sync all pending reports
 */
export async function syncPendingReports(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  if (syncInProgress) {
    return { synced: 0, failed: 0, total: 0 };
  }

  if (!isOnline()) {
    console.log('Offline - skipping sync');
    return { synced: 0, failed: 0, total: 0 };
  }

  syncInProgress = true;
  lastSyncAttempt = Date.now();

  const pendingReports = await getPendingReports();
  let synced = 0;
  let failed = 0;

  for (const report of pendingReports) {
    // Check retry limit
    if (report.retryCount >= SYNC_CONFIG.maxRetries) {
      console.warn(`Report ${report.id} exceeded max retries`);
      await updateReportStatus(report.id, 'failed', 'Max retries exceeded');
      failed++;
      continue;
    }

    // Update status to syncing
    await updateReportStatus(report.id, 'syncing');

    const success = await syncReport(report);

    if (success) {
      synced++;
    } else {
      // Increment retry count
      await updateReportStatus(
        report.id,
        'pending',
        `Sync failed (attempt ${report.retryCount + 1})`
      );
      failed++;
    }

    // Small delay between syncs to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  syncInProgress = false;

  return {
    synced,
    failed,
    total: pendingReports.length,
  };
}

/**
 * Start background sync interval
 */
export function startBackgroundSync(): void {
  if (syncInterval) return;

  // Sync on online event
  window.addEventListener('online', handleOnline);

  // Start periodic sync
  syncInterval = setInterval(() => {
    if (isOnline()) {
      syncPendingReports();
    }
  }, SYNC_CONFIG.syncInterval);

  // Initial sync attempt
  if (isOnline()) {
    syncPendingReports();
  }
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }

  window.removeEventListener('online', handleOnline);
}

/**
 * Handle online event - trigger immediate sync
 */
function handleOnline(): void {
  console.log('Back online - starting sync');
  syncPendingReports();
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  isOnline: boolean;
  syncInProgress: boolean;
  lastSyncAttempt: number | null;
} {
  return {
    isOnline: isOnline(),
    syncInProgress,
    lastSyncAttempt: lastSyncAttempt || null,
  };
}

/**
 * Force immediate sync
 */
export async function forceSync(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  return syncPendingReports();
}

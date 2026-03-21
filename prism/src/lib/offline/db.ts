/**
 * Offline Database for PRISM
 * Uses IndexedDB via 'idb' library for structured offline storage
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Database schema types
interface PrismDB extends DBSchema {
  pending_reports: {
    key: string;
    value: PendingReport;
    indexes: { 'by-created': number; 'by-status': string };
  };
  synced_reports: {
    key: string;
    value: SyncedReport;
    indexes: { 'by-created': number };
  };
  media_cache: {
    key: string;
    value: CachedMedia;
    indexes: { 'by-size': number; 'by-created': number };
  };
  bounty_claims: {
    key: string;
    value: BountyClaim;
    indexes: { 'by-expires': number };
  };
}

export interface PendingReport {
  id: string;
  latitude: number;
  longitude: number;
  digipin: string;
  imageDataUrl: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export interface SyncedReport {
  id: string;
  serverId: string;
  latitude: number;
  longitude: number;
  digipin: string;
  syncedAt: number;
  localId: string;
}

export interface CachedMedia {
  id: string;
  blob: Blob;
  size: number;
  type: string;
  createdAt: number;
  reportId?: string;
}

export interface BountyClaim {
  id: string;
  bountyId: string;
  claimedAt: number;
  expiresAt: number;
  latitude: number;
  longitude: number;
}

const DB_NAME = 'prism-offline';
const DB_VERSION = 1;

let db: IDBPDatabase<PrismDB> | null = null;

/**
 * Initialize the offline database
 */
export async function initOfflineDB(): Promise<IDBPDatabase<PrismDB>> {
  if (db) return db;

  db = await openDB<PrismDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Pending reports store
      const pendingStore = database.createObjectStore('pending_reports', {
        keyPath: 'id',
      });
      pendingStore.createIndex('by-created', 'timestamp');
      pendingStore.createIndex('by-status', 'status');

      // Synced reports store
      const syncedStore = database.createObjectStore('synced_reports', {
        keyPath: 'id',
      });
      syncedStore.createIndex('by-created', 'syncedAt');

      // Media cache store
      const mediaStore = database.createObjectStore('media_cache', {
        keyPath: 'id',
      });
      mediaStore.createIndex('by-size', 'size');
      mediaStore.createIndex('by-created', 'createdAt');

      // Bounty claims store
      const bountyStore = database.createObjectStore('bounty_claims', {
        keyPath: 'id',
      });
      bountyStore.createIndex('by-expires', 'expiresAt');
    },
  });

  return db;
}

/**
 * Get database instance
 */
export async function getDB(): Promise<IDBPDatabase<PrismDB>> {
  if (!db) {
    return initOfflineDB();
  }
  return db;
}

/**
 * Store a report for offline sync
 */
export async function storeReportOffline(report: Omit<PendingReport, 'id' | 'retryCount' | 'status'>): Promise<string> {
  const database = await getDB();
  const id = crypto.randomUUID();

  const pendingReport: PendingReport = {
    ...report,
    id,
    retryCount: 0,
    status: 'pending',
  };

  await database.put('pending_reports', pendingReport);
  return id;
}

/**
 * Get all pending reports
 */
export async function getPendingReports(): Promise<PendingReport[]> {
  const database = await getDB();
  return database.getAll('pending_reports');
}

/**
 * Get pending reports count
 */
export async function getPendingReportsCount(): Promise<number> {
  const database = await getDB();
  return database.count('pending_reports');
}

/**
 * Update report status
 */
export async function updateReportStatus(
  id: string,
  status: PendingReport['status'],
  error?: string
): Promise<void> {
  const database = await getDB();
  const report = await database.get('pending_reports', id);

  if (report) {
    report.status = status;
    if (error) report.lastError = error;
    if (status === 'syncing') report.retryCount++;
    await database.put('pending_reports', report);
  }
}

/**
 * Remove report from pending queue after successful sync
 */
export async function removePendingReport(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('pending_reports', id);
}

/**
 * Store synced report for reference
 */
export async function storeSyncedReport(report: SyncedReport): Promise<void> {
  const database = await getDB();
  await database.put('synced_reports', report);
}

/**
 * Cache media for offline access
 */
export async function cacheMedia(blob: Blob, reportId?: string): Promise<string> {
  const database = await getDB();
  const id = crypto.randomUUID();

  const cachedMedia: CachedMedia = {
    id,
    blob,
    size: blob.size,
    type: blob.type,
    createdAt: Date.now(),
    reportId,
  };

  await database.put('media_cache', cachedMedia);
  return id;
}

/**
 * Get cached media
 */
export async function getCachedMedia(id: string): Promise<CachedMedia | undefined> {
  const database = await getDB();
  return database.get('media_cache', id);
}

/**
 * Get total cache size
 */
export async function getCacheSize(): Promise<number> {
  const database = await getDB();
  const all = await database.getAll('media_cache');
  return all.reduce((sum, item) => sum + item.size, 0);
}

/**
 * Evict oldest cached media (LRU eviction)
 */
export async function evictOldestMedia(): Promise<void> {
  const database = await getDB();
  const index = database.transaction('media_cache').store.index('by-created');

  const cursor = await index.openCursor();
  if (cursor) {
    const record = await cursor.value;
    if (record && record.id) {
      const tx = database.transaction('media_cache', 'readwrite');
      await tx.store.delete(record.id);
      await tx.done;
    }
  }
}

/**
 * Check if we need to evict (quota > 80%)
 * @param maxBytes Maximum cache size in bytes (default 50MB)
 */
export async function checkAndEvictIfNeeded(maxBytes: number = 50 * 1024 * 1024): Promise<void> {
  const currentSize = await getCacheSize();
  const threshold = maxBytes * 0.8;

  if (currentSize > threshold) {
    // Evict until we're under 70%
    const targetSize = maxBytes * 0.7;
    while ((await getCacheSize()) > targetSize) {
      await evictOldestMedia();
    }
  }
}

/**
 * Store bounty claim
 */
export async function storeBountyClaim(claim: BountyClaim): Promise<void> {
  const database = await getDB();
  await database.put('bounty_claims', claim);
}

/**
 * Get active bounty claim for a bounty
 */
export async function getActiveBountyClaim(bountyId: string): Promise<BountyClaim | undefined> {
  const database = await getDB();
  const all = await database.getAll('bounty_claims');

  return all.find(
    (claim) => claim.bountyId === bountyId && claim.expiresAt > Date.now()
  );
}

/**
 * Clear expired bounty claims
 */
export async function clearExpiredClaims(): Promise<void> {
  const database = await getDB();
  const all = await database.getAll('bounty_claims');

  for (const claim of all) {
    if (claim.expiresAt <= Date.now()) {
      await database.delete('bounty_claims', claim.id);
    }
  }
}

/**
 * Clear all offline data
 */
export async function clearAllOfflineData(): Promise<void> {
  const database = await getDB();
  await database.clear('pending_reports');
  await database.clear('synced_reports');
  await database.clear('media_cache');
  await database.clear('bounty_claims');
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

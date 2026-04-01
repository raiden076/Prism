## ADDED Requirements

### Requirement: IndexedDB Cache Storage
The system SHALL use IndexedDB (via `idb` library) for offline data caching.

#### Scenario: Store pending report offline
- **WHEN** network is unavailable during report submission
- **THEN** report data and photo are stored in IndexedDB
- **AND** report is marked as "pending_sync"
- **AND** user sees "Saved offline" confirmation

#### Scenario: Retrieve cached reports
- **WHEN** app needs to show pending reports
- **THEN** IndexedDB query returns all pending_sync records
- **AND** reports are displayed with "Pending" status
- **AND** timestamp shows when cached

### Requirement: Background Sync Worker
The system SHALL implement a background sync mechanism to upload cached data when connectivity returns.

#### Scenario: Auto-sync on connectivity restore
- **WHEN** device regains network connectivity
- **THEN** background sync worker detects network change
- **AND** all pending_sync reports are queued for upload
- **AND** uploads proceed in order of capture

#### Scenario: Sync success notification
- **WHEN** cached report successfully uploads
- **THEN** local notification shows "Report submitted"
- **AND** IndexedDB record is updated to "synced"
- **AND** user's pending rewards update

### Requirement: Network Failure Transparency
The system SHALL never show network errors to users for cached operations.

#### Scenario: Offline submission appears successful
- **WHEN** user submits report while offline
- **THEN** UI shows success message immediately
- **AND** no error dialogs appear
- **AND** report is queued for background sync

#### Scenario: Sync failure is retried silently
- **WHEN** background sync fails
- **THEN** report remains in pending_sync status
- **AND** retry is scheduled with exponential backoff
- **AND** user is not notified unless max retries exceeded

### Requirement: Cache Eviction Policy
The system SHALL implement LRU eviction for cached media to prevent quota issues.

#### Scenario: Evict old cached media
- **WHEN** IndexedDB usage exceeds 80% quota
- **THEN** oldest synced reports' media are evicted
- **AND** metadata is retained
- **AND** pending_sync media are never evicted

### Requirement: Service Worker for Network Detection
The system SHALL use service worker or Tauri event to detect network state changes.

#### Scenario: Network state change detected
- **WHEN** device goes offline or online
- **THEN** app receives network state event
- **AND** UI updates to show sync status
- **AND** background sync triggers if coming online

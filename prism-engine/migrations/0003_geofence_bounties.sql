-- Migration number: 0003 	 2026-03-19T20:00:00.000Z
-- Geo-fence Deduplication and Verification Bounties System

-- Add hierarchy_depth to Users table for power hierarchy tracking
ALTER TABLE Users ADD COLUMN hierarchy_depth INTEGER DEFAULT 0;

-- Add reporter_id to Users table (who referred/whitelisted this user during Phase 1)
ALTER TABLE Users ADD COLUMN reporter_id TEXT REFERENCES Users(id);

-- Create GeoFenceClusters table for deduplication
CREATE TABLE GeoFenceClusters (
  id TEXT PRIMARY KEY,
  center_latitude REAL NOT NULL,
  center_longitude REAL NOT NULL,
  center_digipin TEXT NOT NULL,
  radius_meters INTEGER DEFAULT 50,
  cluster_status TEXT CHECK(cluster_status IN ('active', 'resolved', 'monitoring')) DEFAULT 'active',
  report_count INTEGER DEFAULT 1,
  first_report_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY(first_report_id) REFERENCES Reports(id)
);

-- Create GeoFenceReports junction table for clustering reports
CREATE TABLE GeoFenceReports (
  id TEXT PRIMARY KEY,
  geofence_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(geofence_id) REFERENCES GeoFenceClusters(id),
  FOREIGN KEY(report_id) REFERENCES Reports(id)
);

-- Create VerificationBounties table for verification rewards
CREATE TABLE VerificationBounties (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  bounty_amount INTEGER NOT NULL DEFAULT 5,
  bounty_status TEXT CHECK(bounty_status IN ('available', 'claimed', 'completed', 'expired')) DEFAULT 'available',
  claimed_by TEXT REFERENCES Users(id),
  claimed_at DATETIME,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY(report_id) REFERENCES Reports(id)
);

-- Create BountyVerifications table for tracking verification attempts
CREATE TABLE BountyVerifications (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  r2_verification_image_url TEXT NOT NULL,
  verification_latitude REAL NOT NULL,
  verification_longitude REAL NOT NULL,
  spatial_drift_calc REAL,
  drift_exceeded BOOLEAN DEFAULT FALSE,
  verification_result TEXT CHECK(verification_result IN ('pending', 'approved', 'rejected', 'manual_review')) DEFAULT 'pending',
  reward_credited BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(bounty_id) REFERENCES VerificationBounties(id),
  FOREIGN KEY(verifier_id) REFERENCES Users(id)
);

-- Create indexes for performance
CREATE INDEX idx_users_reporter ON Users(reporter_id);
CREATE INDEX idx_users_hierarchy_depth ON Users(hierarchy_depth);
CREATE INDEX idx_geofence_digipin ON GeoFenceClusters(center_digipin);
CREATE INDEX idx_geofence_status ON GeoFenceClusters(cluster_status);
CREATE INDEX idx_geofence_reports_geofence ON GeoFenceReports(geofence_id);
CREATE INDEX idx_geofence_reports_report ON GeoFenceReports(report_id);
CREATE INDEX idx_bounties_report ON VerificationBounties(report_id);
CREATE INDEX idx_bounties_status ON VerificationBounties(bounty_status);
CREATE INDEX idx_bounties_expires ON VerificationBounties(expires_at);
CREATE INDEX idx_bounty_verifications_bounty ON BountyVerifications(bounty_id);
CREATE INDEX idx_bounty_verifications_verifier ON BountyVerifications(verifier_id);

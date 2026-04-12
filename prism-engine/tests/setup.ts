/**
 * Test Setup - applies D1 migrations inline.
 *
 * Uses applyD1Migrations from cloudflare:test with inline migration objects.
 * D1Migration format: { name: string, queries: string[] }
 */
import type { D1Database } from '@cloudflare/workers-types';

const MIGRATIONS = [
  {
    name: '0001_init_schema.sql',
    queries: [
      `CREATE TABLE IF NOT EXISTS Users (
        id TEXT PRIMARY KEY,
        role TEXT CHECK(role IN ('crony', 'contractor', 'admin')) NOT NULL,
        phone_number TEXT UNIQUE NOT NULL,
        region_scope TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        supervisor_id TEXT REFERENCES Users(id),
        tags TEXT DEFAULT '[]',
        hierarchy_depth INTEGER DEFAULT 0,
        reporter_id TEXT REFERENCES Users(id),
        supertokens_user_id TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS Whitelisted_Sources (
        id TEXT PRIMARY KEY,
        linked_user_id TEXT,
        verified_name TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        approval_status TEXT DEFAULT 'pending',
        FOREIGN KEY(linked_user_id) REFERENCES Users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS Reports (
        id TEXT PRIMARY KEY,
        reporter_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        digipin TEXT NOT NULL,
        r2_image_url TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved')) DEFAULT 'pending',
        ai_confidence_score REAL,
        severity_weight INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(reporter_id) REFERENCES Users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS Interventions (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        contractor_id TEXT NOT NULL,
        repair_tier INTEGER CHECK(repair_tier IN (1, 2, 3)) NOT NULL,
        r2_proof_image_url TEXT NOT NULL,
        fix_latitude REAL NOT NULL,
        fix_longitude REAL NOT NULL,
        spatial_drift_calc REAL,
        execution_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(report_id) REFERENCES Reports(id),
        FOREIGN KEY(contractor_id) REFERENCES Users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS Verifications (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        verifier_id TEXT NOT NULL,
        r2_verification_image_url TEXT NOT NULL,
        is_resolved BOOLEAN NOT NULL,
        verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(report_id) REFERENCES Reports(id),
        FOREIGN KEY(verifier_id) REFERENCES Users(id)
      )`,
    ],
  },
  {
    name: '0002_role_hierarchy_tags.sql',
    queries: [
      `CREATE TABLE IF NOT EXISTS RoleHierarchy (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        supervisor_id TEXT NOT NULL,
        hierarchy_level INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(supervisor_id) REFERENCES Users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS AccountabilityTags (
        id TEXT PRIMARY KEY,
        tag_name TEXT NOT NULL,
        tag_type TEXT CHECK(tag_type IN ('role', 'department', 'region', 'authority', 'custom')) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS UserTags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        assigned_by TEXT REFERENCES Users(id),
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(tag_id) REFERENCES AccountabilityTags(id)
      )`,
      `CREATE TABLE IF NOT EXISTS AuthorityChain (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action_type TEXT CHECK(action_type IN ('report', 'assign', 'intervene', 'verify', 'escalate')) NOT NULL,
        chain_position INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY(report_id) REFERENCES Reports(id),
        FOREIGN KEY(user_id) REFERENCES Users(id)
      )`,
    ],
  },
  {
    name: '0003_geofence_bounties.sql',
    queries: [
      `CREATE TABLE IF NOT EXISTS GeoFenceClusters (
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
      )`,
      `CREATE TABLE IF NOT EXISTS GeoFenceReports (
        id TEXT PRIMARY KEY,
        geofence_id TEXT NOT NULL,
        report_id TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(geofence_id) REFERENCES GeoFenceClusters(id),
        FOREIGN KEY(report_id) REFERENCES Reports(id)
      )`,
      `CREATE TABLE IF NOT EXISTS VerificationBounties (
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
      )`,
      `CREATE TABLE IF NOT EXISTS BountyVerifications (
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
      )`,
    ],
  },
];

export async function applyMigrations(db: D1Database): Promise<void> {
  const { applyD1Migrations } = await import('cloudflare:test');
  await applyD1Migrations(db, MIGRATIONS);
}

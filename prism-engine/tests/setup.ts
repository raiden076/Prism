/**
 * Test setup helper - applies all D1 migrations.
 *
 * Each db.exec() call contains exactly one SQL statement
 * to avoid D1 multi-statement parsing issues.
 */

export async function applyMigrations(db: D1Database): Promise<void> {
  // Migration 0001: init schema
  await db.exec("CREATE TABLE Users (id TEXT PRIMARY KEY, role TEXT CHECK(role IN ('crony', 'contractor', 'admin')) NOT NULL, phone_number TEXT UNIQUE NOT NULL, region_scope TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  await db.exec("CREATE TABLE Whitelisted_Sources (id TEXT PRIMARY KEY, linked_user_id TEXT, verified_name TEXT NOT NULL, reference_id TEXT NOT NULL, approval_status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(linked_user_id) REFERENCES Users(id))");
  await db.exec("CREATE TABLE Reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, digipin TEXT NOT NULL, r2_image_url TEXT NOT NULL, status TEXT CHECK(status IN ('pending', 'pending_review', 'assigned', 'fixed_pending_verification', 'resolved')) DEFAULT 'pending', ai_confidence_score REAL, severity_weight INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(reporter_id) REFERENCES Users(id))");
  await db.exec("CREATE TABLE Interventions (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, contractor_id TEXT NOT NULL, repair_tier INTEGER CHECK(repair_tier IN (1, 2, 3)) NOT NULL, r2_proof_image_url TEXT NOT NULL, fix_latitude REAL NOT NULL, fix_longitude REAL NOT NULL, spatial_drift_calc REAL, execution_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(report_id) REFERENCES Reports(id), FOREIGN KEY(contractor_id) REFERENCES Users(id))");
  await db.exec("CREATE TABLE Verifications (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, verifier_id TEXT NOT NULL, r2_verification_image_url TEXT NOT NULL, is_resolved BOOLEAN NOT NULL, verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(report_id) REFERENCES Reports(id), FOREIGN KEY(verifier_id) REFERENCES Users(id))");

  // Migration 0002: role hierarchy tags
  await db.exec("CREATE TABLE RoleHierarchy (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, supervisor_id TEXT NOT NULL, depth INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES Users(id), FOREIGN KEY(supervisor_id) REFERENCES Users(id))");
  await db.exec("CREATE TABLE AccountabilityTags (id TEXT PRIMARY KEY, tag_name TEXT UNIQUE NOT NULL, tag_type TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  await db.exec("CREATE TABLE UserTags (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tag_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES Users(id), FOREIGN KEY(tag_id) REFERENCES AccountabilityTags(id))");
  await db.exec("CREATE TABLE AuthorityChain (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(report_id) REFERENCES Reports(id), FOREIGN KEY(actor_id) REFERENCES Users(id))");

  // Add columns from migration 0002/0004
  try { await db.exec("ALTER TABLE Users ADD COLUMN supervisor_id TEXT"); } catch (_) { /* column exists */ }
  try { await db.exec("ALTER TABLE Users ADD COLUMN reporter_id TEXT"); } catch (_) { /* column exists */ }
  try { await db.exec("ALTER TABLE Users ADD COLUMN hierarchy_depth INTEGER DEFAULT 0"); } catch (_) { /* column exists */ }
  try { await db.exec("ALTER TABLE Users ADD COLUMN tags TEXT DEFAULT '[]'"); } catch (_) { /* column exists */ }
  try { await db.exec("ALTER TABLE Users ADD COLUMN supertokens_user_id TEXT"); } catch (_) { /* column exists */ }

  // Migration 0003: geofence bounties
  await db.exec("CREATE TABLE IF NOT EXISTS GeoFenceClusters (id TEXT PRIMARY KEY, center_latitude REAL NOT NULL, center_longitude REAL NOT NULL, center_digipin TEXT, radius_meters REAL DEFAULT 50, cluster_status TEXT DEFAULT 'active', report_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, verified_at DATETIME)");
  await db.exec("CREATE TABLE IF NOT EXISTS GeoFenceReports (id TEXT PRIMARY KEY, cluster_id TEXT NOT NULL, report_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(cluster_id) REFERENCES GeoFenceClusters(id), FOREIGN KEY(report_id) REFERENCES Reports(id))");
  await db.exec("CREATE TABLE IF NOT EXISTS VerificationBounties (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, bounty_amount INTEGER DEFAULT 5, bounty_status TEXT DEFAULT 'available', claimed_by TEXT, claimed_at DATETIME, completed_at DATETIME, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(report_id) REFERENCES Reports(id))");
  await db.exec("CREATE TABLE IF NOT EXISTS BountyVerifications (id TEXT PRIMARY KEY, bounty_id TEXT NOT NULL, verifier_id TEXT NOT NULL, r2_verification_image_url TEXT, verification_latitude REAL, verification_longitude REAL, spatial_drift_calc REAL, drift_exceeded BOOLEAN DEFAULT 0, verification_result TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(bounty_id) REFERENCES VerificationBounties(id), FOREIGN KEY(verifier_id) REFERENCES Users(id))");
}

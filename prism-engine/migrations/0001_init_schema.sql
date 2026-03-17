-- Migration number: 0001 	 2026-03-17T12:18:02.087Z

CREATE TABLE Users (
  id TEXT PRIMARY KEY,
  role TEXT CHECK(role IN ('crony', 'contractor', 'admin')) NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  region_scope TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Whitelisted_Sources (
  id TEXT PRIMARY KEY,
  linked_user_id TEXT,
  verified_name TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  approval_status TEXT DEFAULT 'pending',
  FOREIGN KEY(linked_user_id) REFERENCES Users(id)
);

CREATE TABLE Reports (
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
);

CREATE TABLE Interventions (
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
);

CREATE TABLE Verifications (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  verifier_id TEXT NOT NULL,
  r2_verification_image_url TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL,
  verification_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(report_id) REFERENCES Reports(id),
  FOREIGN KEY(verifier_id) REFERENCES Users(id)
);

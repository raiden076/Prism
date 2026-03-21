-- Migration number: 0002 	 2026-03-19T19:30:00.000Z
-- Role Hierarchy and Accountability Tags System

-- Add supervisor_id to Users table for hierarchy tracking
ALTER TABLE Users ADD COLUMN supervisor_id TEXT REFERENCES Users(id);

-- Add tags column to Users table for role categorization
ALTER TABLE Users ADD COLUMN tags TEXT DEFAULT '[]';

-- Create RoleHierarchy table for tracking authority chains
CREATE TABLE RoleHierarchy (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  supervisor_id TEXT NOT NULL,
  hierarchy_level INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES Users(id),
  FOREIGN KEY(supervisor_id) REFERENCES Users(id)
);

-- Create AccountabilityTags table for flexible tagging
CREATE TABLE AccountabilityTags (
  id TEXT PRIMARY KEY,
  tag_name TEXT NOT NULL,
  tag_type TEXT CHECK(tag_type IN ('role', 'department', 'region', 'authority', 'custom')) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create UserTags junction table for many-to-many relationship
CREATE TABLE UserTags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  assigned_by TEXT REFERENCES Users(id),
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES Users(id),
  FOREIGN KEY(tag_id) REFERENCES AccountabilityTags(id)
);

-- Create AuthorityChain table for tracking responsibility flows
CREATE TABLE AuthorityChain (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_type TEXT CHECK(action_type IN ('report', 'assign', 'intervene', 'verify', 'escalate')) NOT NULL,
  chain_position INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY(report_id) REFERENCES Reports(id),
  FOREIGN KEY(user_id) REFERENCES Users(id)
);

-- Insert default accountability tags
INSERT INTO AccountabilityTags (id, tag_name, tag_type, description) VALUES
  (hex(randomblob(16)), 'field-agent', 'role', 'Ground-level field operative'),
  (hex(randomblob(16)), 'supervisor', 'role', 'Team supervisor with oversight'),
  (hex(randomblob(16)), 'regional-manager', 'role', 'Regional authority'),
  (hex(randomblob(16)), 'executive', 'role', 'Executive decision maker'),
  (hex(randomblob(16)), 'quality-control', 'department', 'Quality assurance team'),
  (hex(randomblob(16)), 'logistics', 'department', 'Logistics and operations'),
  (hex(randomblob(16)), 'verification-team', 'department', 'Verification and audit'),
  (hex(randomblob(16)), 'emergency-response', 'authority', 'Emergency response authority'),
  (hex(randomblob(16)), 'budget-approver', 'authority', 'Budget approval authority');

-- Update existing users with supervisor relationships based on role
-- crony -> contractor -> admin hierarchy
UPDATE Users SET supervisor_id = (
  SELECT id FROM Users u2 
  WHERE u2.role = 'contractor' 
  LIMIT 1
) WHERE role = 'crony' AND supervisor_id IS NULL;

UPDATE Users SET supervisor_id = (
  SELECT id FROM Users u2 
  WHERE u2.role = 'admin' 
  LIMIT 1
) WHERE role = 'contractor' AND supervisor_id IS NULL;

-- Create indexes for performance
CREATE INDEX idx_users_supervisor ON Users(supervisor_id);
CREATE INDEX idx_role_hierarchy_user ON RoleHierarchy(user_id);
CREATE INDEX idx_role_hierarchy_supervisor ON RoleHierarchy(supervisor_id);
CREATE INDEX idx_user_tags_user ON UserTags(user_id);
CREATE INDEX idx_user_tags_tag ON UserTags(tag_id);
CREATE INDEX idx_authority_chain_report ON AuthorityChain(report_id);
CREATE INDEX idx_authority_chain_user ON AuthorityChain(user_id);
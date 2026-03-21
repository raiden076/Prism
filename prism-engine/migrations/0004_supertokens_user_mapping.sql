-- Migration number: 0004 	 2026-03-21T00:00:00.000Z
-- Add SuperTokens user ID mapping to Users table

-- Add supertokens_user_id column for SuperTokens integration (nullable, not unique initially)
ALTER TABLE Users ADD COLUMN supertokens_user_id TEXT;

-- Create index for SuperTokens user ID lookups
CREATE INDEX idx_users_supertokens_id ON Users(supertokens_user_id);

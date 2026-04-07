-- Migration number: 0006        2026-04-02
-- Enforce bounty claim expiry (15-minute window)

-- Add claimed_expires_at column to VerificationBounties for clarity
ALTER TABLE VerificationBounties ADD COLUMN claimed_expires_at DATETIME;

-- Index for efficient expiry queries
CREATE INDEX idx_bounties_claimed_expires ON VerificationBounties(claimed_expires_at);

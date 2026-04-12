import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { applyMigrations } from '../setup';
import {
  insertTestUser,
  insertTestReport,
  insertTestBounty,
} from '../factories';

describe('Factory Helpers', () => {
  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  describe('insertTestUser', () => {
    it('creates user with defaults', async () => {
      const id = await insertTestUser(env.DB);
      expect(id).toBeDefined();
      // Verify it's a valid UUID format
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // Verify user exists in DB
      const row = await env.DB
        .prepare('SELECT * FROM Users WHERE id = ?')
        .bind(id)
        .first();
      expect(row).not.toBeNull();
      expect(row!.role).toBe('crony');
    });

    it('applies overrides', async () => {
      const id = await insertTestUser(env.DB, {
        role: 'admin',
        phone_number: '+919999999999',
      });

      const row = await env.DB
        .prepare('SELECT * FROM Users WHERE id = ?')
        .bind(id)
        .first();
      expect(row!.role).toBe('admin');
      expect(row!.phone_number).toBe('+919999999999');
    });

    it('generates unique IDs', async () => {
      const id1 = await insertTestUser(env.DB);
      const id2 = await insertTestUser(env.DB);
      expect(id1).not.toBe(id2);
    });
  });

  describe('insertTestReport', () => {
    it('creates report linked to user', async () => {
      const userId = await insertTestUser(env.DB);
      const reportId = await insertTestReport(env.DB, userId);

      expect(reportId).toBeDefined();
      expect(reportId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      const row = await env.DB
        .prepare('SELECT * FROM Reports WHERE id = ?')
        .bind(reportId)
        .first();
      expect(row).not.toBeNull();
      expect(row!.reporter_id).toBe(userId);
      expect(row!.status).toBe('pending');
      expect(row!.digipin).toBeDefined();
    });
  });

  describe('insertTestBounty', () => {
    it('creates bounty with default expiry', async () => {
      const userId = await insertTestUser(env.DB);
      const reportId = await insertTestReport(env.DB, userId);
      const bountyId = await insertTestBounty(env.DB, reportId);

      expect(bountyId).toBeDefined();

      const row = await env.DB
        .prepare('SELECT * FROM VerificationBounties WHERE id = ?')
        .bind(bountyId)
        .first();
      expect(row).not.toBeNull();
      expect(row!.bounty_status).toBe('available');
      expect(row!.bounty_amount).toBe(5);

      // Verify expires_at is in the future
      const expiresAt = new Date(row!.expires_at as string);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

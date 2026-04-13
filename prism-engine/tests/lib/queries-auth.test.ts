/**
 * Query auth tests for linkSuperTokensUserId and upsertUserBySuperTokens.
 *
 * Uses real D1 via cloudflare:test with migrations + factories.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
  getUserById,
  getUserByPhone,
  getUserBySuperTokensId,
  createUser,
  linkSuperTokensUserId,
  upsertUserBySuperTokens,
} from '../../src/lib/queries';
import { applyMigrations } from '../setup';
import { insertTestUser } from '../factories';

describe('Auth Query Functions', () => {
  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  describe('linkSuperTokensUserId', () => {
    it('links an existing user to SuperTokens ID', async () => {
      const userId = await insertTestUser(env.DB, {
        phone_number: '+919876543300',
      });

      const linked = await linkSuperTokensUserId(env.DB, userId, 'st-user-001');
      expect(linked).toBe(true);

      const user = await getUserById(env.DB, userId);
      expect(user).not.toBeNull();
      expect(user!.supertokensUserId).toBe('st-user-001');
    });

    it('returns false for non-existent user', async () => {
      const linked = await linkSuperTokensUserId(env.DB, 'nonexistent-id', 'st-user-002');
      expect(linked).toBe(false);
    });

    it('overwrites existing SuperTokens ID', async () => {
      const userId = await insertTestUser(env.DB, {
        phone_number: '+919876543301',
      });

      await linkSuperTokensUserId(env.DB, userId, 'st-old');
      await linkSuperTokensUserId(env.DB, userId, 'st-new');

      const user = await getUserById(env.DB, userId);
      expect(user!.supertokensUserId).toBe('st-new');
    });
  });

  describe('upsertUserBySuperTokens', () => {
    it('creates new user when no match by ST ID or phone', async () => {
      const user = await upsertUserBySuperTokens(
        env.DB,
        'st-new-user',
        '+919876543400'
      );

      expect(user).toBeDefined();
      expect(user.phoneNumber).toBe('+919876543400');
      expect(user.role).toBe('crony');
    });

    it('returns existing user by SuperTokens ID', async () => {
      const userId = await insertTestUser(env.DB, {
        phone_number: '+919876543401',
      });
      await linkSuperTokensUserId(env.DB, userId, 'st-existing');

      const user = await upsertUserBySuperTokens(
        env.DB,
        'st-existing',
        '+919876543401'
      );

      expect(user.id).toBe(userId);
      expect(user.supertokensUserId).toBe('st-existing');
    });

    it('links existing user by phone when no ST ID match', async () => {
      const userId = await insertTestUser(env.DB, {
        phone_number: '+919876543402',
      });

      // User exists by phone but has no ST ID linked
      const user = await upsertUserBySuperTokens(
        env.DB,
        'st-phone-link',
        '+919876543402'
      );

      expect(user.id).toBe(userId);
      expect(user.supertokensUserId).toBe('st-phone-link');
    });

    it('auto-creates user with crony role (D-09)', async () => {
      const user = await upsertUserBySuperTokens(
        env.DB,
        'st-auto-create',
        '+919876543403'
      );

      expect(user.role).toBe('crony');
    });

    it('does not re-link user that already has ST ID', async () => {
      const userId = await insertTestUser(env.DB, {
        phone_number: '+919876543404',
      });
      await linkSuperTokensUserId(env.DB, userId, 'st-original');

      // Lookup by the same ST ID should return user without changing anything
      const user = await upsertUserBySuperTokens(
        env.DB,
        'st-original',
        '+919876543404'
      );

      expect(user.id).toBe(userId);
      expect(user.supertokensUserId).toBe('st-original');
    });
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import {
  getUserById,
  getUserByPhone,
  createUser,
  getReportById,
  createReport,
  updateReportStatus,
  getReportsByStatus,
  createIntervention,
  getInterventionsByReport,
  getNearbyReports,
  createBounty,
  getBountyById,
  claimBounty,
  createVerification,
  getVerificationsByReport,
} from '../../src/lib/queries';
import { applyMigrations } from '../setup';
import { insertTestUser, insertTestReport, insertTestBounty } from '../factories';

describe('Query Functions', () => {
  beforeAll(async () => {
    await applyMigrations(env.DB);
  });

  describe('User queries', () => {
    it('createUser inserts, getUserById returns user', async () => {
      const user = await createUser(env.DB, {
        role: 'crony',
        phoneNumber: '+919876543201',
      });
      expect(user.id).toBeDefined();
      expect(user.phoneNumber).toBe('+919876543201');
      expect(user.role).toBe('crony');

      const fetched = await getUserById(env.DB, user.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.phoneNumber).toBe('+919876543201');
    });

    it('getUserByPhone finds user', async () => {
      const phone = '+919876543202';
      await createUser(env.DB, { role: 'contractor', phoneNumber: phone });

      const found = await getUserByPhone(env.DB, phone);
      expect(found).not.toBeNull();
      expect(found!.phoneNumber).toBe(phone);
      expect(found!.role).toBe('contractor');
    });

    it('getUserById returns null for nonexistent', async () => {
      const result = await getUserById(env.DB, 'nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('Report queries', () => {
    it('createReport generates DIGIPIN', async () => {
      const userId = await insertTestUser(env.DB);
      const report = await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/report.jpg',
      });
      expect(report.digipin).toBeDefined();
      expect(report.digipin.length).toBeGreaterThan(0);
      expect(report.status).toBe('pending');
    });

    it('getReportById returns report with camelCase fields', async () => {
      const userId = await insertTestUser(env.DB);
      const report = await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/report2.jpg',
      });

      const fetched = await getReportById(env.DB, report.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.reporterId).toBe(userId);
      expect(fetched!.r2ImageUrl).toBe('r2://test/report2.jpg');
    });

    it('updateReportStatus valid transition succeeds', async () => {
      const userId = await insertTestUser(env.DB);
      const report = await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/report3.jpg',
      });

      const updated = await updateReportStatus(env.DB, report.id, 'pending_review');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('pending_review');
    });

    it('updateReportStatus invalid transition returns null', async () => {
      const userId = await insertTestUser(env.DB);
      const report = await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/report4.jpg',
      });

      // pending -> resolved is invalid (skips states)
      const result = await updateReportStatus(env.DB, report.id, 'resolved');
      expect(result).toBeNull();
    });

    it('getReportsByStatus filters correctly', async () => {
      const userId = await insertTestUser(env.DB);
      await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/report5.jpg',
        status: 'pending',
      });

      const pending = await getReportsByStatus(env.DB, 'pending', 100);
      expect(pending.length).toBeGreaterThan(0);
      for (const r of pending) {
        expect(r.status).toBe('pending');
      }
    });
  });

  describe('Intervention queries', () => {
    it('createIntervention + getByReport returns intervention', async () => {
      const contractorId = await insertTestUser(env.DB, { role: 'contractor' });
      const reportId = await insertTestReport(env.DB, contractorId);

      const intervention = await createIntervention(env.DB, {
        reportId,
        contractorId,
        repairTier: 1,
        r2ProofImageUrl: 'r2://test/proof.jpg',
        fixLatitude: 28.6139,
        fixLongitude: 77.209,
      });

      expect(intervention.reportId).toBe(reportId);
      expect(intervention.contractorId).toBe(contractorId);

      const byReport = await getInterventionsByReport(env.DB, reportId);
      expect(byReport.length).toBe(1);
      expect(byReport[0].id).toBe(intervention.id);
    });
  });

  describe('Nearby queries', () => {
    it('getNearbyReports returns results with distance', async () => {
      const userId = await insertTestUser(env.DB);
      await createReport(env.DB, {
        reporterId: userId,
        latitude: 28.6139,
        longitude: 77.209,
        r2ImageUrl: 'r2://test/nearby.jpg',
      });

      const nearby = await getNearbyReports(env.DB, 28.6139, 77.209, 1000);
      expect(nearby.length).toBeGreaterThan(0);
      expect(nearby[0].distanceMeters).toBeDefined();
      expect(nearby[0].distanceMeters).toBeLessThanOrEqual(1000);
    });
  });

  describe('Bounty queries', () => {
    it('createBounty and claimBounty work', async () => {
      const userId = await insertTestUser(env.DB);
      const reportId = await insertTestReport(env.DB, userId);
      const expiry = new Date(Date.now() + 86400000).toISOString();

      const bounty = await createBounty(env.DB, {
        reportId,
        bountyAmount: 10,
        expiresAt: expiry,
      });

      expect(bounty.reportId).toBe(reportId);
      expect(bounty.bountyStatus).toBe('available');

      const claimerId = await insertTestUser(env.DB);
      const claimed = await claimBounty(env.DB, bounty.id, claimerId);
      expect(claimed).not.toBeNull();
      expect(claimed!.bountyStatus).toBe('claimed');
      expect(claimed!.claimedBy).toBe(claimerId);
    });

    it('claimBounty returns null for already claimed', async () => {
      const userId = await insertTestUser(env.DB);
      const reportId = await insertTestReport(env.DB, userId);
      const expiry = new Date(Date.now() + 86400000).toISOString();

      const bounty = await createBounty(env.DB, { reportId, expiresAt: expiry });
      const claimer1 = await insertTestUser(env.DB);
      const claimer2 = await insertTestUser(env.DB);

      await claimBounty(env.DB, bounty.id, claimer1);
      const second = await claimBounty(env.DB, bounty.id, claimer2);
      expect(second).toBeNull();
    });
  });

  describe('Verification queries', () => {
    it('createVerification and getByReport work', async () => {
      const userId = await insertTestUser(env.DB);
      const reportId = await insertTestReport(env.DB, userId);

      const verification = await createVerification(env.DB, {
        reportId,
        verifierId: userId,
        r2VerificationImageUrl: 'r2://test/verify.jpg',
        isResolved: true,
      });

      expect(verification.reportId).toBe(reportId);
      expect(verification.isResolved).toBe(true);

      const byReport = await getVerificationsByReport(env.DB, reportId);
      expect(byReport.length).toBe(1);
    });
  });
});

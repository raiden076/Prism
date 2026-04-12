import { describe, it, expect } from 'vitest';
import {
  rowToUser,
  rowToReport,
  REPORT_STATUSES,
  USER_ROLES,
  STATUS_TRANSITIONS,
  isValidTransition,
} from '../../src/lib/types';
import type { UserRow, ReportRow } from '../../src/lib/types';

describe('Type Transforms', () => {
  describe('rowToUser', () => {
    it('transforms snake_case to camelCase', () => {
      const row: UserRow = {
        id: 'user-1',
        role: 'crony',
        phone_number: '+919999999999',
        region_scope: 'west-bengal',
        created_at: '2026-04-13T00:00:00Z',
        supervisor_id: 'sup-1',
        tags: '["field-agent"]',
        hierarchy_depth: 2,
        reporter_id: 'rep-1',
        supertokens_user_id: null,
      };
      const user = rowToUser(row);
      expect(user.id).toBe('user-1');
      expect(user.phoneNumber).toBe('+919999999999');
      expect(user.regionScope).toBe('west-bengal');
      expect(user.supervisorId).toBe('sup-1');
      expect(user.reporterId).toBe('rep-1');
    });

    it('parses JSON tags string to array', () => {
      const row: UserRow = {
        id: 'user-2',
        role: 'crony',
        phone_number: '+919999999998',
        region_scope: null,
        created_at: null,
        supervisor_id: null,
        tags: '["field-agent", "verified"]',
        hierarchy_depth: 0,
        reporter_id: null,
        supertokens_user_id: null,
      };
      const user = rowToUser(row);
      expect(user.tags).toEqual(['field-agent', 'verified']);
    });

    it('parses empty tags as empty array', () => {
      const row: UserRow = {
        id: 'user-3',
        role: 'crony',
        phone_number: '+919999999997',
        region_scope: null,
        created_at: null,
        supervisor_id: null,
        tags: null,
        hierarchy_depth: 0,
        reporter_id: null,
        supertokens_user_id: null,
      };
      const user = rowToUser(row);
      expect(user.tags).toEqual([]);
    });

    it('converts string date to Date object', () => {
      const row: UserRow = {
        id: 'user-4',
        role: 'crony',
        phone_number: '+919999999996',
        region_scope: null,
        created_at: '2026-04-13T00:00:00Z',
        supervisor_id: null,
        tags: null,
        hierarchy_depth: 0,
        reporter_id: null,
        supertokens_user_id: null,
      };
      const user = rowToUser(row);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('null coalescing on hierarchy_depth', () => {
      const row: UserRow = {
        id: 'user-5',
        role: 'crony',
        phone_number: '+919999999995',
        region_scope: null,
        created_at: null,
        supervisor_id: null,
        tags: null,
        hierarchy_depth: null,
        reporter_id: null,
        supertokens_user_id: null,
      };
      const user = rowToUser(row);
      expect(user.hierarchyDepth).toBe(0);
    });
  });

  describe('rowToReport', () => {
    it('casts status string to ReportStatus type', () => {
      const row: ReportRow = {
        id: 'report-1',
        reporter_id: 'user-1',
        latitude: 28.6139,
        longitude: 77.209,
        digipin: '39C-K-4',
        r2_image_url: 'r2://test/image.jpg',
        status: 'pending',
        ai_confidence_score: null,
        severity_weight: null,
        created_at: null,
      };
      const report = rowToReport(row);
      expect(report.status).toBe('pending');
      expect(report.reporterId).toBe('user-1');
      expect(report.r2ImageUrl).toBe('r2://test/image.jpg');
    });

    it('defaults severity_weight to 1 when null', () => {
      const row: ReportRow = {
        id: 'report-2',
        reporter_id: 'user-1',
        latitude: 28.6139,
        longitude: 77.209,
        digipin: '39C-K-4',
        r2_image_url: 'r2://test/image.jpg',
        status: null,
        ai_confidence_score: null,
        severity_weight: null,
        created_at: null,
      };
      const report = rowToReport(row);
      expect(report.severityWeight).toBe(1);
    });

    it('defaults status to pending when null', () => {
      const row: ReportRow = {
        id: 'report-3',
        reporter_id: 'user-1',
        latitude: 28.6139,
        longitude: 77.209,
        digipin: '39C-K-4',
        r2_image_url: 'r2://test/image.jpg',
        status: null,
        ai_confidence_score: null,
        severity_weight: 1,
        created_at: null,
      };
      const report = rowToReport(row);
      expect(report.status).toBe('pending');
    });
  });
});

describe('Status State Machine', () => {
  describe('isValidTransition', () => {
    it('accepts pending -> pending_review', () => {
      expect(isValidTransition('pending', 'pending_review')).toBe(true);
    });

    it('accepts assigned -> fixed_pending_verification', () => {
      expect(isValidTransition('assigned', 'fixed_pending_verification')).toBe(true);
    });

    it('accepts pending -> assigned', () => {
      expect(isValidTransition('pending', 'assigned')).toBe(true);
    });

    it('accepts fixed_pending_verification -> resolved', () => {
      expect(isValidTransition('fixed_pending_verification', 'resolved')).toBe(true);
    });

    it('rejects resolved -> pending (terminal state)', () => {
      expect(isValidTransition('resolved', 'pending')).toBe(false);
    });

    it('rejects pending -> resolved (skips states)', () => {
      expect(isValidTransition('pending', 'resolved')).toBe(false);
    });

    it('rejects pending -> fixed_pending_verification', () => {
      expect(isValidTransition('pending', 'fixed_pending_verification')).toBe(false);
    });

    it('resolved has no outgoing transitions', () => {
      expect(STATUS_TRANSITIONS['resolved']).toEqual([]);
    });
  });

  describe('REPORT_STATUSES', () => {
    it('matches D1 CHECK constraint values', () => {
      expect(REPORT_STATUSES).toEqual([
        'pending',
        'pending_review',
        'assigned',
        'fixed_pending_verification',
        'resolved',
      ]);
    });
  });

  describe('USER_ROLES', () => {
    it('matches D1 CHECK constraint values', () => {
      expect(USER_ROLES).toEqual(['crony', 'contractor', 'admin']);
    });
  });
});

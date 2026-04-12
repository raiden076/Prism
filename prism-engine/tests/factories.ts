/**
 * Test Factory Helpers
 *
 * Insert test records directly into real D1. Each takes db as first param
 * and optional overrides object with snake_case keys matching D1 columns.
 */

import { latLngToDIGIPIN } from '../src/lib/digipin';
import type { D1Database } from '@cloudflare/workers-types';

interface UserOverrides {
  role?: string;
  phone_number?: string;
  region_scope?: string | null;
  supervisor_id?: string | null;
  reporter_id?: string | null;
  hierarchy_depth?: number | null;
  tags?: string | null;
}

export async function insertTestUser(
  db: D1Database,
  overrides?: UserOverrides
): Promise<string> {
  const id = crypto.randomUUID();
  const phone = overrides?.phone_number ?? `+91${Math.floor(Math.random() * 1e10)}`;
  await db
    .prepare(
      `INSERT INTO Users (id, role, phone_number, region_scope, supervisor_id, reporter_id, hierarchy_depth, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      overrides?.role ?? 'crony',
      phone,
      overrides?.region_scope ?? null,
      overrides?.supervisor_id ?? null,
      overrides?.reporter_id ?? null,
      overrides?.hierarchy_depth ?? 0,
      overrides?.tags ?? '[]'
    )
    .run();
  return id;
}

interface ReportOverrides {
  latitude?: number;
  longitude?: number;
  r2_image_url?: string;
  status?: string;
  ai_confidence_score?: number | null;
  severity_weight?: number | null;
}

export async function insertTestReport(
  db: D1Database,
  reporterId: string,
  overrides?: ReportOverrides
): Promise<string> {
  const id = crypto.randomUUID();
  const lat = overrides?.latitude ?? 28.6139;
  const lon = overrides?.longitude ?? 77.209;
  const digipin = latLngToDIGIPIN(lat, lon);
  await db
    .prepare(
      `INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status, ai_confidence_score, severity_weight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      reporterId,
      lat,
      lon,
      digipin,
      overrides?.r2_image_url ?? 'r2://test/image.jpg',
      overrides?.status ?? 'pending',
      overrides?.ai_confidence_score ?? null,
      overrides?.severity_weight ?? 1
    )
    .run();
  return id;
}

interface InterventionOverrides {
  repair_tier?: number;
  r2_proof_image_url?: string;
  fix_latitude?: number;
  fix_longitude?: number;
  spatial_drift_calc?: number | null;
}

export async function insertTestIntervention(
  db: D1Database,
  reportId: string,
  contractorId: string,
  overrides?: InterventionOverrides
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO Interventions (id, report_id, contractor_id, repair_tier, r2_proof_image_url, fix_latitude, fix_longitude, spatial_drift_calc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      reportId,
      contractorId,
      overrides?.repair_tier ?? 1,
      overrides?.r2_proof_image_url ?? 'r2://test/proof.jpg',
      overrides?.fix_latitude ?? 28.6139,
      overrides?.fix_longitude ?? 77.209,
      overrides?.spatial_drift_calc ?? null
    )
    .run();
  return id;
}

interface VerificationOverrides {
  r2_verification_image_url?: string;
  is_resolved?: boolean;
}

export async function insertTestVerification(
  db: D1Database,
  reportId: string,
  verifierId: string,
  overrides?: VerificationOverrides
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO Verifications (id, report_id, verifier_id, r2_verification_image_url, is_resolved)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      reportId,
      verifierId,
      overrides?.r2_verification_image_url ?? 'r2://test/verify.jpg',
      overrides?.is_resolved !== undefined ? (overrides.is_resolved ? 1 : 0) : 1
    )
    .run();
  return id;
}

interface BountyOverrides {
  bounty_amount?: number;
  bounty_status?: string;
  expires_at?: string;
}

export async function insertTestBounty(
  db: D1Database,
  reportId: string,
  overrides?: BountyOverrides
): Promise<string> {
  const id = crypto.randomUUID();
  const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db
    .prepare(
      `INSERT INTO VerificationBounties (id, report_id, bounty_amount, bounty_status, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      reportId,
      overrides?.bounty_amount ?? 5,
      overrides?.bounty_status ?? 'available',
      overrides?.expires_at ?? defaultExpiry
    )
    .run();
  return id;
}

/**
 * PRISM Typed D1 Query Layer
 *
 * Plain functions wrapping prepared statements. D1Database as first param.
 * All returns use App types (not Row types). Zero string interpolation.
 */

import {
  type UserRow,
  type User,
  rowToUser,
  type ReportRow,
  type Report,
  rowToReport,
  type InterventionRow,
  type Intervention,
  rowToIntervention,
  type VerificationRow,
  type Verification,
  rowToVerification,
  type WhitelistedSourceRow,
  type WhitelistedSource,
  rowToWhitelistedSource,
  type VerificationBountyRow,
  type VerificationBounty,
  rowToVerificationBounty,
  type GeoFenceClusterRow,
  type GeoFenceCluster,
  rowToGeoFenceCluster,
  type ReportStatus,
  type UserRole,
  isValidTransition,
} from './types';
import { latLngToDIGIPIN } from './digipin';
import { haversineDistance } from './spatial';

// ---------------------------------------------------------------------------
// User queries
// ---------------------------------------------------------------------------

export async function getUserById(
  db: D1Database,
  id: string
): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM Users WHERE id = ?')
    .bind(id)
    .first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function getUserByPhone(
  db: D1Database,
  phoneNumber: string
): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM Users WHERE phone_number = ?')
    .bind(phoneNumber)
    .first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function getUserBySuperTokensId(
  db: D1Database,
  stUserId: string
): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM Users WHERE supertokens_user_id = ?')
    .bind(stUserId)
    .first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function linkSuperTokensUserId(
  db: D1Database,
  userId: string,
  stUserId: string
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE Users SET supertokens_user_id = ? WHERE id = ?')
    .bind(stUserId, userId)
    .run();
  return result.meta.changes > 0;
}

export async function upsertUserBySuperTokens(
  db: D1Database,
  stUserId: string,
  phoneNumber: string
): Promise<User> {
  // Try to find existing user by SuperTokens ID
  const bySt = await getUserBySuperTokensId(db, stUserId);
  if (bySt) return bySt;

  // Try to find existing user by phone (D-11: link if found)
  const byPhone = await getUserByPhone(db, phoneNumber);
  if (byPhone) {
    if (!byPhone.supertokensUserId) {
      await linkSuperTokensUserId(db, byPhone.id, stUserId);
    }
    // Re-fetch to get updated supertokens_user_id
    const refetched = await getUserById(db, byPhone.id);
    if (!refetched) {
      throw new Error('User disappeared after ST ID link -- concurrent modification');
    }
    return refetched;
  }

  // Create new user with crony role (D-09: auto-create)
  // Handle race: concurrent OTP verifications for same phone may both reach here.
  // Catch UNIQUE constraint violation on phone_number and re-fetch the winner.
  try {
    const user = await createUser(db, { role: 'crony', phoneNumber });
    await linkSuperTokensUserId(db, user.id, stUserId);
    // Re-fetch to get updated supertokens_user_id
    const linked = await getUserById(db, user.id);
    return linked ?? user;
  } catch (error: any) {
    const msg = error?.message ?? '';
    if (msg.includes('UNIQUE constraint') || msg.includes('unique') || msg.includes('duplicate')) {
      // Race condition: another request created the user first. Re-fetch and link.
      const winner = await getUserByPhone(db, phoneNumber);
      if (winner) {
        if (!winner.supertokensUserId) {
          await linkSuperTokensUserId(db, winner.id, stUserId);
        }
        return winner;
      }
    }
    throw error;
  }
}

export async function createUser(
  db: D1Database,
  input: {
    role: UserRole;
    phoneNumber: string;
    regionScope?: string | null;
    supervisorId?: string | null;
    reporterId?: string | null;
    hierarchyDepth?: number;
  }
): Promise<User> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO Users (id, role, phone_number, region_scope, supervisor_id, reporter_id, hierarchy_depth)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.role,
      input.phoneNumber,
      input.regionScope ?? null,
      input.supervisorId ?? null,
      input.reporterId ?? null,
      input.hierarchyDepth ?? 0
    )
    .run();
  const user = await getUserById(db, id);
  if (!user) {
    throw new Error('Failed to create user: insert succeeded but lookup failed');
  }
  return user;
}

export async function getUserDescendants(
  db: D1Database,
  userId: string
): Promise<User[]> {
  const { results } = await db
    .prepare(
      `WITH RECURSIVE subtree AS (
        SELECT id FROM Users WHERE id = ?
        UNION ALL
        SELECT u.id FROM Users u JOIN subtree s ON u.supervisor_id = s.id
      )
      SELECT * FROM Users WHERE id IN (SELECT id FROM subtree)`
    )
    .bind(userId)
    .all<UserRow>();
  return results.map(rowToUser);
}

// ---------------------------------------------------------------------------
// Report queries
// ---------------------------------------------------------------------------

export async function getReportById(
  db: D1Database,
  id: string
): Promise<Report | null> {
  const row = await db
    .prepare('SELECT * FROM Reports WHERE id = ?')
    .bind(id)
    .first<ReportRow>();
  return row ? rowToReport(row) : null;
}

export async function getReportsByStatus(
  db: D1Database,
  status: ReportStatus,
  limit: number = 100
): Promise<Report[]> {
  const { results } = await db
    .prepare('SELECT * FROM Reports WHERE status = ? ORDER BY created_at DESC LIMIT ?')
    .bind(status, limit)
    .all<ReportRow>();
  return results.map(rowToReport);
}

export async function getReportsByReporter(
  db: D1Database,
  reporterId: string,
  limit: number = 100
): Promise<Report[]> {
  const { results } = await db
    .prepare('SELECT * FROM Reports WHERE reporter_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(reporterId, limit)
    .all<ReportRow>();
  return results.map(rowToReport);
}

export async function createReport(
  db: D1Database,
  input: {
    reporterId: string;
    latitude: number;
    longitude: number;
    r2ImageUrl: string;
    status?: ReportStatus;
  }
): Promise<Report> {
  const id = crypto.randomUUID();
  const digipin = latLngToDIGIPIN(input.latitude, input.longitude);
  const status = input.status ?? 'pending';
  await db
    .prepare(
      `INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.reporterId,
      input.latitude,
      input.longitude,
      digipin,
      input.r2ImageUrl,
      status
    )
    .run();
  const report = await getReportById(db, id);
  if (!report) {
    throw new Error('Failed to create report: insert succeeded but lookup failed');
  }
  return report;
}

export async function updateReportStatus(
  db: D1Database,
  reportId: string,
  newStatus: ReportStatus
): Promise<Report | null> {
  const current = await getReportById(db, reportId);
  if (!current) return null;
  if (!isValidTransition(current.status, newStatus)) return null;

  await db
    .prepare('UPDATE Reports SET status = ? WHERE id = ?')
    .bind(newStatus, reportId)
    .run();
  return getReportById(db, reportId);
}

export async function getNearbyReports(
  db: D1Database,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  limit: number = 50
): Promise<Array<Report & { distanceMeters: number }>> {
  // Bounding box pre-filter (approximate degrees from meters)
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));

  const { results } = await db
    .prepare(
      `SELECT * FROM Reports
       WHERE latitude BETWEEN ? AND ?
       AND longitude BETWEEN ? AND ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(
      latitude - latDelta,
      latitude + latDelta,
      longitude - lonDelta,
      longitude + lonDelta,
      limit * 3 // Over-fetch for Haversine filtering
    )
    .all<ReportRow>();

  const nearby: Array<Report & { distanceMeters: number }> = [];
  for (const row of results) {
    const dist = haversineDistance(latitude, longitude, row.latitude, row.longitude);
    if (dist <= radiusMeters) {
      nearby.push({ ...rowToReport(row), distanceMeters: dist });
    }
    if (nearby.length >= limit) break;
  }
  return nearby;
}

// ---------------------------------------------------------------------------
// Intervention queries
// ---------------------------------------------------------------------------

export async function getInterventionById(
  db: D1Database,
  id: string
): Promise<Intervention | null> {
  const row = await db
    .prepare('SELECT * FROM Interventions WHERE id = ?')
    .bind(id)
    .first<InterventionRow>();
  return row ? rowToIntervention(row) : null;
}

export async function getInterventionsByReport(
  db: D1Database,
  reportId: string
): Promise<Intervention[]> {
  const { results } = await db
    .prepare('SELECT * FROM Interventions WHERE report_id = ? ORDER BY execution_timestamp DESC')
    .bind(reportId)
    .all<InterventionRow>();
  return results.map(rowToIntervention);
}

export async function createIntervention(
  db: D1Database,
  input: {
    reportId: string;
    contractorId: string;
    repairTier: number;
    r2ProofImageUrl: string;
    fixLatitude: number;
    fixLongitude: number;
    spatialDriftCalc?: number;
  }
): Promise<Intervention> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO Interventions (id, report_id, contractor_id, repair_tier, r2_proof_image_url, fix_latitude, fix_longitude, spatial_drift_calc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.reportId,
      input.contractorId,
      input.repairTier,
      input.r2ProofImageUrl,
      input.fixLatitude,
      input.fixLongitude,
      input.spatialDriftCalc ?? null
    )
    .run();
  const intervention = await getInterventionById(db, id);
  if (!intervention) {
    throw new Error('Failed to create intervention: insert succeeded but lookup failed');
  }
  return intervention;
}

// ---------------------------------------------------------------------------
// Verification queries
// ---------------------------------------------------------------------------

export async function getVerificationById(
  db: D1Database,
  id: string
): Promise<Verification | null> {
  const row = await db
    .prepare('SELECT * FROM Verifications WHERE id = ?')
    .bind(id)
    .first<VerificationRow>();
  return row ? rowToVerification(row) : null;
}

export async function getVerificationsByReport(
  db: D1Database,
  reportId: string
): Promise<Verification[]> {
  const { results } = await db
    .prepare('SELECT * FROM Verifications WHERE report_id = ? ORDER BY verification_timestamp DESC')
    .bind(reportId)
    .all<VerificationRow>();
  return results.map(rowToVerification);
}

export async function createVerification(
  db: D1Database,
  input: {
    reportId: string;
    verifierId: string;
    r2VerificationImageUrl: string;
    isResolved: boolean;
  }
): Promise<Verification> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO Verifications (id, report_id, verifier_id, r2_verification_image_url, is_resolved)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.reportId,
      input.verifierId,
      input.r2VerificationImageUrl,
      input.isResolved ? 1 : 0
    )
    .run();
  const verification = await getVerificationById(db, id);
  if (!verification) {
    throw new Error('Failed to create verification: insert succeeded but lookup failed');
  }
  return verification;
}

// ---------------------------------------------------------------------------
// Bounty queries
// ---------------------------------------------------------------------------

export async function getBountyById(
  db: D1Database,
  id: string
): Promise<VerificationBounty | null> {
  const row = await db
    .prepare('SELECT * FROM VerificationBounties WHERE id = ?')
    .bind(id)
    .first<VerificationBountyRow>();
  return row ? rowToVerificationBounty(row) : null;
}

export async function getBountiesByStatus(
  db: D1Database,
  status: string,
  limit: number = 100
): Promise<VerificationBounty[]> {
  const { results } = await db
    .prepare('SELECT * FROM VerificationBounties WHERE bounty_status = ? ORDER BY created_at DESC LIMIT ?')
    .bind(status, limit)
    .all<VerificationBountyRow>();
  return results.map(rowToVerificationBounty);
}

export async function getBountiesNearby(
  db: D1Database,
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<Array<VerificationBounty & { distanceMeters: number }>> {
  // Bounding box pre-filter
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));

  const { results } = await db
    .prepare(
      `SELECT vb.*, r.latitude, r.longitude
       FROM VerificationBounties vb
       JOIN Reports r ON vb.report_id = r.id
       WHERE r.latitude BETWEEN ? AND ?
       AND r.longitude BETWEEN ? AND ?
       AND vb.bounty_status = 'available'`
    )
    .bind(
      latitude - latDelta,
      latitude + latDelta,
      longitude - lonDelta,
      longitude + lonDelta
    )
    .all<VerificationBountyRow & { latitude: number; longitude: number }>();

  const nearby: Array<VerificationBounty & { distanceMeters: number }> = [];
  for (const row of results) {
    const dist = haversineDistance(latitude, longitude, row.latitude, row.longitude);
    if (dist <= radiusMeters) {
      nearby.push({ ...rowToVerificationBounty(row), distanceMeters: dist });
    }
  }
  return nearby;
}

export async function createBounty(
  db: D1Database,
  input: {
    reportId: string;
    bountyAmount?: number;
    expiresAt: string;
  }
): Promise<VerificationBounty> {
  const id = crypto.randomUUID();
  const amount = input.bountyAmount ?? 5;
  await db
    .prepare(
      `INSERT INTO VerificationBounties (id, report_id, bounty_amount, bounty_status, expires_at)
       VALUES (?, ?, ?, 'available', ?)`
    )
    .bind(id, input.reportId, amount, input.expiresAt)
    .run();
  const bounty = await getBountyById(db, id);
  if (!bounty) {
    throw new Error('Failed to create bounty: insert succeeded but lookup failed');
  }
  return bounty;
}

export async function claimBounty(
  db: D1Database,
  bountyId: string,
  userId: string
): Promise<VerificationBounty | null> {
  const result = await db
    .prepare(
      `UPDATE VerificationBounties
       SET bounty_status = 'claimed', claimed_by = ?, claimed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND bounty_status = 'available'`
    )
    .bind(userId, bountyId)
    .run();

  if (!result.meta.changes) return null;
  return getBountyById(db, bountyId);
}

// ---------------------------------------------------------------------------
// Whitelisted Source queries
// ---------------------------------------------------------------------------

export async function getWhitelistedSourceById(
  db: D1Database,
  id: string
): Promise<WhitelistedSource | null> {
  const row = await db
    .prepare('SELECT * FROM Whitelisted_Sources WHERE id = ?')
    .bind(id)
    .first<WhitelistedSourceRow>();
  return row ? rowToWhitelistedSource(row) : null;
}

export async function getWhitelistedSourceByReference(
  db: D1Database,
  referenceId: string
): Promise<WhitelistedSource | null> {
  const row = await db
    .prepare('SELECT * FROM Whitelisted_Sources WHERE reference_id = ?')
    .bind(referenceId)
    .first<WhitelistedSourceRow>();
  return row ? rowToWhitelistedSource(row) : null;
}

export async function getWhitelistedSourceByUserId(
  db: D1Database,
  userId: string
): Promise<WhitelistedSource | null> {
  const row = await db
    .prepare('SELECT * FROM Whitelisted_Sources WHERE linked_user_id = ? AND approval_status = ?')
    .bind(userId, 'approved')
    .first<WhitelistedSourceRow>();
  return row ? rowToWhitelistedSource(row) : null;
}

export async function createWhitelistedSource(
  db: D1Database,
  input: {
    linkedUserId?: string;
    verifiedName: string;
    referenceId: string;
    approvalStatus?: string;
  }
): Promise<WhitelistedSource> {
  const id = crypto.randomUUID();
  const status = input.approvalStatus ?? 'pending';
  await db
    .prepare(
      `INSERT INTO Whitelisted_Sources (id, linked_user_id, verified_name, reference_id, approval_status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, input.linkedUserId ?? null, input.verifiedName, input.referenceId, status)
    .run();
  const source = await getWhitelistedSourceById(db, id);
  if (!source) {
    throw new Error('Failed to create whitelisted source: insert succeeded but lookup failed');
  }
  return source;
}

// ---------------------------------------------------------------------------
// Hierarchy queries
// ---------------------------------------------------------------------------

export async function getHierarchySubtree(
  db: D1Database,
  userId: string
): Promise<User[]> {
  // Same recursive CTE as getUserDescendants
  return getUserDescendants(db, userId);
}

// ---------------------------------------------------------------------------
// GeoFence Cluster queries
// ---------------------------------------------------------------------------

export async function getGeoFenceClusterById(
  db: D1Database,
  id: string
): Promise<GeoFenceCluster | null> {
  const row = await db
    .prepare('SELECT * FROM GeoFenceClusters WHERE id = ?')
    .bind(id)
    .first<GeoFenceClusterRow>();
  return row ? rowToGeoFenceCluster(row) : null;
}

export async function getActiveGeoFenceClusters(
  db: D1Database,
  limit: number = 100
): Promise<GeoFenceCluster[]> {
  const { results } = await db
    .prepare('SELECT * FROM GeoFenceClusters WHERE cluster_status = ? ORDER BY created_at DESC LIMIT ?')
    .bind('active', limit)
    .all<GeoFenceClusterRow>();
  return results.map(rowToGeoFenceCluster);
}

export async function createGeoFenceCluster(
  db: D1Database,
  input: {
    centerLatitude: number;
    centerLongitude: number;
    centerDigipin: string;
    radiusMeters?: number;
    firstReportId: string;
  }
): Promise<GeoFenceCluster> {
  const id = crypto.randomUUID();
  const radius = input.radiusMeters ?? 50;
  await db
    .prepare(
      `INSERT INTO GeoFenceClusters (id, center_latitude, center_longitude, center_digipin, radius_meters, first_report_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.centerLatitude,
      input.centerLongitude,
      input.centerDigipin,
      radius,
      input.firstReportId
    )
    .run();
  const cluster = await getGeoFenceClusterById(db, id);
  if (!cluster) {
    throw new Error('Failed to create geo-fence cluster: insert succeeded but lookup failed');
  }
  return cluster;
}

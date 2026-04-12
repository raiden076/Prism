/**
 * PRISM Type Definitions
 *
 * Dual-type system: Row types match D1 output exactly (snake_case, string dates).
 * App types use camelCase, parsed dates, typed enums.
 *
 * Every table across all 5 migrations has a Row + App type pair.
 */

// ---------------------------------------------------------------------------
// Enums matching D1 CHECK constraints
// ---------------------------------------------------------------------------

/** Report status values — matches D1 CHECK constraint exactly */
export const REPORT_STATUSES = [
  'pending',
  'pending_review',
  'assigned',
  'fixed_pending_verification',
  'resolved',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Valid status transitions (state machine) */
export const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  pending: ['pending_review', 'assigned'],
  pending_review: ['assigned', 'pending'],
  assigned: ['fixed_pending_verification'],
  fixed_pending_verification: ['resolved', 'pending_review'],
  resolved: [],
};

/** Check if a status transition is valid */
export function isValidTransition(
  from: ReportStatus,
  to: ReportStatus
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** User role values — matches D1 CHECK constraint */
export const USER_ROLES = ['crony', 'contractor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Whitelisted source approval status */
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Geo-fence cluster status */
export const CLUSTER_STATUSES = ['active', 'resolved', 'monitoring'] as const;
export type ClusterStatus = (typeof CLUSTER_STATUSES)[number];

/** Bounty status values */
export const BOUNTY_STATUSES = [
  'available',
  'claimed',
  'completed',
  'expired',
] as const;
export type BountyStatus = (typeof BOUNTY_STATUSES)[number];

/** Bounty verification result */
export const VERIFICATION_RESULTS = [
  'pending',
  'approved',
  'rejected',
  'manual_review',
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

/** Authority chain action type */
export const ACTION_TYPES = [
  'report',
  'assign',
  'intervene',
  'verify',
  'escalate',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Tag type */
export const TAG_TYPES = [
  'role',
  'department',
  'region',
  'authority',
  'custom',
] as const;
export type TagType = (typeof TAG_TYPES)[number];

// ---------------------------------------------------------------------------
// Environment type (Cloudflare Worker bindings)
// ---------------------------------------------------------------------------

export type Env = {
  DB: D1Database;
  VAULT: R2Bucket;
  CONTRACTOR_LOCATIONS: DurableObjectNamespace;
  AI_ACTIVATED: string;
  OTPLESS_CLIENT_ID: string;
  OTPLESS_CLIENT_SECRET: string;
  SUPERTOKENS_CORE_URL: string;
  SUPERTOKENS_API_KEY: string;
  USE_SUPERTOKENS_AUTH: string;
};

// ---------------------------------------------------------------------------
// Users — migrations 0001, 0002, 0003, 0004
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  role: string;
  phone_number: string;
  region_scope: string | null;
  created_at: string | null;
  supervisor_id: string | null;
  tags: string | null;
  hierarchy_depth: number | null;
  reporter_id: string | null;
  supertokens_user_id: string | null;
}

export interface User {
  id: string;
  role: UserRole;
  phoneNumber: string;
  regionScope: string | null;
  createdAt: Date | null;
  supervisorId: string | null;
  tags: string[];
  hierarchyDepth: number;
  reporterId: string | null;
  supertokensUserId: string | null;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    role: row.role as UserRole,
    phoneNumber: row.phone_number,
    regionScope: row.region_scope,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    supervisorId: row.supervisor_id,
    tags: row.tags ? JSON.parse(row.tags) : [],
    hierarchyDepth: row.hierarchy_depth ?? 0,
    reporterId: row.reporter_id,
    supertokensUserId: row.supertokens_user_id,
  };
}

// ---------------------------------------------------------------------------
// Whitelisted_Sources — migration 0001
// ---------------------------------------------------------------------------

export interface WhitelistedSourceRow {
  id: string;
  linked_user_id: string | null;
  verified_name: string;
  reference_id: string;
  approval_status: string | null;
}

export interface WhitelistedSource {
  id: string;
  linkedUserId: string | null;
  verifiedName: string;
  referenceId: string;
  approvalStatus: ApprovalStatus;
}

export function rowToWhitelistedSource(
  row: WhitelistedSourceRow
): WhitelistedSource {
  return {
    id: row.id,
    linkedUserId: row.linked_user_id,
    verifiedName: row.verified_name,
    referenceId: row.reference_id,
    approvalStatus: (row.approval_status ?? 'pending') as ApprovalStatus,
  };
}

// ---------------------------------------------------------------------------
// Reports — migration 0001
// ---------------------------------------------------------------------------

export interface ReportRow {
  id: string;
  reporter_id: string;
  latitude: number;
  longitude: number;
  digipin: string;
  r2_image_url: string;
  status: string | null;
  ai_confidence_score: number | null;
  severity_weight: number | null;
  created_at: string | null;
}

export interface Report {
  id: string;
  reporterId: string;
  latitude: number;
  longitude: number;
  digipin: string;
  r2ImageUrl: string;
  status: ReportStatus;
  aiConfidenceScore: number | null;
  severityWeight: number;
  createdAt: Date | null;
}

export function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    latitude: row.latitude,
    longitude: row.longitude,
    digipin: row.digipin,
    r2ImageUrl: row.r2_image_url,
    status: (row.status ?? 'pending') as ReportStatus,
    aiConfidenceScore: row.ai_confidence_score,
    severityWeight: row.severity_weight ?? 1,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

// ---------------------------------------------------------------------------
// Interventions — migration 0001
// ---------------------------------------------------------------------------

export interface InterventionRow {
  id: string;
  report_id: string;
  contractor_id: string;
  repair_tier: number;
  r2_proof_image_url: string;
  fix_latitude: number;
  fix_longitude: number;
  spatial_drift_calc: number | null;
  execution_timestamp: string | null;
}

export interface Intervention {
  id: string;
  reportId: string;
  contractorId: string;
  repairTier: number;
  r2ProofImageUrl: string;
  fixLatitude: number;
  fixLongitude: number;
  spatialDriftCalc: number | null;
  executionTimestamp: Date | null;
}

export function rowToIntervention(row: InterventionRow): Intervention {
  return {
    id: row.id,
    reportId: row.report_id,
    contractorId: row.contractor_id,
    repairTier: row.repair_tier,
    r2ProofImageUrl: row.r2_proof_image_url,
    fixLatitude: row.fix_latitude,
    fixLongitude: row.fix_longitude,
    spatialDriftCalc: row.spatial_drift_calc,
    executionTimestamp: row.execution_timestamp
      ? new Date(row.execution_timestamp)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Verifications — migration 0001
// ---------------------------------------------------------------------------

export interface VerificationRow {
  id: string;
  report_id: string;
  verifier_id: string;
  r2_verification_image_url: string;
  is_resolved: number;
  verification_timestamp: string | null;
}

export interface Verification {
  id: string;
  reportId: string;
  verifierId: string;
  r2VerificationImageUrl: string;
  isResolved: boolean;
  verificationTimestamp: Date | null;
}

export function rowToVerification(row: VerificationRow): Verification {
  return {
    id: row.id,
    reportId: row.report_id,
    verifierId: row.verifier_id,
    r2VerificationImageUrl: row.r2_verification_image_url,
    isResolved: row.is_resolved === 1,
    verificationTimestamp: row.verification_timestamp
      ? new Date(row.verification_timestamp)
      : null,
  };
}

// ---------------------------------------------------------------------------
// RoleHierarchy — migration 0002
// ---------------------------------------------------------------------------

export interface RoleHierarchyRow {
  id: string;
  user_id: string;
  supervisor_id: string;
  hierarchy_level: number | null;
  created_at: string | null;
}

export interface RoleHierarchy {
  id: string;
  userId: string;
  supervisorId: string;
  hierarchyLevel: number;
  createdAt: Date | null;
}

export function rowToRoleHierarchy(row: RoleHierarchyRow): RoleHierarchy {
  return {
    id: row.id,
    userId: row.user_id,
    supervisorId: row.supervisor_id,
    hierarchyLevel: row.hierarchy_level ?? 1,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

// ---------------------------------------------------------------------------
// AccountabilityTags — migration 0002
// ---------------------------------------------------------------------------

export interface AccountabilityTagRow {
  id: string;
  tag_name: string;
  tag_type: string;
  description: string | null;
  created_at: string | null;
}

export interface AccountabilityTag {
  id: string;
  tagName: string;
  tagType: TagType;
  description: string | null;
  createdAt: Date | null;
}

export function rowToAccountabilityTag(
  row: AccountabilityTagRow
): AccountabilityTag {
  return {
    id: row.id,
    tagName: row.tag_name,
    tagType: row.tag_type as TagType,
    description: row.description,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

// ---------------------------------------------------------------------------
// UserTags — migration 0002
// ---------------------------------------------------------------------------

export interface UserTagRow {
  id: string;
  user_id: string;
  tag_id: string;
  assigned_by: string | null;
  assigned_at: string | null;
}

export interface UserTag {
  id: string;
  userId: string;
  tagId: string;
  assignedBy: string | null;
  assignedAt: Date | null;
}

export function rowToUserTag(row: UserTagRow): UserTag {
  return {
    id: row.id,
    userId: row.user_id,
    tagId: row.tag_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
  };
}

// ---------------------------------------------------------------------------
// AuthorityChain — migration 0002
// ---------------------------------------------------------------------------

export interface AuthorityChainRow {
  id: string;
  report_id: string;
  user_id: string;
  action_type: string;
  chain_position: number;
  timestamp: string | null;
  metadata: string | null;
}

export interface AuthorityChain {
  id: string;
  reportId: string;
  userId: string;
  actionType: ActionType;
  chainPosition: number;
  timestamp: Date | null;
  metadata: Record<string, unknown> | null;
}

export function rowToAuthorityChain(row: AuthorityChainRow): AuthorityChain {
  return {
    id: row.id,
    reportId: row.report_id,
    userId: row.user_id,
    actionType: row.action_type as ActionType,
    chainPosition: row.chain_position,
    timestamp: row.timestamp ? new Date(row.timestamp) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

// ---------------------------------------------------------------------------
// GeoFenceClusters — migration 0003
// ---------------------------------------------------------------------------

export interface GeoFenceClusterRow {
  id: string;
  center_latitude: number;
  center_longitude: number;
  center_digipin: string;
  radius_meters: number | null;
  cluster_status: string | null;
  report_count: number | null;
  first_report_id: string;
  created_at: string | null;
  resolved_at: string | null;
}

export interface GeoFenceCluster {
  id: string;
  centerLatitude: number;
  centerLongitude: number;
  centerDigipin: string;
  radiusMeters: number;
  clusterStatus: ClusterStatus;
  reportCount: number;
  firstReportId: string;
  createdAt: Date | null;
  resolvedAt: Date | null;
}

export function rowToGeoFenceCluster(
  row: GeoFenceClusterRow
): GeoFenceCluster {
  return {
    id: row.id,
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    centerDigipin: row.center_digipin,
    radiusMeters: row.radius_meters ?? 50,
    clusterStatus: (row.cluster_status ?? 'active') as ClusterStatus,
    reportCount: row.report_count ?? 1,
    firstReportId: row.first_report_id,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  };
}

// ---------------------------------------------------------------------------
// GeoFenceReports — migration 0003
// ---------------------------------------------------------------------------

export interface GeoFenceReportRow {
  id: string;
  geofence_id: string;
  report_id: string;
  added_at: string | null;
}

export interface GeoFenceReport {
  id: string;
  geofenceId: string;
  reportId: string;
  addedAt: Date | null;
}

export function rowToGeoFenceReport(row: GeoFenceReportRow): GeoFenceReport {
  return {
    id: row.id,
    geofenceId: row.geofence_id,
    reportId: row.report_id,
    addedAt: row.added_at ? new Date(row.added_at) : null,
  };
}

// ---------------------------------------------------------------------------
// VerificationBounties — migration 0003
// ---------------------------------------------------------------------------

export interface VerificationBountyRow {
  id: string;
  report_id: string;
  bounty_amount: number;
  bounty_status: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string;
  created_at: string | null;
  completed_at: string | null;
}

export interface VerificationBounty {
  id: string;
  reportId: string;
  bountyAmount: number;
  bountyStatus: BountyStatus;
  claimedBy: string | null;
  claimedAt: Date | null;
  expiresAt: Date;
  createdAt: Date | null;
  completedAt: Date | null;
}

export function rowToVerificationBounty(
  row: VerificationBountyRow
): VerificationBounty {
  return {
    id: row.id,
    reportId: row.report_id,
    bountyAmount: row.bounty_amount,
    bountyStatus: (row.bounty_status ?? 'available') as BountyStatus,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
    expiresAt: new Date(row.expires_at),
    createdAt: row.created_at ? new Date(row.created_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

// ---------------------------------------------------------------------------
// BountyVerifications — migration 0003
// ---------------------------------------------------------------------------

export interface BountyVerificationRow {
  id: string;
  bounty_id: string;
  verifier_id: string;
  r2_verification_image_url: string;
  verification_latitude: number;
  verification_longitude: number;
  spatial_drift_calc: number | null;
  drift_exceeded: number | null;
  verification_result: string | null;
  reward_credited: number | null;
  created_at: string | null;
}

export interface BountyVerification {
  id: string;
  bountyId: string;
  verifierId: string;
  r2VerificationImageUrl: string;
  verificationLatitude: number;
  verificationLongitude: number;
  spatialDriftCalc: number | null;
  driftExceeded: boolean;
  verificationResult: VerificationResult;
  rewardCredited: boolean;
  createdAt: Date | null;
}

export function rowToBountyVerification(
  row: BountyVerificationRow
): BountyVerification {
  return {
    id: row.id,
    bountyId: row.bounty_id,
    verifierId: row.verifier_id,
    r2VerificationImageUrl: row.r2_verification_image_url,
    verificationLatitude: row.verification_latitude,
    verificationLongitude: row.verification_longitude,
    spatialDriftCalc: row.spatial_drift_calc,
    driftExceeded: row.drift_exceeded === 1,
    verificationResult: (row.verification_result ?? 'pending') as VerificationResult,
    rewardCredited: row.reward_credited === 1,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

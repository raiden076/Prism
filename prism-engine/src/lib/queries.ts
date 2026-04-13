/**
 * PRISM Engine - Database Query Functions
 *
 * Prepared statement wrappers for D1 operations.
 * All queries use parameterized bindings - zero string interpolation.
 */

import type { User, UserRole, WhitelistedSource } from './types';

/**
 * Look up a user by phone number.
 */
export async function getUserByPhone(db: D1Database, phoneNumber: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT id, role, phone_number, region_scope, supervisor_id, hierarchy_depth, reporter_id, supertokens_user_id, created_at FROM Users WHERE phone_number = ?')
    .bind(phoneNumber)
    .first();

  if (!row) return null;

  return mapRowToUser(row);
}

/**
 * Create a new user with optional hierarchy data.
 */
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
      'INSERT INTO Users (id, role, phone_number, region_scope, supervisor_id, reporter_id, hierarchy_depth) VALUES (?, ?, ?, ?, ?, ?, ?)'
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

  const row = await db
    .prepare('SELECT id, role, phone_number, region_scope, supervisor_id, hierarchy_depth, reporter_id, supertokens_user_id, created_at FROM Users WHERE id = ?')
    .bind(id)
    .first();

  return mapRowToUser(row!);
}

/**
 * Create a whitelisted source record.
 */
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

  await db
    .prepare(
      'INSERT INTO Whitelisted_Sources (id, linked_user_id, verified_name, reference_id, approval_status) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, input.linkedUserId ?? null, input.verifiedName, input.referenceId, input.approvalStatus ?? 'pending')
    .run();

  const row = await db
    .prepare('SELECT id, linked_user_id, verified_name, reference_id, approval_status, created_at FROM Whitelisted_Sources WHERE id = ?')
    .bind(id)
    .first();

  return {
    id: row!.id as string,
    linkedUserId: row!.linked_user_id as string | null,
    verifiedName: row!.verified_name as string,
    referenceId: row!.reference_id as string,
    approvalStatus: row!.approval_status as string,
    createdAt: row!.created_at as Date | null,
  };
}

/**
 * Get all descendants of a user via recursive CTE.
 */
export async function getUserDescendants(db: D1Database, userId: string): Promise<User[]> {
  const result = await db
    .prepare(
      `WITH RECURSIVE hierarchy_tree AS (
        SELECT id FROM Users WHERE id = ?
        UNION ALL
        SELECT u.id FROM Users u
        INNER JOIN hierarchy_tree ht ON u.reporter_id = ht.id
      )
      SELECT u.id, u.role, u.phone_number, u.region_scope, u.supervisor_id, u.hierarchy_depth, u.reporter_id, u.supertokens_user_id, u.created_at
      FROM Users u
      INNER JOIN hierarchy_tree ht ON u.id = ht.id`
    )
    .bind(userId)
    .all();

  return (result.results || []).map(mapRowToUser);
}

/**
 * Map a D1 row to a User object (camelCase).
 */
function mapRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    role: row.role as UserRole,
    phoneNumber: row.phone_number as string,
    regionScope: (row.region_scope as string) ?? null,
    createdAt: (row.created_at as Date) ?? null,
    supervisorId: (row.supervisor_id as string) ?? null,
    tags: [],
    hierarchyDepth: (row.hierarchy_depth as number) ?? 0,
    reporterId: (row.reporter_id as string) ?? null,
    supertokensUserId: (row.supertokens_user_id as string) ?? null,
  };
}

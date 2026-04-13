/**
 * PRISM - RBAC Middleware (requireRole, getReportsFilter)
 *
 * requireRole(): enforces role whitelist on protected routes. Must run after withUser().
 * getReportsFilter(): returns role-appropriate WHERE clause for report queries.
 *
 * Security: Role fetched from D1 on every request (D-08). Never trusts client-sent role.
 * SQL: Parameterized queries only. WHERE clauses use ? placeholders with .bind().
 */

import type { Context, Next } from 'hono';
import type { User, UserRole } from '../lib/types';
import { getUserDescendants } from '../lib/queries';

/**
 * requireRole() -- rejects requests where user.role not in allowed roles.
 * Must run after withUser() which sets user on context.
 * Returns 403 if no user or role mismatch.
 */
export function requireRole(...roles: UserRole[]) {
  return async (c: Context<{ Variables: { user: User } }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json(
        { error: 'Forbidden -- no user context. Ensure withUser() runs first.' },
        403
      );
    }
    if (!roles.includes(user.role)) {
      return c.json(
        { error: `Forbidden -- requires one of: ${roles.join(', ')}` },
        403
      );
    }
    await next();
  };
}

/**
 * getReportsFilter() -- returns role-appropriate WHERE clause for Reports queries.
 *
 * Admin: sees all reports (1=1)
 * Contractor: sees only assigned reports (via Interventions join)
 * Crony: sees own reports + reports they verified
 * Default: hierarchy-scoped access via recursive CTE subtree
 */
export async function getReportsFilter(
  role: UserRole,
  userId: string,
  db: D1Database
): Promise<{ whereClause: string; params: string[] }> {
  switch (role) {
    case 'admin':
      return { whereClause: '1=1', params: [] };

    case 'contractor':
      return {
        whereClause:
          'id IN (SELECT report_id FROM Interventions WHERE contractor_id = ?)',
        params: [userId],
      };

    case 'crony':
      return {
        whereClause:
          '(reporter_id = ? OR id IN (SELECT report_id FROM Verifications WHERE verifier_id = ?))',
        params: [userId, userId],
      };

    default:
      // Hierarchy-scoped access (RBAC-05): users with non-standard roles
      // or hierarchy heads see reports from their subtree
      const descendants = await getUserDescendants(db, userId);
      const ids = descendants.map((d) => d.id);
      if (ids.length === 0) {
        return { whereClause: '1=0', params: [] };
      }
      const placeholders = ids.map(() => '?').join(',');
      return {
        whereClause: `reporter_id IN (${placeholders})`,
        params: ids,
      };
  }
}

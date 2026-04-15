/**
 * Board Query Route
 *
 * Authenticated users query reports with RBAC scoping, status filter,
 * and pagination. Used by War Room dashboard.
 *
 * Security:
 * - withUser() middleware validates Bearer JWT (T-03-11)
 * - getReportsFilter() generates role-specific WHERE clauses (T-03-11, T-03-16)
 * - Hard limit of 100 results per page (T-03-13)
 * - Status enum validation before query (T-03-15)
 */

import { Hono } from 'hono';
import type { Env, ReportStatus } from '../lib/types';
import { REPORT_STATUSES } from '../lib/types';
import { withUser } from '../middleware/auth';
import type { AuthVariables } from '../middleware/auth';
import { getReportsFilter } from '../middleware/rbac';
import { getBoardReports } from '../lib/queries';

export const boardRoutes = new Hono<{
  Bindings: Env;
  Variables: AuthVariables;
}>();

boardRoutes.get('/', withUser(), async (c) => {
  const user = c.get('user');

  // RPT-08: Optional status filter
  const statusParam = c.req.query('status');
  let status: ReportStatus | undefined;
  if (statusParam) {
    if (!REPORT_STATUSES.includes(statusParam as ReportStatus)) {
      return c.json(
        {
          error: `Invalid status. Must be one of: ${REPORT_STATUSES.join(', ')}`,
        },
        400
      );
    }
    status = statusParam as ReportStatus;
  }

  // RPT-06: Pagination params
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');
  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  // RPT-09: RBAC filter
  const filter = await getReportsFilter(user.role, user.id, c.env.DB);

  const result = await getBoardReports(c.env.DB, filter, {
    status,
    limit,
    offset,
  });

  return c.json(
    {
      reports: result.reports,
      total: result.total,
      limit,
      offset,
    },
    200
  );
});

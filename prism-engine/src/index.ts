import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { ContractorLocationObject } from './contractor-locations';
import {
	initSuperTokens,
	createSuperTokensMiddleware,
	isSuperTokensEnabled,
	SuperTokens,
	Session,
	Passwordless
} from './lib/supertokens';

// DIGIPIN Grid (India's Digital Pin Code system)
const DIGIPIN_GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '1', '6'],
  ['L', '5', 'T', 'H'],
];

const INDIA_BOUNDS = {
  minLat: 2.5,
  maxLat: 38.0,
  minLon: 63.5,
  maxLon: 99.0,
};

// Convert latitude and longitude to DIGIPIN
function latLngToDIGIPIN(lat: number, lon: number): string {
  let digipin = '';
  let minLat = INDIA_BOUNDS.minLat;
  let maxLat = INDIA_BOUNDS.maxLat;
  let minLon = INDIA_BOUNDS.minLon;
  let maxLon = INDIA_BOUNDS.maxLon;

  for (let level = 0; level < 5; level++) {
    const latStep = (maxLat - minLat) / 4;
    const lonStep = (maxLon - minLon) / 4;

    let row = Math.floor((lat - minLat) / latStep);
    row = Math.max(0, Math.min(3, row));
    let col = Math.floor((lon - minLon) / lonStep);
    col = Math.max(0, Math.min(3, col));

    const gridRow = 3 - row;
    digipin += DIGIPIN_GRID[gridRow][col];

    if (level === 2 || level === 3) {
      digipin += '-';
    }

    maxLat = minLat + latStep * (4 - row);
    minLat = minLat + latStep * (3 - row);
    maxLon = minLon + lonStep * (col + 1);
    minLon = minLon + lonStep * col;
  }

  return digipin;
}

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

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Initialize SuperTokens if enabled
app.use('*', async (c, next) => {
	const useSuperTokens = isSuperTokensEnabled(c.env.USE_SUPERTOKENS_AUTH);
	if (useSuperTokens) {
		try {
			initSuperTokens(c.env.SUPERTOKENS_CORE_URL, c.env.SUPERTOKENS_API_KEY);
			const middleware = createSuperTokensMiddleware();
			await middleware(c, next);
		} catch (error) {
			console.error('SuperTokens initialization error:', error);
			await next();
		}
	} else {
		await next();
	}
});

// --- Role-Based Access Control Helpers ---

interface UserContext {
  id: string;
  role: string;
  phone_number: string;
  hierarchy_depth: number;
  reporter_id: string | null;
  region_scope: string | null;
}

// Get user from Authorization header (supports both SuperTokens and legacy OTPless)
async function getUserFromAuth(c: Context<{ Bindings: Env }>): Promise<UserContext | null> {
  const useSuperTokens = isSuperTokensEnabled(c.env.USE_SUPERTOKENS_AUTH);

  // Try SuperTokens first if enabled
  if (useSuperTokens) {
    try {
      const session = await Session.getSession(c.req.raw, { sessionRequired: false });
      if (session) {
        const supertokensUserId = session.getUserId();

        // Look up user by SuperTokens user ID
        const user = await c.env.DB.prepare(
          'SELECT id, role, phone_number, hierarchy_depth, reporter_id, region_scope FROM Users WHERE supertokens_user_id = ?'
        ).bind(supertokensUserId).first();

        if (user) {
          return user as UserContext;
        }
      }
    } catch (error) {
      console.error('SuperTokens session error:', error);
      // Fall through to legacy auth
    }
  }

  // Legacy OTPless auth (phone number in Authorization header)
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Support both phone number (legacy) and Bearer token
  let phoneNumber = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    // For Bearer tokens in legacy mode, extract the phone (this maintains backward compatibility)
    phoneNumber = authHeader.replace('Bearer ', '');
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT id, role, phone_number, hierarchy_depth, reporter_id, region_scope FROM Users WHERE phone_number = ?'
    ).bind(phoneNumber).first();

    return user as UserContext | null;
  } catch {
    return null;
  }
}

// Get all descendant user IDs for a given user (for hierarchical access)
async function getDescendantIds(c: Context<{ Bindings: Env }>, userId: string): Promise<string[]> {
  try {
    const descendants = await c.env.DB.prepare(
      `WITH RECURSIVE hierarchy_tree AS (
        SELECT id FROM Users WHERE id = ?
        UNION ALL
        SELECT u.id FROM Users u
        INNER JOIN hierarchy_tree ht ON u.reporter_id = ht.id
      )
      SELECT id FROM hierarchy_tree`
    ).bind(userId).all();

    return descendants.results?.map((r: any) => r.id) || [userId];
  } catch {
    return [userId];
  }
}

// Role-based filter for reports query
async function getReportsFilter(c: Context<{ Bindings: Env }>, user: UserContext): Promise<{ whereClause: string; params: any[] }> {
  // Admin sees everything
  if (user.role === 'admin') {
    return { whereClause: '1=1', params: [] };
  }

  // Contractors only see reports assigned to them
  if (user.role === 'contractor') {
    return {
      whereClause: 'id IN (SELECT report_id FROM Interventions WHERE contractor_id = ?)',
      params: [user.id]
    };
  }

  // Masters and region heads see reports from their subtree
  if (user.role === 'master' || user.hierarchy_depth <= 2) {
    const descendantIds = await getDescendantIds(c, user.id);
    const placeholders = descendantIds.map(() => '?').join(',');
    return {
      whereClause: `reporter_id IN (${placeholders})`,
      params: descendantIds
    };
  }

  // Cronies see reports they submitted or can verify
  return {
    whereClause: '(reporter_id = ? OR id IN (SELECT report_id FROM Verifications WHERE verifier_id = ?))',
    params: [user.id, user.id]
  };
}

// Check if user can access a specific report
async function canAccessReport(c: Context<{ Bindings: Env }>, user: UserContext, reportId: string): Promise<boolean> {
  // Admin can access everything
  if (user.role === 'admin') return true;

  try {
    const report = await c.env.DB.prepare(
      'SELECT reporter_id FROM Reports WHERE id = ?'
    ).bind(reportId).first();

    if (!report) return false;

    // Contractors can access if assigned
    if (user.role === 'contractor') {
      const intervention = await c.env.DB.prepare(
        'SELECT id FROM Interventions WHERE report_id = ? AND contractor_id = ?'
      ).bind(reportId, user.id).first();
      return !!intervention;
    }

    // Check if report is from user's subtree
    const descendantIds = await getDescendantIds(c, user.id);
    return descendantIds.includes(report.reporter_id);
  } catch {
    return false;
  }
}

// Basic health check
app.get('/health', (c: Context<{ Bindings: Env }>) => c.json({ status: 'online', phase: c.env.AI_ACTIVATED === 'true' ? 2 : 1 }));

// Workers status endpoint - returns status of all monitored Workers
app.get('/api/v1/workers/status', async (c: Context<{ Bindings: Env }>) => {
  // Define the Workers to monitor
  // In production, this could be fetched from a configuration store
  const workers = [
    {
      id: 'prism-engine',
      name: 'PRISM Engine',
      url: 'http://localhost:8787/health',
      region: 'Global',
      type: 'API Gateway',
      description: 'Main API gateway and business logic'
    },
    {
      id: 'prism-ai-processor',
      name: 'AI Processor',
      url: null, // Placeholder for future AI Worker
      region: 'Global',
      type: 'AI Inference',
      description: 'YOLO-based image analysis and confidence scoring'
    },
    {
      id: 'prism-notification',
      name: 'Notification Service',
      url: null, // Placeholder for future notification Worker
      region: 'Asia',
      type: 'Messaging',
      description: 'Push notifications and SMS alerts'
    },
    {
      id: 'prism-analytics',
      name: 'Analytics Worker',
      url: null, // Placeholder for future analytics Worker
      region: 'Global',
      type: 'Data Processing',
      description: 'Real-time metrics and reporting aggregation'
    }
  ];

  const workerStatuses = await Promise.all(
    workers.map(async (worker) => {
      if (!worker.url) {
        // Placeholder Worker - return planned status
        return {
          ...worker,
          status: 'planned',
          healthy: null,
          lastChecked: Date.now(),
          responseTime: null,
          uptime: null,
          error: null
        };
      }

      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(worker.url, {
          signal: controller.signal
        });
        clearTimeout(timeout);

        const responseTime = Date.now() - startTime;
        const data = await response.json().catch(() => ({}));

        return {
          ...worker,
          status: response.ok ? 'online' : 'degraded',
          healthy: response.ok,
          lastChecked: Date.now(),
          responseTime,
          uptime: data.uptime || null,
          phase: data.phase || null,
          error: response.ok ? null : `HTTP ${response.status}`
        };
      } catch (error: any) {
        return {
          ...worker,
          status: 'offline',
          healthy: false,
          lastChecked: Date.now(),
          responseTime: null,
          uptime: null,
          error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
      }
    })
  );

  // Calculate summary stats
  const online = workerStatuses.filter(w => w.status === 'online').length;
  const degraded = workerStatuses.filter(w => w.status === 'degraded').length;
  const offline = workerStatuses.filter(w => w.status === 'offline').length;
  const planned = workerStatuses.filter(w => w.status === 'planned').length;

  return c.json({
    workers: workerStatuses,
    summary: {
      total: workers.length,
      online,
      degraded,
      offline,
      planned,
      healthy: online === workers.filter(w => w.url).length
    },
    checkedAt: Date.now()
  }, 200);
});

// --- Phase 1 Routes ---

// Whitelist Webhook - Phase 1 hierarchy capture
app.post('/api/v1/whitelist', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { name, reference_id, phone_number, referrer_phone } = body;

  if (!name || !reference_id || !phone_number) {
    return c.json({ error: 'Missing required payload parameters' }, 400);
  }

  // Phase 1: Require referrer phone for hierarchy tracking
  if (!referrer_phone) {
    return c.json({ error: 'Referrer phone number required for hierarchy tracking' }, 400);
  }

  try {
    // Look up referrer to establish hierarchy
    let reporterId = null;
    let hierarchyDepth = 0;

    const referrerQuery = await c.env.DB.prepare(
      'SELECT id, hierarchy_depth FROM Users WHERE phone_number = ?'
    ).bind(referrer_phone).first();

    if (referrerQuery) {
      reporterId = referrerQuery.id;
      hierarchyDepth = (referrerQuery.hierarchy_depth as number || 0) + 1;
    }

    const userId = crypto.randomUUID();

    // Create user record with hierarchy
    await c.env.DB.prepare(
      'INSERT INTO Users (id, role, phone_number, reporter_id, hierarchy_depth) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'crony', phone_number, reporterId, hierarchyDepth).run();

    // Map the whitelist approval payload
    const sourceId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO Whitelisted_Sources (id, linked_user_id, verified_name, reference_id, approval_status) VALUES (?, ?, ?, ?, ?)'
    ).bind(sourceId, userId, name, reference_id, 'approved').run();

    return c.json({
      status: 'Whitelisted successfully',
      id: sourceId,
      hierarchy_depth: hierarchyDepth,
      reporter_id: reporterId
    }, 201);
  } catch (error) {
    return c.json({ error: 'Database transaction failed' }, 500);
  }
});

// Trusted Ingestion
app.post('/api/v1/reports/harvest', async (c: Context<{ Bindings: Env }>) => {
  const authPhone = c.req.header('Authorization');
  if (!authPhone) return c.json({ error: 'Missing authentication' }, 401);

  // Authenticate against Whitelist
  const userQuery = await c.env.DB.prepare(
    `SELECT u.id, w.approval_status FROM Users u 
     INNER JOIN Whitelisted_Sources w ON u.id = w.linked_user_id 
     WHERE u.phone_number = ?`
  ).bind(authPhone).first();

  if (!userQuery || userQuery.approval_status !== 'approved') {
    return c.json({ error: 'Unauthorized origin or unapproved whitelist state' }, 403);
  }

  // Parse Multi-Part Logic
  const formData = await c.req.formData();
  const media = formData.get('media');
  const latString = formData.get('latitude');
  const lonString = formData.get('longitude');

  if (!media || !(media instanceof File) || !latString || !lonString) {
      return c.json({ error: 'Invalid or missing field payload' }, 400);
  }

  const latitude = parseFloat(latString.toString());
  const longitude = parseFloat(lonString.toString());
  
  try {
    // Stage R2 blob
    const mediaId = crypto.randomUUID();
    const objectKey = `harvest/${mediaId}-${media.name}`;
    await c.env.VAULT.put(objectKey, await media.arrayBuffer());

    // Generate DIGIPIN using actual algorithm
    const digipin = latLngToDIGIPIN(latitude, longitude);
    const reportId = crypto.randomUUID();
    
    // Stage the D1 submission
    await c.env.DB.prepare(`
      INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(reportId, userQuery.id as string, latitude, longitude, digipin, `r2://${objectKey}`, 'approved')
      .run();

    return c.json({ status: 'Harvesting successful, Auto-Approved', digipin: digipin, id: reportId }, 200);

  } catch (e) {
    return c.json({ error: 'Failed to process harvest' }, 500);
  }
});

// --- Phase 2 Routes ---

// Fetch Board State (War Room / Crony List)
app.get('/api/v2/reports', async (c: Context<{ Bindings: Env }>) => {
  const reports = await c.env.DB.prepare('SELECT id, latitude, longitude, digipin, r2_image_url, status, severity_weight, created_at FROM Reports ORDER BY created_at DESC LIMIT 100').all();
  return c.json({ data: reports.results }, 200);
});

// Get bounties (reports needing action) with optional location filter
app.get('/api/v2/bounties', async (c: Context<{ Bindings: Env }>) => {
  const { lat, lon, radius = 10 } = c.req.query();
  
  let query = 'SELECT id, latitude, longitude, digipin, r2_image_url, status, severity_weight, created_at FROM Reports WHERE status IN (?, ?, ?, ?) ORDER BY created_at DESC';
  const params = ['pending', 'pending_review', 'assigned', 'fixed_pending_verification'];
  
  const reports = await c.env.DB.prepare(query).bind(...params).all();
  let results = reports.results;
  
  // Filter by distance if location provided
  if (lat && lon) {
    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const radiusKm = parseFloat(radius.toString());
    
    results = results.filter((report: any) => {
      const distance = haversine(userLat, userLon, report.latitude, report.longitude) / 1000; // Convert to km
      return distance <= radiusKm;
    });
    
    // Add distance to each result
    results = results.map((report: any) => ({
      ...report,
      distance: haversine(userLat, userLon, report.latitude, report.longitude) / 1000
    }));
  }
  
  return c.json({ data: results }, 200);
});

// OTPless token verification endpoint
app.post('/api/v2/auth/verify', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { token, phoneNumber, referrerPhone } = body;

  if (!token || !phoneNumber) {
    return c.json({ error: 'Missing token or phone number' }, 400);
  }

  try {
    // In production, verify the token with OTPLess API
    // For now, we'll accept the token and phone number as valid
    // TODO: Integrate with OTPLess verification API using c.env.OTPLESS_CLIENT_ID and c.env.OTPLESS_CLIENT_SECRET

    const userQuery = await c.env.DB.prepare(
      `SELECT u.id, u.role, u.region_scope, u.supervisor_id, u.reporter_id, u.hierarchy_depth, w.approval_status
       FROM Users u
       LEFT JOIN Whitelisted_Sources w ON u.id = w.linked_user_id
       WHERE u.phone_number = ?`
    ).bind(phoneNumber).first();

    if (!userQuery) {
      // Auto-create user if not exists (for Phase 2 public users)
      const userId = crypto.randomUUID();

      // If referrer provided, establish hierarchy
      let reporterId = null;
      let hierarchyDepth = 0;

      if (referrerPhone) {
        const referrerQuery = await c.env.DB.prepare(
          'SELECT id, hierarchy_depth FROM Users WHERE phone_number = ?'
        ).bind(referrerPhone).first();

        if (referrerQuery) {
          reporterId = referrerQuery.id;
          hierarchyDepth = (referrerQuery.hierarchy_depth as number || 0) + 1;
        }
      }

      await c.env.DB.prepare(
        'INSERT INTO Users (id, role, phone_number, reporter_id, hierarchy_depth) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, 'crony', phoneNumber, reporterId, hierarchyDepth).run();

      return c.json({
        id: userId,
        role: 'crony',
        phone_number: phoneNumber,
        region_scope: null,
        supervisor_id: null,
        reporter_id: reporterId,
        hierarchy_depth: hierarchyDepth,
        tags: [],
        status: 'authenticated',
        is_new_user: true
      }, 200);
    }

    if (userQuery.approval_status !== 'approved') {
      return c.json({ error: 'User not approved' }, 403);
    }

    // Get user tags
    const tagsQuery = await c.env.DB.prepare(
      `SELECT at.tag_name
       FROM UserTags ut
       JOIN AccountabilityTags at ON ut.tag_id = at.id
       WHERE ut.user_id = ?`
    ).bind(userQuery.id).all();

    const tags = tagsQuery.results?.map((row: any) => row.tag_name) || [];

    return c.json({
      id: userQuery.id,
      role: userQuery.role,
      phone_number: phoneNumber,
      region_scope: userQuery.region_scope,
      supervisor_id: userQuery.supervisor_id,
      reporter_id: userQuery.reporter_id || null,
      hierarchy_depth: userQuery.hierarchy_depth || 0,
      tags: tags,
      status: 'authenticated',
      is_new_user: false
    }, 200);

  } catch (error) {
    console.error('Auth verification error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Get user info by phone number (for area check authentication)
app.get('/api/v2/user/info', async (c: Context<{ Bindings: Env }>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'Missing authentication' }, 401);

  // Support both phone number (legacy) and Bearer token
  let phoneNumber = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    // Extract phone number from token (in production, verify token first)
    // For now, we'll assume the token contains the phone number
    phoneNumber = authHeader.replace('Bearer ', '');
  }

  const userQuery = await c.env.DB.prepare(
    `SELECT u.id, u.role, u.region_scope, u.supervisor_id, w.approval_status 
     FROM Users u 
     LEFT JOIN Whitelisted_Sources w ON u.id = w.linked_user_id 
     WHERE u.phone_number = ?`
  ).bind(phoneNumber).first();

  if (!userQuery) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (userQuery.approval_status !== 'approved') {
    return c.json({ error: 'User not approved' }, 403);
  }

  // Get user tags
  const tagsQuery = await c.env.DB.prepare(
    `SELECT at.tag_name 
     FROM UserTags ut 
     JOIN AccountabilityTags at ON ut.tag_id = at.id 
     WHERE ut.user_id = ?`
  ).bind(userQuery.id).all();

  const tags = tagsQuery.results?.map((row: any) => row.tag_name) || [];

  return c.json({
    id: userQuery.id,
    role: userQuery.role,
    region_scope: userQuery.region_scope,
    supervisor_id: userQuery.supervisor_id,
    phone_number: phoneNumber,
    tags: tags,
    status: 'authenticated'
  }, 200);
});

// Public Ingestion (Pluggable AI)
app.post('/api/v2/reports', async (c: Context<{ Bindings: Env }>) => {
  if (c.env.AI_ACTIVATED !== 'true') return c.json({ error: 'AI Phase Not Active' }, 403);

  const authPhone = c.req.header('Authorization');
  if (!authPhone) return c.json({ error: 'Missing authentication' }, 401);

  // Authenticate base user
  const userQuery = await c.env.DB.prepare('SELECT id FROM Users WHERE phone_number = ?').bind(authPhone).first();
  if (!userQuery) return c.json({ error: 'User not registered' }, 403);

  const formData = await c.req.formData();
  const media = formData.get('media');
  const latString = formData.get('latitude');
  const lonString = formData.get('longitude');

  if (!media || !(media instanceof File) || !latString || !lonString) return c.json({ error: 'Invalid payload' }, 400);

  const latitude = parseFloat(latString.toString());
  const longitude = parseFloat(lonString.toString());

  // Proxy to YOLO Microservice (Conceptual)
  // const yoloResponse = await fetch('https://yolo.prism.internal/infer', { method: 'POST', body: media });
  // const { confidence } = await yoloResponse.json();
  const confidence = 0.85; // Mock response

  if (confidence < 0.65) {
    return c.json({ error: 'Auto-Drop - low confidence score', appeal_required: true }, 406);
  }

  const mediaId = crypto.randomUUID();
  const objectKey = `reports/v2/${mediaId}-${media.name}`;
  await c.env.VAULT.put(objectKey, await media.arrayBuffer());

  const digipin = `DP-${latitude.toFixed(4).replace('.','')}${longitude.toFixed(4).replace('.','')}`.substring(0, 10);
  const reportId = crypto.randomUUID();
  
  const status = confidence >= 0.90 ? 'approved' : 'pending_review';

  await c.env.DB.prepare(`
    INSERT INTO Reports (id, reporter_id, latitude, longitude, digipin, r2_image_url, status, ai_confidence_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(reportId, userQuery.id as string, latitude, longitude, digipin, `r2://${objectKey}`, status, confidence)
    .run();

  return c.json({ status: `Ingested to ${status}`, report_id: reportId }, 200);
});

// Appeal Bypass
app.post('/api/v2/reports/appeal', async (c: Context<{ Bindings: Env }>) => {
    // Conceptual forced bypass identical to /v2/reports but skips YOLO fetch and forces status='pending_review'
    return c.json({ status: 'Appeal lodged manually' }, 201);
});

// Helper for Haversine
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Accountability Loop (Fix + Spatial Drift Check)
app.post('/api/v2/interventions/fix', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { report_id, contractor_id, repair_tier, fix_latitude, fix_longitude, r2_proof_url } = body;

  const report = await c.env.DB.prepare('SELECT latitude, longitude FROM Reports WHERE id = ?').bind(report_id).first();
  if (!report) return c.json({ error: 'Report not found' }, 404);

  const driftDistance = haversine(
    report.latitude as number, report.longitude as number,
    fix_latitude, fix_longitude
  );

  const interventionId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO Interventions (id, report_id, contractor_id, repair_tier, r2_proof_image_url, fix_latitude, fix_longitude, spatial_drift_calc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(interventionId, report_id, contractor_id, repair_tier, r2_proof_url, fix_latitude, fix_longitude, driftDistance).run();

  if (driftDistance <= 30.0) {
    await c.env.DB.prepare(`UPDATE Reports SET status = 'fixed_pending_verification' WHERE id = ?`).bind(report_id).run();
    return c.json({ status: 'Fix submitted, awaiting final crony verification', drift_meters: driftDistance }, 200);
  } else {
    // Human flag
    return c.json({ error: 'Spatial drift exceeded bounds. Flagged for review.', drift_meters: driftDistance }, 403);
  }
});

// Final Verification Loop (Crony Ground Truth)
app.post('/api/v2/interventions/verify', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { report_id, verifier_id, is_resolved, r2_verification_url } = body;

  const verificationId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO Verifications (id, report_id, verifier_id, r2_verification_image_url, is_resolved)
    VALUES (?, ?, ?, ?, ?)
  `).bind(verificationId, report_id, verifier_id, r2_verification_url, is_resolved ? 1 : 0).run();

  if (is_resolved) {
      await c.env.DB.prepare(`UPDATE Reports SET status = 'resolved' WHERE id = ?`).bind(report_id).run();
      return c.json({ status: 'Verification successful. Board resolved.' }, 200);
  } else {
      await c.env.DB.prepare(`UPDATE Reports SET status = 'pending_review' WHERE id = ?`).bind(report_id).run();
      return c.json({ status: 'Verification failed. Returned to Purgatory.' }, 200);
  }
});

// --- Geo-fence and Bounty Endpoints ---

// Get nearby geo-fences
app.get('/api/v1/geofences/nearby', async (c: Context<{ Bindings: Env }>) => {
  const { lat, lon, radius = 50 } = c.req.query();

  if (!lat || !lon) {
    return c.json({ error: 'Missing lat/lon parameters' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusMeters = parseFloat(radius.toString());

  try {
    // Get all active geo-fences
    const fences = await c.env.DB.prepare(
      `SELECT id, center_latitude, center_longitude, center_digipin, radius_meters, cluster_status, report_count
       FROM GeoFenceClusters
       WHERE cluster_status = 'active'`
    ).all();

    // Filter by distance
    const nearby = fences.results?.filter((fence: any) => {
      const distance = haversine(userLat, userLon, fence.center_latitude, fence.center_longitude);
      return distance <= radiusMeters;
    }).map((fence: any) => ({
      ...fence,
      distance: haversine(userLat, userLon, fence.center_latitude, fence.center_longitude)
    }));

    return c.json({ data: nearby }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch geo-fences' }, 500);
  }
});

// Get nearby bounties (reports needing verification)
app.get('/api/v1/bounties/nearby', async (c: Context<{ Bindings: Env }>) => {
  const { lat, lon, radius = 5 } = c.req.query();

  if (!lat || !lon) {
    return c.json({ error: 'Missing lat/lon parameters' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusMeters = parseFloat(radius.toString()) * 1000; // km to m

  try {
    // Get reports that need verification (fixed_pending_verification status)
    const reports = await c.env.DB.prepare(
      `SELECT r.id, r.latitude, r.longitude, r.digipin, r.r2_image_url, r.status, r.severity_weight, r.created_at
       FROM Reports r
       WHERE r.status = 'fixed_pending_verification'
       ORDER BY r.created_at DESC`
    ).all();

    // Filter by distance
    const nearby = reports.results?.filter((report: any) => {
      const distance = haversine(userLat, userLon, report.latitude, report.longitude);
      return distance <= radiusMeters;
    }).map((report: any) => ({
      ...report,
      distance: haversine(userLat, userLon, report.latitude, report.longitude) / 1000, // in km
      bounty_amount: 5 + Math.floor(Math.random() * 5) // ₹5-10
    }));

    // Create bounty entries for any that don't exist
    for (const report of nearby) {
      const existingBounty = await c.env.DB.prepare(
        'SELECT id FROM VerificationBounties WHERE report_id = ? AND bounty_status = ?'
      ).bind(report.id, 'available').first();

      if (!existingBounty) {
        const bountyId = crypto.randomUUID();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        await c.env.DB.prepare(
          `INSERT INTO VerificationBounties (id, report_id, bounty_amount, bounty_status, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(bountyId, report.id, report.bounty_amount, 'available', expiresAt).run();
      }
    }

    return c.json({ data: nearby }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch bounties' }, 500);
  }
});

// Claim a bounty
app.post('/api/v1/bounties/claim', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { bounty_id, verifier_phone } = body;

  if (!bounty_id || !verifier_phone) {
    return c.json({ error: 'Missing bounty_id or verifier_phone' }, 400);
  }

  try {
    // Get verifier user
    const verifier = await c.env.DB.prepare(
      'SELECT id FROM Users WHERE phone_number = ?'
    ).bind(verifier_phone).first();

    if (!verifier) {
      return c.json({ error: 'Verifier not found' }, 404);
    }

    // Check if bounty is still available
    const bounty = await c.env.DB.prepare(
      `SELECT id, report_id, bounty_amount, bounty_status, expires_at
       FROM VerificationBounties
       WHERE id = ? AND bounty_status = 'available' AND expires_at > ?`
    ).bind(bounty_id, Date.now()).first();

    if (!bounty) {
      return c.json({ error: 'Bounty not available or expired' }, 404);
    }

    // Claim the bounty (15 minute lock)
    const claimExpiresAt = Date.now() + 15 * 60 * 1000;

    await c.env.DB.prepare(
      `UPDATE VerificationBounties
       SET bounty_status = 'claimed', claimed_by = ?, claimed_at = ?
       WHERE id = ?`
    ).bind(verifier.id, Date.now(), bounty_id).run();

    return c.json({
      status: 'Bounty claimed',
      bounty_id,
      report_id: bounty.report_id,
      bounty_amount: bounty.bounty_amount,
      claim_expires_at: claimExpiresAt
    }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to claim bounty' }, 500);
  }
});

// Submit verification with spatial drift check
app.post('/api/v1/verifications', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { bounty_id, verifier_phone, image_data_url, verification_latitude, verification_longitude } = body;

  if (!bounty_id || !verifier_phone || !verification_latitude || !verification_longitude) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  try {
    // Get verifier
    const verifier = await c.env.DB.prepare(
      'SELECT id FROM Users WHERE phone_number = ?'
    ).bind(verifier_phone).first();

    if (!verifier) {
      return c.json({ error: 'Verifier not found' }, 404);
    }

    // Get bounty and report
    const bounty = await c.env.DB.prepare(
      `SELECT vb.*, r.latitude, r.longitude
       FROM VerificationBounties vb
       JOIN Reports r ON vb.report_id = r.id
       WHERE vb.id = ? AND vb.claimed_by = ?`
    ).bind(bounty_id, verifier.id).first();

    if (!bounty) {
      return c.json({ error: 'Bounty not found or not claimed by you' }, 404);
    }

    // Calculate spatial drift
    const driftMeters = haversine(
      bounty.latitude,
      bounty.longitude,
      verification_latitude,
      verification_longitude
    );

    const driftThreshold = 30; // 30 meters
    const driftExceeded = driftMeters > driftThreshold;

    // Store verification
    const verificationId = crypto.randomUUID();

    await c.env.DB.prepare(
      `INSERT INTO BountyVerifications
       (id, bounty_id, verifier_id, r2_verification_image_url, verification_latitude, verification_longitude,
        spatial_drift_calc, drift_exceeded, verification_result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      verificationId,
      bounty_id,
      verifier.id,
      image_data_url,
      verification_latitude,
      verification_longitude,
      driftMeters,
      driftExceeded ? 1 : 0,
      driftExceeded ? 'manual_review' : 'pending'
    ).run();

    // If within threshold, auto-approve
    if (!driftExceeded) {
      await c.env.DB.prepare(
        `UPDATE VerificationBounties SET bounty_status = 'completed', completed_at = ?
         WHERE id = ?`
      ).bind(Date.now(), bounty_id).run();

      await c.env.DB.prepare(
        `UPDATE Reports SET status = 'resolved' WHERE id = ?`
      ).bind(bounty.report_id).run();

      // Credit reward (TODO: implement actual reward system)
      return c.json({
        status: 'Verification successful',
        verification_id: verificationId,
        drift_meters: driftMeters,
        reward_credited: true,
        bounty_amount: bounty.bounty_amount
      }, 200);
    } else {
      // Flag for manual review
      await c.env.DB.prepare(
        `UPDATE VerificationBounties SET bounty_status = 'completed' WHERE id = ?`
      ).bind(bounty_id).run();

      return c.json({
        status: 'Verification submitted for manual review',
        verification_id: verificationId,
        drift_meters: driftMeters,
        drift_exceeded: true,
        reward_credited: false
      }, 200);
    }
  } catch (error) {
    return c.json({ error: 'Failed to submit verification' }, 500);
  }
});

// Get hierarchy subtree (for access control)
app.get('/api/v1/hierarchy/subtree/:userId', async (c: Context<{ Bindings: Env }>) => {
  const userId = c.req.param('userId');

  try {
    // Recursive CTE to get all descendants
    const descendants = await c.env.DB.prepare(
      `WITH RECURSIVE hierarchy_tree AS (
        SELECT id, phone_number, role, reporter_id, hierarchy_depth
        FROM Users
        WHERE id = ?
        UNION ALL
        SELECT u.id, u.phone_number, u.role, u.reporter_id, u.hierarchy_depth
        FROM Users u
        INNER JOIN hierarchy_tree ht ON u.reporter_id = ht.id
      )
      SELECT * FROM hierarchy_tree`
    ).bind(userId).all();

    return c.json({ data: descendants.results }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch hierarchy' }, 500);
  }
});

// Get hierarchy tree (for visualization)
app.get('/api/v1/hierarchy/tree', async (c: Context<{ Bindings: Env }>) => {
  try {
    // Get all users with hierarchy info
    const users = await c.env.DB.prepare(
      `SELECT id, phone_number, role, reporter_id, hierarchy_depth
       FROM Users
       WHERE reporter_id IS NOT NULL OR hierarchy_depth = 0
       ORDER BY hierarchy_depth ASC`
    ).all();

    // Build tree structure
    const userMap = new Map();
    const rootNodes: any[] = [];

    // First pass: create map
    for (const user of (users.results || [])) {
      userMap.set(user.id, { ...user, children: [] });
    }

    // Second pass: build tree
    for (const user of (users.results || [])) {
      const node = userMap.get(user.id);
      if (user.reporter_id && userMap.has(user.reporter_id)) {
        userMap.get(user.reporter_id).children.push(node);
      } else if (user.hierarchy_depth === 0) {
        rootNodes.push(node);
      }
    }

    return c.json({ nodes: rootNodes }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch hierarchy tree' }, 500);
  }
});

// Get nearby reports (for mini-map overlay)
app.get('/api/v1/reports/nearby', async (c: Context<{ Bindings: Env }>) => {
  const { lat, lon, radius = 200 } = c.req.query();

  if (!lat || !lon) {
    return c.json({ error: 'Missing lat/lon parameters' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusMeters = parseFloat(radius.toString());

  try {
    const reports = await c.env.DB.prepare(
      `SELECT id, latitude, longitude, digipin, status, severity_weight, created_at
       FROM Reports
       WHERE status != 'resolved'
       ORDER BY created_at DESC
       LIMIT 100`
    ).all();

    // Filter by distance
    const nearby = reports.results?.filter((report: any) => {
      const distance = haversine(userLat, userLon, report.latitude, report.longitude);
      return distance <= radiusMeters;
    }).map((report: any) => ({
      ...report,
      distance: haversine(userLat, userLon, report.latitude, report.longitude)
    }));

    return c.json({ data: nearby }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch nearby reports' }, 500);
  }
});

// Get users by role (for contractor deployment)
app.get('/api/v1/users', async (c: Context<{ Bindings: Env }>) => {
  const { role } = c.req.query();

  try {
    let query = 'SELECT id, phone_number, role, hierarchy_depth FROM Users';
    const params: string[] = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    query += ' ORDER BY hierarchy_depth ASC';

    const users = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({ users: users.results }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Deploy contractor to incident
app.post('/api/v1/deployments', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { report_id, contractor_id } = body;

  if (!report_id || !contractor_id) {
    return c.json({ error: 'Missing report_id or contractor_id' }, 400);
  }

  try {
    // Update report status to assigned
    await c.env.DB.prepare(
      `UPDATE Reports SET status = 'assigned' WHERE id = ?`
    ).bind(report_id).run();

    // Create deployment record (using Interventions table as deployment log)
    const deploymentId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO Interventions (id, report_id, contractor_id, repair_tier, spatial_drift_calc)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(deploymentId, report_id, contractor_id, 1, 0).run();

    return c.json({
      status: 'Contractor deployed',
      deployment_id: deploymentId,
      report_id,
      contractor_id
    }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to deploy contractor' }, 500);
  }
});

// Get AI review queue (Phase 2 placeholder)
app.get('/api/v1/reports/ai-review', async (c: Context<{ Bindings: Env }>) => {
  try {
    const reports = await c.env.DB.prepare(
      `SELECT id, digipin, latitude, longitude, ai_confidence_score, created_at
       FROM Reports
       WHERE status = 'pending_review' AND ai_confidence_score >= 0.65 AND ai_confidence_score < 0.90
       ORDER BY created_at DESC`
    ).all();

    return c.json({ reports: reports.results || [] }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch AI review queue' }, 500);
  }
});

// Approve AI review report
app.post('/api/v1/reports/:id/approve', async (c: Context<{ Bindings: Env }>) => {
  const reportId = c.req.param('id');

  try {
    await c.env.DB.prepare(
      `UPDATE Reports SET status = 'approved' WHERE id = ?`
    ).bind(reportId).run();

    return c.json({ status: 'Report approved' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to approve report' }, 500);
  }
});

// Reject AI review report
app.post('/api/v1/reports/:id/reject', async (c: Context<{ Bindings: Env }>) => {
  const reportId = c.req.param('id');

  try {
    await c.env.DB.prepare(
      `UPDATE Reports SET status = 'rejected' WHERE id = ?`
    ).bind(reportId).run();

    return c.json({ status: 'Report rejected' }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to reject report' }, 500);
  }
});

// Batch verification for geo-fence clusters
app.post('/api/v1/geofences/batch-verify', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { geofence_id, verifier_phone, reports } = body;

  if (!geofence_id || !verifier_phone || !reports || !Array.isArray(reports)) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  try {
    const verifier = await c.env.DB.prepare(
      'SELECT id FROM Users WHERE phone_number = ?'
    ).bind(verifier_phone).first();

    if (!verifier) {
      return c.json({ error: 'Verifier not found' }, 404);
    }

    const results = [];

    for (const report of reports) {
      const { report_id, is_resolved, verification_latitude, verification_longitude } = report;

      // Get original report
      const original = await c.env.DB.prepare(
        'SELECT latitude, longitude FROM Reports WHERE id = ?'
      ).bind(report_id).first();

      if (!original) continue;

      // Calculate drift
      const driftMeters = haversine(
        original.latitude as number,
        original.longitude as number,
        verification_latitude,
        verification_longitude
      );

      // Create verification
      const verificationId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO Verifications (id, report_id, verifier_id, is_resolved)
         VALUES (?, ?, ?, ?)`
      ).bind(verificationId, report_id, verifier.id, is_resolved ? 1 : 0).run();

      // Update report status
      const newStatus = is_resolved ? 'resolved' : 'pending_review';
      await c.env.DB.prepare(
        `UPDATE Reports SET status = ? WHERE id = ?`
      ).bind(newStatus, report_id).run();

      results.push({
        report_id,
        verification_id: verificationId,
        drift_meters: driftMeters,
        new_status: newStatus
      });
    }

    // Update geo-fence status
    await c.env.DB.prepare(
      `UPDATE GeoFenceClusters SET cluster_status = 'verified', verified_at = ? WHERE id = ?`
    ).bind(Date.now(), geofence_id).run();

    return c.json({
      status: 'Batch verification complete',
      geofence_id,
      verified_count: results.length,
      results
    }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to batch verify' }, 500);
  }
});

// Get reports in a geo-fence cluster
app.get('/api/v1/geofences/:clusterId/reports', async (c: Context<{ Bindings: Env }>) => {
  const clusterId = c.req.param('clusterId');

  try {
    // Get cluster info
    const cluster = await c.env.DB.prepare(
      'SELECT center_latitude, center_longitude, radius_meters FROM GeoFenceClusters WHERE id = ?'
    ).bind(clusterId).first();

    if (!cluster) {
      return c.json({ error: 'Cluster not found' }, 404);
    }

    // Get all reports and filter by distance
    const reports = await c.env.DB.prepare(
      `SELECT id, latitude, longitude, digipin, status, severity_weight, created_at
       FROM Reports
       WHERE status != 'resolved'
       ORDER BY created_at DESC`
    ).all();

    const nearby = reports.results?.filter((report: any) => {
      const distance = haversine(
        cluster.center_latitude as number,
        cluster.center_longitude as number,
        report.latitude,
        report.longitude
      );
      return distance <= (cluster.radius_meters as number);
    });

    return c.json({ reports: nearby }, 200);
  } catch (error) {
    return c.json({ error: 'Failed to fetch cluster reports' }, 500);
  }
});

// --- Contractor Real-Time Location Tracking Endpoints ---

// WebSocket endpoint for real-time contractor locations
app.get('/api/v1/contractors/locations/ws', async (c: Context<{ Bindings: Env }>) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected websocket' }, 400);
  }

  // Get role from query params
  const role = c.req.query('role') || 'contractor';
  const contractorId = c.req.query('contractorId');

  // Get the Durable Object
  const id = c.env.CONTRACTOR_LOCATIONS.idFromName('global');
  const contractorLocationObject = c.env.CONTRACTOR_LOCATIONS.get(id);

  // Forward the request to the Durable Object
  const url = new URL(c.req.url);
  url.searchParams.set('role', role);
  if (contractorId) {
    url.searchParams.set('contractorId', contractorId);
  }

  const request = new Request(url.toString(), {
    headers: c.req.raw.headers,
    method: c.req.method
  });

  return contractorLocationObject.fetch(request);
});

// Get all contractor locations (HTTP fallback)
app.get('/api/v1/contractors/locations', async (c: Context<{ Bindings: Env }>) => {
  try {
    const id = c.env.CONTRACTOR_LOCATIONS.idFromName('global');
    const contractorLocationObject = c.env.CONTRACTOR_LOCATIONS.get(id);

    const response = await contractorLocationObject.fetch(
      new URL('/locations', c.req.url).toString()
    );

    const data = await response.json();
    return c.json(data, 200);
  } catch (error) {
    console.error('Error fetching contractor locations:', error);
    return c.json({ error: 'Failed to fetch contractor locations' }, 500);
  }
});

// Update contractor location
app.post('/api/v1/contractors/location', async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json();
    const { id, phone_number, latitude, longitude, accuracy, status, name } = body;

    if (!id || !phone_number || latitude === undefined || longitude === undefined) {
      return c.json({ error: 'Missing required fields: id, phone_number, latitude, longitude' }, 400);
    }

    const contractorLocation = {
      id,
      phone_number,
      name,
      latitude,
      longitude,
      accuracy,
      status: status || 'online',
      lastSeen: Date.now()
    };

    const id_obj = c.env.CONTRACTOR_LOCATIONS.idFromName('global');
    const contractorLocationObject = c.env.CONTRACTOR_LOCATIONS.get(id_obj);

    const response = await contractorLocationObject.fetch(
      new URL('/location', c.req.url).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractor: contractorLocation })
      }
    );

    const data = await response.json();
    return c.json(data, 200);
  } catch (error) {
    console.error('Error updating contractor location:', error);
    return c.json({ error: 'Failed to update contractor location' }, 500);
  }
});

// Update contractor status
app.post('/api/v1/contractors/status', async (c: Context<{ Bindings: Env }>) => {
  try {
    const body = await c.req.json();
    const { contractorId, status, assignedReportId } = body;

    if (!contractorId || !status) {
      return c.json({ error: 'Missing required fields: contractorId, status' }, 400);
    }

    const id = c.env.CONTRACTOR_LOCATIONS.idFromName('global');
    const contractorLocationObject = c.env.CONTRACTOR_LOCATIONS.get(id);

    const response = await contractorLocationObject.fetch(
      new URL('/status', c.req.url).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId, status, assignedReportId })
      }
    );

    const data = await response.json();
    return c.json(data, 200);
  } catch (error) {
    console.error('Error updating contractor status:', error);
    return c.json({ error: 'Failed to update contractor status' }, 500);
  }
});

// Get contractors near a location
app.get('/api/v1/contractors/nearby', async (c: Context<{ Bindings: Env }>) => {
  const { lat, lon, radius = 5, status } = c.req.query();

  if (!lat || !lon) {
    return c.json({ error: 'Missing lat/lon parameters' }, 400);
  }

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const radiusKm = parseFloat(radius.toString());

  try {
    // Get all active contractors
    const id = c.env.CONTRACTOR_LOCATIONS.idFromName('global');
    const contractorLocationObject = c.env.CONTRACTOR_LOCATIONS.get(id);

    const response = await contractorLocationObject.fetch(
      new URL('/locations', c.req.url).toString()
    );

    const data = await response.json() as { contractors: any[] };
    let contractors = data.contractors || [];

    // Filter by status if provided
    if (status) {
      contractors = contractors.filter(c => c.status === status);
    }

    // Filter by distance and add distance field
    const nearby = contractors
      .filter((contractor: any) => {
        const distance = haversine(userLat, userLon, contractor.latitude, contractor.longitude) / 1000; // km
        return distance <= radiusKm;
      })
      .map((contractor: any) => ({
        ...contractor,
        distance: haversine(userLat, userLon, contractor.latitude, contractor.longitude) / 1000
      }))
      .sort((a: any, b: any) => a.distance - b.distance);

    return c.json({
      contractors: nearby,
      count: nearby.length,
      search_location: { lat: userLat, lon: userLon, radius_km: radiusKm }
    }, 200);
  } catch (error) {
    console.error('Error fetching nearby contractors:', error);
    return c.json({ error: 'Failed to fetch nearby contractors' }, 500);
  }
});

// ============================================
// SUPERTOKENS AUTHENTICATION ENDPOINTS
// ============================================

// Handle SuperTokens sign-in/up callback
// This endpoint is called after SuperTokens verifies the OTP
app.post('/auth/signinup', async (c: Context<{ Bindings: Env }>) => {
  const useSuperTokens = isSuperTokensEnabled(c.env.USE_SUPERTOKENS_AUTH);
  if (!useSuperTokens) {
    return c.json({ error: 'SuperTokens authentication is disabled' }, 503);
  }

  try {
    const body = await c.req.json();
    const { phoneNumber, supertokensUserId, referrerPhone } = body;

    if (!phoneNumber || !supertokensUserId) {
      return c.json({ error: 'Missing phone number or SuperTokens user ID' }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      `SELECT u.id, u.role, u.region_scope, u.supervisor_id, u.reporter_id, u.hierarchy_depth, 
              u.supertokens_user_id, w.approval_status
       FROM Users u
       LEFT JOIN Whitelisted_Sources w ON u.id = w.linked_user_id
       WHERE u.phone_number = ?`
    ).bind(phoneNumber).first();

    if (existingUser) {
      // Update SuperTokens user ID if not already set
      if (!existingUser.supertokens_user_id) {
        await c.env.DB.prepare(
          'UPDATE Users SET supertokens_user_id = ? WHERE id = ?'
        ).bind(supertokensUserId, existingUser.id).run();
      }

      if (existingUser.approval_status !== 'approved') {
        return c.json({ error: 'User not approved' }, 403);
      }

      // Get user tags
      const tagsQuery = await c.env.DB.prepare(
        `SELECT at.tag_name
         FROM UserTags ut
         JOIN AccountabilityTags at ON ut.tag_id = at.id
         WHERE ut.user_id = ?`
      ).bind(existingUser.id).all();

      const tags = tagsQuery.results?.map((row: any) => row.tag_name) || [];

      return c.json({
        id: existingUser.id,
        role: existingUser.role,
        phone_number: phoneNumber,
        region_scope: existingUser.region_scope,
        supervisor_id: existingUser.supervisor_id,
        reporter_id: existingUser.reporter_id || null,
        hierarchy_depth: existingUser.hierarchy_depth || 0,
        tags: tags,
        status: 'authenticated',
        is_new_user: false,
        supertokens_user_id: supertokensUserId
      }, 200);
    }

    // Create new user
    const userId = crypto.randomUUID();

    // Handle referrer hierarchy
    let reporterId = null;
    let hierarchyDepth = 0;

    if (referrerPhone) {
      const referrerQuery = await c.env.DB.prepare(
        'SELECT id, hierarchy_depth FROM Users WHERE phone_number = ?'
      ).bind(referrerPhone).first();

      if (referrerQuery) {
        reporterId = referrerQuery.id;
        hierarchyDepth = (referrerQuery.hierarchy_depth as number || 0) + 1;
      }
    }

    // Insert new user with SuperTokens mapping
    await c.env.DB.prepare(
      'INSERT INTO Users (id, role, phone_number, supertokens_user_id, reporter_id, hierarchy_depth) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, 'crony', phoneNumber, supertokensUserId, reporterId, hierarchyDepth).run();

    // Store PRISM-specific metadata in SuperTokens
    try {
      await SuperTokens.setUserMetadata(supertokensUserId, {
        role: 'crony',
        hierarchy_depth: hierarchyDepth,
        reporter_id: reporterId,
        region_scope: null,
        prism_user_id: userId
      });
    } catch (metadataError) {
      console.error('Failed to set user metadata:', metadataError);
      // Continue anyway - metadata is not critical
    }

    return c.json({
      id: userId,
      role: 'crony',
      phone_number: phoneNumber,
      region_scope: null,
      supervisor_id: null,
      reporter_id: reporterId,
      hierarchy_depth: hierarchyDepth,
      tags: [],
      status: 'authenticated',
      is_new_user: true,
      supertokens_user_id: supertokensUserId
    }, 200);

  } catch (error) {
    console.error('SuperTokens sign-in/up error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Get current user info from SuperTokens session
app.get('/auth/me', async (c: Context<{ Bindings: Env }>) => {
  const useSuperTokens = isSuperTokensEnabled(c.env.USE_SUPERTOKENS_AUTH);
  if (!useSuperTokens) {
    return c.json({ error: 'SuperTokens authentication is disabled' }, 503);
  }

  try {
    const session = await Session.getSession(c.req.raw, { sessionRequired: true });
    const supertokensUserId = session.getUserId();

    // Get user from database using SuperTokens user ID
    const userQuery = await c.env.DB.prepare(
      `SELECT u.id, u.role, u.phone_number, u.region_scope, u.supervisor_id, 
              u.reporter_id, u.hierarchy_depth, w.approval_status
       FROM Users u
       LEFT JOIN Whitelisted_Sources w ON u.id = w.linked_user_id
       WHERE u.supertokens_user_id = ?`
    ).bind(supertokensUserId).first();

    if (!userQuery) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (userQuery.approval_status !== 'approved') {
      return c.json({ error: 'User not approved' }, 403);
    }

    // Get user tags
    const tagsQuery = await c.env.DB.prepare(
      `SELECT at.tag_name
       FROM UserTags ut
       JOIN AccountabilityTags at ON ut.tag_id = at.id
       WHERE ut.user_id = ?`
    ).bind(userQuery.id).all();

    const tags = tagsQuery.results?.map((row: any) => row.tag_name) || [];

    return c.json({
      id: userQuery.id,
      role: userQuery.role,
      phone_number: userQuery.phone_number,
      region_scope: userQuery.region_scope,
      supervisor_id: userQuery.supervisor_id,
      reporter_id: userQuery.reporter_id || null,
      hierarchy_depth: userQuery.hierarchy_depth || 0,
      tags: tags,
      status: 'authenticated',
      supertokens_user_id: supertokensUserId
    }, 200);

  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({ error: 'Unauthorized' }, 401);
  }
});

// Sign out endpoint
app.post('/auth/signout', async (c: Context<{ Bindings: Env }>) => {
  const useSuperTokens = isSuperTokensEnabled(c.env.USE_SUPERTOKENS_AUTH);
  if (!useSuperTokens) {
    return c.json({ error: 'SuperTokens authentication is disabled' }, 503);
  }

  try {
    const session = await Session.getSession(c.req.raw, { sessionRequired: false });
    if (session) {
      await session.revokeSession();
    }
    return c.json({ message: 'Signed out successfully' }, 200);
  } catch (error) {
    console.error('Sign out error:', error);
    return c.json({ message: 'Signed out successfully' }, 200);
  }
});

export default app;

// Export the Durable Object class
export { ContractorLocationObject };

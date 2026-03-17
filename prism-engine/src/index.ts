import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';

export type Env = {
  DB: D1Database;
  VAULT: R2Bucket;
  AI_ACTIVATED: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Basic health check
app.get('/health', (c: Context<{ Bindings: Env }>) => c.json({ status: 'online', phase: c.env.AI_ACTIVATED === 'true' ? 2 : 1 }));

// --- Phase 1 Routes ---

// Whitelist Webhook
app.post('/api/v1/whitelist', async (c: Context<{ Bindings: Env }>) => {
  const body = await c.req.json();
  const { name, reference_id, phone_number } = body;

  if (!name || !reference_id || !phone_number) {
    return c.json({ error: 'Missing required payload parameters' }, 400);
  }

  try {
    const userId = crypto.randomUUID();
    
    // Create fundamental user record
    await c.env.DB.prepare('INSERT INTO Users (id, role, phone_number) VALUES (?, ?, ?)')
      .bind(userId, 'crony', phone_number)
      .run();

    // Map the whitelist approval payload
    const sourceId = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO Whitelisted_Sources (id, linked_user_id, verified_name, reference_id, approval_status) VALUES (?, ?, ?, ?, ?)')
      .bind(sourceId, userId, name, reference_id, 'approved')
      .run();

    return c.json({ status: 'Whitelisted successfully', id: sourceId }, 201);
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

    // Generate pseudo-DIGIPIN format logic (MapmyIndia abstraction)
    const digipin = `DP-${latitude.toFixed(4).replace('.','')}${longitude.toFixed(4).replace('.','')}`.substring(0, 10);
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

export default app;

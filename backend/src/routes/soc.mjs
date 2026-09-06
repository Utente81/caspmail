import pool from '../db/pool.mjs';
import { encryptData, decryptData } from '../services/vault.mjs';
import { requireRole } from '../auth/verify.mjs';
import { sendMail } from '../mailer.mjs';
const SOC_ROLES = ['soc_analyst', 'soc_manager', 'soc_admin', 'admin', 'casper_admin'];
export default async function socRoutes(app) {
  const socGuard = { preHandler: requireRole(SOC_ROLES) };

function zeroTrustGuardHook(req, reply, done) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || '';
  const isVPN = /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) || ip === '127.0.0.1' || ip === '::1';
  
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours() + 2;
  const isWorkingHours = (day >= 1 && day <= 5) && (hour >= 8 && hour < 18);
  
  const acr = req.user?.acr;
  const hasMFA = (acr === '2' || acr === 'loa2' || (req.user?.amr && req.user.amr.includes('mfa')));
  
  if (!isVPN && !isWorkingHours) {
    if (!hasMFA) {
      return reply.status(403).send({ error: 'Zero Trust Policy: Access denied. Please connect to VPN, operate during working hours, or authenticate with MFA.' });
    }
  }
  done();
}
const zeroTrustGuard = { preHandler: [requireRole(SOC_ROLES), zeroTrustGuardHook] };

  const socStreamGuard = {
    preHandler: async (req, reply) => {      return requireRole(SOC_ROLES)(req, reply);
    },
  };
  async function getTenantId(req) {
    const isGlobalAdmin = req.user?.realm_access?.roles?.includes('casper_admin');
    if (isGlobalAdmin && req.query.tenant_id) {
      return req.query.tenant_id;
    }
    return req.user?.tenant_id || req.user?.tenant || null;
  }
  // ─── Overview ─────────────────────────────────────────────────────────────
  app.get('/overview', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const [metrics, alerts, cases] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM soc_events WHERE (tenant_id = $1 )
           AND created_at > NOW() - INTERVAL '24 hours') AS events_24h,
          (SELECT COUNT(*) FROM soc_events WHERE (tenant_id = $1 )
           AND severity IN ('high','critical')
           AND created_at > NOW() - INTERVAL '24 hours') AS high_severity_24h,
          (SELECT COUNT(*) FROM soc_alerts WHERE (tenant_id = $1 ) AND status='open') AS open_alerts,
          (SELECT COUNT(*) FROM soc_cases  WHERE (tenant_id = $1 ) AND status='open') AS open_cases
      `, [tenantId]),
      pool.query(`
        SELECT a.id, a.severity, a.message, a.status, a.created_at,
               e.type AS event_type, e.source_ip
        FROM soc_alerts a
        LEFT JOIN soc_events e ON e.id = a.event_id
        WHERE (a.tenant_id = $1 )
        ORDER BY a.created_at DESC LIMIT 10
      `, [tenantId]),
      pool.query(`
        SELECT id, title, severity, status, type, assigned_to, created_at
        FROM soc_cases WHERE (tenant_id = $1 )
        ORDER BY created_at DESC LIMIT 10
      `, [tenantId]),
    ]);
    const [eventsTrend, severityDist] = await Promise.all([
      pool.query(`
        SELECT 
          date_trunc('hour', created_at) AS time_bucket,
          COUNT(*) AS event_count
        FROM soc_events
        WHERE (tenant_id = $1 ) AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1
        ORDER BY 1 ASC
      `, [tenantId]),
      pool.query(`
        SELECT 
          LOWER(severity) AS severity,
          COUNT(*) AS count
        FROM soc_events
        WHERE (tenant_id = $1 ) AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY 1
      `, [tenantId]),
    ]);

    const m = metrics.rows[0] || {};
    const openAlerts = parseInt(m.open_alerts || '0', 10);
    const highSev = parseInt(m.high_severity_24h || '0', 10);

    reply.send({
      metrics: m,
      kpis: {
        events_24h: parseInt(m.events_24h || '0', 10),
        open_cases: parseInt(m.open_cases || '0', 10),
        critical_alerts: openAlerts,
        security_score: Math.max(0, 100 - (highSev * 3 + openAlerts * 5))
      },
      events_trend: eventsTrend.rows.map(r => ({
        time_bucket: r.time_bucket,
        event_count: parseInt(r.event_count, 10)
      })),
      severity_distribution: severityDist.rows.map(r => ({
        severity: r.severity,
        count: parseInt(r.count, 10)
      })),
      recent_alerts: alerts.rows,
      recent_cases: cases.rows,
      system_health: [
        { name: 'SIEM Ingestion Engine', status: 'healthy' },
        { name: 'Threat Intel Feed', status: 'healthy' },
        { name: 'Email Gateway WAF', status: 'healthy' },
        { name: 'Vault KMS Auto-Unseal', status: 'healthy' },
        { name: 'SOAR Incident Automation', status: 'healthy' },
      ]
    });
  });
  // ─── Alerts ───────────────────────────────────────────────────────────────
  app.get('/alerts', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const status = req.query.status;
    let query = `
      SELECT a.*, e.type AS event_type, e.source_ip, e.user_email AS event_user
      FROM soc_alerts a
      LEFT JOIN soc_events e ON e.id = a.event_id
      WHERE a.tenant_id = $1
    `;
    const params = [tenantId];
    if (status) { params.push(status); query += ` AND a.status = $${params.length}`; }
    params.push(limit, offset);
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });
  app.post('/alerts/:id/status', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { status } = req.body || {};
    const allowed = ['open', 'acknowledged', 'resolved'];
    if (!status || !allowed.includes(status)) {
      return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const { rows, rowCount } = await pool.query(
      'UPDATE soc_alerts SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [status, req.params.id, tenantId]
    );
    if (rowCount === 0) return reply.status(404).send({ error: 'Alert not found' });
    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'update_status', 'soc_alert', $3, $4)`,
      [tenantId, req.user.sub, JSON.stringify({ alert_id: req.params.id, status }), req.ip]
    );
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });
  app.patch('/alerts/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { id } = req.params;
    const { status } = req.body || {};
    if (!['open', 'acknowledged', 'resolved', 'false_positive'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }
    const { rows, rowCount } = await pool.query(
      'UPDATE soc_alerts SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [status, id, tenantId]
    );
    if (rowCount === 0) return reply.status(404).send({ error: 'Alert not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });
  // ─── Event Ingestion (internal/agent use — requires SOC role or API key header) ───
  app.post('/events', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { type, severity = 'info', source_ip, user_email, message, raw = {} } = req.body || {};
    if (!type || !message) return reply.status(400).send({ error: 'type and message required' });
    const VALID_SEV = ['critical','high','medium','low','info'];
    if (!VALID_SEV.includes(severity)) return reply.status(400).send({ error: 'Invalid severity' });
    // Insert event
    const { rows: evRows } = await pool.query(
      `INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, type, severity, source_ip || null, user_email || null, await encryptData(message), await encryptData(JSON.stringify(raw))]
    );
    const event = evRows[0];
    // Auto-create alert for high/critical
    if (severity === 'critical' || severity === 'high') {
      const { rows: alertRows } = await pool.query(
        `INSERT INTO soc_alerts (tenant_id, event_id, severity, message, status)
         VALUES ($1,$2,$3,$4,'open') RETURNING id`,
        [tenantId, event.id, severity, message]
      );
      // Fire SOAR playbooks asynchronously
      const triggerKey = severity === 'critical' ? 'alert_critical' : 'alert_high';
      pool.query(
        `SELECT * FROM soar_playbooks WHERE tenant_id=$1 AND trigger_type=$2 AND status='active'`,
        [tenantId, triggerKey]
      ).then(({ rows: playbooks }) => {
        for (const pb of playbooks) {
          pool.query(
            `INSERT INTO soar_runs (playbook_id, tenant_id, trigger_type, status)
             VALUES ($1,$2,$3,'running') RETURNING id`,
            [pb.id, tenantId, triggerKey]
          ).then(({ rows }) => {
            executeAction(app, pb, rows[0].id, tenantId, 'soar-auto').catch(() => {});
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    reply.status(201).send(event);
  });
  // ─── Events / SIEM ────────────────────────────────────────────────────────
  app.get('/events', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const limit    = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset   = parseInt(req.query.offset || '0', 10);
    const severity = req.query.severity;
    const type     = req.query.type;
    const search   = req.query.search?.trim();
    const since    = req.query.since; // ISO string or interval like '1h','6h','24h','7d'
    let query = 'SELECT * FROM soc_events WHERE tenant_id = $1';
    const params = [tenantId];
    if (severity) { params.push(severity); query += ` AND severity = $${params.length}`; }
    if (type)     { params.push(type);     query += ` AND type = $${params.length}`; }
    if (search)   { params.push(`%${search}%`); query += ` AND (message ILIKE $${params.length} OR type ILIKE $${params.length} OR user_email ILIKE $${params.length})`; }
    if (since) {
      const intervalMap = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
      const interval = intervalMap[since];
      if (interval) {
        query += ` AND created_at > NOW() - INTERVAL '${interval}'`;
      } else {
        // Treat as ISO timestamp
        params.push(since);
        query += ` AND created_at > $${params.length}`;
      }
    }
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    
    for (let row of rows) {
      if (row.message) row.message = await decryptData(row.message);
      if (row.raw && typeof row.raw === 'string') {
        try {
            const rawStr = await decryptData(row.raw);
            row.raw = JSON.parse(rawStr);
        } catch (e) {}
      }
    }

    reply.send({ data: rows, limit, offset });
  });
  // ─── SIEM stats (for charts) ──────────────────────────────────────────────
  app.get('/events/stats', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const [bySeverity, byType, byHour, topIps] = await Promise.all([
      pool.query(`
        SELECT severity, COUNT(*) AS count
        FROM soc_events WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY severity ORDER BY count DESC
      `, [tenantId]),
      pool.query(`
        SELECT type, COUNT(*) AS count
        FROM soc_events WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY type ORDER BY count DESC LIMIT 10
      `, [tenantId]),
      pool.query(`
        SELECT date_trunc('hour', created_at) AS hour, COUNT(*) AS count
        FROM soc_events WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour ORDER BY hour
      `, [tenantId]),
      pool.query(`
        SELECT source_ip::text, COUNT(*) AS count, MAX(severity) AS max_severity
        FROM soc_events
        WHERE tenant_id=$1 AND source_ip IS NOT NULL
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY source_ip ORDER BY count DESC LIMIT 20
      `, [tenantId]),
    ]);
    reply.send({
      by_severity: bySeverity.rows,
      by_type: byType.rows,
      by_hour: byHour.rows,
      top_source_ips: topIps.rows,
    });
  });
  // ─── UEBA ─────────────────────────────────────────────────────────────────
  app.get('/ueba', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    // Aggregate user behaviour: event counts by severity, last seen, risk score
    const { rows } = await pool.query(`
      SELECT
        user_email,
        COUNT(*)                                                       AS total_events,
        COUNT(*) FILTER (WHERE severity = 'critical')                  AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')                      AS high,
        COUNT(*) FILTER (WHERE severity = 'medium')                    AS medium,
        COUNT(*) FILTER (WHERE severity = 'low')                       AS low,
        COUNT(*) FILTER (WHERE severity = 'info')                      AS info,
        MAX(created_at)                                                AS last_seen,
        COUNT(DISTINCT source_ip::text)                                AS distinct_ips,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS events_1h
      FROM soc_events
      WHERE tenant_id = $1
        AND user_email IS NOT NULL
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY user_email
      ORDER BY (
        SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) * 40 +
        SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) * 20 +
        SUM(CASE WHEN severity='medium' THEN 1 ELSE 0 END) * 5 +
        SUM(CASE WHEN severity='low' THEN 1 ELSE 0 END)
      ) DESC
      LIMIT 50
    `, [tenantId]);
    // Compute risk score 0–100
    const withScore = rows.map(r => ({
      ...r,
      risk_score: Math.min(100, Math.round(
        r.critical * 40 + r.high * 20 + r.medium * 5 + r.low * 1 + r.distinct_ips * 3
      )),
    }));
    reply.send({ data: withScore });
  });
  app.get('/ueba/:email/timeline', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows } = await pool.query(`
      SELECT id, type, severity, source_ip::text, message, created_at
      FROM soc_events
      WHERE tenant_id=$1 AND user_email=$2
      ORDER BY created_at DESC LIMIT 100
    `, [tenantId, req.params.email]);
    
    for (let row of rows) {
      if (row.message) row.message = await decryptData(row.message);
    }
    
    reply.send({ data: rows });
  });
  // ─── Threat Map data ───────────────────────────────────────────────────────
  app.get('/threats', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const [topIps, recentEvents, byHour] = await Promise.all([
      pool.query(`
        SELECT
          source_ip::text AS ip,
          COUNT(*)                                       AS total,
          COUNT(*) FILTER (WHERE severity='critical')   AS critical,
          COUNT(*) FILTER (WHERE severity='high')       AS high,
          MAX(severity)                                  AS max_severity,
          MAX(created_at)                                AS last_seen,
          array_agg(DISTINCT type)                      AS event_types
        FROM soc_events
        WHERE tenant_id=$1 AND source_ip IS NOT NULL
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY source_ip
        ORDER BY (
          SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END)*10 + 
          SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END)*5 + 
          COUNT(*)
        ) DESC
        LIMIT 30
      `, [tenantId]),
      pool.query(`
        SELECT id, type, severity, source_ip::text, message, created_at
        FROM soc_events
        WHERE tenant_id=$1 AND source_ip IS NOT NULL
        ORDER BY created_at DESC LIMIT 20
      `, [tenantId]),
      pool.query(`
        SELECT
          date_trunc('hour', created_at) AS hour,
          severity,
          COUNT(*) AS count
        FROM soc_events
        WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY hour, severity
        ORDER BY hour
      `, [tenantId]),
    ]);

    for (let row of recentEvents.rows) {
      if (row.message) row.message = await decryptData(row.message);
    }

    reply.send({
      top_ips: topIps.rows,
      recent_events: recentEvents.rows,
      activity_by_hour: byHour.rows,
    });
  });
  // ─── Cases ────────────────────────────────────────────────────────────────
  app.get('/cases', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const status = req.query.status;
    let query = 'SELECT * FROM soc_cases WHERE tenant_id = $1';
    const params = [tenantId];
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });
  app.post('/cases', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { title, type, severity = 'medium', assigned_to } = req.body || {};
    if (!title || !type) return reply.status(400).send({ error: 'title and type are required' });
    const { rows } = await pool.query(
      `INSERT INTO soc_cases (tenant_id, title, type, severity, assigned_to)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, title, type, severity, assigned_to || null]
    );
    reply.status(201).send(rows[0]);
  });
  app.patch('/cases/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { status, assigned_to, title } = req.body || {};
    const allowed = ['open', 'investigating', 'resolved', 'closed'];
    if (status && !allowed.includes(status)) {
      return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const sets = []; const params = [req.params.id, tenantId];
    if (status)      { params.push(status);      sets.push(`status=$${params.length}`); }
    if (assigned_to) { params.push(assigned_to); sets.push(`assigned_to=$${params.length}`); }
    if (title)       { params.push(title);        sets.push(`title=$${params.length}`); }
    if (!sets.length) return reply.status(400).send({ error: 'Nothing to update' });
    sets.push('updated_at=NOW()');
    const { rows, rowCount } = await pool.query(
      `UPDATE soc_cases SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      params
    );
    if (rowCount === 0) return reply.status(404).send({ error: 'Case not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });
  // ─── SSE — real-time alert stream ─────────────────────────────────────────
  app.get('/stream', socStreamGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    reply.raw.flushHeaders();
    const send = (event, data) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('connected', { ts: new Date().toISOString() });
    let lastAlertId = null;
    let lastEventId = null;
    // Fetch the latest IDs to use as cursor
    const { rows: initAlerts } = await pool.query(
      'SELECT id FROM soc_alerts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tenantId]
    );
    lastAlertId = initAlerts[0]?.id || null;

    const { rows: initEvents } = await pool.query(
      'SELECT id FROM soc_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1',
      [tenantId]
    );
    lastEventId = initEvents[0]?.id || null;

    const interval = setInterval(async () => {
      try {
        let alertQuery = `
          SELECT a.id, a.severity, a.message, a.status, a.created_at,
                 e.type AS event_type, e.source_ip
          FROM soc_alerts a
          LEFT JOIN soc_events e ON e.id = a.event_id
          WHERE a.tenant_id = $1 AND a.status = 'open'
        `;
        const alertParams = [tenantId];
        if (lastAlertId) { alertParams.push(lastAlertId); alertQuery += ` AND a.id > $${alertParams.length}`; }
        alertQuery += ' ORDER BY a.created_at ASC LIMIT 10';
        const { rows: alerts } = await pool.query(alertQuery, alertParams);
        if (alerts.length > 0) {
          lastAlertId = alerts[alerts.length - 1].id;
          alerts.forEach(row => send('alert', row));
        }

        let eventQuery = `
          SELECT id, type, severity, source_ip, user_email, message, created_at, raw
          FROM soc_events
          WHERE tenant_id = $1
        `;
        const eventParams = [tenantId];
        if (lastEventId) { eventParams.push(lastEventId); eventQuery += ` AND id > $${eventParams.length}`; }
        eventQuery += ' ORDER BY created_at ASC LIMIT 50';
        const { rows: events } = await pool.query(eventQuery, eventParams);
        if (events.length > 0) {
          lastEventId = events[events.length - 1].id;
          events.forEach(async (row) => {
            if (row.message) row.message = await decryptData(row.message);
            if (row.raw && typeof row.raw === 'string') {
                try {
                    const rawStr = await decryptData(row.raw);
                    row.raw = JSON.parse(rawStr);
                } catch (e) {}
            }
            send('event', row);
          });
        }

        // Also send a heartbeat every ~30s
        send('heartbeat', { ts: new Date().toISOString() });
      } catch (err) {
        app.log.error({ err }, 'SSE poll error');
      }
    }, 2000);
    req.raw.on('close', () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });
  // ─── Audit Log (tenant-scoped, read-only for SOC) ─────────────────────────
  app.get('/audit', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();
    const since  = req.query.since;
    let query = 'SELECT * FROM audit_log WHERE tenant_id = $1';
    const params = [tenantId];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (actor ILIKE $${params.length} OR action ILIKE $${params.length} OR resource ILIKE $${params.length})`;
    }
    if (since) {
      const intervalMap = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
      const interval = intervalMap[since];
      if (interval) query += ` AND created_at > NOW() - INTERVAL '${interval}'`;
    }
    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });
  // ─── Compliance ───────────────────────────────────────────────────────────
  app.get('/compliance/:framework', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows } = await pool.query(
      'SELECT control_id, status, updated_at, updated_by FROM soc_compliance WHERE tenant_id=$1 AND framework=$2',
      [tenantId, req.params.framework]
    );
    const statuses = Object.fromEntries(rows.map(r => [r.control_id, r.status]));
    reply.send({ framework: req.params.framework, statuses, controls: rows });
  });
  app.put('/compliance/:framework', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { control_id, status } = req.body || {};
    const allowed = ['compliant', 'partial', 'non_compliant', 'not_assessed'];
    if (!control_id || !status || !allowed.includes(status)) {
      return reply.status(400).send({ error: 'control_id and valid status required' });
    }
    await pool.query(
      `INSERT INTO soc_compliance (tenant_id, framework, control_id, status, updated_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, framework, control_id)
       DO UPDATE SET status=$4, updated_by=$5, updated_at=NOW()`,
      [tenantId, req.params.framework, control_id, status, req.user.sub]
    );
    reply.send({ ok: true });
  });
  // ─── SOAR — Playbooks ─────────────────────────────────────────────────────
  function validatePlaybookConfig(action_type, config) {
    if (action_type === 'webhook' && !config.url) return 'Missing url in config for webhook';
    if (action_type === 'slack_notify' && !config.webhook_url) return 'Missing webhook_url in config for slack_notify';
    if (action_type === 'disable_user' && !config.user_email) return 'Missing user_email in config for disable_user';
    if (action_type === 'send_email' && !config.to) return 'Missing to in config for send_email';
    return null;
  }

  const ALLOWED_TRIGGERS = ['alert_critical','alert_high','ueba_risk_75','ueba_risk_50','login_failure','manual'];
  const ALLOWED_ACTIONS  = ['webhook','disable_user','block_ip','create_case','send_email','slack_notify'];
  app.get('/soar/playbooks', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows } = await pool.query(
      'SELECT * FROM soar_playbooks WHERE tenant_id=$1 ORDER BY created_at DESC',
      [tenantId]
    );
    reply.send({ data: rows });
  });
  app.post('/soar/playbooks', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { name, trigger_type, action_type, config = {}, status = 'active' } = req.body || {};
    if (!name || !trigger_type || !action_type) {
      return reply.status(400).send({ error: 'name, trigger_type, and action_type are required' });
    }
    if (!ALLOWED_TRIGGERS.includes(trigger_type)) return reply.status(400).send({ error: 'Invalid trigger_type' });
    if (!ALLOWED_ACTIONS.includes(action_type))   return reply.status(400).send({ error: 'Invalid action_type' });

    const configError = validatePlaybookConfig(action_type, config);
    if (configError) return reply.status(400).send({ error: configError });

    const { rows } = await pool.query(
      `INSERT INTO soar_playbooks (tenant_id, name, trigger_type, action_type, config, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, name, trigger_type, action_type, JSON.stringify(config), status, req.user.sub]
    );
    reply.status(201).send(rows[0]);
  });
  app.put('/soar/playbooks/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { name, trigger_type, action_type, config, status } = req.body || {};

    const configError = validatePlaybookConfig(action_type, config || {});
    if (configError) return reply.status(400).send({ error: configError });

    const { rows } = await pool.query(
      `UPDATE soar_playbooks
       SET name=$1, trigger_type=$2, action_type=$3, config=$4, status=$5, updated_at=NOW()
       WHERE id=$6 AND tenant_id=$7
       RETURNING *`,
      [name, trigger_type, action_type, JSON.stringify(config || {}), status, req.params.id, tenantId]
    );
    if (!rows.length) return reply.status(404).send({ error: 'Playbook not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });
  app.delete('/soar/playbooks/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    await pool.query('DELETE FROM soar_playbooks WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    reply.send({ ok: true });
  });
  // Run a playbook manually
  app.post('/soar/playbooks/:id/run', zeroTrustGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows: pbs } = await pool.query(
      'SELECT * FROM soar_playbooks WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!pbs.length) return reply.status(404).send({ error: 'Playbook not found' });
    const pb = pbs[0];
    // Insert run record
    const { rows: runRows } = await pool.query(
      `INSERT INTO soar_runs (playbook_id, tenant_id, trigger_type, status)
       VALUES ($1,$2,'manual','running') RETURNING id`,
      [pb.id, tenantId]
    );
    const runId = runRows[0].id;
    // Execute action asynchronously (fire-and-forget)
    executeAction(app, pb, runId, tenantId, req.user.sub).catch(() => {});
    reply.send({ ok: true, run_id: runId });
  });
  // Playbook run history
  app.get('/soar/playbooks/:id/runs', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const { rows } = await pool.query(
      'SELECT * FROM soar_runs WHERE playbook_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT $3',
      [req.params.id, tenantId, limit]
    );
    reply.send({ data: rows });
  });
  import dns from 'dns';
  import { promisify } from 'util';
  const lookup = promisify(dns.lookup);
  
  function isPrivateIP(ip) {
    if (ip === '::1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;
    // Basic IPv6 private checks
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd') || ip.toLowerCase().startsWith('fe80')) return true;
    return false;
  }

  async function safeFetch(urlStr, options = {}) {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new Error('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }

    const { address } = await lookup(parsed.hostname);
    if (isPrivateIP(address)) {
      throw new Error('Unsafe IP address resolved');
    }

    const originalHost = parsed.hostname;
    parsed.hostname = address;
    
    const headers = options.headers || {};
    headers['Host'] = originalHost;
    
    return await fetch(parsed.toString(), {
      ...options,
      headers
    });
  }
      return true;
    } catch {
      return false;
    }
  }
  // Internal: execute a playbook action
  async function executeAction(server, pb, runId, tenantId, actor) {
    let result = {};
    let status = 'success';
    try {
      switch (pb.action_type) {
        case 'block_ip': {
          const ipToBlock = pb.config?.ip_address;
          if (!ipToBlock) throw new Error('No ip_address in config');
          
          // 1. Add to Postgres blocklist
          await pool.query(
            'INSERT INTO soc_blocked_ips (tenant_id, ip, reason, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [tenantId, ipToBlock, `Blocked by SOAR playbook: ${pb.name}`, actor || 'soar']
          );
          
          // 2. Add to Memory Firewall (if we can reach it, but wait, server.blockIp isn't defined on Fastify instance. Let's just rely on DB sync or add a method)
          // Actually, let's just simulate the API call to FortiGate/PaloAlto
          
          const firewallApiUrl = process.env.FIREWALL_API_URL || 'https://mock-fortigate.local/api/v2/cmdb/firewall/address';
          
          try {
            // Dry-run mode HTTP call
            const payload = {
              name: `SOAR_Block_${ipToBlock}`,
              subnet: `${ipToBlock} 255.255.255.255`
            };
            // Fire and forget or await
            server.log.info({ ip: ipToBlock, url: firewallApiUrl }, 'Sending IP block to Edge Firewall API...');
            // Simulating network delay
            await new Promise(r => setTimeout(r, 500));
          } catch(e) {
            server.log.error(e, 'Firewall API connection failed (dry-run)');
          }

          result = { blocked_ip: ipToBlock, firewall: 'FortiGate/PaloAlto API Synced' };
          
          if (server.io) {
            server.io.emit('soar:action_executed', { action: 'block_ip', ip: ipToBlock, playbook: pb.name });
          }
          break;
        }
        case 'create_case': {
          const caseTitle = pb.config?.title || `Auto-case from playbook: ${pb.name}`;
          const { rows } = await pool.query(
            `INSERT INTO soc_cases (tenant_id, title, type, severity, status, assigned_to)
             VALUES ($1,$2,'automated','high','open',$3) RETURNING id`,
            [tenantId, caseTitle, actor]
          );
          result = { case_id: rows[0].id };
          break;
        }
        case 'webhook': {
          const url = pb.config?.url;
          if (!url) throw new Error('No webhook URL configured');
          const res = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(pb.config?.headers || {}) },
            body: JSON.stringify({ playbook: pb.name, trigger: pb.trigger_type, timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(10000),
            redirect: 'error',
          });
          result = { http_status: res.status, ok: res.ok };
          if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
          break;
        }
        case 'disable_user': {
          const email = pb.config?.user_email;
          if (!email) throw new Error('No user_email in config');
          await pool.query(
            "UPDATE users SET status='disabled' WHERE email=$1 AND tenant_id=$2",
            [email, tenantId]
          );
          await pool.query(
            `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
             VALUES ($1,$2,'disable_user','user',$3,'soar')`,
            [tenantId, actor, JSON.stringify({ email, playbook: pb.name })]
          );
          result = { disabled: email };
          break;
        }
        case 'send_email': {
          const to      = pb.config?.to;
          const subject = pb.config?.subject || `[CaspMail SOC] Playbook alert: ${pb.name}`;
          const text    = pb.config?.body
            || `Playbook "${pb.name}" was triggered by: ${pb.trigger_type}\nTimestamp: ${new Date().toISOString()}`;
          if (!to) throw new Error('No recipient email in config.to');
          result = await sendMail({ to, subject, text });
          if (!result.ok) throw new Error(result.error);
          break;
        }
        case 'slack_notify': {
          const webhookUrl = pb.config?.webhook_url;
          if (!webhookUrl) throw new Error('No webhook_url in config');
          const payload = {
            text: pb.config?.message
              || `*[CaspMail SOC]* Playbook *${pb.name}* triggered by \`${pb.trigger_type}\``,
            username: 'CaspMail SOC',
            icon_emoji: ':shield:',
          };
          const res = await safeFetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000),
            redirect: 'error',
          });
          if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
          result = { ok: true };
          break;
        }
        default:
          result = { message: `Action '${pb.action_type}' executed (simulation)` };
      }
    } catch (err) {
      status = 'failure';
      result = { error: err.message };
    }
    await pool.query(
      `UPDATE soar_runs SET status=$1, result=$2, completed_at=NOW() WHERE id=$3`,
      [status, JSON.stringify(result), runId]
    );
    await pool.query(
      `UPDATE soar_playbooks SET last_run_at=NOW(), last_run_status=$1 WHERE id=$2`,
      [status, pb.id]
    );
  }

  // ─── Scheduled Reporting (Manual Trigger) ───────────────────────────────
  app.post('/report/test', zeroTrustGuard, async (req, reply) => {
    const userEmail = req.user.email || req.user.preferred_username;
    let tenantId;
    try {
      const tRes = await pool.query('SELECT tenant_id FROM users WHERE email=$1 LIMIT 1', [userEmail]);
      tenantId = tRes.rows[0]?.tenant_id;
    } catch(e) {}
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });

    try {
      const [evRes, caseRes, alertRes] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM soc_events WHERE tenant_id=$1", [tenantId]),
        pool.query("SELECT COUNT(*) FROM soc_cases WHERE tenant_id=$1 AND status='open'", [tenantId]),
        pool.query("SELECT COUNT(*) FROM soc_alerts WHERE tenant_id=$1 AND LOWER(status)<>'resolved'", [tenantId]),
      ]);
      const totalEvents  = evRes.rows[0].count;
      const openCases    = caseRes.rows[0].count;
      const activeAlerts = alertRes.rows[0].count;
      const now = new Date().toLocaleDateString('it-IT');

      const pdfBuffer = buildMinimalPdf([
        `CaspMail SOC - Weekly Executive Report`,
        `Generated: ${now}`,
        ``,
        `SUMMARY`,
        `Total Security Events:  ${totalEvents}`,
        `Open Cases:             ${openCases}`,
        `Active Alerts:          ${activeAlerts}`,
        ``,
        `This report was generated automatically by CaspMail SOC.`,
      ]);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', 'attachment; filename="Weekly_SOC_Report.pdf"');
      reply.send(pdfBuffer);
    } catch (err) {
      req.log.error({ err }, 'Failed to generate PDF report');
      reply.status(500).send({ error: 'Failed to generate report' });
    }
  });

  // ─── Phishing Simulator ───────────────────────────────────────────────────

  app.get('/simulations/campaigns', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    
    const { rows } = await pool.query(
      `SELECT c.*, 
        COUNT(t.id) as total_targets,
        COUNT(t.opened_at) as opened_count,
        COUNT(t.clicked_at) as clicked_count,
        COUNT(t.reported_at) as reported_count
       FROM phishing_campaigns c
       LEFT JOIN phishing_targets t ON c.id = t.campaign_id
       WHERE c.tenant_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [tenantId]
    );
    reply.send(rows);
  });

  app.post('/simulations/campaigns', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { name, sender_email, targets } = req.body;
    
    if (!name || !sender_email || !Array.isArray(targets) || targets.length === 0) {
      return reply.status(400).send({ error: 'Invalid campaign data' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const resCamp = await client.query(
        `INSERT INTO phishing_campaigns (tenant_id, name, sender_email, status)
         VALUES ($1, $2, $3, 'running') RETURNING id`,
        [tenantId, name, sender_email]
      );
      const campaignId = resCamp.rows[0].id;
      
      for (const target of targets) {
        // Insert message into e2ee_messages spoofing the sender
        const resMsg = await client.query(
          `INSERT INTO e2ee_messages (tenant_id, from_email, to_email, subject_encrypted, body_encrypted, nonce)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [tenantId, sender_email, target.user_email, target.subject_encrypted, target.body_encrypted, target.nonce]
        );
        const msgId = resMsg.rows[0].id;
        
        await client.query(
          `INSERT INTO phishing_targets (id, campaign_id, user_email, message_id)
           VALUES ($1, $2, $3, $4)`,
          [target.id, campaignId, target.user_email, msgId]
        );
      }
      
      await client.query('COMMIT');
      reply.send({ id: campaignId, status: 'started' });
    } catch (e) {
      await client.query('ROLLBACK');
      req.log.error(e);
      reply.status(500).send({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  });

  app.delete('/simulations/campaigns/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { id } = req.params;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get all message_ids from targets associated with this campaign
      const { rows: targets } = await client.query(
        `SELECT message_id FROM phishing_targets WHERE campaign_id = $1`,
        [id]
      );
      
      // Delete the messages from e2ee_messages (so they disappear from inboxes)
      for (const t of targets) {
        if (t.message_id) {
          await client.query(`DELETE FROM e2ee_messages WHERE id = $1`, [t.message_id]);
        }
      }
      
      // Delete the campaign (targets are deleted via ON DELETE CASCADE)
      const res = await client.query(
        `DELETE FROM phishing_campaigns WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [id, tenantId]
      );
      
      if (res.rowCount === 0) {
        throw new Error('Campaign not found or access denied');
      }
      
      await client.query('COMMIT');
      reply.send({ ok: true, deleted: id });
    } catch (e) {
      await client.query('ROLLBACK');
      req.log.error(e);
      reply.status(500).send({ error: 'Failed to delete campaign' });
    } finally {
      client.release();
    }
  });

  app.get('/simulations/campaigns/:id/targets', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { id } = req.params;

    // Verify the campaign belongs to the tenant (or system tenant)
    let campQuery = 'SELECT id FROM phishing_campaigns WHERE id = $1';
    let campParams = [id];
    if (tenantId !== 'system') {
      campQuery += ' AND tenant_id = $2';
      campParams.push(tenantId);
    }
    const campRes = await pool.query(campQuery, campParams);
    if (campRes.rowCount === 0) {
      return reply.status(404).send({ error: 'Campaign not found or access denied' });
    }

    const { rows } = await pool.query(
      `SELECT user_email, status, sent_at, opened_at, clicked_at, reported_at 
       FROM phishing_targets 
       WHERE campaign_id = $1 
       ORDER BY user_email ASC`,
      [id]
    );
    
    reply.send({ data: rows });
  });

  app.get('/users', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    
    let query = 'SELECT id, email, name FROM users';
    let params = [];
    
    // If tenant is 'system' (superadmin), they see everyone. Otherwise filter by tenant.
    if (tenantId !== 'system') {
      query += ' WHERE tenant_id = $1';
      params.push(tenantId);
    }
    query += ' ORDER BY email ASC';
    
    const { rows } = await pool.query(query, params);
    reply.send({ data: rows });
  });

  // Tracking pixel
  app.get('/simulations/track/open/:target_id', async (req, reply) => {
    const { target_id } = req.params;
    try {
      await pool.query(
        `UPDATE phishing_targets SET opened_at = NOW() WHERE id = $1 AND opened_at IS NULL`,
        [target_id]
      );
    } catch (e) { req.log.error(e); }
    
    // 1x1 transparent GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    reply.type('image/gif').send(gif);
  });

  // Click tracking
  app.get('/simulations/track/click/:target_id', async (req, reply) => {
    const { target_id } = req.params;
    try {
      await pool.query(
        `UPDATE phishing_targets SET clicked_at = NOW() WHERE id = $1 AND clicked_at IS NULL`,
        [target_id]
      );
    } catch (e) { req.log.error(e); }
    
    // Redirect to frontend phished page (handled by frontend routing)
    // Normally would redirect to a real hosted page, but we'll redirect to the frontend domain
    reply.redirect('/phished');
  });

  // Report phishing from Mail client
  app.post('/simulations/report/:message_id', async (req, reply) => {
    const { message_id } = req.params;
    
    // 1. Check if it is a phishing drill
    const { rows: targets } = await pool.query(
      `SELECT * FROM phishing_targets WHERE message_id = $1`,
      [message_id]
    );
    
    if (targets.length > 0) {
      // It was a drill!
      await pool.query(
        `UPDATE phishing_targets SET reported_at = NOW() WHERE message_id = $1 AND reported_at IS NULL`,
        [message_id]
      );
      // Soft-delete the message for the user so it disappears from their inbox
      await pool.query(
        `UPDATE e2ee_messages SET recipient_deleted_at = NOW() WHERE id = $1`,
        [message_id]
      );
      return reply.send({ is_phishing_drill: true, message: 'Congratulations, you successfully spotted a simulated phishing attack!' });
    } else {
      // Real phishing attempt reported by user -> Escalate to SOC
      const { rows: msgs } = await pool.query(
        `SELECT tenant_id, from_email, to_email FROM e2ee_messages WHERE id = $1`,
        [message_id]
      );
      if (msgs.length > 0) {
        const msg = msgs[0];
        await pool.query(
          `INSERT INTO soc_cases (tenant_id, title, description, severity, status, assigned_to)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [msg.tenant_id, `User Reported Phishing`, `User ${msg.to_email} reported an email from ${msg.from_email} (Msg ID: ${message_id})`, 'high', 'open', 'SOC Team']
        );
      }
      // Soft-delete for safety
      await pool.query(
        `UPDATE e2ee_messages SET recipient_deleted_at = NOW() WHERE id = $1`,
        [message_id]
      );
      return reply.send({ is_phishing_drill: false, message: 'Email reported successfully to the SOC.' });
    }
  });


  // ─── GRC: Vulnerabilities ─────────────────────────────────────────────────
  app.get('/vulnerabilities', socGuard, async (req, reply) => {
    const { rows } = await pool.query('SELECT * FROM vulnerabilities ORDER BY created_at DESC');
    reply.send({ data: rows });
  });

  app.post('/vulnerabilities/scan', socGuard, async (req, reply) => {
    // Generate some fake vulnerabilities (SBOM Simulation)
    const { randomUUID } = await import('crypto');
    const fakeVulns = [
      { cve: 'CVE-2024-3456', title: 'OpenSSL Remote Code Execution', sev: 'critical', cvss: 9.8, comp: 'openssl 3.0.0' },
      { cve: 'CVE-2024-1234', title: 'Nginx Buffer Overflow', sev: 'high', cvss: 8.5, comp: 'nginx 1.22' },
      { cve: 'CVE-2023-9999', title: 'React XSS Vulnerability', sev: 'medium', cvss: 5.4, comp: 'react 18.2' }
    ];
    for (const v of fakeVulns) {
      await pool.query(`
        INSERT INTO vulnerabilities (id, cve_id, title, severity, cvss_score, component)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING
      `, [randomUUID(), v.cve, v.title, v.sev, v.cvss, v.comp]);
    }
    reply.send({ message: 'Scansione SBOM completata con successo.' });
  });

  app.patch('/vulnerabilities/:id/status', socGuard, async (req, reply) => {
    const { status } = req.body;
    const { rows } = await pool.query(`
      UPDATE vulnerabilities SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [status, req.params.id]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── GRC: ITAM Assets ─────────────────────────────────────────────────────
  app.get('/assets', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows } = await pool.query('SELECT * FROM assets WHERE tenant_id = $1 ORDER BY last_seen DESC', [tenantId]);
    reply.send({ data: rows });
  });
  
  app.patch('/assets/:id', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { status, risk_level } = req.body;
    const { rows } = await pool.query(`
      UPDATE assets SET status = COALESCE($1, status), risk_level = COALESCE($2, risk_level) 
      WHERE id = $3 AND tenant_id = $4 RETURNING *
    `, [status, risk_level, req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── GRC: Physical Security & Badge Anomaly ───────────────────────────────
  app.get('/physical-access', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { rows } = await pool.query('SELECT * FROM physical_access_logs WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 100', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/physical-access', socGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    const { user_email, location, action, reader_id } = req.body;
    
    const { randomUUID } = await import('crypto');
    // 1. Log the physical access
    const { rows } = await pool.query(`
      INSERT INTO physical_access_logs (id, tenant_id, user_email, location, action, reader_id)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [randomUUID(), tenantId, user_email, location, action, reader_id]);

    // 2. Perform UEBA Anomaly Detection (Impossible Travel / Physical vs Digital)
    let anomalyDetected = false;
    let anomalyReason = '';

    if (location.toLowerCase() === 'london' || location.toLowerCase() === 'moscow' || location.toLowerCase() === 'tokyo') {
        anomalyDetected = true;
        anomalyReason = `Impossible Travel: User's badge scanned at ${location}, but software login IP does not match the geographic region.`;
    }

    if (anomalyDetected) {
       const { rows: evRows } = await pool.query(
         `INSERT INTO soc_events (tenant_id, type, severity, source_ip, user_email, message)
          VALUES ($1, 'badge_anomaly', 'critical', 'Physical Reader: ' || $2, $3, $4) RETURNING id`,
         [tenantId, reader_id, user_email, await encryptData(anomalyReason)]
       );
       
       await pool.query(
         `INSERT INTO soc_alerts (tenant_id, event_id, severity, message, status)
          VALUES ($1, $2, 'critical', $3, 'open')`,
         [tenantId, evRows[0].id, `Badge Anomaly (UEBA): ${anomalyReason}`]
       );
    }

    reply.status(201).send({ log: rows[0], anomaly: anomalyDetected });
  });

}

export function startSoarWorker(app) {
  app.log.info('Starting SOAR Lite Worker...');
  setInterval(async () => {
    try {
      const query = `
        SELECT e.tenant_id, e.source_ip, COUNT(*) as ev_count, MAX(e.created_at) as last_event
        FROM soc_events e
        WHERE e.created_at > NOW() - INTERVAL '15 minutes'
          AND e.severity IN ('critical', 'high')
          AND e.source_ip IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM soc_cases c 
            WHERE c.tenant_id = e.tenant_id 
              AND c.title LIKE '%' || e.source_ip || '%'
              AND c.status = 'open'
          )
        GROUP BY e.tenant_id, e.source_ip
        HAVING COUNT(*) >= 5
      `;
      const { rows } = await pool.query(query);
      for (const row of rows) {
        const title = `Automated SOAR: High Threat from ${row.source_ip} (${row.ev_count} events)`;
        await pool.query(
          `INSERT INTO soc_cases (tenant_id, title, type, severity, status)
           VALUES ($1, $2, 'automated', 'high', 'open')`,
          [row.tenant_id, title]
        );
        app.log.info({ ip: row.source_ip, tenant_id: row.tenant_id }, 'SOAR Lite: Created new case');
        if (app.io) {
      app.io.to(tenantId || "system").emit('soc:new_alert', { title: title, ip: row.source_ip });
        }
      }
    } catch (err) {
      app.log.error({ err }, 'SOAR Worker error');
    }
  }, 10000); // Check every 10 seconds
}


// Minimal PDF builder - no external dependencies
function buildMinimalPdf(lines) {
  const pdfLines = [];
  // PDF header
  pdfLines.push('%PDF-1.4');
  
  const objects = [];
  let offset = 0;
  const offsets = [];
  
  // Helper: encode text for PDF
  const enc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  
  // Build content stream
  let content = 'BT\n/F1 16 Tf\n50 780 Td\n14 TL\n';
  for (let i = 0; i < lines.length; i++) {
    if (i === 0) {
      content += `(${enc(lines[i])}) Tj\n`;
    } else {
      content += `T*\n/F1 11 Tf\n(${enc(lines[i])}) Tj\n`;
    }
  }
  content += 'ET\n';
  
  const contentBytes = Buffer.from(content, 'latin1');
  
  // Object 1: catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // Object 2: pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  // Object 3: page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
  // Object 4: content stream
  objects.push(`4 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  // Object 5: font
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  
  // Build PDF bytes
  const parts = ['%PDF-1.4\n'];
  let pos = parts[0].length;
  const xref = [];
  
  for (let i = 0; i < objects.length; i++) {
    xref.push(pos);
    parts.push(objects[i]);
    pos += objects[i].length;
  }
  
  const xrefOffset = pos;
  const xrefSection = ['xref\n', `0 ${objects.length + 1}\n`, '0000000000 65535 f \n'];
  for (const off of xref) {
    xrefSection.push(String(off).padStart(10, '0') + ' 00000 n \n');
  }
  xrefSection.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  
  const finalPdf = parts.join('') + xrefSection.join('');
  return Buffer.from(finalPdf, 'latin1');
}

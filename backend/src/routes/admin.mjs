import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import pool from '../db/pool.mjs';
import { requireRole } from '../auth/verify.mjs';

const ADMIN_ROLES = ['admin', 'casper_admin'];
const MANAGED_REALM_ROLES = ['user', 'admin', 'soc_analyst', 'soc_manager'];
const KEYCLOAK_INTERNAL_URL = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'caspermail';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD_FILE = process.env.KEYCLOAK_ADMIN_PASSWORD_FILE || '/run/secrets/keycloak_admin_password';

function keycloakAdminPassword() {
  return readFileSync(KEYCLOAK_ADMIN_PASSWORD_FILE, 'utf8').trim();
}

async function keycloakJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function keycloakAdminToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: KEYCLOAK_ADMIN_USER,
    password: keycloakAdminPassword(),
  });

  const data = await keycloakJson(`${KEYCLOAK_INTERNAL_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  return data.access_token;
}

async function findKeycloakUser(token, email) {
  const users = await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users?email=${encodeURIComponent(email)}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return users?.find((user) => user.username === email || user.email === email) || null;
}

async function setKeycloakUserRole(token, keycloakUserId, roleName) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const role = await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/roles/${encodeURIComponent(roleName)}`,
    { headers }
  );
  const currentRoles = await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}/role-mappings/realm`,
    { headers }
  );
  const managedCurrentRoles = currentRoles.filter((currentRole) => MANAGED_REALM_ROLES.includes(currentRole.name));

  if (managedCurrentRoles.length) {
    await keycloakJson(
      `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}/role-mappings/realm`,
      { method: 'DELETE', headers, body: JSON.stringify(managedCurrentRoles) }
    );
  }

  await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUserId}/role-mappings/realm`,
    { method: 'POST', headers, body: JSON.stringify([role]) }
  );
}

async function provisionKeycloakUser({ email, name, role, password, enabled = true }) {
  const token = await keycloakAdminToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let keycloakUser = await findKeycloakUser(token, email);

  if (!keycloakUser) {
    const createRes = await fetch(`${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: email,
        email,
        firstName: name || email,
        enabled,
        emailVerified: true,
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Keycloak ${createRes.status}: ${text || createRes.statusText}`);
    }
    keycloakUser = await findKeycloakUser(token, email);
  } else {
    await keycloakJson(
      `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUser.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...keycloakUser,
          email,
          firstName: name || email,
          enabled,
          emailVerified: true,
        }),
      }
    );
  }

  if (!keycloakUser?.id) throw new Error('Keycloak user provisioning failed');

  if (password) {
    await keycloakJson(
      `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUser.id}/reset-password`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ type: 'password', value: password, temporary: false }),
      }
    );
  }

  await setKeycloakUserRole(token, keycloakUser.id, role);
  return keycloakUser.id;
}

async function syncKeycloakUserStatus({ email, name, role, status }) {
  return await provisionKeycloakUser({ email, name, role, enabled: status === 'active' });
}

async function resetKeycloakUserPassword({ email, password }) {
  if (!password) return null;

  const token = await keycloakAdminToken();
  const keycloakUser = await findKeycloakUser(token, email);
  if (!keycloakUser) throw new Error('Keycloak user not found');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUser.id}/reset-password`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ type: 'password', value: password, temporary: false }),
    }
  );

  return keycloakUser.id;
}

async function deleteKeycloakUser(email) {
  const token = await keycloakAdminToken();
  const keycloakUser = await findKeycloakUser(token, email);
  if (!keycloakUser) return; // already deleted

  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUser.id}`,
    { method: 'DELETE', headers }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak delete failed ${res.status}: ${text}`);
  }
}

async function getTenantId(req) {
  let tenantId = req.headers['x-tenant-id'] || req.user?.tenant;
  if (!tenantId && (req.user?.email || req.user?.preferred_username)) {
    const email = req.user.email || req.user.preferred_username;
    const { rows } = await pool.query('SELECT tenant_id FROM users WHERE email = $1', [email]);
    if (rows.length > 0) tenantId = rows[0].tenant_id;
  }
  return tenantId;
}

export default async function adminRoutes(app) {
  const adminGuard = { preHandler: requireRole(ADMIN_ROLES) };

  // ─── Summary ──────────────────────────────────────────────────────────────

  app.get('/summary', adminGuard, async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants WHERE status = 'active')        AS active_tenants,
        (SELECT COUNT(*) FROM users WHERE COALESCE(status, 'active') <> 'deleted') AS total_users,
        (SELECT COUNT(*) FROM domains WHERE verified = TRUE)          AS verified_domains,
        (SELECT COUNT(*) FROM soc_alerts WHERE status = 'open')       AS open_alerts,
        (SELECT COUNT(*) FROM soc_cases  WHERE status = 'open')       AS open_cases
    `);
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── Metrics & Retention ──────────────────────────────────────────────────

  app.get('/metrics', adminGuard, async (req, reply) => {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM e2ee_messages) AS total_messages,
        (SELECT COALESCE(SUM(LENGTH(body_encrypted)), 0) FROM e2ee_messages) AS storage_used_bytes,
        (SELECT COUNT(*) FROM e2ee_keys) AS users_with_keys
    `);
    reply.send({ data: rows[0] });
  });

  app.post('/retention/purge', adminGuard, async (req, reply) => {
    const { rowCount } = await pool.query(`
      DELETE FROM e2ee_messages
      WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days'
        AND legal_hold = FALSE
    `);
    reply.send({ purged_count: rowCount });
  });

  app.post('/simulate-attack', adminGuard, async (req, reply) => {
    let tenantId = await getTenantId(req);
    if (!tenantId) tenantId = 'system';
    
    const { type, message } = req.body || {};
    const severity = 'critical';
    const source_ip = '10.0.0.99';
    const eventType = type || 'manual_simulation';
    const { rows: evRows } = await pool.query(
      `INSERT INTO soc_events (tenant_id, type, severity, source_ip, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, eventType, severity, source_ip, message || 'Manual simulated attack']
    );
    
    await pool.query(
      `INSERT INTO soc_alerts (tenant_id, event_id, severity, message, status)
       VALUES ($1, $2, $3, $4, 'open')`,
      [tenantId, evRows[0].id, severity, message || 'Manual simulated attack']
    );
    
    if (app.io) {
      app.io.emit('soc:new_alert', { title: message || 'Manual simulated attack', ip: source_ip });
    }

    // Trigger SOAR Playbooks asynchronously
    import('../services/soar.mjs').then(({ processSoarPlaybooks }) => {
      processSoarPlaybooks(tenantId, eventType, { source_ip, user_email: null, message });
    }).catch(console.error);
    
    reply.send({ ok: true, message: 'Simulated attack injected into SIEM' });
  });

  // ─── Tenants ──────────────────────────────────────────────────────────────

  app.get('/tenants', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    const { rows } = await pool.query(
      'SELECT * FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    reply.send({ data: rows, limit, offset });
  });

  app.post('/tenants', adminGuard, async (req, reply) => {
    const { id, name, plan = 'starter', region = 'eu-west-1' } = req.body || {};
    if (!id || !name) {
      return reply.status(400).send({ error: 'id and name are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tenants (id, name, plan, region)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, name, plan, region]
    );

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'create', 'tenant', $3, $4)`,
      [id, req.user.sub, JSON.stringify({ id, name, plan }), req.ip]
    );

    reply.status(201).send(rows[0]);
  });

  // ─── Users ────────────────────────────────────────────────────────────────

  app.delete('/tenants/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Tenant not found' });
    await pool.query('UPDATE tenants SET status = $1 WHERE id = $2', ['deleted', id]);
    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'tenant', $3, $4)`,
      [id, req.user.sub, JSON.stringify({ tenant_id: id }), req.ip]
    );
    await pool.query("UPDATE users SET status = 'suspended' WHERE tenant_id = $1", [id]);
    reply.send({ success: true });
  });

  app.get('/users', adminGuard, async (req, reply) => {
    const limit     = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset    = parseInt(req.query.offset || '0', 10);
    const tenantId  = req.query.tenant_id;

    let query = 'SELECT * FROM users';
    const params = [];
    const where = [];

    if (tenantId) {
      params.push(tenantId);
      where.push(`tenant_id = $${params.length}`);
    }

    if (req.query.include_deleted !== 'true') {
      where.push("COALESCE(status, 'active') <> 'deleted'");
    }

    if (where.length) {
      query += ` WHERE ${where.join(' AND ')}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });

  app.post('/users', adminGuard, async (req, reply) => {
    const { tenant_id, email, name = '', role = 'user', quota_mb = 1024, password = '' } = req.body || {};
    if (!tenant_id || !email) {
      return reply.status(400).send({ error: 'tenant_id and email are required' });
    }
    if (!password || password.length < 8) {
      return reply.status(400).send({ error: 'Password is required (min 8 chars)' });
    }
    if (!['user', 'admin', 'soc_analyst', 'soc_manager'].includes(role)) {
      return reply.status(400).send({ error: 'Invalid role' });
    }

    const { rows: existingRows } = await pool.query(
      'SELECT * FROM users WHERE tenant_id=$1 AND email=$2',
      [tenant_id, email]
    );

    let user;
    let auditAction = 'create';

    if (existingRows.length) {
      const existing = existingRows[0];
      if (existing.status !== 'deleted') {
        try {
          await provisionKeycloakUser({ email, name, role, password, enabled: existing.status === 'active' });
        } catch (err) {
          req.log.error({ err, email }, 'Keycloak existing user sync failed');
          return reply.status(502).send({ error: 'Keycloak existing user sync failed' });
        }

        const { rows } = await pool.query(
          `UPDATE users
           SET name=$1, role=$2, quota_mb=$3
           WHERE id=$4
           RETURNING *`,
          [name, role, Number(quota_mb) || 1024, existing.id]
        );
        user = rows[0];
        auditAction = 'sync';
      } else {
        try {
          await provisionKeycloakUser({ email, name, role, password, enabled: true });
        } catch (err) {
          req.log.error({ err, email }, 'Keycloak user restore failed');
          return reply.status(502).send({ error: 'Keycloak user restore failed' });
        }

        const { rows } = await pool.query(
          `UPDATE users
           SET name=$1, role=$2, quota_mb=$3, status='active'
           WHERE id=$4
           RETURNING *`,
          [name, role, Number(quota_mb) || 1024, existing.id]
        );
        user = rows[0];
        auditAction = 'restore';
      }
    } else {
      try {
        await provisionKeycloakUser({ email, name, role, password, enabled: true });
      } catch (err) {
        req.log.error({ err, email }, 'Keycloak user creation failed');
        return reply.status(502).send({ error: 'Keycloak user creation failed' });
      }

      const id = uuidv4();
      const { rows } = await pool.query(
        `INSERT INTO users (id, tenant_id, email, name, role, quota_mb)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, tenant_id, email, name, role, Number(quota_mb) || 1024]
      );
      user = rows[0];
    }

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, $3, 'user', $4, $5)`,
      [
        tenant_id,
        req.user.sub,
        auditAction,
        JSON.stringify({ id: user.id, email: user.email, role: user.role, status: user.status }),
        req.ip,
      ]
    );

    reply.status(auditAction === 'create' ? 201 : 200).send(user);
  });


  app.patch('/users/:id/legal-hold', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { legal_hold } = req.body;
    try {
      const { rows } = await pool.query(
        'UPDATE users SET legal_hold = $1 WHERE id = $2 RETURNING *',
        [legal_hold, id]
      );
      if (rows.length === 0) return reply.status(404).send({ error: 'User not found' });
      reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    } catch (e) {
      reply.status(500).send({ error: e.message });
    }
  });

  app.put('/users/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const {
      name = '',
      role = 'user',
      quota_mb = 1024,
      status = 'active',
      password = '',
    } = req.body || {};

    if (!['user', 'admin', 'soc_analyst', 'soc_manager'].includes(role)) {
      return reply.status(400).send({ error: 'Invalid role' });
    }
    if (!['active', 'suspended', 'deleted'].includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }
    if (password && password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 chars' });
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE users
       SET name=$1, role=$2, quota_mb=$3, status=$4
       WHERE id=$5
       RETURNING *`,
      [name, role, Number(quota_mb) || 1024, status, id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'User not found' });

    const auditAction = status === 'deleted' ? 'delete' : 'update';

    try {
      await syncKeycloakUserStatus({
        email: rows[0].email,
        name: rows[0].name,
        role: rows[0].role,
        status: rows[0].status,
      });
      if (password && rows[0].status === 'active') {
        await resetKeycloakUserPassword({ email: rows[0].email, password });
      }
    } catch (err) {
      req.log.error({ err, email: rows[0].email }, 'Keycloak user status sync failed');
      return reply.status(502).send({ error: 'Keycloak user status sync failed' });
    }

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, $3, 'user', $4, $5)`,
      [
        rows[0].tenant_id,
        req.user.sub,
        auditAction,
        JSON.stringify({ id, email: rows[0].email, role, status }),
        req.ip,
      ]
    );

    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.delete('/users/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';

    if (hardDelete) {
      const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (userRows.length === 0) return reply.status(404).send({ error: 'User not found' });
      const user = userRows[0];

      try {
        await deleteKeycloakUser(user.email);
      } catch (err) {
        req.log.error({ err, email: user.email }, 'Keycloak user hard delete failed');
      }

      await pool.query('DELETE FROM users WHERE id=$1', [id]);
      
      await pool.query('DELETE FROM e2ee_keys WHERE tenant_id=$1 AND user_email=$2', [user.tenant_id, user.email]);

      await pool.query(
        `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
         VALUES ($1, $2, 'hard_delete', 'user', $3, $4)`,
        [user.tenant_id, req.user.sub, JSON.stringify({ id, email: user.email }), req.ip]
      );

      return reply.send({ ok: true, hard_deleted: true });
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE users
       SET status='deleted'
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'User not found' });

    try {
      await syncKeycloakUserStatus({
        email: rows[0].email,
        name: rows[0].name,
        role: rows[0].role,
        status: rows[0].status,
      });
    } catch (err) {
      req.log.error({ err, email: rows[0].email }, 'Keycloak user delete sync failed');
      return reply.status(502).send({ error: 'Keycloak user delete sync failed' });
    }

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'user', $3, $4)`,
      [
        rows[0].tenant_id,
        req.user.sub,
        JSON.stringify({ id, email: rows[0].email }),
        req.ip,
      ]
    );

    reply.send({ ok: true, user: rows[0] });
  });

  // ─── Domains ──────────────────────────────────────────────────────────────

  app.get('/domains', adminGuard, async (req, reply) => {
    const limit    = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset   = parseInt(req.query.offset || '0', 10);
    const tenantId = req.query.tenant_id;

    let query = 'SELECT * FROM domains';
    const params = [];

    if (tenantId) {
      params.push(tenantId);
      query += ` WHERE tenant_id = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });

  app.post('/domains/:id/verify', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows: [domain] } = await pool.query('SELECT * FROM domains WHERE id = $1', [id]);
    if (!domain) return reply.status(404).send({ error: 'Domain not found' });
    if (domain.verified) return reply.send(domain);

    // DNS TXT lookup via system resolver (best-effort)
    let verified = false;
    try {
      const { promises: dns } = await import('dns');
      const records = await dns.resolveTxt(domain.domain);
      const flat = records.flat();
      verified = flat.some(r => r === domain.dns_txt_token);
    } catch (_) { /* DNS failure — not verified */ }

    const { rows: [updated] } = await pool.query(
      'UPDATE domains SET verified = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [verified, id]
    );

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'verify', 'domain', $3, $4)`,
      [domain.tenant_id, req.user.sub, JSON.stringify({ domain: domain.domain, verified }), req.ip]
    );

    if (!verified) {
      return reply.status(400).send({ error: 'DNS TXT record not found. Add the token to your DNS and retry.', domain: updated });
    }
    reply.send(updated);
  });

  app.post('/domains', adminGuard, async (req, reply) => {
    const { tenant_id, domain, is_primary = false } = req.body || {};
    if (!tenant_id || !domain) {
      return reply.status(400).send({ error: 'tenant_id and domain are required' });
    }

    const id            = uuidv4();
    const dns_txt_token = `caspermail-verify=${uuidv4().replace(/-/g, '')}`;

    const { rows } = await pool.query(
      `INSERT INTO domains (id, tenant_id, domain, is_primary, dns_txt_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, tenant_id, domain, is_primary, dns_txt_token]
    );

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'create', 'domain', $3, $4)`,
      [tenant_id, req.user.sub, JSON.stringify({ id, domain }), req.ip]
    );

    reply.status(201).send(rows[0]);
  });

  // ─── GRC: RoPA (Record of Processing Activities) ──────────────────────────

  app.get('/ropa', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM ropa_records WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/ropa', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { process_name, data_categories, legal_basis, retention_period, data_subjects } = req.body;
    
    const { rows } = await pool.query(`
      INSERT INTO ropa_records (id, tenant_id, process_name, data_categories, legal_basis, retention_period, data_subjects)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [uuidv4(), tenantId, process_name, data_categories, legal_basis, retention_period, data_subjects]);
    reply.status(201).send(rows[0]);
  });

  app.delete('/ropa/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    await pool.query('DELETE FROM ropa_records WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    reply.send({ success: true });
  });

  // ─── GRC: DSR (Data Subject Requests) ─────────────────────────────────────

  app.get('/dsr', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM dsr_requests WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/dsr', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { user_email, request_type, details } = req.body;
    
    const { rows } = await pool.query(`
      INSERT INTO dsr_requests (id, tenant_id, user_email, request_type, details)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [uuidv4(), tenantId, user_email, request_type, details]);
    reply.status(201).send(rows[0]);
  });

  app.patch('/dsr/:id/status', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { status } = req.body;
    const { rows } = await pool.query(`
      UPDATE dsr_requests SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [status, req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });

    // If status is completed and type is erasure, delete all messages!
    if (status === 'completed' && rows[0].request_type === 'erasure') {
      await pool.query('DELETE FROM e2ee_messages WHERE (from_email = $1 OR to_email = $1) AND legal_hold = FALSE', [rows[0].user_email]);
    }

    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── GRC: Policies ────────────────────────────────────────────────────────

  app.get('/policies', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM security_policies WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/policies', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { title, content, version } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO security_policies (id, tenant_id, title, content, version)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [uuidv4(), tenantId, title, content, version]);
    reply.status(201).send(rows[0]);
  });


  app.put('/policies/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { title, version, content, is_active } = req.body;
    const { rows } = await pool.query(`
      UPDATE security_policies 
      SET title = $1, version = $2, content = $3, is_active = $4 
      WHERE id = $5 AND tenant_id = $6 RETURNING *
    `, [title, version, content, is_active, req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.delete('/policies/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rowCount } = await pool.query('DELETE FROM security_policies WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send({ ok: true });
  });

  app.get('/policies/acknowledgments', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query(`
      SELECT p.title, p.version, a.user_email, a.acknowledged_at, a.ip_address
      FROM policy_acknowledgments a
      JOIN security_policies p ON a.policy_id = p.id
      WHERE a.tenant_id = $1
      ORDER BY a.acknowledged_at DESC
    `, [tenantId]);
    reply.send({ data: rows });
  });

  // 🛡️ GRC: Vendor Risk Management 🛡️

  app.get('/vendors', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    
    const { rows } = await pool.query(`
      SELECT v.*, 
             d.status as dpa_status, d.signed_at as dpa_signed_at, d.expires_at as dpa_expires_at,
             a.status as assessment_status, a.score as assessment_score, a.completed_at as assessment_completed_at
      FROM vendors v
      LEFT JOIN vendor_dpas d ON d.vendor_id = v.id
      LEFT JOIN vendor_assessments a ON a.vendor_id = v.id
      WHERE v.tenant_id = $1
      ORDER BY v.created_at DESC
    `, [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/vendors', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    
    const { name, contact_email, service_provided, risk_level } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: vendorRows } = await client.query(`
        INSERT INTO vendors (tenant_id, name, contact_email, service_provided, risk_level)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [tenantId, name, contact_email, service_provided, risk_level || 'medium']);
      
      const vendorId = vendorRows[0].id;
      
      await client.query(`INSERT INTO vendor_dpas (vendor_id) VALUES ($1)`, [vendorId]);
      await client.query(`INSERT INTO vendor_assessments (vendor_id) VALUES ($1)`, [vendorId]);
      
      await client.query('COMMIT');
      reply.status(201).send({ ok: true, id: vendorId });
    } catch (e) {
      await client.query('ROLLBACK');
      req.log.error(e);
      reply.status(500).send({ error: 'Failed to create vendor' });
    } finally {
      client.release();
    }
  });

  app.delete('/vendors/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    
    const { rowCount } = await pool.query('DELETE FROM vendors WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return reply.status(404).send({ error: 'Vendor not found' });
    reply.send({ ok: true });
  });

  app.post('/vendors/:id/dpa/sign', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    
    const { rowCount } = await pool.query('SELECT id FROM vendors WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return reply.status(404).send({ error: 'Vendor not found' });
    
    await pool.query(`
      UPDATE vendor_dpas 
      SET status = 'valid', signed_at = NOW(), expires_at = NOW() + INTERVAL '1 year' 
      WHERE vendor_id = $1
    `, [req.params.id]);
    
    reply.send({ ok: true });
  });

  app.post('/vendors/:id/assess', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    
    const { score } = req.body;
    
    const { rowCount } = await pool.query('SELECT id FROM vendors WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return reply.status(404).send({ error: 'Vendor not found' });
    
    await pool.query(`
      UPDATE vendor_assessments 
      SET status = 'completed', score = $2, completed_at = NOW() 
      WHERE vendor_id = $1
    `, [req.params.id, score || 100]);
    
    reply.send({ ok: true });
  });

  // ─── GRC: DPA Agreements ──────────────────────────────────────────────────
  app.get('/dpas', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM dpa_agreements WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/dpas', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { vendor_name, title, expiry_date, document_url } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO dpa_agreements (id, tenant_id, vendor_name, title, status, signed_at, expiry_date, document_url)
      VALUES ($1, $2, $3, $4, 'active', NOW(), $5, $6) RETURNING *
    `, [uuidv4(), tenantId, vendor_name, title, expiry_date, document_url]);
    reply.status(201).send(rows[0]);
  });

  app.patch('/dpas/:id/status', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { status } = req.body;
    const { rows } = await pool.query(`
      UPDATE dpa_agreements SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [status, req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── GRC: Security Trainings ──────────────────────────────────────────────
  app.get('/trainings', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM security_trainings WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/trainings', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { user_email, course_name, status, score } = req.body;
    const { rows } = await pool.query(`
      INSERT INTO security_trainings (id, tenant_id, user_email, course_name, status, score, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [uuidv4(), tenantId, user_email, course_name, status, score, status === 'completed' ? new Date() : null]);
    reply.status(201).send(rows[0]);
  });

  app.patch('/trainings/:id/status', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { status, score } = req.body;
    const { rows } = await pool.query(`
      UPDATE security_trainings SET status = $1::varchar, score = COALESCE($2, score), completed_at = CASE WHEN $1::varchar = 'completed' THEN NOW() ELSE completed_at END
      WHERE id = $3 AND tenant_id = $4 RETURNING *
    `, [status, score, req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });


  // ─── GRC: Aliases ─────────────────────────────────────────────────────────
  app.get('/aliases', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rows } = await pool.query('SELECT * FROM organization_aliases WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    reply.send({ data: rows });
  });

  app.post('/aliases', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { alias_email, members } = req.body;
    try {
      const { rows } = await pool.query(`
        INSERT INTO organization_aliases (id, tenant_id, alias_email, members, created_at)
        VALUES ($1, $2, $3, $4, NOW()) RETURNING *
      `, [uuidv4(), tenantId, alias_email, JSON.stringify(members)]);
      reply.status(201).send(rows[0]);
    } catch (e) {
      if (e.code === '23505') return reply.status(400).send({ error: 'Alias already exists' });
      throw e;
    }
  });

  app.put('/aliases/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { members } = req.body;
    const { rows } = await pool.query(`
      UPDATE organization_aliases SET members = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [JSON.stringify(members), req.params.id, tenantId]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.delete('/aliases/:id', adminGuard, async (req, reply) => {
    const tenantId = await getTenantId(req);
    if (!tenantId) return reply.status(403).send({ error: 'No tenant' });
    const { rowCount } = await pool.query('DELETE FROM organization_aliases WHERE id = $1 AND tenant_id = $2', [req.params.id, tenantId]);
    if (rowCount === 0) return reply.status(404).send({ error: 'Not found' });
    reply.send({ ok: true });
  });

  app.delete('/domains/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM domains WHERE id = $1', [id]);
    if (rows.length === 0) return reply.status(404).send({ error: 'Domain not found' });
    await pool.query('DELETE FROM domains WHERE id = $1', [id]);
    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'domain', $3, $4)`,
      [rows[0].tenant_id, req.user.sub, JSON.stringify({ id, domain: rows[0].domain }), req.ip]
    );
    reply.send({ success: true });
  });

  // 🛡️ Audit Log 🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️🛡️────────────────────────────────────────────────────────────

  app.get('/audit', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();
    const since  = req.query.since;

    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    const userRoles = req.user?.realm_access?.roles || [];
    const isGlobalAdmin = userRoles.includes('casper_admin');

    if (!isGlobalAdmin) {
      let tenantId = req.headers['x-tenant-id'] || req.user?.tenant;
      if (!tenantId && (req.user?.email || req.user?.preferred_username)) {
        const email = req.user.email || req.user.preferred_username;
        const { rows } = await pool.query('SELECT tenant_id FROM users WHERE email = $1', [email]);
        if (rows.length > 0) tenantId = rows[0].tenant_id;
      }
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
      params.push(tenantId);
      query += ` AND tenant_id = $${params.length}`;
    } else if (req.query.tenant_id) {
      params.push(req.query.tenant_id);
      query += ` AND tenant_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (actor ILIKE $${params.length} OR action ILIKE $${params.length} OR resource ILIKE $${params.length})`;
    }

    if (since) {
      const intervalMap = { '1h': '1 hour', '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
      const interval = intervalMap[since];
      if (interval) {
        query += ` AND created_at > NOW() - INTERVAL '${interval}'`;
      }
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });
}

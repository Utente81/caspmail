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
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(email)}&exact=true`,
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
  const token = await keycloakAdminToken();
  const keycloakUser = await findKeycloakUser(token, email);
  if (!keycloakUser) return null;

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  await keycloakJson(
    `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${keycloakUser.id}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...keycloakUser,
        email,
        firstName: name || email,
        enabled: status === 'active',
        emailVerified: true,
      }),
    }
  );

  if (status === 'active') {
    await setKeycloakUserRole(token, keycloakUser.id, role);
  }

  return keycloakUser.id;
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
    reply.send(rows[0]);
  });

  // ─── Tenants ──────────────────────────────────────────────────────────────


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
      reply.send(rows[0]);
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

    reply.send(rows[0]);
  });

  app.delete('/users/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;

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

  // ─── Audit Log ────────────────────────────────────────────────────────────

  app.get('/audit', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();
    const since  = req.query.since;

    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

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

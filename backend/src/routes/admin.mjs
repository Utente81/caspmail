import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import pool from '../db/pool.mjs';
import { requireRole } from '../auth/verify.mjs';
import { logSiemEvent } from '../audit/siem.mjs';

const ADMIN_ROLES = ['admin', 'casper_admin'];
const MANAGED_REALM_ROLES = ['user', 'admin', 'soc_analyst', 'soc_manager'];
const KEYCLOAK_INTERNAL_URL = process.env.KEYCLOAK_INTERNAL_URL || 'http://keycloak:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'caspermail';
const KEYCLOAK_ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER || 'admin';
const KEYCLOAK_ADMIN_PASSWORD_FILE = process.env.KEYCLOAK_ADMIN_PASSWORD_FILE || '/run/secrets/keycloak_admin_password';

// ─── Roles that can see ALL tenants in audit/domains ────────────────────────
const SUPERADMIN_ROLES = ['casper_admin'];

function isSuperAdmin(user) {
  const roles = user?.realm_access?.roles || [];
  return roles.some((r) => SUPERADMIN_ROLES.includes(r));
}

// ─── Keycloak helpers ────────────────────────────────────────────────────────

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

/**
 * Upsert Keycloak user status.
 * If the user does not exist in Keycloak, it is created (reconciliation).
 * Returns the Keycloak user ID.
 */
async function syncKeycloakUserStatus({ email, name, role, status }) {
  const token = await keycloakAdminToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  let keycloakUser = await findKeycloakUser(token, email);
  const enabled = status === 'active';

  if (!keycloakUser) {
    // ── RECONCILIATION: user exists in DB but not in Keycloak ──────────────
    // Recreate the user so the two sources of truth are back in sync.
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
      throw new Error(`Keycloak reconciliation failed for ${email}: ${createRes.status} ${text}`);
    }
    keycloakUser = await findKeycloakUser(token, email);
    if (!keycloakUser?.id) throw new Error(`Keycloak reconciliation: could not find user after create for ${email}`);
  } else {
    // ── UPDATE existing user ────────────────────────────────────────────────
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

  if (enabled) {
    await setKeycloakUserRole(token, keycloakUser.id, role);
  }

  return keycloakUser.id;
}

/**
 * Reset password for a Keycloak user.
 * If the user does not exist, a reconciliation upsert is performed first,
 * then the password is set.
 */
async function resetKeycloakUserPassword({ email, name = '', role = 'user', password }) {
  if (!password) return null;

  const token = await keycloakAdminToken();
  let keycloakUser = await findKeycloakUser(token, email);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (!keycloakUser) {
    // ── RECONCILIATION: upsert before password reset ────────────────────────
    const createRes = await fetch(`${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: email,
        email,
        firstName: name || email,
        enabled: true,
        emailVerified: true,
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Keycloak password-reset reconciliation failed for ${email}: ${createRes.status} ${text}`);
    }
    keycloakUser = await findKeycloakUser(token, email);
    if (!keycloakUser?.id) throw new Error(`Keycloak: could not find user after reconcile for ${email}`);
    await setKeycloakUserRole(token, keycloakUser.id, role);
  }

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

// ─── SOAR playbook config schema validation ──────────────────────────────────

const SOAR_ACTION_SCHEMAS = {
  send_email: ['to', 'subject', 'body'],
  block_ip: ['ip'],
  webhook: ['url'],
  create_case: ['title', 'severity'],
  notify_slack: ['webhook_url', 'message'],
};

const SOAR_TRIGGER_TYPES = ['manual', 'alert_high', 'alert_critical', 'event_login_failure', 'event_data_exfil', 'scheduled'];

function validateSoarPlaybookConfig(trigger_type, action_type, config) {
  const errors = [];

  if (!SOAR_TRIGGER_TYPES.includes(trigger_type)) {
    errors.push(`Invalid trigger_type. Allowed: ${SOAR_TRIGGER_TYPES.join(', ')}`);
  }

  const requiredFields = SOAR_ACTION_SCHEMAS[action_type];
  if (!requiredFields) {
    errors.push(`Invalid action_type. Allowed: ${Object.keys(SOAR_ACTION_SCHEMAS).join(', ')}`);
  } else {
    for (const field of requiredFields) {
      if (!config?.[field]) {
        errors.push(`config.${field} is required for action_type "${action_type}"`);
      }
    }
  }

  return errors;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function adminRoutes(app) {
  const adminGuard = {
  preHandler: async (req, reply) => {
    if (!req.headers.authorization && req.query?.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    return requireRole(ADMIN_ROLES)(req, reply);
  }
};

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

  app.get('/tenants', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();

    let query = "SELECT * FROM tenants WHERE status != 'deleted'";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR id ILIKE $${params.length})`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });

  app.post('/tenants', adminGuard, async (req, reply) => {
    const { name, status = 'active', plan = 'basic' } = req.body || {};
    if (!name) return reply.status(400).send({ error: 'name is required' });

    const id = uuidv4().replace(/-/g, '').slice(0, 20);
    const { rows } = await pool.query(
      `INSERT INTO tenants (id, name, status, plan) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, name, status, plan]
    );

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'create', 'tenant', $3, $4)`,
      [id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id, name }), req.ip]
    );

    reply.status(201).send(rows[0]);
  });

  app.put('/tenants/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { name, status, plan } = req.body || {};

    const { rows, rowCount } = await pool.query(
      `UPDATE tenants SET name=COALESCE($1, name), status=COALESCE($2, status), plan=COALESCE($3, plan)
       WHERE id=$4 RETURNING *`,
      [name, status, plan, id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'Tenant not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'update', 'tenant', $3, $4)`,
      [id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id, name, status, plan }), req.ip]
    );

    reply.send(rows[0]);
  });

  app.delete('/tenants/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    
    const { rowCount } = await pool.query(
      `UPDATE tenants SET status='deleted' WHERE id=$1 RETURNING *`,
      [id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'Tenant not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'tenant', $3, $4)`,
      [id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id }), req.ip]
    );

    reply.send({ ok: true });
  });

  // ─── Users ────────────────────────────────────────────────────────────────

  app.get('/users', adminGuard, async (req, reply) => {
    const limit     = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset    = parseInt(req.query.offset || '0', 10);
    const search    = req.query.search?.trim();
    const tenant_id = req.query.tenant_id;
    const status    = req.query.status;

    let query = `SELECT * FROM users WHERE COALESCE(status, 'active') <> 'deleted'`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (email ILIKE $${params.length} OR name ILIKE $${params.length})`;
    }
    if (tenant_id) {
      params.push(tenant_id);
      query += ` AND tenant_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });

  app.post('/users', adminGuard, async (req, reply) => {
    const {
      tenant_id,
      email,
      name = '',
      role = 'user',
      quota_mb = 1024,
      password = '',
    } = req.body || {};

    if (!tenant_id || !email) {
      return reply.status(400).send({ error: 'tenant_id and email are required' });
    }
    if (!['user', 'admin', 'soc_analyst', 'soc_manager'].includes(role)) {
      return reply.status(400).send({ error: 'Invalid role' });
    }
    if (password && password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 chars' });
    }

    const existing = await pool.query(
      'SELECT id, status FROM users WHERE tenant_id=$1 AND email=$2',
      [tenant_id, email]
    );

    let user;
    let auditAction;

    if (existing.rows.length > 0 && existing.rows[0].status !== 'deleted') {
      return reply.status(409).send({ error: 'User with that email already exists in this tenant' });
    }

    if (existing.rows.length > 0 && existing.rows[0].status === 'deleted') {
      // Re-activate soft-deleted user
      auditAction = 'reactivate';
      try {
        await provisionKeycloakUser({ email, name, role, password, enabled: true });
      } catch (err) {
        req.log.error({ err, email }, 'Keycloak user reactivation failed');
        return reply.status(502).send({ error: 'Keycloak user reactivation failed' });
      }

      const { rows } = await pool.query(
        `UPDATE users SET name=$1, role=$2, quota_mb=$3, status='active'
         WHERE tenant_id=$4 AND email=$5 RETURNING *`,
        [name, role, Number(quota_mb) || 1024, tenant_id, email]
      );
      user = rows[0];
    } else {
      // Create new user
      auditAction = 'create';
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
        (req.user.email || req.user.preferred_username || req.user.sub),
        auditAction,
        JSON.stringify({ id: user.id, email: user.email, role: user.role, status: user.status }),
        req.ip,
      ]
    );

    reply.status(auditAction === 'create' ? 201 : 200).send(user);
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
      // syncKeycloakUserStatus now upserts — will reconcile missing KC users
      await syncKeycloakUserStatus({
        email: rows[0].email,
        name: rows[0].name,
        role: rows[0].role,
        status: rows[0].status,
      });
      if (password && rows[0].status === 'active') {
        await resetKeycloakUserPassword({
          email: rows[0].email,
          name: rows[0].name,
          role: rows[0].role,
          password,
        });
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
        (req.user.email || req.user.preferred_username || req.user.sub),
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
        (req.user.email || req.user.preferred_username || req.user.sub),
        JSON.stringify({ id, email: rows[0].email }),
        req.ip,
      ]
    );

    reply.send({ ok: true, user: rows[0] });
  });

  // ─── Legal Hold (Enterprise) ─────────────────────────────────────────────

  app.patch('/users/:id/legal-hold', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { legal_hold } = req.body || {};

    const { rows, rowCount } = await pool.query(
      `UPDATE users
       SET legal_hold = $1
       WHERE id = $2
       RETURNING *`,
      [!!legal_hold, id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'User not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'update_legal_hold', 'user', $3, $4)`,
      [
        rows[0].tenant_id,
        (req.user.email || req.user.preferred_username || req.user.sub),
        JSON.stringify({ id, email: rows[0].email, legal_hold: !!legal_hold }),
        req.ip,
      ]
    );

    reply.send(rows[0]);
  });

  // ─── Data Retention / GDPR Purge ────────────────────────────────────────

  app.post('/retention/purge', adminGuard, async (req, reply) => {
    let tenantId;
    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    } else {
      tenantId = req.body?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant_id required for superadmin' });
    }

    // Hard-delete messages older than 30 days that are marked as deleted (soft delete)
    // AND neither the message itself nor its sender/recipient are under legal_hold.
    const { rowCount } = await pool.query(`
      DELETE FROM e2ee_messages 
      WHERE tenant_id = $1 
        AND deleted_at < NOW() - INTERVAL '30 days'
        AND legal_hold = FALSE
        AND from_email NOT IN (SELECT email FROM users WHERE tenant_id = $1 AND legal_hold = TRUE)
        AND to_email NOT IN (SELECT email FROM users WHERE tenant_id = $1 AND legal_hold = TRUE)
    `, [tenantId]);

    // Also purge trash where both sender and recipient have deleted it long ago
    const { rowCount: trashCount } = await pool.query(`
      DELETE FROM e2ee_messages
      WHERE tenant_id = $1
        AND sender_deleted_at < NOW() - INTERVAL '30 days'
        AND recipient_deleted_at < NOW() - INTERVAL '30 days'
        AND legal_hold = FALSE
        AND from_email NOT IN (SELECT email FROM users WHERE tenant_id = $1 AND legal_hold = TRUE)
        AND to_email NOT IN (SELECT email FROM users WHERE tenant_id = $1 AND legal_hold = TRUE)
    `, [tenantId]);

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'gdpr_purge', 'e2ee_messages', $3, $4)`,
      [tenantId, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ purged_count: rowCount + trashCount }), req.ip]
    );

    reply.send({ ok: true, purged_count: rowCount + trashCount });
  });

  // ─── User Sessions ────────────────────────────────────────────────────────

  app.get('/users/:id/sessions', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    if (!rows.length) return reply.status(404).send({ error: 'User not found' });
    
    try {
      const token = await keycloakAdminToken();
      const kcUser = await findKeycloakUser(token, rows[0].email);
      if (!kcUser) return reply.send({ data: [] });

      const sessions = await keycloakJson(
        `${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${kcUser.id}/sessions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      reply.send({ data: sessions });
    } catch (e) {
      req.log.error({ err: e }, 'Failed to fetch sessions');
      reply.send({ data: [] }); 
    }
  });

  app.post('/users/:id/logout', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT email, tenant_id FROM users WHERE id = $1', [id]);
    if (!rows.length) return reply.status(404).send({ error: 'User not found' });

    try {
      const token = await keycloakAdminToken();
      const kcUser = await findKeycloakUser(token, rows[0].email);
      if (kcUser) {
        await fetch(`${KEYCLOAK_INTERNAL_URL}/admin/realms/${KEYCLOAK_REALM}/users/${kcUser.id}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      await pool.query(
        `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
         VALUES ($1, $2, 'revoke_session', 'user', $3, $4)`,
        [rows[0].tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ target_user: rows[0].email }), req.ip]
      );

      reply.send({ ok: true });
    } catch (e) {
      req.log.error({ err: e }, 'Failed to logout user');
      reply.status(500).send({ error: 'Failed to logout user' });
    }
  });

  // ─── Domains ──────────────────────────────────────────────────────────────

  app.get('/domains', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    // Non-superadmins can only see their own tenant's domains
    const tenantId = isSuperAdmin(req.user) ? req.query.tenant_id : req.user.tenant_id;

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
      [domain.tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ domain: domain.domain, verified }), req.ip]
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
      [tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id, domain }), req.ip]
    );

    reply.status(201).send(rows[0]);
  });

  // ─── Audit Log ────────────────────────────────────────────────────────────

  app.get('/audit', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();
    const since  = req.query.since;

    // ── Tenant scoping: non-superadmins only see their own tenant's log ─────
    const params = [];
    let query = 'SELECT * FROM audit_log WHERE 1=1';

    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      const tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
      params.push(tenantId);
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

  app.get('/audit/export', adminGuard, async (req, reply) => {
    // ── Tenant scoping: non-superadmins only see their own tenant's log ─────
    const params = [];
    let query = 'SELECT * FROM audit_log WHERE 1=1';

    let tenantId;
    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
      params.push(tenantId);
      query += ` AND tenant_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 5000'; // Export up to 5k recent logs
    const { rows } = await pool.query(query, params);

    // CSV serialization
    const header = ['ID', 'Tenant ID', 'Timestamp', 'Actor', 'Action', 'Resource', 'Details', 'IP'];
    const csvRows = [header.join(',')];
    
    for (const row of rows) {
      csvRows.push([
        row.id,
        row.tenant_id,
        row.created_at.toISOString(),
        `"${row.actor}"`,
        row.action,
        row.resource,
        `"${JSON.stringify(row.details).replace(/"/g, '""')}"`,
        row.ip || ''
      ].join(','));
    }

    const csvData = csvRows.join('\n');

    logSiemEvent({
      tenantId: tenantId || 'system',
      actor: (req.user.email || req.user.preferred_username || req.user.sub) || req.user.email || req.user.preferred_username,
      action: 'export_data',
      resource: 'audit_log',
      details: { format: 'csv', records: rows.length },
      ip: req.ip
    });

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="audit_export.csv"');
    reply.send(csvData);
  });

  app.get('/metrics', adminGuard, async (req, reply) => {
    let tenantId;
    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    }

    try {
      const tenantFilter = tenantId ? 'WHERE tenant_id = $1' : '';
      const params = tenantId ? [tenantId] : [];

      const usersRes = await pool.query(`SELECT COUNT(*) as count FROM users ${tenantFilter}`, params);
      const msgsRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(body_encrypted) + LENGTH(subject_encrypted)), 0) as storage FROM e2ee_messages ${tenantFilter}`, params);
      const keysRes = await pool.query(`SELECT COUNT(DISTINCT user_email) as count FROM e2ee_keys ${tenantFilter}`, params);

      reply.send({
        data: {
          total_users: parseInt(usersRes.rows[0].count, 10),
          total_messages: parseInt(msgsRes.rows[0].count, 10),
          storage_used_bytes: parseInt(msgsRes.rows[0].storage, 10),
          users_with_keys: parseInt(keysRes.rows[0].count, 10)
        }
      });
    } catch (e) {
      reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
  });

  // ─── SOAR Playbooks ───────────────────────────────────────────────────────

  app.get('/soar/playbooks', adminGuard, async (req, reply) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const tenantRes = await pool.query(
      'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
      [req.user.email || req.user.preferred_username]
    );
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });

    const { rows } = await pool.query(
      `SELECT * FROM soar_playbooks WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );
    reply.send({ data: rows, limit, offset });
  });

  app.post('/soar/playbooks', adminGuard, async (req, reply) => {
    const { name, trigger_type, action_type, config = {} } = req.body || {};
    if (!name || !trigger_type || !action_type) {
      return reply.status(400).send({ error: 'name, trigger_type, and action_type are required' });
    }

    // ── Validate playbook config schema ─────────────────────────────────────
    const validationErrors = validateSoarPlaybookConfig(trigger_type, action_type, config);
    if (validationErrors.length > 0) {
      return reply.status(400).send({ error: 'Invalid playbook configuration', details: validationErrors });
    }

    const tenantRes = await pool.query(
      'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
      [req.user.email || req.user.preferred_username]
    );
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO soar_playbooks (id, tenant_id, name, trigger_type, action_type, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, tenantId, name, trigger_type, action_type, JSON.stringify(config), (req.user.email || req.user.preferred_username || req.user.sub)]
    );

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'create', 'soar_playbook', $3, $4)`,
      [tenantId, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id, name, trigger_type, action_type }), req.ip]
    );

    reply.status(201).send(rows[0]);
  });

  app.put('/soar/playbooks/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { name, trigger_type, action_type, config, status } = req.body || {};

    // ── Validate config only if action_type and/or config are being updated ─
    if (trigger_type || action_type || config !== undefined) {
      const current = await pool.query('SELECT * FROM soar_playbooks WHERE id=$1', [id]);
      if (current.rowCount === 0) return reply.status(404).send({ error: 'Playbook not found' });

      const effectiveTrigger = trigger_type || current.rows[0].trigger_type;
      const effectiveAction  = action_type  || current.rows[0].action_type;
      const effectiveConfig  = config       !== undefined ? config : current.rows[0].config;

      const validationErrors = validateSoarPlaybookConfig(effectiveTrigger, effectiveAction, effectiveConfig);
      if (validationErrors.length > 0) {
        return reply.status(400).send({ error: 'Invalid playbook configuration', details: validationErrors });
      }
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE soar_playbooks
       SET name=COALESCE($1, name),
           trigger_type=COALESCE($2, trigger_type),
           action_type=COALESCE($3, action_type),
           config=COALESCE($4::jsonb, config),
           status=COALESCE($5, status),
           updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, trigger_type, action_type, config ? JSON.stringify(config) : null, status, id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'Playbook not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'update', 'soar_playbook', $3, $4)`,
      [rows[0].tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id, name, status }), req.ip]
    );

    reply.send(rows[0]);
  });

  app.delete('/soar/playbooks/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows, rowCount } = await pool.query(
      `UPDATE soar_playbooks SET status='inactive', updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id]
    );
    if (rowCount === 0) return reply.status(404).send({ error: 'Playbook not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'soar_playbook', $3, $4)`,
      [rows[0].tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ id }), req.ip]
    );

    reply.send({ ok: true });
  });

  // ─── Organization Aliases ──────────────────────────────────────────────────

  app.get('/aliases', adminGuard, async (req, reply) => {
    let tenantId;
    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    }

    const query = tenantId 
      ? 'SELECT * FROM organization_aliases WHERE tenant_id = $1 ORDER BY created_at DESC' 
      : 'SELECT * FROM organization_aliases ORDER BY created_at DESC';
    const params = tenantId ? [tenantId] : [];
    
    const { rows } = await pool.query(query, params);
    reply.send({ data: rows });
  });

  app.post('/aliases', adminGuard, async (req, reply) => {
    const { alias_email, members } = req.body || {};
    if (!alias_email || !members || !Array.isArray(members)) {
      return reply.status(400).send({ error: 'alias_email and members array are required' });
    }

    let tenantId;
    if (!isSuperAdmin(req.user)) {
      const tenantRes = await pool.query(
        'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
        [req.user.email || req.user.preferred_username]
      );
      tenantId = tenantRes.rows[0]?.tenant_id;
      if (!tenantId) return reply.status(403).send({ error: 'No tenant association' });
    } else {
      tenantId = req.body.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenant_id is required for superadmins' });
    }

    try {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      const { rows } = await pool.query(
        `INSERT INTO organization_aliases (id, tenant_id, alias_email, members)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
        [id, tenantId, alias_email, JSON.stringify(members)]
      );

      await pool.query(
        `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
         VALUES ($1, $2, 'create', 'alias', $3, $4)`,
        [tenantId, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ alias_email, members }), req.ip]
      );

      reply.status(201).send(rows[0]);
    } catch (e) {
      if (e.code === '23505') {
        reply.status(409).send({ error: 'Alias already exists' });
      } else {
        reply.status(500).send({ error: 'Failed to create alias' });
      }
    }
  });

  app.put('/aliases/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { members } = req.body || {};
    if (!members || !Array.isArray(members)) {
      return reply.status(400).send({ error: 'members array is required' });
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE organization_aliases SET members = $1::jsonb WHERE id = $2 RETURNING *`,
      [JSON.stringify(members), id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'Alias not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'update', 'alias', $3, $4)`,
      [rows[0].tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ alias_email: rows[0].alias_email, members }), req.ip]
    );

    reply.send(rows[0]);
  });

  app.delete('/aliases/:id', adminGuard, async (req, reply) => {
    const { id } = req.params;
    const { rows, rowCount } = await pool.query(
      `DELETE FROM organization_aliases WHERE id = $1 RETURNING *`,
      [id]
    );

    if (rowCount === 0) return reply.status(404).send({ error: 'Alias not found' });

    await pool.query(
      `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
       VALUES ($1, $2, 'delete', 'alias', $3, $4)`,
      [rows[0].tenant_id, (req.user.email || req.user.preferred_username || req.user.sub), JSON.stringify({ alias_email: rows[0].alias_email }), req.ip]
    );

    reply.send({ ok: true });
  });
}

import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.mjs';
import { requireAuth, requireRole } from '../auth/verify.mjs';
import { logSiemEvent } from '../audit/siem.mjs';

const authGuard = { preHandler: requireAuth };
const socGuard = { preHandler: requireRole(['soc_analyst', 'soc_manager', 'admin', 'casper_admin']) };
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://casper-vault.caspermail.svc.cluster.local:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN;

async function wrapKey(plaintext) {
  if (!VAULT_TOKEN) throw new Error("Vault Token missing");
  const res = await fetch(`${VAULT_ADDR}/v1/transit/encrypt/caspmail-kek`, {
    method: 'POST',
    headers: { 'X-Vault-Token': VAULT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plaintext: Buffer.from(plaintext).toString('base64') })
  });
  if (!res.ok) throw new Error("Vault wrap failed");
  const data = await res.json();
  return data.data.ciphertext;
}

async function unwrapKey(ciphertext) {
  if (!VAULT_TOKEN) throw new Error("Vault Token missing");
  const res = await fetch(`${VAULT_ADDR}/v1/transit/decrypt/caspmail-kek`, {
    method: 'POST',
    headers: { 'X-Vault-Token': VAULT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext })
  });
  if (!res.ok) throw new Error("Vault unwrap failed");
  const data = await res.json();
  return Buffer.from(data.data.plaintext, 'base64').toString('utf8');
}

export default async function mailRoutes(app) {
  // Helper: look up user row from JWT email
  async function getUser(jwtPayload) {
    let email = jwtPayload.email || jwtPayload.preferred_username || jwtPayload.sub;
    let tenantId = jwtPayload.tenant_id || jwtPayload.tenant;
    
    if (!email) throw new Error("Missing email, username and sub in JWT");
    if (!tenantId) throw new Error("Missing tenant_id in JWT");

    let { rows } = await pool.query(
      'SELECT id, tenant_id, email, name, role, status FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
      [email, tenantId]
    );

    if (rows.length === 0) {
      const name = jwtPayload.name || email.split('@')[0];
      try {
        const res = await pool.query(
          `INSERT INTO users (tenant_id, email, name, quota_mb) VALUES ($1, $2, $3, 500) RETURNING *`,
          [tenantId, email, name]
        );
        rows = res.rows;
      } catch (e) {
        throw new Error("AUTO_PROVISION_FAIL: " + e.message + " | email: " + email);
      }
    }
    
    if (!rows[0]) throw new Error("User row is empty after insert");
    if (rows[0].status === 'suspended' || rows[0].status === 'deleted') {
      throw new Error("User account is inactive");
    }
    return rows[0];
  }

  // ─── Current User ─────────────────────────────────────────────────────────

  app.get('/api/discovery/:domain', async (req, reply) => {
    const { domain } = req.params;
    
    // Check if domain exists in domains table and get tenant
    const { rows: domainRows } = await pool.query('SELECT tenant_id FROM domains WHERE domain = $1', [domain]);
    
    if (domainRows.length > 0) {
      const tenantId = domainRows[0].tenant_id;
      // Get mobile policies
      const { rows: policyRows } = await pool.query('SELECT * FROM tenant_mobile_policies WHERE tenant_id = $1', [tenantId]);
      
      const policies = policyRows.length > 0 ? policyRows[0] : { require_biometrics: false, prevent_screenshots: false };
      
      return reply.send({
        type: 'enterprise',
        tenantId,
        requireBiometrics: policies.require_biometrics,
        preventScreenshots: policies.prevent_screenshots,
        oidcIssuer: `https://auth.enterprise.caspmail.com/realms/${tenantId}`
      });
    }

    // Default response for caspmail.com or unknown
    reply.send({
      type: 'standard',
      apiUrl: 'https://api.caspmail.com'
    });
  });

  app.get('/api/me', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    reply.send(user); // nosemgrep // nosemgrep
  });

  app.get('/api/me/dashboard', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const [inbox, keys, storage] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE read_at IS NULL) AS unread
        FROM e2ee_messages
        WHERE tenant_id = $1 AND to_email = $2 AND deleted_at IS NULL AND recipient_deleted_at IS NULL
          AND COALESCE((recipient_flags->>'spam')::boolean, false) = false
          AND COALESCE((recipient_flags->>'archived')::boolean, false) = false
      `, [user.tenant_id, user.email]),
      pool.query(`
        SELECT key_fingerprint, created_at
        FROM e2ee_keys
        WHERE tenant_id = $1 AND user_email = $2
        LIMIT 1
      `, [user.tenant_id, user.email]),
      pool.query(`
        SELECT
          COUNT(*) AS message_count,
          COALESCE(SUM(
            octet_length(COALESCE(subject_encrypted,'')) +
            octet_length(COALESCE(body_encrypted,'')) +
            octet_length(COALESCE(nonce,''))
          ), 0) AS bytes_used
        FROM e2ee_messages
        WHERE tenant_id = $1 AND to_email = $2 AND deleted_at IS NULL
      `, [user.tenant_id, user.email]),
    ]);

    const bytesUsed = Number(storage.rows[0]?.bytes_used || 0);
    const mbUsed    = Math.round(bytesUsed / 1024 / 1024 * 100) / 100;
    const quotaMb   = user.quota_mb || 100;

    reply.send({
      user,
      inbox: inbox.rows[0],
      has_keys: keys.rows.length > 0,
      key_fingerprint: keys.rows[0]?.key_fingerprint || null,
      storage: {
        used_mb:    mbUsed,
        quota_mb:   quotaMb,
        used_pct:   Math.min(100, Math.round((mbUsed / quotaMb) * 100)),
        bytes_used: bytesUsed,
      },
    });
  });

  // ─── E2EE Keys ────────────────────────────────────────────────────────────

  



  app.post('/api/e2ee/me/keys', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      const { public_key, key_fingerprint, private_key_encrypted, private_key_salt, escrow_data, escrow_aes, escrow_iv } = req.body || {};
      if (!public_key || !key_fingerprint) {
        return reply.status(400).send({ error: 'public_key and key_fingerprint are required' });
      }

      let finalEncryptedKey = private_key_encrypted || null;
      if (finalEncryptedKey) {
        finalEncryptedKey = await wrapKey(finalEncryptedKey);
      }

      const { rows } = await pool.query(
        `INSERT INTO e2ee_keys (tenant_id, user_email, public_key, key_fingerprint, private_key_encrypted, private_key_salt, escrow_data, escrow_aes, escrow_iv)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tenant_id, user_email)
         DO UPDATE SET public_key = EXCLUDED.public_key,
                       key_fingerprint = EXCLUDED.key_fingerprint,
                       private_key_encrypted = EXCLUDED.private_key_encrypted,
                       private_key_salt = EXCLUDED.private_key_salt,
                       escrow_data = EXCLUDED.escrow_data,
                       escrow_aes = EXCLUDED.escrow_aes,
                       escrow_iv = EXCLUDED.escrow_iv,
                       created_at = NOW()
         RETURNING *`,
        [user.tenant_id, user.email, public_key, key_fingerprint, finalEncryptedKey, private_key_salt || null, escrow_data || null, escrow_aes || null, escrow_iv || null]
      );

      reply.status(201).send(rows[0]);
    } catch (e) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.get('/api/e2ee/me/keys', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      const { rows } = await pool.query(
        'SELECT id, user_id, public_key, created_at FROM e2ee_keys WHERE tenant_id = $1 AND user_email = $2',
        [user.tenant_id, user.email]
      );

      for (let row of rows) {
        if (row.private_key_encrypted && row.private_key_encrypted.startsWith('vault:v1:')) {
          row.private_key_encrypted = await unwrapKey(row.private_key_encrypted);
        }
      }

      reply.send({ data: rows }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    } catch (e) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.get('/api/e2ee/corporate-key', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      const { rows } = await pool.query('SELECT public_key FROM corporate_master_keys WHERE tenant_id = $1', [user.tenant_id]);
      if (rows.length === 0) return reply.status(404).send({ error: 'Corporate Master Key not found' });
      reply.send(rows[0]);
    } catch(e) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.post('/api/e2ee/corporate-key', { preHandler: requireRole(['soc_manager', 'casper_admin']) }, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      // In a real app, only SOC admins can post this.
      const { public_key } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO corporate_master_keys (tenant_id, public_key) VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO UPDATE SET public_key = EXCLUDED.public_key RETURNING public_key`,
         [user.tenant_id, public_key]
      );
      reply.send(rows[0]);
    } catch(e) {
      reply.status(400).send({ error: e.message });
    }
  });

  // ─── PFS PreKeys ────────────────────────────────────────────────────────────
  
  app.post('/api/e2ee/me/prekeys', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      const { keys } = req.body;
      if (!keys || !Array.isArray(keys)) return reply.status(400).send({ error: 'keys array is required' });

      let count = 0;
      for (const k of keys) {
        if (!k.prekey_id || !k.public_key || !k.private_key_encrypted) continue;
        const wrappedPrivate = await wrapKey(k.private_key_encrypted);
        await pool.query(
          `INSERT INTO e2ee_prekeys (id, tenant_id, user_email, prekey_id, public_key, private_key_encrypted, escrow_data, escrow_aes, escrow_iv)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
          [uuidv4(), user.tenant_id, user.email, k.prekey_id, k.public_key, wrappedPrivate, k.escrow_data || null, k.escrow_aes || null, k.escrow_iv || null]
        );
        count++;
      }
      reply.status(201).send({ success: true, count });
    } catch (e) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.get('/api/e2ee/prekeys/fetch/:email', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      if (!user) return reply.status(404).send({ error: 'User not found' });
      const email = req.params.email;

      const { rows } = await pool.query(
        `UPDATE e2ee_prekeys
         SET used = true
         WHERE id = (
           SELECT id FROM e2ee_prekeys
           WHERE tenant_id = $1 AND user_email = $2 AND used = false
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING prekey_id, public_key`,
        [user.tenant_id, email]
      );

      if (rows.length === 0) {
        return reply.send({ fallback: true });
      }
      reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    } catch (e) {
      reply.status(400).send({ error: e.message });
    }
  });

  app.get('/api/e2ee/me/prekeys/sync', authGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      // Fetch all USED prekeys (since we only need to decrypt messages received)
      // Actually, we need to fetch all of them so IndexedDB is fully seeded for future receives too.
      const { rows } = await pool.query(
        'SELECT prekey_id, public_key, private_key_encrypted, used FROM e2ee_prekeys WHERE tenant_id = $1 AND user_email = $2 ORDER BY created_at DESC',
        [user.tenant_id, user.email]
      );

      for (let row of rows) {
        if (row.private_key_encrypted && row.private_key_encrypted.startsWith('vault:v1:')) {
          row.private_key_encrypted = await unwrapKey(row.private_key_encrypted);
        }
      }

      reply.send({ data: rows }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    } catch (e) {
      reply.status(400).send({ error: e.message });
    }
  });

  // ─── Policy Acknowledgments (ISO 27001) ───────────────────────────────────

  app.get('/api/me/policies', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    // Fetch active policies that the user hasn't acknowledged yet
    const { rows } = await pool.query(`
      SELECT p.id, p.title, p.content, p.version
      FROM security_policies p
      WHERE p.tenant_id = $1 AND p.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM policy_acknowledgments a
          WHERE a.policy_id = p.id AND a.user_email = $2
        )
    `, [user.tenant_id, user.email]);

    reply.send({ pending_policies: rows });
  });

  app.post('/api/me/policies/:id/acknowledge', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

    const { rows } = await pool.query(`
      INSERT INTO policy_acknowledgments (id, tenant_id, policy_id, user_email, ip_address)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (policy_id, user_email) DO NOTHING
      RETURNING *
    `, [uuidv4(), user.tenant_id, req.params.id, user.email, ip]);

    reply.send({ success: true });
  });

  // ─── Messages (Inbox) ─────────────────────────────────────────────────────

  app.get('/api/e2ee/messages', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const folder = req.query.folder || 'inbox';
    const unread = req.query.unread === 'true';

    let query = `
      SELECT id, from_email, to_email, subject_encrypted, nonce, created_at, read_at, sender_flags, recipient_flags, sender_deleted_at, recipient_deleted_at, sender_subject_encrypted, sender_nonce, expires_at
      FROM e2ee_messages
      WHERE tenant_id = $1 AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (from_email != $2 OR COALESCE((sender_flags->>'cleared')::boolean, false) = false)
        AND (to_email != $2 OR COALESCE((recipient_flags->>'cleared')::boolean, false) = false)
    `;
    const params = [user.tenant_id, user.email];

    if (folder === 'inbox') {
      query += ` AND to_email = $2 AND recipient_deleted_at IS NULL 
                 AND COALESCE((recipient_flags->>'spam')::boolean, false) = false 
                 AND COALESCE((recipient_flags->>'archived')::boolean, false) = false AND recipient_flags->>'folder_id' IS NULL`;
    } else if (folder === 'sent') {
      query += ` AND from_email = $2 AND sender_deleted_at IS NULL AND sender_flags->>'folder_id' IS NULL`;
    } else if (folder === 'trash') {
      query += ` AND (
        (from_email = $2 AND sender_deleted_at IS NOT NULL) OR
        (to_email = $2 AND recipient_deleted_at IS NOT NULL)
      )`;
    } else if (folder === 'archive') {
      query += ` AND to_email = $2 AND recipient_deleted_at IS NULL AND COALESCE((recipient_flags->>'archived')::boolean, false) = true`;
    } else if (folder === 'spam') {
      query += ` AND to_email = $2 AND recipient_deleted_at IS NULL AND COALESCE((recipient_flags->>'spam')::boolean, false) = true`;
    } else if (folder === 'important') {
      query += ` AND (
        (to_email = $2 AND recipient_deleted_at IS NULL AND COALESCE((recipient_flags->>'important')::boolean, false) = true) OR
        (from_email = $2 AND sender_deleted_at IS NULL AND COALESCE((sender_flags->>'important')::boolean, false) = true)
      )`;
    } else {
      // Custom folder
      params.push(folder);
      query += ` AND (
        (to_email = $2 AND recipient_deleted_at IS NULL AND recipient_flags->>'folder_id' = $3) OR
        (from_email = $2 AND sender_deleted_at IS NULL AND sender_flags->>'folder_id' = $3)
      )`;
    }

    if (unread) {
      query += ' AND read_at IS NULL';
    }

    params.push(limit, offset);
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    
    // Remap for sender double encryption
    const mappedRows = rows.map(r => {
      if (r.from_email === user.email && r.to_email !== user.email && r.sender_subject_encrypted) {
         return {
           ...r,
           subject_encrypted: r.sender_subject_encrypted,
           nonce: r.sender_nonce
         }
      }
      return r;
    });

    reply.send({ data: mappedRows, limit, offset, folder }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── Send Message ─────────────────────────────────────────────────────────

  app.post('/api/e2ee/messages', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const { to_email, subject_encrypted, body_encrypted, nonce, sender_subject_encrypted, sender_body_encrypted, sender_nonce, attachments, expires_at } = req.body || {};
    if (!to_email || !subject_encrypted || !body_encrypted || !nonce) {
      return reply.status(400).send({
        error: 'to_email, subject_encrypted, body_encrypted, and nonce are required',
      });
    }

    // Recipient must exist in the same tenant
    const res = await pool.query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [user.tenant_id, to_email]
    );
    if (res.rowCount === 0) {
      return reply.status(404).send({ error: 'Recipient not found in your tenant' });
    }

    // Enforce sender quota
    const { rows: qRows } = await pool.query(`
      SELECT COALESCE(SUM(
        octet_length(COALESCE(subject_encrypted,'')) +
        octet_length(COALESCE(body_encrypted,'')) +
        octet_length(COALESCE(nonce,''))
      ), 0) AS bytes_used
      FROM e2ee_messages
      WHERE tenant_id=$1 AND from_email=$2 AND deleted_at IS NULL
    `, [user.tenant_id, user.email]);
    const usedMb = Number(qRows[0].bytes_used) / 1024 / 1024;
    if (user.quota_mb && usedMb >= user.quota_mb) {
      return reply.status(413).send({ error: `Storage quota exceeded (${user.quota_mb} MB). Delete old messages to free space.` });
    }

    // Anti-Spam: Check if the user has sent more than 10 messages in the last 15 minutes
    const { rows: recentSent } = await pool.query(
      `SELECT COUNT(*) as recent_count FROM e2ee_messages WHERE tenant_id = $1 AND from_email = $2 AND created_at > NOW() - INTERVAL '15 minutes'`,
      [user.tenant_id, user.email]
    );
    const recentCount = parseInt(recentSent[0]?.recent_count || '0', 10);
    
    let recipientFlagsObj = {};
    if (recentCount >= 10) {
      recipientFlagsObj.spam = true;
    }
    if (req.body.prekey_id) {
      recipientFlagsObj.prekey_id = req.body.prekey_id;
    }
    const recipient_flags = JSON.stringify(recipientFlagsObj);

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO e2ee_messages
         (id, tenant_id, from_email, to_email, subject_encrypted, body_encrypted, nonce, sender_subject_encrypted, sender_body_encrypted, sender_nonce, recipient_flags, attachments, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [id, user.tenant_id, user.email, to_email, subject_encrypted, body_encrypted, nonce, sender_subject_encrypted, sender_body_encrypted, sender_nonce, recipient_flags, attachments ? JSON.stringify(attachments) : '[]', expires_at || null]
    );

    reply.status(201).send(rows[0]);
  });

  // ─── Public Key Lookup (for composers) ───────────────────────────────────

  app.get('/api/e2ee/keys/:email', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const email = req.params.email;

    // Check if it's an alias
    const res = await pool.query(
      'SELECT members FROM organization_aliases WHERE tenant_id = $1 AND alias_email = $2',
      [user.tenant_id, email]
    );

    let emailsToFetch = [email];
    if (res.rowCount > 0 && Array.isArray(res.rows[0].members)) {
      emailsToFetch = res.rows[0].members;
    }

    if (emailsToFetch.length === 0) {
      return reply.send({ data: [] }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    }

    const { rows } = await pool.query(
      'SELECT user_email, public_key, key_fingerprint, created_at FROM e2ee_keys WHERE tenant_id = $1 AND user_email = ANY($2::varchar[])',
      [user.tenant_id, emailsToFetch]
    );

    reply.send({ data: rows }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── Get Single Message ───────────────────────────────────────────────────

  app.get('/api/e2ee/messages/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const { rows, rowCount } = await pool.query(
      `SELECT id, from_email, to_email, subject_encrypted, body_encrypted, nonce, created_at, status FROM e2ee_messages
       WHERE id = $1
         AND tenant_id = $2
         AND (to_email = $3 OR from_email = $3)
         AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [req.params.id, user.tenant_id, user.email]
    );

    if (rowCount === 0) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    const msg = rows[0];

    // Mark as read if the recipient is viewing it
    if (msg.to_email === user.email && !msg.read_at) {
      const res = await pool.query(
        'UPDATE e2ee_messages SET read_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      msg.read_at = new Date().toISOString();

      logSiemEvent({
        tenantId: user.tenant_id,
        actor: user.email,
        action: 'read_mail',
        resource: req.params.id,
        details: { from: msg.from_email, to: msg.to_email },
        ip: req.ip
      });
    }

    // Remap payload if sender is requesting their sent message
    if (msg.from_email === user.email && msg.to_email !== user.email && msg.sender_subject_encrypted) {
      msg.subject_encrypted = msg.sender_subject_encrypted;
      msg.body_encrypted = msg.sender_body_encrypted;
      msg.nonce = msg.sender_nonce;
    }

    reply.send(msg); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── Trash / Delete / Flags ───────────────────────────────────────────────────────

  app.patch('/api/e2ee/messages/:id/flags', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    
    const { flags } = req.body; 
    if (!flags || typeof flags !== 'object') return reply.status(400).send({error: 'Invalid flags'});

    const { rows } = await pool.query(`
      UPDATE e2ee_messages
      SET
        sender_flags = CASE WHEN from_email = $2 THEN sender_flags || $4::jsonb ELSE sender_flags END,
        recipient_flags = CASE WHEN to_email = $2 THEN recipient_flags || $4::jsonb ELSE recipient_flags END
      WHERE id = $1 AND tenant_id = $3 AND (from_email = $2 OR to_email = $2)
      RETURNING id, sender_flags, recipient_flags
    `, [req.params.id, user.email, user.tenant_id, JSON.stringify(flags)]);
    
    if (rows.length === 0) return reply.status(404).send({ error: 'Message not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.patch('/api/e2ee/messages/:id/trash', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const { rows } = await pool.query(`
      UPDATE e2ee_messages
      SET
        sender_deleted_at = CASE WHEN from_email = $2 THEN NOW() ELSE sender_deleted_at END,
        recipient_deleted_at = CASE WHEN to_email = $2 THEN NOW() ELSE recipient_deleted_at END
      WHERE id = $1 AND tenant_id = $3 AND (from_email = $2 OR to_email = $2)
      RETURNING *
    `, [req.params.id, user.email, user.tenant_id]);

    if (rows.length === 0) return reply.status(404).send({ error: 'Message not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.delete('/api/e2ee/messages/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const { id } = req.params;
    try {
      await pool.query(
        "UPDATE e2ee_messages SET sender_flags = COALESCE(sender_flags, '{}'::jsonb) || '{\"cleared\":true}'::jsonb WHERE tenant_id = $1 AND from_email = $2 AND id = $3",
        [user.tenant_id, user.email, id]
      );
      await pool.query(
        "UPDATE e2ee_messages SET recipient_flags = COALESCE(recipient_flags, '{}'::jsonb) || '{\"cleared\":true}'::jsonb WHERE tenant_id = $1 AND to_email = $2 AND id = $3",
        [user.tenant_id, user.email, id]
      );
      reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
    } catch (err) {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ================= Bulk & Trash =================
  app.delete('/api/e2ee/trash', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    await pool.query(
      "UPDATE e2ee_messages SET sender_flags = COALESCE(sender_flags, '{}'::jsonb) || '{\"cleared\":true}'::jsonb WHERE tenant_id = $1 AND from_email = $2 AND sender_deleted_at IS NOT NULL"
    , [user.tenant_id, user.email]);
    await pool.query(
      "UPDATE e2ee_messages SET recipient_flags = COALESCE(recipient_flags, '{}'::jsonb) || '{\"cleared\":true}'::jsonb WHERE tenant_id = $1 AND to_email = $2 AND recipient_deleted_at IS NOT NULL"
    , [user.tenant_id, user.email]);
    reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.patch('/api/e2ee/messages/bulk/flags', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const { ids, flags } = req.body;
    if (!ids || !Array.isArray(ids) || !flags) return reply.status(400).send({ error: 'Invalid payload' });
    const res = await pool.query(
      "UPDATE e2ee_messages SET sender_flags = CASE WHEN from_email = $2 THEN COALESCE(sender_flags, '{}'::jsonb) || $3::jsonb ELSE sender_flags END, recipient_flags = CASE WHEN to_email = $2 THEN COALESCE(recipient_flags, '{}'::jsonb) || $3::jsonb ELSE recipient_flags END, sender_deleted_at = CASE WHEN from_email = $2 THEN NULL ELSE sender_deleted_at END, recipient_deleted_at = CASE WHEN to_email = $2 THEN NULL ELSE recipient_deleted_at END WHERE tenant_id = $1 AND id = ANY($4::uuid[]) AND (from_email = $2 OR to_email = $2)" 
    , [user.tenant_id, user.email, JSON.stringify(flags), ids]); console.log("UPDATE BULK FLAGS", {ids, flags, email: user.email, updated: res.rowCount});
    reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.patch('/api/e2ee/messages/bulk/trash', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return reply.status(400).send({ error: 'Invalid payload' });
    const res = await pool.query(
      "UPDATE e2ee_messages SET sender_deleted_at = CASE WHEN from_email = $2 THEN NOW() ELSE sender_deleted_at END, recipient_deleted_at = CASE WHEN to_email = $2 THEN NOW() ELSE recipient_deleted_at END WHERE tenant_id = $1 AND id = ANY($3::uuid[]) AND (from_email = $2 OR to_email = $2)" 
    , [user.tenant_id, user.email, ids]);
    reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── eDiscovery (Enterprise) ────────────────────────────────────────────────
  
  app.get('/api/e2ee/ediscovery/user/:email', socGuard, async (req, reply) => {
    try {
      const user = await getUser(req.user);
      const targetEmail = req.params.email;
      
      // Fetch user's identity key and escrow data
      const { rows: keyRows } = await pool.query(
        'SELECT public_key, escrow_data, escrow_aes, escrow_iv FROM e2ee_keys WHERE tenant_id = $1 AND user_email = $2',
        [user.tenant_id, targetEmail]
      );
      if (keyRows.length === 0) return reply.status(404).send({ error: 'User keys not found' });
      const identityKey = keyRows[0];

      // Fetch user's PFS PreKeys and escrow data
      const { rows: prekeyRows } = await pool.query(
        'SELECT prekey_id, public_key, escrow_data, escrow_aes, escrow_iv FROM e2ee_prekeys WHERE tenant_id = $1 AND user_email = $2',
        [user.tenant_id, targetEmail]
      );

      // Fetch user's messages
      const { rows: messages } = await pool.query(
        `SELECT id, from_email as sender, to_email as recipient, subject_encrypted, body_encrypted, nonce, created_at 
         FROM e2ee_messages 
         WHERE tenant_id = $1 AND (to_email = $2 OR from_email = $2) 
         ORDER BY created_at DESC LIMIT 100`,
        [user.tenant_id, targetEmail]
      );

      // IMPORTANT: Log this highly privileged eDiscovery access
      await pool.query(
        `INSERT INTO audit_log (tenant_id, actor, action, resource, details, ip)
         VALUES ($1, $2, 'ediscovery_access', 'e2ee_messages', $3, $4)`,
        [user.tenant_id, req.user.sub, JSON.stringify({ target_email: targetEmail }), req.ip]
      );

      reply.send({
        identityKey,
        prekeys: prekeyRows,
        messages
      });
    } catch(e) {
      reply.status(400).send({ error: e.message });
    }
  });

}

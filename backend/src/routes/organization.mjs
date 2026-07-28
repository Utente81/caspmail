import pool from '../db/pool.mjs';
import { requireAuth } from '../auth/verify.mjs';

const authGuard = { preHandler: requireAuth };

export default async function organizationRoutes(app) {
  async function getUser(jwtPayload) {
    let email = jwtPayload.email || jwtPayload.preferred_username || jwtPayload.sub;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (!rows[0]) throw new Error("User not found");
    return rows[0];
  }

  // ─── Folders & Labels ───────────────────────────────────────────────────────
  
  app.get('/api/e2ee/folders', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { rows } = await pool.query(
      'SELECT * FROM e2ee_folders WHERE tenant_id = $1 AND user_email = $2 ORDER BY created_at ASC',
      [user.tenant_id, user.email]
    );
    reply.send({ data: rows }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.post('/api/e2ee/folders', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { name, type, color } = req.body;
    if (!name) return reply.status(400).send({ error: 'Name is required' });

    try {
      const { rows } = await pool.query(
        `INSERT INTO e2ee_folders (tenant_id, user_email, name, type, color) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.tenant_id, user.email, name, type || 'folder', color || '#3b82f6']
      );
      reply.status(201).send(rows[0]);
    } catch (e) {
      if (e.code === '23505') return reply.status(400).send({ error: 'Folder or label already exists' });
      reply.status(500).send({ error: e.message });
    }
  });

  app.delete('/api/e2ee/folders/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    await pool.query(
      'DELETE FROM e2ee_folders WHERE id = $1 AND tenant_id = $2 AND user_email = $3',
      [req.params.id, user.tenant_id, user.email]
    );
    reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // ─── Drafts ──────────────────────────────────────────────────────────────────
  
  app.get('/api/e2ee/drafts', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { rows } = await pool.query(
      'SELECT id, to_email, subject_encrypted, body_encrypted, nonce, created_at, updated_at FROM e2ee_drafts WHERE tenant_id = $1 AND user_email = $2 ORDER BY updated_at DESC',
      [user.tenant_id, user.email]
    );
    reply.send({ data: rows }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.post('/api/e2ee/drafts', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { to_email, subject_encrypted, body_encrypted, nonce } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO e2ee_drafts (tenant_id, user_email, to_email, subject_encrypted, body_encrypted, nonce)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.tenant_id, user.email, to_email || '', subject_encrypted, body_encrypted, nonce]
    );
    reply.status(201).send(rows[0]);
  });

  app.put('/api/e2ee/drafts/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { to_email, subject_encrypted, body_encrypted, nonce } = req.body;

    const { rows } = await pool.query(
      `UPDATE e2ee_drafts 
       SET to_email = $1, subject_encrypted = $2, body_encrypted = $3, nonce = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 AND user_email = $7 RETURNING *`,
      [to_email || '', subject_encrypted, body_encrypted, nonce, req.params.id, user.tenant_id, user.email]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Draft not found' });
    reply.send(rows[0]); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  app.delete('/api/e2ee/drafts/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    await pool.query(
      'DELETE FROM e2ee_drafts WHERE id = $1 AND tenant_id = $2 AND user_email = $3',
      [req.params.id, user.tenant_id, user.email]
    );
    reply.send({ success: true }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });
}

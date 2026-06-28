import pool from '../db/pool.mjs';
import { requireAuth } from '../auth/verify.mjs';

const authGuard = { preHandler: requireAuth };

export default async function contactsRoutes(app) {
  async function getUser(jwtPayload) {
    let email = jwtPayload.email || jwtPayload.preferred_username || jwtPayload.sub;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    if (!rows[0]) throw new Error("User not found");
    return rows[0];
  }

  app.get('/api/e2ee/contacts', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { rows } = await pool.query(
      'SELECT * FROM e2ee_contacts WHERE tenant_id = $1 AND user_email = $2 ORDER BY contact_name ASC',
      [user.tenant_id, user.email]
    );
    reply.send({ data: rows });
  });

  app.post('/api/e2ee/contacts', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    const { contact_email, contact_name, is_favorite } = req.body;
    if (!contact_email) return reply.status(400).send({ error: 'Contact email is required' });

    try {
      const { rows } = await pool.query(
        `INSERT INTO e2ee_contacts (tenant_id, user_email, contact_email, contact_name, is_favorite) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.tenant_id, user.email, contact_email, contact_name || '', is_favorite || false]
      );
      reply.status(201).send(rows[0]);
    } catch (e) {
      if (e.code === '23505') return reply.status(400).send({ error: 'Contact already exists' });
      reply.status(500).send({ error: e.message });
    }
  });

  app.delete('/api/e2ee/contacts/:id', authGuard, async (req, reply) => {
    const user = await getUser(req.user);
    await pool.query(
      'DELETE FROM e2ee_contacts WHERE id = $1 AND tenant_id = $2 AND user_email = $3',
      [req.params.id, user.tenant_id, user.email]
    );
    reply.send({ success: true });
  });
}

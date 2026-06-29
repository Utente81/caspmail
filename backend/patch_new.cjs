const fs = require('fs');
let content = fs.readFileSync('/home/ubuntu/caspmail/new/backend/src/routes/admin.mjs', 'utf8');

const helpers = `
// ─── Multi-Tenancy Segregation ──────────────────────────────────────────────
async function getEnforcedTenantId(req, requestedTenantId, isGlobalAllowed = false) {
  if (isSuperAdmin(req.user)) {
    if (requestedTenantId) return requestedTenantId;
    if (isGlobalAllowed) return null;
    throw new Error('Tenant ID is required for this operation');
  }

  const tenantRes = await pool.query(
    'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
    [req.user.email || req.user.preferred_username]
  );
  const userTenant = tenantRes.rows[0]?.tenant_id;
  if (!userTenant) {
    throw new Error('User has no tenant association');
  }
  return userTenant;
}

const superAdminGuard = {
  preHandler: async (req, reply) => {
    if (!req.headers.authorization && req.query?.token) {
      req.headers.authorization = \`Bearer \${req.query.token}\`;
    }
    return requireRole(SUPERADMIN_ROLES)(req, reply);
  }
};
`;

content = content.replace('// ─── Summary ──────────────────────────────────────────────────────────────', helpers + '\n  // ─── Summary ──────────────────────────────────────────────────────────────');

// Restrict macro admin routes to superAdminGuard
content = content.replace(/app\.get\('\/summary', adminGuard/g, "app.get('/summary', superAdminGuard");
content = content.replace(/app\.post\('\/tenants', adminGuard/g, "app.post('/tenants', superAdminGuard");
content = content.replace(/app\.put\('\/tenants\/:id', adminGuard/g, "app.put('/tenants/:id', superAdminGuard");
content = content.replace(/app\.delete\('\/tenants\/:id', adminGuard/g, "app.delete('/tenants/:id', superAdminGuard");
content = content.replace(/app\.get\('\/metrics', adminGuard/g, "app.get('/metrics', superAdminGuard");

// Update GET /tenants
const getTenantsBlock = `  app.get('/tenants', adminGuard, async (req, reply) => {
    let enforcedTenant;
    try {
      enforcedTenant = await getEnforcedTenantId(req, null, true);
    } catch (e) {
      return reply.status(403).send({ error: e.message });
    }

    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);
    const search = req.query.search?.trim();

    let query = "SELECT * FROM tenants WHERE status != 'deleted'";
    const params = [];

    if (enforcedTenant) {
      params.push(enforcedTenant);
      query += \` AND id = $\${params.length}\`;
    }

    if (search) {
      params.push(\`%\${search}%\`);
      query += \` AND (name ILIKE $\${params.length} OR id ILIKE $\${params.length})\`;
    }

    params.push(limit, offset);
    query += \` ORDER BY created_at DESC LIMIT $\${params.length - 1} OFFSET $\${params.length}\`;

    const { rows } = await pool.query(query, params);
    reply.send({ data: rows, limit, offset });
  });`;

content = content.replace(/app\.get\('\/tenants', adminGuard, async \(req, reply\) => \{[\s\S]*?reply\.send\(\{ data: rows, limit, offset \}\);\n  \}\);/m, getTenantsBlock);

// Replace tenant_id fetching in GET routes (users, aliases, domains, audit, soar)
content = content.replace(/const tenant_id = req\.query\.tenant_id;/g, `let tenant_id;
    try {
      tenant_id = await getEnforcedTenantId(req, req.query.tenant_id, true);
    } catch (e) {
      return reply.status(403).send({ error: e.message });
    }`);

// Replace tenant_id in POST/PUT routes
content = content.replace(/const \{\s*tenant_id,/g, `let { tenant_id,`);
content = content.replace(/if \(\!tenant_id \|\| \!email\) \{/g, `try { tenant_id = await getEnforcedTenantId(req, tenant_id, false); } catch (e) { return reply.status(403).send({ error: e.message }); }\n    if (!tenant_id || !email) {`);
content = content.replace(/if \(\!tenant_id \|\| \!domain\) \{/g, `try { tenant_id = await getEnforcedTenantId(req, tenant_id, false); } catch (e) { return reply.status(403).send({ error: e.message }); }\n    if (!tenant_id || !domain) {`);
content = content.replace(/if \(\!tenant_id \|\| \!name\) \{/g, `try { tenant_id = await getEnforcedTenantId(req, tenant_id, false); } catch (e) { return reply.status(403).send({ error: e.message }); }\n    if (!tenant_id || !name) {`);

fs.writeFileSync('/home/ubuntu/caspmail/new/backend/src/routes/admin.mjs', content);

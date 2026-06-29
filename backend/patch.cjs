const fs = require('fs');
let content = fs.readFileSync('/home/ubuntu/caspmail/new/backend/src/routes/admin.mjs', 'utf8');

const helpers = `
const superAdminGuard = {
  preHandler: async (req, reply) => {
    if (!req.headers.authorization && req.query?.token) {
      req.headers.authorization = \`Bearer \${req.query.token}\`;
    }
    return requireRole(SUPERADMIN_ROLES)(req, reply);
  }
};

async function getEnforcedTenantId(req, requestedTenantId) {
  if (isSuperAdmin(req.user)) {
    if (!requestedTenantId) throw new Error('SUPERADMIN_MISSING_TENANT');
    return requestedTenantId;
  }
  const tenantRes = await pool.query(
    'SELECT tenant_id FROM users WHERE email = $1 LIMIT 1',
    [req.user.email || req.user.preferred_username]
  );
  if (!tenantRes.rows[0]?.tenant_id) throw new Error('TENANT_ADMIN_MISSING_TENANT');
  return tenantRes.rows[0].tenant_id;
}
`;

content = content.replace('// ─── Summary ──────────────────────────────────────────────────────────────', helpers + '\n  // ─── Summary ──────────────────────────────────────────────────────────────');

// Restrict these to superAdminGuard
const restrictedRoutes = ['/summary', '/tenants', '/metrics'];
for (const route of restrictedRoutes) {
  content = content.replace(new RegExp(`app\\.get\\('${route}', adminGuard`, 'g'), `app.get('${route}', superAdminGuard`);
  content = content.replace(new RegExp(`app\\.post\\('${route}', adminGuard`, 'g'), `app.post('${route}', superAdminGuard`);
  content = content.replace(new RegExp(`app\\.put\\('${route}/:id', adminGuard`, 'g'), `app.put('${route}/:id', superAdminGuard`);
  content = content.replace(new RegExp(`app\\.delete\\('${route}/:id', adminGuard`, 'g'), `app.delete('${route}/:id', superAdminGuard`);
}

// Replace tenant_id fetching logic in other routes
content = content.replace(/const tenant_id = req\.query\.tenant_id;/g, "const tenant_id = await getEnforcedTenantId(req, req.query.tenant_id).catch(e => null);\n    if (!tenant_id) return reply.status(403).send({ error: 'Tenant restriction' });");

// Replace req.body.tenant_id in POST /users
content = content.replace(/const \{\s*tenant_id,\s*email,/g, "let { tenant_id, email,");
content = content.replace(/if \(\!tenant_id \|\| \!email\) \{/g, "tenant_id = await getEnforcedTenantId(req, tenant_id).catch(e => null);\n    if (!tenant_id || !email) {");

fs.writeFileSync('/home/ubuntu/caspmail/new/backend/src/routes/admin.mjs', content);

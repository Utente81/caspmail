import pool from '../db/pool.mjs';
import { requireRole } from '../auth/verify.mjs';

const VERSION = process.env.npm_package_version || '1.0.0';
const ISSUER  = process.env.KEYCLOAK_ISSUER
  || 'https://auth.secure.internal/realms/caspermail';

export default async function healthRoutes(app) {
  // Quick liveness probe — used by Docker/nginx
  app.get('/health', { logLevel: 'warn' }, async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
    } catch {
      return reply.status(503).send({ ok: false, db: 'error', version: VERSION });
    }
    reply.send({ ok: true, db: 'ok', version: VERSION }); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
  });

  // Deep readiness probe — checks DB + Keycloak reachability
  const adminGuard = { preHandler: requireRole(['admin', 'casper_admin']) };
  app.get('/health/deep', { logLevel: 'warn', ...adminGuard }, async (_req, reply) => {
    const checks = {};
    let allOk = true;

    // DB check
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      checks.db = { ok: true, latency_ms: Date.now() - start };
    } catch (err) {
      checks.db = { ok: false, error: err.message };
      allOk = false;
    }

    // DB pool stats
    try {
      checks.db_pool = {
        total: pool.totalCount,
        idle:  pool.idleCount,
        waiting: pool.waitingCount,
      };
    } catch {}

    // Keycloak OIDC discovery reachability
    try {
      const start = Date.now();
      const res = await fetch(
        `${ISSUER}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(4000) }
      );
      checks.keycloak = { ok: res.ok, status: res.status, latency_ms: Date.now() - start };
      if (!res.ok) allOk = false;
    } catch (err) {
      checks.keycloak = { ok: false, error: err.message };
      allOk = false;
    }

    // Row counts (quick sanity)
    try {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM tenants)    AS tenants,
          (SELECT COUNT(*) FROM users)      AS users,
          (SELECT COUNT(*) FROM soc_alerts WHERE status='open') AS open_alerts
      `);
      checks.counts = rows[0];
    } catch {}

    checks.uptime_s = Math.round(process.uptime());
    checks.memory_mb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    checks.version = VERSION;

    reply.status(allOk ? 200 : 503).send({ ok: allOk, ...checks });
  });
}

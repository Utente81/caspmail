import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { runMigrations } from './db/migrate.mjs';
import healthRoutes from './routes/health.mjs';
import adminRoutes from './routes/admin.mjs';
import socRoutes, { startSoarWorker } from './routes/soc.mjs';
import mailRoutes from './routes/mail.mjs';
import organizationRoutes from './routes/organization.mjs';
import contactsRoutes from './routes/contacts.mjs';
import { startSimulator } from './soc_simulator.mjs';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

function sanitizedUrl(url = '') {
  return String(url).split('?')[0];
}

const app = Fastify({
  bodyLimit: 52428800, // 50MB per payloads (allegati)
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: sanitizedUrl(req.url),
          hostname: req.hostname,
          remoteAddress: req.ip,
          remotePort: req.socket?.remotePort,
        };
      },
    },
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  },
  trustProxy: true,
});

// ─── Security Headers ────────────────────────────────────────────────────────

await app.register(helmet, {
  contentSecurityPolicy: false, // Managed by nginx
});

// ─── CORS ────────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: (process.env.CORS_ORIGINS || 'https://secure.internal').split(','),
  credentials: true,
});

// ─── Rate Limiting (layered, enterprise-grade) ───────────────────────────────
//
//  Global:          200 req/min per real IP   (broad protection)
//  Auth endpoints:   20 req/min per real IP   (brute-force mitigation)
//  Write endpoints:  60 req/min per real IP   (mutation protection)
//
// The keyGenerator always resolves the real client IP even when behind nginx.

function realIp(req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

// Global rate-limit (applied to all routes via plugin)
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: realIp,
  errorResponseBuilder(_req, context) {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${context.after}.`,
    };
  },
});

// ─── Per-route rate-limit hooks ──────────────────────────────────────────────

// Stricter limits for authentication-sensitive routes (e2ee send, admin write ops)
const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute',
      keyGenerator: realIp,
      errorResponseBuilder(_req, context) {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Sensitive endpoint rate limit exceeded. Try again in ${context.after}.`,
        };
      },
    },
  },
};

// Medium limit for mutating admin/SOC routes
const writeRateLimit = {
  config: {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute',
      keyGenerator: realIp,
    },
  },
};

// ─── Routes ──────────────────────────────────────────────────────────────────

await app.register(healthRoutes);
await app.register(adminRoutes, { prefix: '/api/admin', rateLimitHooks: { authRateLimit, writeRateLimit } });
await app.register(socRoutes, { prefix: '/api/v4/soc', rateLimitHooks: { writeRateLimit } });
await app.register(socRoutes, { prefix: '/api/soc', rateLimitHooks: { writeRateLimit } });
await app.register(mailRoutes, { rateLimitHooks: { authRateLimit, writeRateLimit } });
await app.register(organizationRoutes, { rateLimitHooks: { authRateLimit, writeRateLimit } });
await app.register(contactsRoutes, { rateLimitHooks: { authRateLimit, writeRateLimit } });

// ─── Global Error Handler ────────────────────────────────────────────────────

app.setErrorHandler((err, req, reply) => {
  const statusCode = err.statusCode || 500;
  app.log.error({ err, url: sanitizedUrl(req.url), method: req.method }, 'Request error');
  reply.status(statusCode).send({
    statusCode,
    error: err.name || 'Error',
    message: statusCode < 500 ? err.message : 'Internal Server Error',
  });
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

const shutdown = async (signal) => {
  app.log.info({ signal }, 'Received shutdown signal, closing server...');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Startup ─────────────────────────────────────────────────────────────────

try {
  app.log.info('Running database migrations...');
  await runMigrations();
  app.log.info('Migrations complete.');

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`CaspMail backend listening on ${HOST}:${PORT}`);
  
  startSoarWorker(app);
  startSimulator(app);
} catch (err) {
  app.log.error(err, 'Fatal startup error');
  process.exit(1);
}

export default app;

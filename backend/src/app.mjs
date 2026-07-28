import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { Server } from 'socket.io';

import { runMigrations } from './db/migrate.mjs';
import pool from './db/pool.mjs';
import healthRoutes from './routes/health.mjs';
import adminRoutes from './routes/admin.mjs';
import socRoutes, { startSoarWorker } from './routes/soc.mjs';
import mailRoutes from './routes/mail.mjs';
import organizationRoutes from './routes/organization.mjs';
import contactsRoutes from './routes/contacts.mjs';

// Global cache for SOAR Application Firewall
export const blockedIps = new Set();
export function blockIp(ip) {
  blockedIps.add(ip);
}

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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
});

// ─── CORS ────────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: (process.env.CORS_ORIGINS || 'https://secure.internal').split(','),
  credentials: true,
});

// ─── WebSockets ──────────────────────────────────────────────────────────────

import http from 'http';
const ioServer = http.createServer();
const io = new Server(ioServer, {
  cors: {
    origin: (process.env.CORS_ORIGINS || 'https://secure.internal').split(','),
    credentials: true,
  }
});

ioServer.listen(3001, '0.0.0.0', () => {
  console.log('Socket.io dedicated server listening on 0.0.0.0:3001');
});

app.io = io;

io.on('connection', (socket) => {
  app.log.info({ socketId: socket.id }, 'New WebSocket connection');
  
  // Very simple auth check can be added here or via middleware
  socket.on('disconnect', () => {
    app.log.info({ socketId: socket.id }, 'WebSocket disconnected');
  });
});

// ─── Rate Limiting & Firewall (layered, enterprise-grade) ─────────────────
//
//  Global Firewall: Blocks IPs requested by SOAR Playbooks
//  Global Rate Limiting: 200 req/min per real IP   (broad protection)
//  Auth endpoints:   20 req/min per real IP   (brute-force mitigation)
//  Write endpoints:  60 req/min per real IP   (mutation protection)
//
// The keyGenerator always resolves the real client IP even when behind nginx.

function realIp(req) {
  return req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

function logWafEvent(ip, type, severity, message, mitre_technique) {
  let displayIp = ip;
  // Se DEMO_MODE è attivo, simula IP pubblici per la Threat Map, altrimenti usa l'IP reale
  if (process.env.DEMO_MODE === 'true' && (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.'))) {
    const publicPrefixes = ['114.114', '46.22', '104.28', '177.10', '41.220', '183.192', '198.51', '95.108'];
    displayIp = publicPrefixes[Math.floor(Math.random() * publicPrefixes.length)] + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255);
  }

  const tenantId = process.env.DEFAULT_TENANT_ID || 'system-global'; // Default tenant for network-level events
  const raw = {
    mitre_tactic: type === 'rate_limit' ? 'Impact' : 'Initial Access',
    mitre_technique,
    ueba_score: severity === 'high' ? 85 : 40,
    threat_intelligence: 'Native WAF Sensor'
  };
  pool.query(
    `INSERT INTO soc_events (tenant_id, type, severity, source_ip, message, raw)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, type, severity, displayIp, message, JSON.stringify(raw)]
  ).catch(() => {});
}

// Global Firewall Hook
app.addHook('onRequest', async (req, reply) => {
  const ip = realIp(req);
  if (blockedIps.has(ip)) {
    logWafEvent(ip, 'firewall_block', 'medium', 'Blocked IP attempted connection', 'T1090');
    return reply.status(403).send({ error: 'Forbidden', message: 'Your IP address has been blocked by SOC policies.' });
  }
});

import { v4 as uuidv4 } from 'uuid';
// ITAM Autodiscovery Hook
app.addHook('onResponse', (req, reply, done) => {
  if (req.user && (req.user.email || req.user.preferred_username)) {
    const email = req.user.email || req.user.preferred_username;
    const ip = realIp(req);
    const ua = req.headers['user-agent'] || 'Unknown';
    // Fire and forget
    pool.query('SELECT tenant_id FROM users WHERE email = $1', [email])
      .then(({rows}) => {
        if (rows.length > 0) {
          pool.query(`
            INSERT INTO assets (id, tenant_id, ip_address, device_type, last_seen)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (tenant_id, ip_address)
            DO UPDATE SET last_seen = NOW(), device_type = $4
          `, [uuidv4(), rows[0].tenant_id, ip, ua]).catch(()=>{});
        }
      }).catch(()=>{});
  }
  done();
});

import { readFileSync } from 'node:fs';
let redisPassword;
try {
  redisPassword = readFileSync('/run/secrets/redis_password', 'utf8').trim();
} catch {
  console.warn('No redis password found at /run/secrets/redis_password');
}

const redis = new Redis({
  host: process.env.REDIS_HOST || 'casper-redis-master.caspermail.svc.cluster.local',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || redisPassword
});

// Global rate-limit (applied to all routes via plugin)
await app.register(rateLimit, {
  redis,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: realIp,
  errorResponseBuilder(req, context) {
    const ip = realIp(req);
    logWafEvent(ip, 'rate_limit', 'high', 'Global Rate Limit Exceeded (Possible DoS)', 'T1498');
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
      errorResponseBuilder(req, context) {
        const ip = realIp(req);
        logWafEvent(ip, 'rate_limit_auth', 'critical', 'Auth Rate Limit Exceeded (Brute-Force)', 'T1110');
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

  // Load blocked IPs into memory firewall
  const { rows: blockedRows } = await pool.query('SELECT ip FROM soc_blocked_ips');
  for (const row of blockedRows) {
    blockedIps.add(row.ip);
  }
  app.log.info(`Firewall: Loaded ${blockedIps.size} blocked IPs from database.`);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`CaspMail backend listening on ${HOST}:${PORT}`);
  
  startSoarWorker(app);
} catch (err) {
  app.log.error(err, 'Fatal startup error');
  process.exit(1);
}

export default app;

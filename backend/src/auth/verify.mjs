import { createRemoteJWKSet, jwtVerify } from 'jose';
import { pool } from '../db/pool.mjs';

const JWKS_URI = process.env.KEYCLOAK_JWKS_URI;
const ISSUER = process.env.KEYCLOAK_ISSUER;

if (!JWKS_URI) throw new Error('KEYCLOAK_JWKS_URI env var is required');
if (!ISSUER) throw new Error('KEYCLOAK_ISSUER env var is required');

// Cache JWKS remotely — jose handles automatic rotation
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export async function verifyToken(req) {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    // Fallback for short-lived tickets (mitigates SSE token exposure)
    // We should ideally use a one-time ticket, but for now we accept it and will migrate frontend.
    token = req.query.token;
  }

  if (!token) {
    const err = new Error('Missing or malformed Authorization header');
    err.statusCode = 401;
    throw err;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      algorithms: ['RS256'],
    });

    if (!payload.azp) {
      throw new Error('Missing azp claim');
    }

    const email = payload.email || payload.preferred_username;
    if (email) {
      const { rows } = await pool.query('SELECT tenant_id, status FROM users WHERE email = $1', [email]);
      if (rows.length > 0) {
        if (rows[0].status === 'suspended' || rows[0].status === 'deleted') {
          throw new Error('User account is inactive');
        }
        payload.tenant_id = rows[0].tenant_id;
      }
    }

    return payload;
  } catch (cause) {
    const err = new Error('Invalid, expired, or inactive token');
    err.statusCode = 401;
    err.cause = cause;
    throw err;
  }
}

export function requireRole(roles) {
  return async function roleCheck(req, reply) {
    let payload;
    try {
      payload = await verifyToken(req);
    } catch (err) {
      reply.status(err.statusCode || 401).send({ error: err.message });
      return;
    }

    req.user = payload;

    const userRoles = payload?.realm_access?.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Required role(s): ${roles.join(', ')}`,
      });
    }
  };
}

export async function requireAuth(req, reply) {
  try {
    req.user = await verifyToken(req);
  } catch (err) {
    reply.status(err.statusCode || 401).send({ error: err.message });
  }
}

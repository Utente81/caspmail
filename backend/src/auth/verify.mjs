import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS_URI = process.env.KEYCLOAK_JWKS_URI;
const ISSUER = process.env.KEYCLOAK_ISSUER;

if (!JWKS_URI) throw new Error('KEYCLOAK_JWKS_URI env var is required');
if (!ISSUER) throw new Error('KEYCLOAK_ISSUER env var is required');

// Cache JWKS remotely — jose handles automatic rotation
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * Verify the Bearer token from Authorization header.
 * Returns the decoded JWT payload or throws on failure.
 *
 * @param {import('fastify').FastifyRequest} req
 * @returns {Promise<object>} JWT payload
 */
export async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed Authorization header');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      algorithms: ['RS256'],
    });
    return payload;
  } catch (cause) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    err.cause = cause;
    throw err;
  }
}

/**
 * Fastify preHandler factory that enforces role-based access.
 * Attaches the verified JWT payload to req.user.
 *
 * @param {string[]} roles - At least one of these realm_access.roles must be present
 * @returns {import('fastify').preHandlerHookHandler}
 */
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

/**
 * Fastify preHandler that only verifies the token (no role check).
 * Attaches payload to req.user.
 */
export async function requireAuth(req, reply) {
  try {
    req.user = await verifyToken(req);
  } catch (err) {
    reply.status(err.statusCode || 401).send({ error: err.message });
  }
}

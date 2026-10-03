import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { normalizeRole } from '../constants/crm.js';
import { validateOrgId } from '../db/tenantQuery.js';

const getJwtSecret = () => process.env.JWT_SECRET || 'growprospect_production_jwt_secret_key_2026_super_secure';

// Role hierarchy levels: admin (3) > manager (2) > rep (1)
export const ROLE_HIERARCHY = {
  admin: 3,
  manager: 2,
  rep: 1
};

let cachedTestKeyPair = null;

export function getTestKeyPair() {
  if (!cachedTestKeyPair) {
    cachedTestKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  }
  return cachedTestKeyPair;
}

/**
 * Creates standard signed JWT for tests and local simulation.
 */
export function createTestToken({
  userId = 'usr_test_1',
  orgId = 'org_default',
  role = 'admin',
  expiresInSeconds = 3600,
  tamper = false
} = {}) {
  const payload = {
    sub: userId,
    userId,
    org_id: orgId,
    orgId,
    org_role: role === 'admin' ? 'org:admin' : role === 'manager' ? 'org:manager' : 'org:member',
    role,
    name: 'Test Member',
    email: 'test@growprospect.local'
  };

  const secret = getJwtSecret();
  const token = jwt.sign(payload, secret, { expiresIn: expiresInSeconds });

  if (tamper) {
    const parts = token.split('.');
    return `${parts[0]}.${parts[1]}.tampered_signature_invalid`;
  }

  return token;
}

/**
 * Standard JWT verification middleware with bearer token parsing.
 * 
 * @param {import('node:http').IncomingMessage} req 
 * @returns {Promise<{
 *   userId: string;
 *   orgId: string;
 *   role: 'admin'|'manager'|'rep';
 *   orgRole: string;
 *   claims: Record<string, any>;
 * }>}
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const orgHeader = req.headers['x-org-id'] || '';
  const roleHeader = req.headers['x-org-role'] || '';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Unauthorized: Missing or malformed Authorization header. Expected Bearer <token>');
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    const error = new Error('Unauthorized: Empty Bearer token');
    error.statusCode = 401;
    throw error;
  }

  let verifiedPayload = null;
  let verificationError = null;

  // 1. Try standard HS256 JWT verification with JWT_SECRET
  try {
    const secret = getJwtSecret();
    verifiedPayload = jwt.verify(token, secret);
  } catch (err) {
    verificationError = err;
  }

  // 2. Try RS256 verification for test tokens
  if (!verifiedPayload && cachedTestKeyPair) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        if (header.alg === 'RS256') {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const isValid = verifier.verify(cachedTestKeyPair.publicKey, parts[2], 'base64url');
          if (isValid) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp && decoded.exp < now) {
              const expErr = new Error('Unauthorized: Token has expired');
              expErr.statusCode = 401;
              throw expErr;
            }
            verifiedPayload = decoded;
          } else {
            const sigErr = new Error('Unauthorized: Invalid token signature');
            sigErr.statusCode = 401;
            throw sigErr;
          }
        }
      }
    } catch (err) {
      if (err.statusCode === 401) throw err;
      verificationError = err;
    }
  }

  // 3. Fallback for expired token detection
  if (!verifiedPayload) {
    try {
      const decoded = jwt.decode(token);
      const now = Math.floor(Date.now() / 1000);
      if (decoded && decoded.exp && decoded.exp < now) {
        const expErr = new Error('Unauthorized: Token has expired');
        expErr.statusCode = 401;
        throw expErr;
      }
    } catch {}

    const error = new Error(`Unauthorized: ${verificationError?.message || 'Token verification failed'}`);
    error.statusCode = 401;
    throw error;
  }

  const orgId = validateOrgId(
    verifiedPayload.org_id || 
    verifiedPayload.orgId || 
    orgHeader || 
    'org_default'
  );

  const role = normalizeRole(
    verifiedPayload.role ||
    verifiedPayload.org_role || 
    verifiedPayload.orgRole || 
    roleHeader || 
    'admin'
  );

  const auth = {
    userId: verifiedPayload.userId || verifiedPayload.sub || verifiedPayload.sid || 'usr_anonymous',
    orgId,
    role,
    orgRole: verifiedPayload.org_role || verifiedPayload.orgRole || role,
    name: verifiedPayload.name || verifiedPayload.fullName || verifiedPayload.username || 'Team User',
    email: verifiedPayload.email || verifiedPayload.primary_email || '',
    claims: verifiedPayload
  };

  req.auth = auth;
  return auth;
}

/**
 * Middleware enforcing role-based permissions:
 * - admin: access everything (including provider keys and member management)
 * - manager: access all leads, assign leads, run scrapers, team dashboard
 * - rep: access own leads and unassigned leads only
 * 
 * @param {'admin'|'manager'|'rep'} requiredRole
 */
export function requireRole(requiredRole) {
  return function checkRole(req) {
    if (!req.auth) {
      const error = new Error('Unauthorized: Authentication required before role check');
      error.statusCode = 401;
      throw error;
    }

    const userLevel = ROLE_HIERARCHY[req.auth.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 1;

    if (userLevel < requiredLevel) {
      const error = new Error(
        `Forbidden: Role '${req.auth.role}' does not have permission for this resource. Required role: '${requiredRole}'.`
      );
      error.statusCode = 403;
      throw error;
    }

    return true;
  };
}

/**
 * Helper to check if the current user can access or modify a specific lead:
 * - admin & manager: can access all leads within their org_id
 * - rep: can only access leads assigned to them or unassigned leads
 * 
 * @param {Object} auth req.auth
 * @param {Object} lead Lead object
 * @returns {boolean}
 */
export function canAccessLead(auth, lead) {
  if (!lead || !auth) return false;
  if (lead.org_id !== auth.orgId) return false;

  if (auth.role === 'admin' || auth.role === 'manager') {
    return true;
  }

  // Rep rule: own leads or unassigned leads only
  if (auth.role === 'rep') {
    if (!lead.assigned_to) return true;
    return lead.assigned_to === auth.userId;
  }

  return false;
}

// middleware/auth.js
import jwt from 'jsonwebtoken';

/**
 * Auth middleware: verifies Bearer token and normalizes claims onto req.user
 * Accepts either { id, orgId } or { sub, orgId } in the JWT payload.
 */
export function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize to req.user for all downstream code:
    // Support tokens that use either `sub` or `id`
    const userId = claims.sub || claims.id;
    if (!userId || !claims.orgId) {
      return res.status(401).json({ error: 'invalid_token_claims' });
    }
    req.user = {
      id: String(userId),
      orgId: String(claims.orgId),
      role: claims.role || 'user',
      // keep the raw claims if you want:
      ...claims,
    };
    next();
  } catch (err) {
    // tiny bit of debug without leaking secrets
    console.log('[auth] verify fail:', err?.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Tenant guard: block cross-org access based on :orgId param.
 */
export function requireOrg(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });

  const paramOrg = String(req.params.orgId || '');
  const tokenOrg = String(req.user.orgId || '');
  if (!paramOrg || !tokenOrg) {
    return res.status(400).json({ error: 'orgId_required' });
  }

  if (paramOrg !== tokenOrg) {
    return res.status(403).json({ error: 'cross-tenant blocked' });
  }

  next();
}

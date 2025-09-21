// import jwt from 'jsonwebtoken';

// export function auth(req, res, next) {
//   try {
//     const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
//     const payload = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = payload;
//     next();
//   } catch {
//     res.status(401).json({ error: 'unauthorized' });
//   }
// }

export function requireOrg(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.params.orgId !== req.user.orgId) return res.status(403).json({ error: 'cross-tenant blocked' });
  next();
}


export function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    // claims: { sub, orgId, role, iat, exp }
    req.auth = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

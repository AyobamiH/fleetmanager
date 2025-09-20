import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireOrg(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.params.orgId !== req.user.orgId) return res.status(403).json({ error: 'cross-tenant blocked' });
  next();
}

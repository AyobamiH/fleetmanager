// routes/auth.js (ESM)
// ------------------------------
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Org from '../models/Org.js';
import { authMiddleware } from '../middleware/auth.js';

const r = Router();

// Sign a JWT with standard claims
function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), orgId: String(user.orgId), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * POST /api/auth/register
 * Body: { name, email, password, orgName }
 * Creates Org (if needed) + owner User, returns {token, user, org}
 */
r.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, orgName } = req.body || {};
    if (!name || !email || !password || !orgName) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Find or create org
    let org = await Org.findOne({ name: orgName });
    if (!org) org = await Org.create({ name: orgName });

    const lower = String(email).toLowerCase();

    // Enforce unique email within org
    const exists = await User.findOne({ orgId: org._id, email: lower }).lean();
    if (exists) return res.status(409).json({ error: 'email_exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      orgId: org._id,
      email: lower,
      name,
      passwordHash,
      role: 'owner',
      status: 'active'
    });

    const token = signToken(user);
    console.log('[auth] user created', String(user._id), String(org._id));

    res.status(201).json({
      token,
      user: { id: String(user._id), email: user.email, name: user.name, orgId: String(user.orgId), role: user.role, status: user.status },
      org:  { id: String(org._id), name: org.name, status: org.status }
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/auth/login
 * Body: { email, password }  (optionally { orgId } to disambiguate)
 * Returns { token, user }
 */
r.post('/login', async (req, res, next) => {
  try {
    const { email, password, orgId } = req.body || {};
    if (!email) return res.status(400).json({ error: 'missing_email' });

    const lower = String(email).toLowerCase();
    const query = orgId ? { orgId, email: lower } : { email: lower };
    const user = await User.findOne(query);

    if (!user) {
      console.log('[auth] login fail', 'not_found', lower);
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    if (password) {
      const ok = await bcrypt.compare(password, user.passwordHash || '');
      if (!ok) {
        console.log('[auth] login fail', 'bad_password', lower);
        return res.status(401).json({ error: 'invalid_credentials' });
      }
    }

    if (user.status === 'disabled') return res.status(403).json({ error: 'user_disabled' });

    const token = signToken(user);
    console.log('[auth] login ok', String(user._id), String(user.orgId));

    res.json({
      token,
      user: { id: String(user._id), email: user.email, name: user.name, orgId: String(user.orgId), role: user.role, status: user.status }
    });
  } catch (e) { next(e); }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * Returns { user, org } loaded from Mongo
 */
r.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('-passwordHash').lean();
    const org  = await Org.findById(req.auth.orgId).lean();
    if (!user || !org) return res.status(404).json({ error: 'not_found' });

    res.json({
      user: { id: String(user._id), email: user.email, name: user.name, orgId: String(user.orgId), role: user.role, status: user.status, createdAt: user.createdAt },
      org:  { id: String(org._id), name: org.name, status: org.status, createdAt: org.createdAt }
    });
  } catch (e) { next(e); }
});

export default r;

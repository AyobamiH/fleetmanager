import { Router } from 'express';
import jwt from 'jsonwebtoken';

const r = Router();

r.post('/login', (req, res) => {
  const { orgId, email, role } = req.body || {};
  if (!orgId || !email) return res.status(400).json({ error: 'orgId and email required' });
  const token = jwt.sign({ orgId, role: role || 'owner', sub: email }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h' });
  res.json({ ok: true, token, orgId, role: role || 'owner' });
});

r.get('/whoami', (req, res) => {
  res.json({ ok: true, hint: 'Use Authorization: Bearer <token> on org routes' });
});

export default r;

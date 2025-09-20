import { Router } from 'express';
import mongoose from 'mongoose';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

r.get('/orgs/:orgId/positions', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to, limit = '500' } = req.query;
  const q = { 'metadata.orgId': req.params.orgId };
  if (vehicleId) q['metadata.vehicleId'] = String(vehicleId);
  if (from || to) q.ts = {};
  if (from) q.ts.$gte = String(from);
  if (to) q.ts.$lte = String(to);
  const rows = await mongoose.connection.db.collection('positions')
    .find(q, { projection: { _id: 0 } })
    .sort({ ts: -1 })
    .limit(Math.min(parseInt(limit, 10) || 500, 5000))
    .toArray();
  res.json(rows);
});

export default r;

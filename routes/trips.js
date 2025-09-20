import { Router } from 'express';
import Trip from '../models/trip.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

r.get('/orgs/:orgId/trips', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to, limit = '1000' } = req.query;
  const q = { orgId: req.params.orgId };
  if (vehicleId) q.vehicleId = String(vehicleId);
  if (from || to) q.startTs = {};
  if (from) q.startTs.$gte = String(from);
  if (to) q.startTs.$lte = String(to);
  const rows = await Trip.find(q).sort({ startTs: -1 }).limit(Math.min(parseInt(limit, 10) || 1000, 5000)).lean();
  res.json(rows);
});

export default r;

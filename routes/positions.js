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

/**
 * POST /api/orgs/:orgId/positions/mobile
 * Body: { lat, lon, speedKph?, heading?, accuracyM?, vehicleId?, driverId? }
 * Stores a mobile-originated GPS fix and tags it with orgId.
 */
r.post('/orgs/:orgId/positions/mobile', auth, requireOrg, async (req, res, next) => {
  try {
    const { lat, lon, speedKph, heading, accuracyM, vehicleId, driverId } = req.body || {};
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat_lon_required' });
    }

    const doc = await Position.create({
      ts: new Date().toISOString(),
      lat, lon,
      speedKph: Number(speedKph) || 0,
      heading: Number(heading) || 0,
      accuracyM: Number(accuracyM) || undefined,
      vehicleId: vehicleId ? String(vehicleId) : undefined,
      driverId:  driverId  ? String(driverId)  : undefined,
      metadata: { orgId: String(req.params.orgId), source: 'mobile' }
    });

    // (optional) if you have socket.io wired, you can emit a map update here

    res.status(201).json({ ok: true, id: String(doc._id) });
  } catch (e) { next(e); }
});

export default r;

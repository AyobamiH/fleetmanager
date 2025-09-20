import { Router } from 'express';
import Vehicle from '../models/vehicle.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

r.get('/orgs/:orgId/vehicles', auth, requireOrg, async (req, res) => {
  const rows = await Vehicle.find({ orgId: req.params.orgId }).sort({ name: 1 }).limit(1000).lean();
  res.json(rows);
});

r.post('/orgs/:orgId/vehicles', auth, requireOrg, async (req, res) => {
  const { name, plate } = req.body || {};
  if (!name || !plate) return res.status(400).json({ error: 'name and plate required' });
  const doc = await Vehicle.create({ orgId: req.params.orgId, name, plate, status: 'active' });
  res.status(201).json(doc);
});

r.patch('/orgs/:orgId/vehicles/:id', auth, requireOrg, async (req, res) => {
  const r1 = await Vehicle.updateOne({ orgId: req.params.orgId, _id: req.params.id }, { $set: { ...req.body } });
  res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
});

export default r;

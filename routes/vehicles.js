import { Router } from 'express';
import Vehicle from '../models/Vehicle.js';
import { auth, requireOrg } from '../middleware/auth.js';

import { Parser as Json2CsvParser } from 'json2csv';

const r = Router();

// GET /api/orgs/:orgId/vehicles/export/csv
r.get('/orgs/:orgId/vehicles/export/csv', auth, requireOrg, async (req, res) => {
  const rows = await Vehicle.find({ orgId: req.params.orgId }).sort({ createdAt: -1 }).lean();
  const fields = ['name','plate','status','make','vehicleModel','year','vin','deviceId','odometerKm','createdAt','updatedAt'];
  const parser = new Json2CsvParser({ fields });
  const csv = parser.parse(rows.map(v => ({
    ...v, id: undefined, _id: undefined
  })));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="vehicles.csv"');
  res.send(csv);
});



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

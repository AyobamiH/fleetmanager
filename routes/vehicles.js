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



// routes/vehicles.js
r.get('/orgs/:orgId/vehicles', auth, requireOrg, async (req, res) => {
  const {
    page = 1, limit = 20, search, status,
    sortBy = 'createdAt', sortOrder = 'desc'
  } = req.query;

  const q = { orgId: req.params.orgId };
  if (status) q.status = status;
  if (search) q.$or = [
    { name:  new RegExp(String(search), 'i') },
    { plate: new RegExp(String(search), 'i') }
  ];

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [rows, total] = await Promise.all([
    Vehicle.find(q)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Vehicle.countDocuments(q)
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limitNum));
  res.json({
    vehicles: rows.map(v => ({
      // normalize to what the UI uses
      id: String(v._id),
      name: v.name,
      plate: v.plate,
      status: v.status || 'active',
      make: v.make || null,
      vehicleModel: v.vehicleModel || null,
      year: v.year || null,
      deviceId: v.deviceId || null,
      odometerKm: v.odometerKm ?? 0,
      updatedAt: v.updatedAt || v.createdAt,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  });



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

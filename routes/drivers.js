import { Router } from 'express';
import Driver from '../models/Driver.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

// GET /api/orgs/:orgId/drivers
r.get('/orgs/:orgId/drivers', auth, requireOrg, async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;
  const q = { orgId: req.params.orgId };
  if (status) q.status = status;
  if (search) q.name = { $regex: search, $options: 'i' };

  const total = await Driver.countDocuments(q);
  const rows = await Driver.find(q)
    .sort({ createdAt: -1 })
    .skip((+page - 1) * +limit)
    .limit(+limit)
    .lean();

  res.json({
    drivers: rows.map(d => ({
      id: d._id.toString(),
      name: d.name,
      email: d.email,
      phone: d.phone,
      licenceNumber: d.licenceNumber,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    })),
    pagination: {
      page: +page,
      limit: +limit,
      total,
      totalPages: Math.ceil(total / +limit),
      hasNext: +page * +limit < total,
      hasPrev: +page > 1
    }
  });
});

// POST /api/orgs/:orgId/drivers
r.post('/orgs/:orgId/drivers', auth, requireOrg, async (req, res) => {
  const { name, email, phone, licenceNumber, emergencyContact } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const doc = await Driver.create({
    orgId: req.params.orgId,
    name, email, phone, licenceNumber,
    emergencyContact,
    status: 'active'
  });

  res.status(201).json({
    message: 'Driver created',
    driver: { id: doc._id.toString(), ...doc.toObject() }
  });
});

// GET /api/orgs/:orgId/drivers/:id
r.get('/orgs/:orgId/drivers/:id', auth, requireOrg, async (req, res) => {
  const doc = await Driver.findOne({ orgId: req.params.orgId, _id: req.params.id }).lean();
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json({ driver: { id: doc._id.toString(), ...doc } });
});

// PATCH /api/orgs/:orgId/drivers/:id
r.patch('/orgs/:orgId/drivers/:id', auth, requireOrg, async (req, res) => {
  const upd = await Driver.updateOne(
    { orgId: req.params.orgId, _id: req.params.id },
    { $set: { ...req.body, updatedAt: new Date() } }
  );
  res.json({ ok: true, matched: upd.matchedCount, modified: upd.modifiedCount });
});

// DELETE /api/orgs/:orgId/drivers/:id
r.delete('/orgs/:orgId/drivers/:id', auth, requireOrg, async (req, res) => {
  const del = await Driver.deleteOne({ orgId: req.params.orgId, _id: req.params.id });
  res.json({ ok: true, deleted: del.deletedCount });
});

export default r;

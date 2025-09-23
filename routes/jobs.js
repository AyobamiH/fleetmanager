// routes/jobs.js (ESM, JS-safe)
import { Router } from 'express';
import Job from '../models/Job.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

// Create
r.post('/orgs/:orgId/jobs', auth, requireOrg, async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const job = await Job.create({
      orgId: req.params.orgId,
      title: req.body?.title || 'Untitled Job',
      pickup: req.body?.pickup,
      dropoff: req.body?.dropoff,
      assignedVehicleId: req.body?.assignedVehicleId,
      assignedDriverId: req.body?.assignedDriverId,
      status: 'new',
      eta: req.body?.eta,
      notes: req.body?.notes,
      createdAt: now,
      updatedAt: now
    });
    res.status(201).json(job);
  } catch (e) { next(e); }
});

// Update whole job (optional)
r.patch('/orgs/:orgId/jobs/:id', auth, requireOrg, async (req, res, next) => {
  try {
    const r1 = await Job.updateOne(
      { orgId: req.params.orgId, _id: req.params.id },
      { $set: { ...req.body, updatedAt: new Date().toISOString() } }
    );
    res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
  } catch (e) { next(e); }
});

// Update status
r.patch('/orgs/:orgId/jobs/:id/status', auth, requireOrg, async (req, res, next) => {
  try {
    const { status, completedAt, eta, notes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    const set = { status, updatedAt: new Date().toISOString() };
    if (completedAt) set.completedAt = completedAt;
    if (eta) set.eta = eta;
    if (notes) set.notes = notes;

    const r1 = await Job.updateOne(
      { orgId: req.params.orgId, _id: req.params.id },
      { $set: set }
    );
    res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
  } catch (e) { next(e); }
});

// List + pagination + filters (used by Jobs page & Dashboard)
r.get('/orgs/:orgId/jobs', auth, requireOrg, async (req, res, next) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search,
      assignedVehicleId,
      assignedDriverId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const p = Math.max(Number.parseInt(String(page || '1'), 10) || 1, 1);
    const l = Math.min(Math.max(Number.parseInt(String(limit || '20'), 10) || 20, 1), 100);

    const q = { orgId: req.params.orgId };
    if (status) q.status = String(status);
    if (assignedVehicleId) q.assignedVehicleId = String(assignedVehicleId);
    if (assignedDriverId) q.assignedDriverId = String(assignedDriverId);
    if (search) q.title = { $regex: String(search), $options: 'i' };

    const sort = { [String(sortBy)]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      Job.find(q).sort(sort).skip((p - 1) * l).limit(l).lean(),
      Job.countDocuments(q)
    ]);

    res.json({
      jobs: items,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.max(Math.ceil(total / l), 1),
        hasNext: p * l < total,
        hasPrev: p > 1
      }
    });
  } catch (e) { next(e); }
});

export default r;

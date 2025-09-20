import { Router } from 'express';
import Job from '../models/job.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

r.post('/orgs/:orgId/jobs', auth, requireOrg, async (req, res) => {
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
});

r.patch('/orgs/:orgId/jobs/:id/status', auth, requireOrg, async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });
  const r1 = await Job.updateOne({ orgId: req.params.orgId, _id: req.params.id },
                                 { $set: { status, updatedAt: new Date().toISOString() } });
  res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
});

export default r;

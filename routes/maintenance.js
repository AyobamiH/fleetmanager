// routes/maintenance.js
import { Router } from 'express';
import { auth, requireOrg } from '../middleware/auth.js';
import MaintenanceSchedule from '../models/MaintenanceSchedule.js';
import MaintenanceLog from '../models/MaintenanceLog.js';

const r = Router();

/**
 * GET /api/orgs/:orgId/maintenance/schedules?vehicleId=&limit=50
 */
r.get('/orgs/:orgId/maintenance/schedules', auth, requireOrg, async (req, res) => {
  const { vehicleId, limit = 100 } = req.query;
  const q = { orgId: req.params.orgId };
  if (vehicleId) q.vehicleId = String(vehicleId);
  const rows = await MaintenanceSchedule.find(q).sort({ updatedAt: -1 }).limit(Number(limit)).lean();
  res.json({ schedules: rows });
});

/**
 * POST /api/orgs/:orgId/maintenance/schedules
 * Body: { vehicleId, title, priority?, everyDays?, everyKm?, nextDueDate?, nextDueOdomKm?, notes? }
 */
r.post('/orgs/:orgId/maintenance/schedules', auth, requireOrg, async (req, res) => {
  const { vehicleId, title } = req.body || {};
  if (!vehicleId || !title) return res.status(400).json({ error: 'vehicleId and title required' });

  const doc = await MaintenanceSchedule.create({ orgId: req.params.orgId, ...req.body });
  res.status(201).json({ schedule: doc });
});

/**
 * PATCH /api/orgs/:orgId/maintenance/schedules/:id
 */
r.patch('/orgs/:orgId/maintenance/schedules/:id', auth, requireOrg, async (req, res) => {
  const r1 = await MaintenanceSchedule.updateOne(
    { orgId: req.params.orgId, _id: req.params.id },
    { $set: { ...req.body } }
  );
  res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
});

/**
 * POST /api/orgs/:orgId/maintenance/logs
 * Body: { scheduleId, vehicleId, performedAt(ISO), odometerKm?, cost?, notes? }
 * Rolls schedule forward by everyDays/everyKm if present.
 */
r.post('/orgs/:orgId/maintenance/logs', auth, requireOrg, async (req, res) => {
  const { scheduleId, vehicleId, performedAt } = req.body || {};
  if (!scheduleId || !vehicleId || !performedAt) {
    return res.status(400).json({ error: 'scheduleId, vehicleId, performedAt required' });
  }

  const sched = await MaintenanceSchedule.findOne({ orgId: req.params.orgId, _id: scheduleId });
  if (!sched) return res.status(404).json({ error: 'schedule not found' });

  const log = await MaintenanceLog.create({ orgId: req.params.orgId, ...req.body });

  // Roll next due based on template
  const update = {};
  if (sched.everyDays) {
    const cur = new Date(performedAt);
    cur.setDate(cur.getDate() + Number(sched.everyDays));
    update.nextDueDate = cur.toISOString();
  }
  if (sched.everyKm && req.body?.odometerKm != null) {
    update.nextDueOdomKm = Number(req.body.odometerKm) + Number(sched.everyKm);
  }
  if (Object.keys(update).length) {
    await MaintenanceSchedule.updateOne({ _id: sched._id }, { $set: update });
  }

  res.status(201).json({ log, scheduleRolled: update });
});

export default r;

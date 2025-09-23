// import { Router } from 'express';
// import Job from '../models/Job.js';
// import { auth, requireOrg } from '../middleware/auth.js';

// const r = Router();

// r.post('/orgs/:orgId/jobs', auth, requireOrg, async (req, res) => {
//   const now = new Date().toISOString();
//   const job = await Job.create({
//     orgId: req.params.orgId,
//     title: req.body?.title || 'Untitled Job',
//     pickup: req.body?.pickup,
//     dropoff: req.body?.dropoff,
//     assignedVehicleId: req.body?.assignedVehicleId,
//     assignedDriverId: req.body?.assignedDriverId,
//     status: 'new',
//     eta: req.body?.eta,
//     notes: req.body?.notes,
//     createdAt: now,
//     updatedAt: now
//   });
//   res.status(201).json(job);
// });

// r.patch('/orgs/:orgId/jobs/:id/status', auth, requireOrg, async (req, res) => {
//   const { status } = req.body || {};
//   if (!status) return res.status(400).json({ error: 'status required' });
//   const r1 = await Job.updateOne({ orgId: req.params.orgId, _id: req.params.id },
//                                  { $set: { status, updatedAt: new Date().toISOString() } });
//   res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
// });

// export default r;



// routes/jobs.js (ESM, drop-in replacement)
import { Router } from 'express';
import Job from '../models/Job.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

/**
 * GET /api/orgs/:orgId/jobs
 * Query: page, limit, status, search, assignedVehicleId, sortBy, sortOrder
 * Returns: { jobs, pagination }
 */
r.get('/orgs/:orgId/jobs', auth, requireOrg, async (req, res, next) => {
  try {
    const orgId = req.params.orgId;
    const {
      page = '1',
      limit = '20',
      status,
      search,
      assignedVehicleId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const p = Math.max(parseInt(page as string, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);

    const q: any = { orgId };
    if (status) q.status = String(status);
    if (assignedVehicleId) q.assignedVehicleId = String(assignedVehicleId);
    if (search) q.title = { $regex: String(search), $options: 'i' };

    const sort: Record<string, 1 | -1> = {
      [String(sortBy)]: String(sortOrder).toLowerCase() === 'asc' ? 1 : -1,
    };

    const [jobs, total] = await Promise.all([
      Job.find(q).sort(sort).skip((p - 1) * l).limit(l).lean(),
      Job.countDocuments(q),
    ]);

    const totalPages = Math.max(Math.ceil(total / l), 1);

    res.json({
      jobs,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages,
        hasNext: p < totalPages,
        hasPrev: p > 1,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/orgs/:orgId/jobs/:id
 */
r.get('/orgs/:orgId/jobs/:id', auth, requireOrg, async (req, res, next) => {
  try {
    const job = await Job.findOne({ orgId: req.params.orgId, _id: req.params.id }).lean();
    if (!job) return res.status(404).json({ error: 'not_found' });
    res.json({ job });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/orgs/:orgId/jobs
 * Body: title, pickup, dropoff, assignedVehicleId, assignedDriverId, eta, notes, priority, description, scheduledAt
 * Returns: { job }
 */
r.post('/orgs/:orgId/jobs', auth, requireOrg, async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const body = req.body || {};
    const job = await Job.create({
      _id: body._id, // optional custom id (keeps UUID compatibility)
      orgId: req.params.orgId,
      title: body.title || 'Untitled Job',
      pickup: body.pickup,
      dropoff: body.dropoff,
      assignedVehicleId: body.assignedVehicleId,
      assignedDriverId: body.assignedDriverId,
      status: body.status || 'new',
      eta: body.eta, // keep as string for compatibility
      notes: body.notes,
      // optional extras (safe no-ops if not provided)
      description: body.description,
      priority: body.priority,        // 'low' | 'normal' | 'high' | 'urgent'
      scheduledAt: body.scheduledAt,  // ISO Date string accepted by Mongoose
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ job });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/orgs/:orgId/jobs/:id
 * Body: any fields to update (server guards org + id)
 * Returns: { ok, matched, modified }
 */
r.patch('/orgs/:orgId/jobs/:id', auth, requireOrg, async (req, res, next) => {
  try {
    const updates = { ...(req.body || {}), updatedAt: new Date().toISOString() };
    const r1 = await Job.updateOne({ orgId: req.params.orgId, _id: req.params.id }, { $set: updates });
    res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/orgs/:orgId/jobs/:id/status
 * Body: { status }
 * Returns: { ok, matched, modified }
 * (keeps your existing path for compatibility)
 */
r.patch('/orgs/:orgId/jobs/:id/status', auth, requireOrg, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status_required' });
    const r1 = await Job.updateOne(
      { orgId: req.params.orgId, _id: req.params.id },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );
    res.json({ ok: true, matched: r1.matchedCount, modified: r1.modifiedCount });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /api/orgs/:orgId/jobs/:id
 * Soft-delete: mark as cancelled + set deletedAt (never 404 just because it’s deleted)
 * Returns: { ok: true, status: 'cancelled' }
 */
r.delete('/orgs/:orgId/jobs/:id', auth, requireOrg, async (req, res, next) => {
  try {
    const q = { orgId: req.params.orgId, _id: req.params.id };
    const job = await Job.findOne(q);
    if (!job) return res.status(404).json({ error: 'not_found' });

    // Soft delete
    job.status = 'cancelled';
    job.deletedAt = new Date().toISOString();
    job.updatedAt = job.deletedAt;
    await job.save();

    res.json({ ok: true, status: job.status });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/orgs/:orgId/jobs/stats
 * Returns: { total, byStatus, active, completed, failed }
 */
r.get('/orgs/:orgId/jobs/stats', auth, requireOrg, async (req, res, next) => {
  try {
    const orgId = req.params.orgId;

    const pipeline = [
      { $match: { orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];
    const by = await Job.aggregate(pipeline);
    const byStatus: Record<string, number> = {};
    by.forEach((row) => { byStatus[row._id] = row.count; });

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    res.json({
      total,
      byStatus,
      active: (byStatus.assigned || 0) + (byStatus.enroute || 0) + (byStatus.arrived || 0),
      completed: byStatus.completed || 0,
      failed: (byStatus.failed || 0) + (byStatus.cancelled || 0),
    });
  } catch (e) {
    next(e);
  }
});

export default r;

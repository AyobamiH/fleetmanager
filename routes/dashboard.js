// routes/dashboard.js
import { Router } from 'express';
import { auth, requireOrg } from '../middleware/auth.js';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
import mongoose from 'mongoose';

const r = Router();

/**
 * GET /api/orgs/:orgId/dashboard
 * Returns: {
 *   vehicles: { total, active, maintenance, retired },
 *   jobs: { today, byStatus: { new, assigned, enroute, completed, failed, cancelled } },
 *   telemetry: { lastSeenCount, lastIngestAt }
 * }
 */
r.get('/orgs/:orgId/dashboard', auth, requireOrg, async (req, res, next) => {
  try {
    const orgId = req.params.orgId;

    // Vehicles aggregate
    const vehAgg = await Vehicle.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const vehicles = { total: 0, active: 0, maintenance: 0, retired: 0 };
    vehAgg.forEach(v => { vehicles.total += v.count; vehicles[v._id] = v.count; });

    // Jobs aggregate (today + byStatus)
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date();   endOfDay.setHours(23,59,59,999);

    const [jobsByStatus, jobsToday] = await Promise.all([
      Job.aggregate([
        { $match: { orgId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Job.countDocuments({ orgId, createdAt: { $gte: startOfDay, $lte: endOfDay } })
    ]);

    const byStatus = { new: 0, assigned: 0, enroute: 0, completed: 0, failed: 0, cancelled: 0 };
    jobsByStatus.forEach(j => { byStatus[j._id] = j.count; });

    // Telemetry from positions collection (time-series)
    const Positions = mongoose.connection.db.collection('positions');
    const lastPos = await Positions.find({ 'metadata.orgId': orgId })
      .project({ ts: 1 })
      .sort({ ts: -1 })
      .limit(1)
      .toArray();

    const lastIngestAt = lastPos[0]?.ts || null;

    // Count vehicles with lastSeen in last 24h (using Vehicle.lastSeenTs if you update it on ingest)
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const lastSeenCount = await Vehicle.countDocuments({ orgId, lastSeenTs: { $gte: since.toISOString?.() || since } });

    res.json({
      vehicles,
      jobs: { today: jobsToday, byStatus },
      telemetry: { lastSeenCount, lastIngestAt }
    });
  } catch (e) { next(e); }
});

export default r;

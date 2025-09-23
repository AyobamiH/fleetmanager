// routes/dashboard.js (ESM)
import { Router } from 'express';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Job from '../models/Job.js';
// Optional models (if you have them)
let Driver; try { ({ default: Driver } = await import('../models/Driver.js')); } catch {}
let Trip;   try { ({ default: Trip } = await import('../models/Trip.js')); } catch {}

import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

r.get('/orgs/:orgId/dashboard', auth, requireOrg, async (req, res, next) => {
  try {
    const orgId = String(req.params.orgId);

    // ---------- VEHICLES ----------
    const vAgg = await Vehicle.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const vehicles = { total: 0, active: 0, maintenance: 0, retired: 0 };
    for (const row of vAgg) {
      vehicles.total += row.count;
      if (row._id === 'active') vehicles.active = row.count;
      if (row._id === 'maintenance') vehicles.maintenance = row.count;
      if (row._id === 'retired') vehicles.retired = row.count;
    }

    // ---------- JOBS KPIs + today list ----------
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const jobsAgg = await Job.aggregate([
      { $match: { orgId } },
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          todayJobs: [
            { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
            { $sort: { createdAt: -1 } },
            { $limit: 6 },
            {
              $project: {
                _id: 0,
                id: '$_id',
                title: 1,
                status: 1,
                eta: 1,
                assignedVehicleId: 1,
                assignedDriverId: 1,
                createdAt: 1
              }
            }
          ],
          completed: [
            { $match: { status: 'completed' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const byStatus = {};
    for (const s of (jobsAgg[0]?.byStatus || [])) byStatus[s._id] = s.count;

    // On-time delivery (if eta & completedAt exist)
    const completedWithETA = await Job.countDocuments({ orgId, status: 'completed', eta: { $exists: true } });
    const onTime = await Job.countDocuments({
      orgId,
      status: 'completed',
      eta: { $exists: true },
      $expr: { $lte: ['$completedAt', '$eta'] }
    });
    const onTimeDeliveryPct = completedWithETA ? Math.round((onTime / completedWithETA) * 100) : null;

    const jobs = {
      today: jobsAgg[0]?.todayJobs?.length || 0,
      byStatus,
      recent: jobsAgg[0]?.todayJobs || [],
      totals: { completed: jobsAgg[0]?.completed?.[0]?.count || 0 }
    };

    // ---------- TELEMETRY ----------
    const Positions = mongoose.connection.db.collection('positions');
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const [recentPositions, latestPosition] = await Promise.all([
      Positions.countDocuments({ 'metadata.orgId': orgId, ts: { $gte: lastHour.toISOString?.() || lastHour } }),
      Positions.find({ 'metadata.orgId': orgId }).project({ ts: 1 }).sort({ ts: -1 }).limit(1).toArray()
    ]);
    const telemetry = {
      lastSeenCount: recentPositions,
      lastIngestAt: latestPosition?.[0]?.ts || null
    };

    // ---------- ALERTS ----------
    // Speeding: positions with speedKph > 80 in last 3h (tweak threshold)
    const since3h = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const speeding = await Positions
      .find({
        'metadata.orgId': orgId,
        ts: { $gte: since3h.toISOString?.() || since3h },
        speedKph: { $gt: 80 }
      })
      .project({ ts: 1, 'metadata.vehicleId': 1, speedKph: 1 })
      .sort({ ts: -1 })
      .limit(3)
      .toArray();

    // Maintenance due: vehicles in maintenance (sample 3)
    const maintDue = await Vehicle.find({ orgId, status: 'maintenance' })
      .select({ name: 1, plate: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean();

    const alerts = {
      critical: speeding.length, // simple proxy for MVP
      recent: [
        ...speeding.map(s => ({
          type: 'speeding',
          severity: 'high',
          vehicleId: s?.metadata?.vehicleId || null,
          speedKph: s?.speedKph || null,
          ts: s?.ts || null
        })),
        ...maintDue.map(m => ({
          type: 'maintenance_due',
          severity: 'medium',
          vehicleName: m.name,
          plate: m.plate,
          ts: m.updatedAt
        }))
      ]
    };

    // ---------- KPIs ----------
    // Active drivers: count distinct vehicleIds seen in last hour (proxy)
    const activeVehiclesDistinct = await Positions.distinct('metadata.vehicleId', {
      'metadata.orgId': orgId,
      ts: { $gte: lastHour.toISOString?.() || lastHour }
    });
    const activeDrivers = Array.isArray(activeVehiclesDistinct) ? activeVehiclesDistinct.length : 0;

    // Fleet utilization: active vehicles / total
    const fleetUtilizationPct = vehicles.total ? Math.round((vehicles.active / vehicles.total) * 100) : null;

    // Fuel efficiency (if you have trips with distanceKm & fuelLiters)
    let fuelEfficiency = null;
    if (Trip) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const t = await Trip.aggregate([
        { $match: { orgId, startAt: { $gte: weekAgo } } },
        { $group: { _id: null, dist: { $sum: '$distanceKm' }, fuel: { $sum: '$fuelLiters' } } }
      ]);
      const dist = t?.[0]?.dist || 0;
      const fuel = t?.[0]?.fuel || 0;
      fuelEfficiency = fuel > 0 ? +( (fuel / (dist || 1)) * 100 ).toFixed(1) : null; // L/100km
    }

    const kpis = {
      fuelEfficiency,
      onTimeDeliveryPct,
      activeDrivers,
      fleetUtilizationPct
    };

    res.json({ vehicles, jobs, telemetry, alerts, kpis });
  } catch (err) {
    next(err);
  }
});

export default r;

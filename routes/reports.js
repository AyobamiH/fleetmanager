// routes/reports.js
import { Router } from 'express';
import { Parser as Json2CsvParser } from 'json2csv';
import { auth, requireOrg } from '../middleware/auth.js';
import Trip from '../models/Trip.js';
import Job from '../models/Job.js';
import Vehicle from '../models/Vehicle.js';

const r = Router();

/**
 * GET /api/orgs/:orgId/reports/summary
 * Adds a couple of trip KPIs on top of vehicles/jobs so the Reports page
 * can show real numbers even before advanced analytics exist.
 */
r.get('/orgs/:orgId/reports/summary', auth, requireOrg, async (req, res) => {
  const orgId = req.params.orgId;

  // Vehicles by status
  const vehAgg = await Vehicle.aggregate([
    { $match: { orgId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Jobs by status
  const jobAgg = await Job.aggregate([
    { $match: { orgId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Trips quick rollup
  const tripAgg = await Trip.aggregate([
    { $match: { orgId } },
    {
      $group: {
        _id: null,
        trips:    { $sum: 1 },
        km:       { $sum: { $ifNull: ['$distanceKm', 0] } },
        minutes:  { $sum: { $ifNull: ['$durationMin', 0] } },
      }
    }
  ]);
  const t = tripAgg[0] || { trips:0, km:0, minutes:0 };

  res.json({
    vehiclesByStatus: Object.fromEntries(vehAgg.map(v => [v._id || 'unknown', v.count])),
    jobsByStatus:     Object.fromEntries(jobAgg.map(j => [j._id || 'unknown', j.count])),
    tripsSummary:     { trips: t.trips, distanceKm: Number(t.km.toFixed(2)), durationMin: Math.round(t.minutes) }
  });
});

/**
 * GET /api/orgs/:orgId/reports/trips/csv
 * Mirrors trips export but namespaced under /reports
 */
r.get('/orgs/:orgId/reports/trips/csv', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to, limit = '5000', sort = 'desc' } = req.query;
  const q = { orgId: req.params.orgId };
  if (vehicleId) q.vehicleId = String(vehicleId);
  if (from || to) {
    q.startTs = {};
    if (from) q.startTs.$gte = String(from);
    if (to)   q.startTs.$lte = String(to);
  }

  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 5000, 1), 10000);
  const sortDir = sort === 'asc' ? 1 : -1;

  const rows = await Trip.find(q).sort({ startTs: sortDir }).limit(lim).lean();
  const fields = [
    '_id','vehicleId','startTs','endTs','durationMin',
    'distanceKm','avgSpeedKph','maxSpeedKph','idleMinutes','stopCount',
    'fuelUsedL','co2Kg'
  ];
  const parser = new Json2CsvParser({ fields, withBOM: true });
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="trips-report.csv"');
  res.send(csv);
});

export default r;

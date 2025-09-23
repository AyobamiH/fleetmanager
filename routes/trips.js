// routes/trips.js
import { Router } from 'express';
import { Parser as Json2CsvParser } from 'json2csv';
import Trip from '../models/Trip.js';
import { auth, requireOrg } from '../middleware/auth.js';

const r = Router();

/**
 * GET /api/orgs/:orgId/trips
 * Query: vehicleId, from, to, page=1, limit=20, sort=desc
 * Returns { trips, pagination }
 */
r.get('/orgs/:orgId/trips', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to, page = '1', limit = '20', sort = 'desc' } = req.query;

  const q = { orgId: req.params.orgId };
  if (vehicleId) q.vehicleId = String(vehicleId);
  if (from || to) {
    q.startTs = {};
    if (from) q.startTs.$gte = String(from);
    if (to)   q.startTs.$lte = String(to);
  }

  const pg  = Math.max(parseInt(String(page), 10)  || 1, 1);
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 1000);
  const sortDir = sort === 'asc' ? 1 : -1;

  const [rows, total] = await Promise.all([
    Trip.find(q).sort({ startTs: sortDir }).skip((pg - 1) * lim).limit(lim).lean(),
    Trip.countDocuments(q),
  ]);

  res.json({
    trips: rows,
    pagination: {
      page: pg, limit: lim, total,
      totalPages: Math.max(Math.ceil(total / lim), 1),
      hasNext: pg * lim < total,
      hasPrev: pg > 1,
    }
  });
});

/**
 * GET /api/orgs/:orgId/trips/:id
 * Returns a single trip (for details drawer)
 */
r.get('/orgs/:orgId/trips/:id', auth, requireOrg, async (req, res) => {
  const doc = await Trip.findOne({ orgId: req.params.orgId, _id: req.params.id }).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json({ trip: doc });
});

/**
 * GET /api/orgs/:orgId/trips/summary
 * Quick KPIs for the UI: distance, duration, count, avg speed, idling.
 * Query: vehicleId, from, to
 */
r.get('/orgs/:orgId/trips/summary', auth, requireOrg, async (req, res) => {
  const { vehicleId, from, to } = req.query;
  const match = { orgId: req.params.orgId };
  if (vehicleId) match.vehicleId = String(vehicleId);
  if (from || to) {
    match.startTs = {};
    if (from) match.startTs.$gte = String(from);
    if (to)   match.startTs.$lte = String(to);
  }

  const agg = await Trip.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        trips:         { $sum: 1 },
        totalKm:       { $sum: { $ifNull: ['$distanceKm', 0] } },
        totalMin:      { $sum: { $ifNull: ['$durationMin', 0] } },
        totalIdleMin:  { $sum: { $ifNull: ['$idleMinutes', 0] } },
        avgSpeed:      { $avg: { $ifNull: ['$avgSpeedKph', 0] } },
        maxSpeed:      { $max: { $ifNull: ['$maxSpeedKph', 0] } },
      }
    }
  ]);

  const s = agg[0] || { trips:0,totalKm:0,totalMin:0,totalIdleMin:0,avgSpeed:0,maxSpeed:0 };
  res.json({
    trips: s.trips,
    distanceKm: Number(s.totalKm.toFixed(2)),
    durationMin: Math.round(s.totalMin),
    idleMinutes: Math.round(s.totalIdleMin),
    avgSpeedKph: Number(s.avgSpeed.toFixed(1)),
    maxSpeedKph: Number(s.maxSpeed.toFixed(1)),
  });
});

/**
 * GET /api/orgs/:orgId/trips/export/csv
 * Query: vehicleId, from, to, limit=5000
 * Streams CSV for downloads.
 */
r.get('/orgs/:orgId/trips/export/csv', auth, requireOrg, async (req, res) => {
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
    'startLat','startLon','endLat','endLon','startAddress','endAddress',
    'fuelUsedL','co2Kg','harshAccel','harshBrake','overSpeedEvents'
  ];
  const parser = new Json2CsvParser({ fields, withBOM: true });
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="trips.csv"');
  res.send(csv);
});

export default r;
